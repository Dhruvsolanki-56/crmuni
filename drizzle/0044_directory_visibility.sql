ALTER TABLE `events` ADD `directory_visibility` text DEFAULT 'private' NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_events_directory` ON `events` (`directory_visibility`,`status`);
--> statement-breakpoint
CREATE TRIGGER event_directory_visibility_validate_insert BEFORE INSERT ON events
BEGIN
  SELECT CASE WHEN NEW.directory_visibility NOT IN ('private','published') THEN RAISE(ABORT, 'invalid directory visibility') END;
END;
--> statement-breakpoint
CREATE TRIGGER event_directory_visibility_validate_update BEFORE UPDATE ON events
BEGIN
  SELECT CASE WHEN NEW.directory_visibility NOT IN ('private','published') THEN RAISE(ABORT, 'invalid directory visibility') END;
END;
