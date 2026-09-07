CREATE TABLE `company_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`storage_key` text,
	`status` text DEFAULT 'pending_upload' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_company_documents_workspace` ON `company_documents` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`stage` text DEFAULT 'qualified' NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'INR' NOT NULL,
	`probability` integer DEFAULT 20 NOT NULL,
	`expected_close_date` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_opportunities_workspace_stage` ON `opportunities` (`workspace_id`,`stage`);--> statement-breakpoint
CREATE INDEX `idx_opportunities_workspace_company` ON `opportunities` (`workspace_id`,`company`);