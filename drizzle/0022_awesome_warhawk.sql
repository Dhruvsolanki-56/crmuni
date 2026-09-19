CREATE TABLE `task_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`task_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text,
	`reminder_at` integer,
	`version` integer NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_task_history_task_created` ON `task_history` (`workspace_id`,`task_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_extraction_id` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `source_commitment_key` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `reminder_at` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_by` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `cancelled_by` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `cancelled_at` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `cancellation_reason` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_tasks_workspace_reminder` ON `tasks` (`workspace_id`,`status`,`reminder_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_tasks_source_commitment` ON `tasks` (`workspace_id`,`source_extraction_id`,`source_commitment_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_qualification_scores_extraction` ON `qualification_scores` (`extraction_id`);--> statement-breakpoint
CREATE TRIGGER `tasks_tenant_insert` BEFORE INSERT ON `tasks`
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('open','complete','cancelled') THEN RAISE(ABORT,'invalid task status') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM leads l WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'task lead workspace mismatch') END;
  SELECT CASE WHEN NEW.source_interaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.id=NEW.source_interaction_id AND i.workspace_id=NEW.workspace_id AND i.lead_id=NEW.lead_id) THEN RAISE(ABORT,'task interaction scope mismatch') END;
  SELECT CASE WHEN NEW.source_extraction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_extractions a WHERE a.id=NEW.source_extraction_id AND a.workspace_id=NEW.workspace_id AND a.lead_id=NEW.lead_id) THEN RAISE(ABORT,'task extraction scope mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `tasks_tenant_update` BEFORE UPDATE OF workspace_id,lead_id,source_interaction_id,source_extraction_id,status,version ON `tasks`
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('open','complete','cancelled') THEN RAISE(ABORT,'invalid task status') END;
  SELECT CASE WHEN NEW.version < 1 THEN RAISE(ABORT,'invalid task version') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM leads l WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'task lead workspace mismatch') END;
  SELECT CASE WHEN NEW.source_interaction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM interactions i WHERE i.id=NEW.source_interaction_id AND i.workspace_id=NEW.workspace_id AND i.lead_id=NEW.lead_id) THEN RAISE(ABORT,'task interaction scope mismatch') END;
  SELECT CASE WHEN NEW.source_extraction_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ai_extractions a WHERE a.id=NEW.source_extraction_id AND a.workspace_id=NEW.workspace_id AND a.lead_id=NEW.lead_id) THEN RAISE(ABORT,'task extraction scope mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `task_history_tenant_insert` BEFORE INSERT ON `task_history`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id=NEW.task_id AND t.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'task history workspace mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `task_history_tenant_update` BEFORE UPDATE OF workspace_id,task_id ON `task_history`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM tasks t WHERE t.id=NEW.task_id AND t.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'task history workspace mismatch') END;
END;
