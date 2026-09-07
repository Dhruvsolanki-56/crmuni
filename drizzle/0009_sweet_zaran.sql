CREATE TABLE `communication_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`extraction_id` text,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`model` text NOT NULL,
	`created_by` text NOT NULL,
	`approved_by` text,
	`created_at` integer NOT NULL,
	`approved_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`extraction_id`) REFERENCES `ai_extractions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_communication_drafts_lead` ON `communication_drafts` (`workspace_id`,`lead_id`,`created_at`);