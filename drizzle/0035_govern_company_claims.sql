CREATE TABLE `approved_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`claim_text` text NOT NULL,
	`evidence_note` text,
	`source_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`retired_by` text,
	`retired_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_approved_claims_workspace_status` ON `approved_claims` (`workspace_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `company_profile_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`change_reason` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_company_profile_version` ON `company_profile_versions` (`workspace_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_company_profile_versions_created` ON `company_profile_versions` (`workspace_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER approved_claim_validate_insert BEFORE INSERT ON approved_claims
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('draft','approved','retired') THEN RAISE(ABORT, 'invalid claim status') END;
  SELECT CASE WHEN length(trim(NEW.claim_text)) < 5 THEN RAISE(ABORT, 'claim text is too short') END;
  SELECT CASE WHEN NEW.source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM knowledge_sources s WHERE s.id=NEW.source_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT, 'claim source workspace mismatch') END;
  SELECT CASE WHEN NEW.status='approved' AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN RAISE(ABORT, 'approved claim requires approval attribution') END;
END;
--> statement-breakpoint
CREATE TRIGGER approved_claim_validate_update BEFORE UPDATE ON approved_claims
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('draft','approved','retired') THEN RAISE(ABORT, 'invalid claim status') END;
  SELECT CASE WHEN OLD.status='retired' AND NEW.status!='retired' THEN RAISE(ABORT, 'retired claim is final') END;
  SELECT CASE WHEN OLD.status='approved' AND NEW.status='draft' THEN RAISE(ABORT, 'approved claim cannot return to draft') END;
  SELECT CASE WHEN NEW.status='approved' AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN RAISE(ABORT, 'approved claim requires approval attribution') END;
  SELECT CASE WHEN NEW.source_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM knowledge_sources s WHERE s.id=NEW.source_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT, 'claim source workspace mismatch') END;
END;
--> statement-breakpoint
INSERT INTO company_profile_versions (id,workspace_id,version,snapshot_json,change_reason,created_by,created_at)
SELECT lower(hex(randomblob(16))),workspace_id,1,json_object(
  'legalName',legal_name,
  'websiteUrl',website_url,
  'description',description,
  'targetIndustries',json(target_industries_json),
  'targetGeographies',json(target_geographies_json),
  'eventObjective',event_objective
),'Backfilled current profile',updated_by,updated_at
FROM company_profiles;
