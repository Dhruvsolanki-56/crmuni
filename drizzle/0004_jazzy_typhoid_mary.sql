DROP INDEX `idx_workspaces_slug`;--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_workspaces_slug` ON `workspaces` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_memberships_workspace_user` ON `memberships` (`workspace_id`,`user_id`);