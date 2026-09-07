CREATE TABLE `account_stakeholders` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`buying_role` text NOT NULL,
	`influence_level` text DEFAULT 'unknown' NOT NULL,
	`notes` text,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_account_stakeholder_lead` ON `account_stakeholders` (`account_id`,`lead_id`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`domain` text,
	`industry` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_accounts_workspace_normalized` ON `accounts` (`workspace_id`,`normalized_name`);--> statement-breakpoint
ALTER TABLE `leads` ADD `account_id` text REFERENCES accounts(id);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `account_id` text REFERENCES accounts(id);