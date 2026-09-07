CREATE TABLE `lead_capture_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`kind` text NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`processing_status` text DEFAULT 'stored' NOT NULL,
	`extracted_json` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lead_capture_assets_lead` ON `lead_capture_assets` (`workspace_id`,`lead_id`);--> statement-breakpoint
ALTER TABLE `leads` ADD `client_capture_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_leads_workspace_client_capture` ON `leads` (`workspace_id`,`client_capture_id`);