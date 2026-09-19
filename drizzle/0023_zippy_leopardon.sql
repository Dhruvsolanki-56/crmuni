CREATE TABLE `meeting_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`meeting_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`reason` text,
	`version` integer NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_meeting_history_meeting` ON `meeting_history` (`workspace_id`,`meeting_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `meeting_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`meeting_id` text NOT NULL,
	`lead_id` text,
	`name` text,
	`email` text NOT NULL,
	`participant_type` text DEFAULT 'external' NOT NULL,
	`response_status` text DEFAULT 'needs_action' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`meeting_id`) REFERENCES `meetings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_meeting_participants_email` ON `meeting_participants` (`meeting_id`,`email`);--> statement-breakpoint
CREATE INDEX `idx_meeting_participants_meeting` ON `meeting_participants` (`workspace_id`,`meeting_id`);--> statement-breakpoint
CREATE TABLE `meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`event_id` text NOT NULL,
	`lead_id` text,
	`opportunity_id` text,
	`organizer_id` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`timezone` text NOT NULL,
	`location` text,
	`agenda` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`cancellation_reason` text,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_meetings_workspace_event_start` ON `meetings` (`workspace_id`,`event_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `idx_meetings_workspace_status_start` ON `meetings` (`workspace_id`,`status`,`starts_at`);--> statement-breakpoint
CREATE TRIGGER `meetings_scope_insert` BEFORE INSERT ON `meetings`
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('scheduled','complete','cancelled') THEN RAISE(ABORT,'invalid meeting status') END;
  SELECT CASE WHEN NEW.version < 1 OR NEW.ends_at <= NEW.starts_at OR NEW.ends_at-NEW.starts_at > 86400000 THEN RAISE(ABORT,'invalid meeting schedule') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'meeting event workspace mismatch') END;
  SELECT CASE WHEN NEW.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id AND l.event_id=NEW.event_id) THEN RAISE(ABORT,'meeting lead scope mismatch') END;
  SELECT CASE WHEN NEW.opportunity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id=NEW.opportunity_id AND o.workspace_id=NEW.workspace_id AND o.event_id=NEW.event_id) THEN RAISE(ABORT,'meeting opportunity scope mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `meetings_scope_update` BEFORE UPDATE OF workspace_id,event_id,lead_id,opportunity_id,status,starts_at,ends_at,version ON `meetings`
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('scheduled','complete','cancelled') THEN RAISE(ABORT,'invalid meeting status') END;
  SELECT CASE WHEN NEW.version < 1 OR NEW.ends_at <= NEW.starts_at OR NEW.ends_at-NEW.starts_at > 86400000 THEN RAISE(ABORT,'invalid meeting schedule') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'meeting event workspace mismatch') END;
  SELECT CASE WHEN NEW.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads l WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id AND l.event_id=NEW.event_id) THEN RAISE(ABORT,'meeting lead scope mismatch') END;
  SELECT CASE WHEN NEW.opportunity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id=NEW.opportunity_id AND o.workspace_id=NEW.workspace_id AND o.event_id=NEW.event_id) THEN RAISE(ABORT,'meeting opportunity scope mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `meeting_participants_scope_insert` BEFORE INSERT ON `meeting_participants`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM meetings m WHERE m.id=NEW.meeting_id AND m.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'meeting participant workspace mismatch') END;
  SELECT CASE WHEN NEW.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads l JOIN meetings m ON m.id=NEW.meeting_id WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id AND l.event_id=m.event_id AND m.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'meeting participant lead scope mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `meeting_participants_scope_update` BEFORE UPDATE OF workspace_id,meeting_id,lead_id ON `meeting_participants`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM meetings m WHERE m.id=NEW.meeting_id AND m.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'meeting participant workspace mismatch') END;
  SELECT CASE WHEN NEW.lead_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM leads l JOIN meetings m ON m.id=NEW.meeting_id WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id AND l.event_id=m.event_id AND m.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'meeting participant lead scope mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `meeting_history_scope_insert` BEFORE INSERT ON `meeting_history`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM meetings m WHERE m.id=NEW.meeting_id AND m.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'meeting history workspace mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `meeting_history_scope_update` BEFORE UPDATE OF workspace_id,meeting_id ON `meeting_history`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM meetings m WHERE m.id=NEW.meeting_id AND m.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'meeting history workspace mismatch') END;
END;
