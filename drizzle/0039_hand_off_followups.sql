ALTER TABLE `communication_drafts` ADD `handed_off_at` integer;
--> statement-breakpoint
CREATE TRIGGER communication_draft_status_validate_insert BEFORE INSERT ON communication_drafts
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('draft','approved','handed_off') THEN RAISE(ABORT, 'invalid communication draft status') END;
  SELECT CASE WHEN NEW.status='handed_off' AND NEW.handed_off_at IS NULL THEN RAISE(ABORT, 'handed off draft requires handed_off_at') END;
  SELECT CASE WHEN NEW.status IN ('approved','handed_off') AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN RAISE(ABORT, 'approved draft requires approval attribution') END;
END;
--> statement-breakpoint
CREATE TRIGGER communication_draft_status_validate_update BEFORE UPDATE ON communication_drafts
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('draft','approved','handed_off') THEN RAISE(ABORT, 'invalid communication draft status') END;
  SELECT CASE WHEN NEW.status='handed_off' AND NEW.handed_off_at IS NULL THEN RAISE(ABORT, 'handed off draft requires handed_off_at') END;
  SELECT CASE WHEN NEW.status IN ('approved','handed_off') AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN RAISE(ABORT, 'approved draft requires approval attribution') END;
  SELECT CASE WHEN OLD.status!=NEW.status AND NOT (
    (OLD.status='draft' AND NEW.status='approved') OR
    (OLD.status='approved' AND NEW.status IN ('handed_off','draft')) OR
    (OLD.status='handed_off' AND NEW.status='draft')
  ) THEN RAISE(ABORT, 'invalid communication draft transition') END;
END;
