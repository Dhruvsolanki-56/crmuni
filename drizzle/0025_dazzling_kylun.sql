CREATE TABLE `opportunity_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`contact_role` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_opportunity_contacts_lead` ON `opportunity_contacts` (`workspace_id`,`opportunity_id`,`lead_id`);--> statement-breakpoint
CREATE INDEX `idx_opportunity_contacts_opportunity` ON `opportunity_contacts` (`workspace_id`,`opportunity_id`);--> statement-breakpoint
CREATE TABLE `opportunity_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`opportunity_id` text NOT NULL,
	`change_type` text NOT NULL,
	`from_stage` text,
	`to_stage` text,
	`from_value` integer,
	`to_value` integer,
	`reason` text,
	`mutation_token` text NOT NULL,
	`changed_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_opportunity_history_mutation` ON `opportunity_history` (`workspace_id`,`mutation_token`);--> statement-breakpoint
CREATE INDEX `idx_opportunity_history_opportunity` ON `opportunity_history` (`workspace_id`,`opportunity_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `opportunities` ADD `loss_reason` text;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `closed_at` integer;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `opportunities` ADD `mutation_token` text;
--> statement-breakpoint
UPDATE opportunities SET mutation_token=lower(hex(randomblob(16))) WHERE mutation_token IS NULL;
--> statement-breakpoint
INSERT INTO opportunity_contacts (id,workspace_id,opportunity_id,lead_id,contact_role,is_primary,created_by,created_at)
SELECT lower(hex(randomblob(16))),o.workspace_id,o.id,o.lead_id,s.buying_role,1,'migration',o.created_at
FROM opportunities o LEFT JOIN account_stakeholders s ON s.workspace_id=o.workspace_id AND s.lead_id=o.lead_id
WHERE o.lead_id IS NOT NULL;
--> statement-breakpoint
INSERT INTO opportunity_history (id,workspace_id,opportunity_id,change_type,to_stage,to_value,reason,mutation_token,changed_by,created_at)
SELECT lower(hex(randomblob(16))),workspace_id,id,'imported',stage,value,'Existing opportunity imported into audited lifecycle',mutation_token,'migration',created_at FROM opportunities;
--> statement-breakpoint
CREATE TRIGGER opportunities_stage_insert BEFORE INSERT ON opportunities
WHEN NEW.stage NOT IN ('qualified','requirement','sample','rfq','quotation','meeting','negotiation','won','lost') OR (NEW.stage='lost' AND (NEW.loss_reason IS NULL OR trim(NEW.loss_reason)='')) OR (NEW.stage IN ('won','lost') AND NEW.closed_at IS NULL) OR (NEW.stage NOT IN ('won','lost') AND NEW.closed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'invalid opportunity lifecycle'); END;
--> statement-breakpoint
CREATE TRIGGER opportunities_stage_update BEFORE UPDATE OF stage,loss_reason,closed_at ON opportunities
WHEN NEW.stage NOT IN ('qualified','requirement','sample','rfq','quotation','meeting','negotiation','won','lost') OR (NEW.stage='lost' AND (NEW.loss_reason IS NULL OR trim(NEW.loss_reason)='')) OR (NEW.stage IN ('won','lost') AND NEW.closed_at IS NULL) OR (NEW.stage NOT IN ('won','lost') AND NEW.closed_at IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'invalid opportunity lifecycle'); END;
--> statement-breakpoint
CREATE TRIGGER opportunity_contacts_scope_insert BEFORE INSERT ON opportunity_contacts
WHEN NOT EXISTS (
  SELECT 1 FROM opportunities o JOIN leads l ON l.id=NEW.lead_id
  WHERE o.id=NEW.opportunity_id AND o.workspace_id=NEW.workspace_id AND l.workspace_id=NEW.workspace_id
    AND l.event_id=o.event_id AND l.review_status!='merged' AND (o.account_id IS NULL OR l.account_id=o.account_id)
)
BEGIN SELECT RAISE(ABORT,'opportunity contact scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER opportunity_contacts_scope_update BEFORE UPDATE OF workspace_id,opportunity_id,lead_id ON opportunity_contacts
WHEN NOT EXISTS (
  SELECT 1 FROM opportunities o JOIN leads l ON l.id=NEW.lead_id
  WHERE o.id=NEW.opportunity_id AND o.workspace_id=NEW.workspace_id AND l.workspace_id=NEW.workspace_id
    AND l.event_id=o.event_id AND l.review_status!='merged' AND (o.account_id IS NULL OR l.account_id=o.account_id)
)
BEGIN SELECT RAISE(ABORT,'opportunity contact scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER opportunity_history_scope_insert BEFORE INSERT ON opportunity_history
WHEN NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id=NEW.opportunity_id AND o.workspace_id=NEW.workspace_id AND o.mutation_token=NEW.mutation_token)
BEGIN SELECT RAISE(ABORT,'opportunity history scope mismatch'); END;
