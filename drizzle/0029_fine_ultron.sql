CREATE TABLE `event_cost_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`event_id` text NOT NULL,
	`cost_line_id` text NOT NULL,
	`action` text NOT NULL,
	`from_version` integer,
	`to_version` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`mutation_token` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cost_line_id`) REFERENCES `event_cost_lines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_event_cost_history_line` ON `event_cost_history` (`cost_line_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_event_cost_history_mutation` ON `event_cost_history` (`cost_line_id`,`mutation_token`);--> statement-breakpoint
CREATE TABLE `event_cost_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`event_id` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`vendor` text,
	`amount` integer NOT NULL,
	`status` text DEFAULT 'actual' NOT NULL,
	`incurred_on` text,
	`version` integer DEFAULT 1 NOT NULL,
	`mutation_token` text,
	`voided_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_event_cost_lines_event_status` ON `event_cost_lines` (`event_id`,`status`,`incurred_on`);--> statement-breakpoint
ALTER TABLE `events` ADD `attribution_window_days` integer DEFAULT 180 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `gross_margin_bps` integer DEFAULT 4000 NOT NULL;
--> statement-breakpoint
CREATE TRIGGER event_cost_lines_scope_insert BEFORE INSERT ON event_cost_lines
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT, 'event cost scope mismatch') END;
  SELECT CASE WHEN NEW.amount < 0 THEN RAISE(ABORT, 'event cost amount must be non-negative') END;
  SELECT CASE WHEN NEW.status NOT IN ('planned','actual','void') THEN RAISE(ABORT, 'invalid event cost status') END;
END;
--> statement-breakpoint
CREATE TRIGGER event_cost_lines_scope_update BEFORE UPDATE ON event_cost_lines
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id
  ) THEN RAISE(ABORT, 'event cost scope mismatch') END;
  SELECT CASE WHEN NEW.amount < 0 THEN RAISE(ABORT, 'event cost amount must be non-negative') END;
  SELECT CASE WHEN NEW.status NOT IN ('planned','actual','void') THEN RAISE(ABORT, 'invalid event cost status') END;
END;
--> statement-breakpoint
CREATE TRIGGER event_cost_history_scope_insert BEFORE INSERT ON event_cost_history
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM event_cost_lines c
    WHERE c.id=NEW.cost_line_id AND c.event_id=NEW.event_id AND c.workspace_id=NEW.workspace_id
      AND c.mutation_token=NEW.mutation_token
  ) THEN RAISE(ABORT, 'event cost history scope mismatch') END;
END;
