CREATE TABLE `rfq_ai_extractions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rfq_id` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`model` text NOT NULL,
	`result_json` text,
	`error_code` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	`confirmed_by` text,
	`confirmed_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rfq_ai_extractions_rfq` ON `rfq_ai_extractions` (`workspace_id`,`rfq_id`,`created_at`);