ALTER TABLE `workspaces` ADD `kind` text DEFAULT 'exhibitor' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_workspaces_visitor_owner` ON `workspaces` (`created_by`) WHERE `kind`='visitor';
--> statement-breakpoint
CREATE TRIGGER workspace_kind_validate_insert BEFORE INSERT ON workspaces
BEGIN
  SELECT CASE WHEN NEW.kind NOT IN ('exhibitor','visitor') THEN RAISE(ABORT, 'invalid workspace kind') END;
END;
--> statement-breakpoint
CREATE TRIGGER workspace_kind_validate_update BEFORE UPDATE ON workspaces
BEGIN
  SELECT CASE WHEN NEW.kind NOT IN ('exhibitor','visitor') THEN RAISE(ABORT, 'invalid workspace kind') END;
  SELECT CASE WHEN OLD.kind!=NEW.kind THEN RAISE(ABORT, 'workspace kind cannot change after creation') END;
END;
