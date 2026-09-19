CREATE TABLE `lead_duplicate_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_lead_id` text NOT NULL,
	`target_lead_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`confidence_basis_points` integer NOT NULL,
	`reasons_json` text NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_lead_duplicate_pair` ON `lead_duplicate_suggestions` (`workspace_id`,`source_lead_id`,`target_lead_id`);--> statement-breakpoint
CREATE INDEX `idx_lead_duplicate_source_status` ON `lead_duplicate_suggestions` (`workspace_id`,`source_lead_id`,`status`);--> statement-breakpoint
CREATE TABLE `lead_merge_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_lead_id` text NOT NULL,
	`target_lead_id` text NOT NULL,
	`status` text DEFAULT 'merged' NOT NULL,
	`snapshot_json` text NOT NULL,
	`merged_by` text NOT NULL,
	`merged_at` integer NOT NULL,
	`reverted_by` text,
	`reverted_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lead_merge_source_status` ON `lead_merge_events` (`workspace_id`,`source_lead_id`,`status`);--> statement-breakpoint
ALTER TABLE `leads` ADD `merged_into_id` text;--> statement-breakpoint
CREATE TRIGGER `lead_duplicate_tenant_insert` BEFORE INSERT ON `lead_duplicate_suggestions`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM leads s JOIN leads t ON t.id=NEW.target_lead_id WHERE s.id=NEW.source_lead_id AND s.workspace_id=NEW.workspace_id AND t.workspace_id=NEW.workspace_id AND s.event_id=t.event_id) THEN RAISE(ABORT,'duplicate lead scope mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `lead_merge_tenant_insert` BEFORE INSERT ON `lead_merge_events`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM leads s JOIN leads t ON t.id=NEW.target_lead_id WHERE s.id=NEW.source_lead_id AND s.workspace_id=NEW.workspace_id AND t.workspace_id=NEW.workspace_id AND s.event_id=t.event_id) THEN RAISE(ABORT,'merge lead scope mismatch') END;
END;
