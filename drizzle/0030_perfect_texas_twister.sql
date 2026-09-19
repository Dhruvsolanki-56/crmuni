CREATE TABLE `background_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 5 NOT NULL,
	`available_at` integer NOT NULL,
	`locked_at` integer,
	`last_error` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_background_jobs_dedupe` ON `background_jobs` (`workspace_id`,`kind`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_background_jobs_due` ON `background_jobs` (`status`,`available_at`);--> statement-breakpoint
CREATE TABLE `in_app_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`recipient_user_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_in_app_notifications_dedupe` ON `in_app_notifications` (`workspace_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_in_app_notifications_unread` ON `in_app_notifications` (`workspace_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `job_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`claimed_count` integer DEFAULT 0 NOT NULL,
	`completed_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`dead_count` integer DEFAULT 0 NOT NULL,
	`error` text,
	`started_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_job_runs_started` ON `job_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `operational_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`severity` text NOT NULL,
	`code` text NOT NULL,
	`message` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`acknowledged_by` text,
	`acknowledged_at` integer,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_operational_alerts_dedupe` ON `operational_alerts` (`workspace_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_operational_alerts_status` ON `operational_alerts` (`workspace_id`,`status`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER background_jobs_validate_insert BEFORE INSERT ON background_jobs
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('queued','running','completed','failed','dead','canceled') THEN RAISE(ABORT, 'invalid background job status') END;
  SELECT CASE WHEN NEW.max_attempts < 1 OR NEW.max_attempts > 20 THEN RAISE(ABORT, 'invalid background job attempts') END;
END;
--> statement-breakpoint
CREATE TRIGGER background_jobs_validate_update BEFORE UPDATE ON background_jobs
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('queued','running','completed','failed','dead','canceled') THEN RAISE(ABORT, 'invalid background job status') END;
  SELECT CASE WHEN NEW.attempts < OLD.attempts AND NOT (NEW.status='queued' AND OLD.status IN ('completed','canceled','dead','failed')) THEN RAISE(ABORT, 'background job attempts cannot decrease') END;
END;
--> statement-breakpoint
CREATE TRIGGER operational_alerts_validate_insert BEFORE INSERT ON operational_alerts
BEGIN
  SELECT CASE WHEN NEW.severity NOT IN ('info','warning','critical') THEN RAISE(ABORT, 'invalid operational alert severity') END;
  SELECT CASE WHEN NEW.status NOT IN ('open','acknowledged','resolved') THEN RAISE(ABORT, 'invalid operational alert status') END;
END;
--> statement-breakpoint
INSERT INTO background_jobs (id,workspace_id,kind,entity_type,entity_id,dedupe_key,payload_json,status,attempts,max_attempts,available_at,created_at,updated_at)
SELECT lower(hex(randomblob(16))),workspace_id,'task_reminder','task',id,id,'{}','queued',0,5,reminder_at,created_at,updated_at
FROM tasks WHERE status='open' AND reminder_at IS NOT NULL;
--> statement-breakpoint
INSERT INTO background_jobs (id,workspace_id,kind,entity_type,entity_id,dedupe_key,payload_json,status,attempts,max_attempts,available_at,created_at,updated_at)
SELECT lower(hex(randomblob(16))),workspace_id,'workspace_deletion_due','workspace',workspace_id,workspace_id,'{}','queued',0,5,scheduled_for,created_at,updated_at
FROM workspace_deletion_requests WHERE status='scheduled';
