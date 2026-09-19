CREATE TABLE `lead_erasure_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`asset_keys_json` text DEFAULT '[]' NOT NULL,
	`requested_by` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lead_erasure_workspace_status` ON `lead_erasure_requests` (`workspace_id`,`status`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_lead_erasure_workspace_lead` ON `lead_erasure_requests` (`workspace_id`,`lead_id`);
--> statement-breakpoint
CREATE TRIGGER lead_erasure_validate_insert BEFORE INSERT ON lead_erasure_requests
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('queued','processing','failed','completed') THEN RAISE(ABORT, 'invalid lead erasure status') END;
  SELECT CASE WHEN NEW.attempts < 0 OR NEW.attempts > 20 THEN RAISE(ABORT, 'invalid lead erasure attempts') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM leads l WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id) THEN RAISE(ABORT, 'lead erasure workspace mismatch') END;
END;
--> statement-breakpoint
CREATE TRIGGER lead_erasure_validate_update BEFORE UPDATE ON lead_erasure_requests
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('queued','processing','failed','completed') THEN RAISE(ABORT, 'invalid lead erasure status') END;
  SELECT CASE WHEN NEW.attempts < OLD.attempts AND NOT (OLD.status='failed' AND NEW.status='queued') THEN RAISE(ABORT, 'lead erasure attempts cannot decrease') END;
  SELECT CASE WHEN OLD.status='completed' AND NEW.status!='completed' THEN RAISE(ABORT, 'completed lead erasure is final') END;
END;
