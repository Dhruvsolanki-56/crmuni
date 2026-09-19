CREATE TABLE `event_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`event_id` text NOT NULL,
	`membership_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`membership_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_event_memberships_event_member` ON `event_memberships` (`event_id`,`membership_id`);--> statement-breakpoint
CREATE INDEX `idx_event_memberships_member_status` ON `event_memberships` (`workspace_id`,`membership_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_event_memberships_event_status` ON `event_memberships` (`workspace_id`,`event_id`,`status`);--> statement-breakpoint
INSERT INTO `event_memberships` (`id`,`workspace_id`,`event_id`,`membership_id`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT lower(hex(randomblob(16))),e.workspace_id,e.id,m.id,'active',e.created_by,e.created_at,e.updated_at
FROM events e JOIN memberships m ON m.workspace_id=e.workspace_id AND m.user_id=e.created_by AND m.status='active'
ON CONFLICT(event_id,membership_id) DO NOTHING;--> statement-breakpoint
INSERT INTO `event_memberships` (`id`,`workspace_id`,`event_id`,`membership_id`,`status`,`created_by`,`created_at`,`updated_at`)
SELECT lower(hex(randomblob(16))),e.workspace_id,e.id,m.id,'active',e.created_by,e.created_at,e.updated_at
FROM events e JOIN json_each(e.team_member_ids_json) team JOIN memberships m ON m.workspace_id=e.workspace_id AND m.user_id=team.value AND m.status='active'
ON CONFLICT(event_id,membership_id) DO NOTHING;--> statement-breakpoint
CREATE TRIGGER `event_memberships_tenant_insert` BEFORE INSERT ON `event_memberships`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'event workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM memberships m WHERE m.id=NEW.membership_id AND m.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'membership workspace mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `event_memberships_tenant_update` BEFORE UPDATE ON `event_memberships`
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'event workspace mismatch') END;
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM memberships m WHERE m.id=NEW.membership_id AND m.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'membership workspace mismatch') END;
END;--> statement-breakpoint
ALTER TABLE `quotations` ADD `event_id` text;--> statement-breakpoint
UPDATE `quotations` SET `event_id`=COALESCE(
  (SELECT r.event_id FROM rfqs r WHERE r.id=quotations.rfq_id AND r.workspace_id=quotations.workspace_id),
  (SELECT o.event_id FROM opportunities o WHERE o.id=quotations.opportunity_id AND o.workspace_id=quotations.workspace_id)
) WHERE `event_id` IS NULL;--> statement-breakpoint
CREATE TRIGGER `quotations_event_tenant_insert` BEFORE INSERT ON `quotations` WHEN NEW.event_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'quotation event workspace mismatch') END;
END;--> statement-breakpoint
CREATE TRIGGER `quotations_event_tenant_update` BEFORE UPDATE OF `event_id`,`workspace_id` ON `quotations` WHEN NEW.event_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id) THEN RAISE(ABORT,'quotation event workspace mismatch') END;
END;--> statement-breakpoint
CREATE INDEX `idx_quotations_workspace_event` ON `quotations` (`workspace_id`,`event_id`);
