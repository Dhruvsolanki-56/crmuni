CREATE TABLE `quotation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`quotation_id` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`note` text,
	`version` integer NOT NULL,
	`mutation_token` text NOT NULL,
	`actor_id` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_quotation_history_mutation` ON `quotation_history` (`workspace_id`,`mutation_token`);--> statement-breakpoint
CREATE INDEX `idx_quotation_history_quote` ON `quotation_history` (`workspace_id`,`quotation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `quotation_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`quotation_id` text NOT NULL,
	`version` integer NOT NULL,
	`amount` integer NOT NULL,
	`valid_until` text,
	`note` text,
	`original_name` text,
	`storage_key` text,
	`content_type` text,
	`size_bytes` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_quotation_revisions_version` ON `quotation_revisions` (`workspace_id`,`quotation_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_quotation_revisions_quote` ON `quotation_revisions` (`workspace_id`,`quotation_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `quotations` ADD `version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `quotations` ADD `approved_by` text;--> statement-breakpoint
ALTER TABLE `quotations` ADD `approved_at` integer;--> statement-breakpoint
ALTER TABLE `quotations` ADD `sent_at` integer;--> statement-breakpoint
ALTER TABLE `quotations` ADD `mutation_token` text;
--> statement-breakpoint
UPDATE quotations SET mutation_token=lower(hex(randomblob(16))),approved_by=CASE WHEN status IN ('approved','sent','accepted','rejected','expired') THEN 'migration' ELSE NULL END,approved_at=CASE WHEN status IN ('approved','sent','accepted','rejected','expired') THEN created_at ELSE NULL END,sent_at=CASE WHEN status IN ('sent','accepted','rejected') THEN created_at ELSE NULL END WHERE mutation_token IS NULL;
--> statement-breakpoint
INSERT INTO quotation_revisions (id,workspace_id,quotation_id,version,amount,valid_until,note,original_name,storage_key,content_type,size_bytes,created_by,created_at)
SELECT lower(hex(randomblob(16))),workspace_id,id,1,amount,valid_until,'Existing quotation imported as version 1',original_name,storage_key,content_type,size_bytes,created_by,created_at FROM quotations;
--> statement-breakpoint
INSERT INTO quotation_history (id,workspace_id,quotation_id,action,to_status,note,version,mutation_token,actor_id,created_at)
SELECT lower(hex(randomblob(16))),workspace_id,id,'imported',status,'Existing quotation imported into audited lifecycle',version,mutation_token,'migration',created_at FROM quotations;
--> statement-breakpoint
CREATE TRIGGER quotations_status_insert BEFORE INSERT ON quotations
WHEN NEW.status NOT IN ('draft','approved','sent','accepted','rejected','expired') OR (NEW.status IN ('approved','sent','accepted','rejected','expired') AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL)) OR (NEW.status IN ('sent','accepted','rejected') AND NEW.sent_at IS NULL)
BEGIN SELECT RAISE(ABORT,'invalid quotation lifecycle'); END;
--> statement-breakpoint
CREATE TRIGGER quotations_status_update BEFORE UPDATE OF status,approved_by,approved_at,sent_at ON quotations
WHEN NEW.status NOT IN ('draft','approved','sent','accepted','rejected','expired') OR (NEW.status IN ('approved','sent','accepted','rejected','expired') AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL)) OR (NEW.status IN ('sent','accepted','rejected') AND NEW.sent_at IS NULL) OR (NEW.status='draft' AND (NEW.approved_by IS NOT NULL OR NEW.approved_at IS NOT NULL OR NEW.sent_at IS NOT NULL))
BEGIN SELECT RAISE(ABORT,'invalid quotation lifecycle'); END;
--> statement-breakpoint
CREATE TRIGGER quotation_history_scope_insert BEFORE INSERT ON quotation_history
WHEN NOT EXISTS (SELECT 1 FROM quotations q WHERE q.id=NEW.quotation_id AND q.workspace_id=NEW.workspace_id AND q.version=NEW.version AND q.mutation_token=NEW.mutation_token)
BEGIN SELECT RAISE(ABORT,'quotation history scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER quotation_revisions_scope_insert BEFORE INSERT ON quotation_revisions
WHEN NOT EXISTS (SELECT 1 FROM quotations q WHERE q.id=NEW.quotation_id AND q.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'quotation revision scope mismatch'); END;
