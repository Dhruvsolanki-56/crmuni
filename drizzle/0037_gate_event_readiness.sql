CREATE TABLE `event_readiness_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`event_id` text NOT NULL,
	`version` integer NOT NULL,
	`config_version` integer NOT NULL,
	`status` text NOT NULL,
	`checks_json` text NOT NULL,
	`config_json` text NOT NULL,
	`config_hash` text NOT NULL,
	`assessed_by` text NOT NULL,
	`assessed_at` integer NOT NULL,
	`activated_by` text,
	`activated_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_event_readiness_version` ON `event_readiness_snapshots` (`workspace_id`,`event_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_event_readiness_latest` ON `event_readiness_snapshots` (`workspace_id`,`event_id`,`assessed_at`);--> statement-breakpoint
ALTER TABLE `events` ADD `config_version` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER event_readiness_snapshot_validate_insert BEFORE INSERT ON event_readiness_snapshots
BEGIN
  SELECT CASE WHEN NEW.version < 1 OR NEW.config_version < 1 THEN RAISE(ABORT, 'invalid event readiness version') END;
  SELECT CASE WHEN NEW.status NOT IN ('ready','blocked') THEN RAISE(ABORT, 'invalid event readiness status') END;
  SELECT CASE WHEN length(NEW.config_hash) != 64 THEN RAISE(ABORT, 'invalid event readiness hash') END;
  SELECT CASE WHEN json_valid(NEW.checks_json)!=1 OR json_type(NEW.checks_json)!='array' OR json_array_length(NEW.checks_json)!=10 OR json_valid(NEW.config_json)!=1 OR json_type(NEW.config_json)!='object' THEN RAISE(ABORT, 'invalid event readiness snapshot') END;
  SELECT CASE WHEN NEW.status='ready' AND EXISTS (SELECT 1 FROM json_each(NEW.checks_json) WHERE json_extract(value,'$.required') IS NOT 1 OR json_extract(value,'$.passed') IS NOT 1) THEN RAISE(ABORT, 'ready assessment contains failed checks') END;
  SELECT CASE WHEN NEW.status='blocked' AND NOT EXISTS (SELECT 1 FROM json_each(NEW.checks_json) WHERE json_extract(value,'$.passed') IS NOT 1) THEN RAISE(ABORT, 'blocked assessment has no failed checks') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id AND e.config_version=NEW.config_version) THEN RAISE(ABORT, 'event readiness scope or config mismatch') END;
  SELECT CASE WHEN (NEW.activated_by IS NULL) != (NEW.activated_at IS NULL) THEN RAISE(ABORT, 'event activation attribution incomplete') END;
  SELECT CASE WHEN NEW.activated_by IS NOT NULL AND NEW.status!='ready' THEN RAISE(ABORT, 'blocked event cannot be activated') END;
END;
--> statement-breakpoint
CREATE TRIGGER event_readiness_snapshot_validate_update BEFORE UPDATE ON event_readiness_snapshots
BEGIN
  SELECT CASE WHEN OLD.id!=NEW.id OR OLD.workspace_id!=NEW.workspace_id OR OLD.event_id!=NEW.event_id OR OLD.version!=NEW.version OR OLD.config_version!=NEW.config_version OR OLD.status!=NEW.status OR OLD.checks_json!=NEW.checks_json OR OLD.config_json!=NEW.config_json OR OLD.config_hash!=NEW.config_hash OR OLD.assessed_by!=NEW.assessed_by OR OLD.assessed_at!=NEW.assessed_at THEN RAISE(ABORT, 'event readiness assessment is immutable') END;
  SELECT CASE WHEN OLD.activated_at IS NOT NULL AND (NEW.activated_at!=OLD.activated_at OR NEW.activated_by!=OLD.activated_by) THEN RAISE(ABORT, 'event activation is immutable') END;
  SELECT CASE WHEN (NEW.activated_by IS NULL) != (NEW.activated_at IS NULL) THEN RAISE(ABORT, 'event activation attribution incomplete') END;
  SELECT CASE WHEN NEW.activated_by IS NOT NULL AND NEW.status!='ready' THEN RAISE(ABORT, 'blocked event cannot be activated') END;
END;
--> statement-breakpoint
CREATE TRIGGER event_status_validate_insert BEFORE INSERT ON events
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('draft','ready','active','archived') THEN RAISE(ABORT, 'invalid event status') END;
  SELECT CASE WHEN NEW.config_version < 1 THEN RAISE(ABORT, 'invalid event config version') END;
END;
--> statement-breakpoint
CREATE TRIGGER event_status_validate_update BEFORE UPDATE ON events
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('draft','ready','active','archived') THEN RAISE(ABORT, 'invalid event status') END;
  SELECT CASE WHEN OLD.status='archived' AND NEW.status!='archived' THEN RAISE(ABORT, 'archived event is final') END;
  SELECT CASE WHEN NEW.config_version < OLD.config_version THEN RAISE(ABORT, 'event config version cannot decrease') END;
  SELECT CASE WHEN NEW.config_version!=OLD.config_version AND NEW.status NOT IN ('draft','archived') THEN RAISE(ABORT, 'changed event config requires readiness assessment') END;
  SELECT CASE WHEN NEW.status IN ('ready','active') AND NOT EXISTS (SELECT 1 FROM event_readiness_snapshots r WHERE r.workspace_id=NEW.workspace_id AND r.event_id=NEW.id AND r.config_version=NEW.config_version AND r.status='ready' ORDER BY r.version DESC LIMIT 1) THEN RAISE(ABORT, 'event requires passing readiness assessment') END;
END;
