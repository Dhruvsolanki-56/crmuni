CREATE TABLE `quotations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rfq_id` text,
	`opportunity_id` text,
	`quote_number` text NOT NULL,
	`customer` text NOT NULL,
	`amount` integer DEFAULT 0 NOT NULL,
	`currency` text NOT NULL,
	`valid_until` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`original_name` text,
	`storage_key` text,
	`content_type` text,
	`size_bytes` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_quotations_workspace_number` ON `quotations` (`workspace_id`,`quote_number`);--> statement-breakpoint
CREATE INDEX `idx_quotations_workspace_status_valid` ON `quotations` (`workspace_id`,`status`,`valid_until`);