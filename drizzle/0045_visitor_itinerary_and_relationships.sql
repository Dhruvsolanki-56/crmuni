CREATE TABLE `visitor_itinerary_items` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`event_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'manual' NOT NULL,
	`starts_at` integer,
	`notes` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`visited_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_visitor_itinerary_event` ON `visitor_itinerary_items` (`workspace_id`,`event_id`,`starts_at`);
--> statement-breakpoint
CREATE TRIGGER visitor_itinerary_validate_insert BEFORE INSERT ON visitor_itinerary_items
BEGIN
  SELECT CASE WHEN NEW.kind NOT IN ('exhibitor_visit','session','manual') THEN RAISE(ABORT, 'invalid itinerary kind') END;
  SELECT CASE WHEN NEW.status NOT IN ('planned','in_progress','visited','skipped','cancelled') THEN RAISE(ABORT, 'invalid itinerary status') END;
END;
--> statement-breakpoint
CREATE TRIGGER visitor_itinerary_validate_update BEFORE UPDATE ON visitor_itinerary_items
BEGIN
  SELECT CASE WHEN NEW.kind NOT IN ('exhibitor_visit','session','manual') THEN RAISE(ABORT, 'invalid itinerary kind') END;
  SELECT CASE WHEN NEW.status NOT IN ('planned','in_progress','visited','skipped','cancelled') THEN RAISE(ABORT, 'invalid itinerary status') END;
END;
--> statement-breakpoint
ALTER TABLE `leads` ADD `relationship_status` text DEFAULT 'active' NOT NULL;
--> statement-breakpoint
CREATE TRIGGER lead_relationship_status_validate_insert BEFORE INSERT ON leads
BEGIN
  SELECT CASE WHEN NEW.relationship_status NOT IN ('active','archived') THEN RAISE(ABORT, 'invalid relationship status') END;
END;
--> statement-breakpoint
CREATE TRIGGER lead_relationship_status_validate_update BEFORE UPDATE ON leads
BEGIN
  SELECT CASE WHEN NEW.relationship_status NOT IN ('active','archived') THEN RAISE(ABORT, 'invalid relationship status') END;
END;
