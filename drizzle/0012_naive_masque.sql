ALTER TABLE `opportunities` ADD `event_id` text;
--> statement-breakpoint
UPDATE `opportunities` SET `event_id` = (SELECT `event_id` FROM `leads` WHERE `leads`.`id` = `opportunities`.`lead_id`) WHERE `lead_id` IS NOT NULL;
