CREATE TABLE `company_profiles` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`legal_name` text NOT NULL,
	`website_url` text,
	`description` text,
	`target_industries_json` text DEFAULT '[]' NOT NULL,
	`target_geographies_json` text DEFAULT '[]' NOT NULL,
	`event_objective` text,
	`onboarding_step` integer DEFAULT 1 NOT NULL,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `ideal_customer_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`industries_json` text DEFAULT '[]' NOT NULL,
	`company_sizes_json` text DEFAULT '[]' NOT NULL,
	`geographies_json` text DEFAULT '[]' NOT NULL,
	`buyer_roles_json` text DEFAULT '[]' NOT NULL,
	`must_have_signals_json` text DEFAULT '[]' NOT NULL,
	`disqualifiers_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_icp_workspace` ON `ideal_customer_profiles` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `knowledge_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text,
	`storage_key` text,
	`content_type` text,
	`size_bytes` integer,
	`status` text DEFAULT 'stored' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_knowledge_sources_workspace` ON `knowledge_sources` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'product' NOT NULL,
	`description` text,
	`buyer_roles_json` text DEFAULT '[]' NOT NULL,
	`pain_points_json` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_products_workspace_status` ON `products` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `qualification_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`label` text NOT NULL,
	`field` text NOT NULL,
	`operator` text NOT NULL,
	`expected_value` text NOT NULL,
	`weight` integer DEFAULT 10 NOT NULL,
	`rule_type` text DEFAULT 'positive' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_qualification_rules_workspace` ON `qualification_rules` (`workspace_id`,`status`);