CREATE TABLE `lead_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`author_id` text NOT NULL,
	`body` text NOT NULL,
	`mentioned_user_ids_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lead_comments_lead` ON `lead_comments` (`workspace_id`,`lead_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER lead_comment_validate_insert BEFORE INSERT ON lead_comments
BEGIN
  SELECT CASE WHEN length(trim(NEW.body))=0 THEN RAISE(ABORT, 'comment body is required') END;
  SELECT CASE WHEN json_valid(NEW.mentioned_user_ids_json)!=1 OR json_type(NEW.mentioned_user_ids_json)!='array' THEN RAISE(ABORT, 'mentioned_user_ids_json must be a JSON array') END;
END;
