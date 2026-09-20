ALTER TABLE `lead_capture_assets` ADD `accepted_fields_json` text;--> statement-breakpoint
ALTER TABLE `lead_capture_assets` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `lead_capture_assets` ADD `reviewed_at` integer;
--> statement-breakpoint
UPDATE lead_capture_assets SET processing_status='completed_pending_review' WHERE processing_status='completed';
--> statement-breakpoint
CREATE TRIGGER lead_capture_review_validate_insert BEFORE INSERT ON lead_capture_assets
BEGIN
  SELECT CASE WHEN NEW.processing_status NOT IN ('stored','stored_pending_extraction','processing','completed_pending_review','confirmed','failed') THEN RAISE(ABORT, 'invalid capture processing status') END;
  SELECT CASE WHEN NEW.processing_status='confirmed' AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL OR NEW.accepted_fields_json IS NULL) THEN RAISE(ABORT, 'confirmed capture requires review attribution') END;
END;
--> statement-breakpoint
CREATE TRIGGER lead_capture_review_validate_update BEFORE UPDATE ON lead_capture_assets
BEGIN
  SELECT CASE WHEN NEW.processing_status NOT IN ('stored','stored_pending_extraction','processing','completed_pending_review','confirmed','failed') THEN RAISE(ABORT, 'invalid capture processing status') END;
  SELECT CASE WHEN OLD.processing_status='confirmed' AND NEW.processing_status!='confirmed' THEN RAISE(ABORT, 'confirmed capture review is final') END;
  SELECT CASE WHEN OLD.processing_status!=NEW.processing_status AND NOT (
    (OLD.processing_status IN ('stored','stored_pending_extraction','failed') AND NEW.processing_status='processing') OR
    (OLD.processing_status='processing' AND NEW.processing_status IN ('completed_pending_review','failed')) OR
    (OLD.processing_status='completed_pending_review' AND NEW.processing_status='confirmed')
  ) THEN RAISE(ABORT, 'invalid capture processing transition') END;
  SELECT CASE WHEN NEW.processing_status='confirmed' AND (NEW.reviewed_by IS NULL OR NEW.reviewed_at IS NULL OR NEW.accepted_fields_json IS NULL) THEN RAISE(ABORT, 'confirmed capture requires review attribution') END;
  SELECT CASE WHEN NEW.accepted_fields_json IS NOT NULL AND (json_valid(NEW.accepted_fields_json)!=1 OR json_type(NEW.accepted_fields_json)!='array' OR EXISTS (SELECT 1 FROM json_each(NEW.accepted_fields_json) WHERE value NOT IN ('fullName','company','role','email','phone','transcript'))) THEN RAISE(ABORT, 'invalid accepted capture fields') END;
END;
