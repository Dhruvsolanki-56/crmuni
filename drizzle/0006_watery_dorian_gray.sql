CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`venue` text,
	`hall` text,
	`booth` text,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`timezone` text NOT NULL,
	`budget` integer DEFAULT 0 NOT NULL,
	`objective` text,
	`products_json` text DEFAULT '[]' NOT NULL,
	`target_accounts_json` text DEFAULT '[]' NOT NULL,
	`qualification_questions_json` text DEFAULT '[]' NOT NULL,
	`team_member_ids_json` text DEFAULT '[]' NOT NULL,
	`lead_routing_rule` text DEFAULT 'capturer' NOT NULL,
	`followup_sla_hours` integer DEFAULT 24 NOT NULL,
	`daily_lead_target` integer DEFAULT 25 NOT NULL,
	`badge_provider` text,
	`qr_campaign_code` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_events_workspace_status_dates` ON `events` (`workspace_id`,`status`,`starts_on`);