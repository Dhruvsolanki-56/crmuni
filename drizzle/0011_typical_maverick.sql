CREATE TABLE `rfq_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rfq_id` text NOT NULL,
	`original_name` text NOT NULL,
	`storage_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`processing_status` text DEFAULT 'stored_pending_extraction' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rfq_documents_rfq` ON `rfq_documents` (`workspace_id`,`rfq_id`);--> statement-breakpoint
CREATE TABLE `rfq_items` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`rfq_id` text NOT NULL,
	`product` text NOT NULL,
	`quantity` text,
	`specifications` text,
	`source_evidence` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rfq_id`) REFERENCES `rfqs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rfq_items_rfq` ON `rfq_items` (`workspace_id`,`rfq_id`);--> statement-breakpoint
CREATE TABLE `rfqs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text,
	`lead_id` text,
	`event_id` text,
	`title` text NOT NULL,
	`reference` text,
	`requester_company` text NOT NULL,
	`contact_name` text,
	`delivery_location` text,
	`submission_deadline` text,
	`status` text DEFAULT 'received' NOT NULL,
	`processing_status` text DEFAULT 'manual_review' NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rfqs_workspace_status_deadline` ON `rfqs` (`workspace_id`,`status`,`submission_deadline`);