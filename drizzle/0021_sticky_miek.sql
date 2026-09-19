ALTER TABLE `communication_drafts` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `communication_drafts` ADD `edited_by` text;--> statement-breakpoint
ALTER TABLE `communication_drafts` ADD `updated_at` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `communication_drafts` SET `updated_at`=`created_at` WHERE `updated_at`=0;
