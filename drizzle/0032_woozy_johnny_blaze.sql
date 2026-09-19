CREATE TABLE `support_access_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`support_user_id` text NOT NULL,
	`support_email` text NOT NULL,
	`reason` text NOT NULL,
	`ticket_reference` text,
	`status` text DEFAULT 'active' NOT NULL,
	`granted_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`last_access_at` integer,
	`revoked_by` text,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_support_grants_user_status` ON `support_access_grants` (`support_user_id`,`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_support_grants_workspace_status` ON `support_access_grants` (`workspace_id`,`status`,`expires_at`);
--> statement-breakpoint
CREATE TRIGGER support_access_validate_insert BEFORE INSERT ON support_access_grants
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('active','revoked','expired') THEN RAISE(ABORT, 'invalid support grant status') END;
  SELECT CASE WHEN NEW.expires_at <= NEW.created_at THEN RAISE(ABORT, 'support grant must expire in the future') END;
  SELECT CASE WHEN NEW.status='active' AND EXISTS (
    SELECT 1 FROM support_access_grants g
    WHERE g.workspace_id=NEW.workspace_id AND g.support_user_id=NEW.support_user_id
      AND g.status='active' AND g.expires_at>NEW.created_at
  ) THEN RAISE(ABORT, 'active support grant already exists') END;
END;
--> statement-breakpoint
CREATE TRIGGER support_access_validate_update BEFORE UPDATE ON support_access_grants
BEGIN
  SELECT CASE WHEN NEW.status NOT IN ('active','revoked','expired') THEN RAISE(ABORT, 'invalid support grant status') END;
  SELECT CASE WHEN OLD.status='revoked' AND NEW.status!='revoked' THEN RAISE(ABORT, 'revoked support grant is final') END;
END;
