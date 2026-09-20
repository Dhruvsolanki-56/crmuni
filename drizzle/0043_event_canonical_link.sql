ALTER TABLE `events` ADD `canonical_event_id` text REFERENCES `events`(`id`);
--> statement-breakpoint
CREATE INDEX `idx_events_canonical` ON `events` (`canonical_event_id`);
