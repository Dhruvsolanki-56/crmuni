CREATE TABLE `rfq_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rfq_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`note` text,
	`version` integer NOT NULL,
	`mutation_token` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_rfq_history_mutation` ON `rfq_history` (`workspace_id`,`mutation_token`);--> statement-breakpoint
CREATE INDEX `idx_rfq_history_rfq` ON `rfq_history` (`workspace_id`,`rfq_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rfq_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rfq_id` text NOT NULL,
	`version` integer NOT NULL,
	`note` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`submitted_by` text NOT NULL,
	`submitted_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_rfq_submissions_version` ON `rfq_submissions` (`workspace_id`,`rfq_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_rfq_submissions_rfq` ON `rfq_submissions` (`workspace_id`,`rfq_id`,`submitted_at`);--> statement-breakpoint
ALTER TABLE `rfqs` ADD `owner_due_at` integer;--> statement-breakpoint
ALTER TABLE `rfqs` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `rfqs` ADD `mutation_token` text;
--> statement-breakpoint
UPDATE rfqs SET mutation_token=lower(hex(randomblob(16))),owner_due_at=created_at+(24*60*60*1000) WHERE mutation_token IS NULL;
--> statement-breakpoint
INSERT INTO rfq_history (id,workspace_id,rfq_id,action,to_status,note,version,mutation_token,actor_id,created_at)
SELECT lower(hex(randomblob(16))),workspace_id,id,'imported',status,'Existing RFQ imported into audited lifecycle',version,mutation_token,'migration',created_at FROM rfqs;
--> statement-breakpoint
CREATE TRIGGER rfqs_status_insert BEFORE INSERT ON rfqs WHEN NEW.status NOT IN ('received','reviewing','clarification','ready_to_quote','quoted','won','lost')
BEGIN SELECT RAISE(ABORT,'invalid RFQ status'); END;
--> statement-breakpoint
CREATE TRIGGER rfqs_status_update BEFORE UPDATE OF status ON rfqs WHEN NEW.status NOT IN ('received','reviewing','clarification','ready_to_quote','quoted','won','lost')
BEGIN SELECT RAISE(ABORT,'invalid RFQ status'); END;
--> statement-breakpoint
CREATE TRIGGER rfq_history_scope_insert BEFORE INSERT ON rfq_history
WHEN NOT EXISTS (SELECT 1 FROM rfqs r WHERE r.id=NEW.rfq_id AND r.workspace_id=NEW.workspace_id AND r.mutation_token=NEW.mutation_token AND r.version=NEW.version)
BEGIN SELECT RAISE(ABORT,'RFQ history scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER rfq_submissions_scope_insert BEFORE INSERT ON rfq_submissions
WHEN NOT EXISTS (SELECT 1 FROM rfqs r WHERE r.id=NEW.rfq_id AND r.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'RFQ submission scope mismatch'); END;
