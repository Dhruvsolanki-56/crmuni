CREATE TABLE `lead_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`purpose` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`captured_at` integer,
	`withdrawn_at` integer,
	`updated_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_lead_consents_scope` ON `lead_consents` (`workspace_id`,`lead_id`,`purpose`,`channel`);--> statement-breakpoint
CREATE INDEX `idx_lead_consents_status` ON `lead_consents` (`workspace_id`,`channel`,`status`);--> statement-breakpoint
CREATE TABLE `suppression_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`channel` text NOT NULL,
	`identifier_hash` text NOT NULL,
	`reason` text NOT NULL,
	`source_lead_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_suppression_workspace_channel_identifier` ON `suppression_entries` (`workspace_id`,`channel`,`identifier_hash`);--> statement-breakpoint
CREATE INDEX `idx_suppression_workspace_status` ON `suppression_entries` (`workspace_id`,`status`);