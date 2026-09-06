CREATE TABLE `ai_extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`interaction_id` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`model` text NOT NULL,
	`prompt_version` text NOT NULL,
	`result_json` text,
	`error_code` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`confirmed_at` integer,
	`confirmed_by` text,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ai_extractions_lead_created` ON `ai_extractions` (`workspace_id`,`lead_id`,`created_at`);