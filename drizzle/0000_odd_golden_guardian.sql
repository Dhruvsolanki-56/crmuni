CREATE TABLE `interactions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`note` text NOT NULL,
	`source` text DEFAULT 'typed_note' NOT NULL,
	`occurred_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_interactions_lead` ON `interactions` (`workspace_id`,`lead_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`event_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`full_name` text NOT NULL,
	`company` text NOT NULL,
	`role` text,
	`email` text,
	`phone` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`review_status` text DEFAULT 'needs_review' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_leads_workspace_created` ON `leads` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_leads_workspace_company` ON `leads` (`workspace_id`,`company`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text,
	`status` text DEFAULT 'open' NOT NULL,
	`source_interaction_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_interaction_id`) REFERENCES `interactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tasks_workspace_status_due` ON `tasks` (`workspace_id`,`status`,`due_date`);