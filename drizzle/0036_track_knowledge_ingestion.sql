CREATE TABLE `knowledge_ingestions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_id` text NOT NULL,
	`status` text DEFAULT 'ready_for_review' NOT NULL,
	`content_hash` text NOT NULL,
	`extraction_method` text NOT NULL,
	`extracted_text` text,
	`provenance_json` text NOT NULL,
	`attempts` integer DEFAULT 1 NOT NULL,
	`last_error` text,
	`review_note` text,
	`reviewed_by` text,
	`reviewed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `knowledge_sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_knowledge_ingestion_source` ON `knowledge_ingestions` (`workspace_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_ingestion_status` ON `knowledge_ingestions` (`workspace_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_knowledge_ingestion_hash` ON `knowledge_ingestions` (`workspace_id`,`content_hash`);
--> statement-breakpoint
CREATE TRIGGER knowledge_ingestion_validate_insert BEFORE INSERT ON knowledge_ingestions
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('ready_for_review','approved','rejected','failed','removed') THEN RAISE(ABORT, 'invalid knowledge ingestion status') END;
  SELECT CASE WHEN NEW.attempts < 1 OR NEW.attempts > 20 THEN RAISE(ABORT, 'invalid knowledge ingestion attempts') END;
  SELECT CASE WHEN length(NEW.content_hash)<8 OR length(NEW.extraction_method)<3 THEN RAISE(ABORT, 'invalid knowledge ingestion provenance') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM knowledge_sources s WHERE s.id=NEW.source_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT, 'knowledge source workspace mismatch') END;
  SELECT CASE WHEN NEW.status IN ('approved','rejected') AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) THEN RAISE(ABORT, 'knowledge review requires attribution') END;
END;
--> statement-breakpoint
CREATE TRIGGER knowledge_ingestion_validate_update BEFORE UPDATE ON knowledge_ingestions
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('ready_for_review','approved','rejected','failed','removed') THEN RAISE(ABORT, 'invalid knowledge ingestion status') END;
  SELECT CASE WHEN OLD.status='removed' AND NEW.status!='removed' THEN RAISE(ABORT, 'removed knowledge ingestion is final') END;
  SELECT CASE WHEN OLD.status!=NEW.status AND NOT (
    (OLD.status='ready_for_review' AND NEW.status IN ('approved','rejected','failed','removed')) OR
    (OLD.status='failed' AND NEW.status IN ('ready_for_review','removed')) OR
    (OLD.status IN ('approved','rejected') AND NEW.status='removed')
  ) THEN RAISE(ABORT, 'invalid knowledge ingestion transition') END;
  SELECT CASE WHEN NEW.attempts < OLD.attempts AND NOT (OLD.status='failed' AND NEW.status='ready_for_review') THEN RAISE(ABORT, 'knowledge ingestion attempts cannot decrease') END;
  SELECT CASE WHEN length(NEW.content_hash)<8 OR length(NEW.extraction_method)<3 THEN RAISE(ABORT, 'invalid knowledge ingestion provenance') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM knowledge_sources s WHERE s.id=NEW.source_id AND s.workspace_id=NEW.workspace_id) THEN RAISE(ABORT, 'knowledge source workspace mismatch') END;
  SELECT CASE WHEN NEW.status IN ('approved','rejected') AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL) THEN RAISE(ABORT, 'knowledge review requires attribution') END;
END;
--> statement-breakpoint
INSERT INTO knowledge_ingestions (id,workspace_id,source_id,status,content_hash,extraction_method,provenance_json,attempts,reviewed_by,reviewed_at,created_at,updated_at)
SELECT lower(hex(randomblob(16))),workspace_id,id,
  CASE WHEN status='approved' THEN 'approved' WHEN status='rejected' THEN 'rejected' WHEN status='removed' THEN 'removed' ELSE 'ready_for_review' END,
  'legacy:' || id,
  CASE WHEN source_type='website' THEN 'url_reference' ELSE 'legacy_original' END,
  json_object('sourceType',source_type,'backfilled',json('true')),
  1,
  CASE WHEN status IN ('approved','rejected') THEN 'migration' ELSE NULL END,
  CASE WHEN status IN ('approved','rejected') THEN created_at ELSE NULL END,
  created_at,created_at
FROM knowledge_sources;
