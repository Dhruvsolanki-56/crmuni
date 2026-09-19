CREATE TABLE `lead_assignment_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`previous_owner_id` text,
	`owner_id` text NOT NULL,
	`reason` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lead_assignment_history_lead` ON `lead_assignment_history` (`workspace_id`,`lead_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lead_qualification_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`state` text NOT NULL,
	`score` integer,
	`reason` text NOT NULL,
	`source` text NOT NULL,
	`previous_state` text,
	`changed_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_lead_qualification_history_lead` ON `lead_qualification_history` (`workspace_id`,`lead_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `leads` ADD `qualification_state` text DEFAULT 'unqualified' NOT NULL;--> statement-breakpoint
ALTER TABLE `leads` ADD `qualification_reason` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `qualification_updated_by` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `qualification_updated_at` integer;--> statement-breakpoint
INSERT INTO `lead_assignment_history` (`id`,`workspace_id`,`lead_id`,`previous_owner_id`,`owner_id`,`reason`,`changed_by`,`created_at`)
SELECT lower(hex(randomblob(16))),workspace_id,id,NULL,owner_id,'migration_backfill',owner_id,created_at FROM leads;--> statement-breakpoint
UPDATE leads SET qualification_state=CASE
  WHEN COALESCE((SELECT score FROM qualification_scores q WHERE q.lead_id=leads.id AND q.workspace_id=leads.workspace_id ORDER BY q.created_at DESC LIMIT 1),0)>=80 THEN 'hot'
  WHEN COALESCE((SELECT score FROM qualification_scores q WHERE q.lead_id=leads.id AND q.workspace_id=leads.workspace_id ORDER BY q.created_at DESC LIMIT 1),0)>=60 THEN 'warm'
  WHEN COALESCE((SELECT score FROM qualification_scores q WHERE q.lead_id=leads.id AND q.workspace_id=leads.workspace_id ORDER BY q.created_at DESC LIMIT 1),0)>=30 THEN 'cold'
  ELSE 'unqualified' END;--> statement-breakpoint
CREATE TRIGGER `lead_assignment_history_tenant_insert` BEFORE INSERT ON `lead_assignment_history`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM leads l WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'assignment lead workspace mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `lead_qualification_history_tenant_insert` BEFORE INSERT ON `lead_qualification_history`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM leads l WHERE l.id=NEW.lead_id AND l.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'qualification lead workspace mismatch') END;
END;
