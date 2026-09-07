CREATE TABLE `lead_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`extraction_id` text NOT NULL,
	`field_key` text NOT NULL,
	`label` text NOT NULL,
	`value` text NOT NULL,
	`confidence_basis_points` integer NOT NULL,
	`evidence` text NOT NULL,
	`confirmed_by` text NOT NULL,
	`confirmed_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`extraction_id`) REFERENCES `ai_extractions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_lead_facts_extraction_field` ON `lead_facts` (`extraction_id`,`field_key`);--> statement-breakpoint
CREATE TABLE `qualification_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`extraction_id` text NOT NULL,
	`score` integer NOT NULL,
	`rationale` text NOT NULL,
	`rule_results_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`extraction_id`) REFERENCES `ai_extractions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_qualification_scores_lead` ON `qualification_scores` (`workspace_id`,`lead_id`,`created_at`);