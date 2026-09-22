CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text,
	`phone` text,
	`primary_account_id` text,
	`merged_into_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`primary_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_email` ON `contacts` (`workspace_id`,`email`);
--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_phone` ON `contacts` (`workspace_id`,`phone`);
--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_account` ON `contacts` (`workspace_id`,`primary_account_id`);
--> statement-breakpoint
CREATE INDEX `idx_contacts_workspace_name` ON `contacts` (`workspace_id`,`full_name`);
--> statement-breakpoint
CREATE TABLE `contact_duplicate_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_contact_id` text NOT NULL,
	`target_contact_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`confidence_basis_points` integer NOT NULL,
	`reasons_json` text NOT NULL,
	`resolved_by` text,
	`resolved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uidx_contact_duplicate_pair` ON `contact_duplicate_suggestions` (`workspace_id`,`source_contact_id`,`target_contact_id`);
--> statement-breakpoint
CREATE INDEX `idx_contact_duplicate_source_status` ON `contact_duplicate_suggestions` (`workspace_id`,`source_contact_id`,`status`);
--> statement-breakpoint
CREATE TABLE `contact_merge_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_contact_id` text NOT NULL,
	`target_contact_id` text NOT NULL,
	`status` text DEFAULT 'merged' NOT NULL,
	`snapshot_json` text NOT NULL,
	`merged_by` text NOT NULL,
	`merged_at` integer NOT NULL,
	`reverted_by` text,
	`reverted_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`target_contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contact_merge_source_status` ON `contact_merge_events` (`workspace_id`,`source_contact_id`,`status`);
--> statement-breakpoint
ALTER TABLE `leads` ADD `contact_id` text REFERENCES contacts(id);
--> statement-breakpoint
CREATE INDEX `idx_leads_workspace_contact` ON `leads` (`workspace_id`,`contact_id`);
--> statement-breakpoint
CREATE TRIGGER leads_contact_scope_insert BEFORE INSERT ON leads
WHEN NEW.contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id=NEW.contact_id AND c.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'lead contact workspace mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER leads_contact_scope_update BEFORE UPDATE OF contact_id ON leads
WHEN NEW.contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id=NEW.contact_id AND c.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'lead contact workspace mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER contacts_account_scope_insert BEFORE INSERT ON contacts
WHEN NEW.primary_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id=NEW.primary_account_id AND a.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'contact account workspace mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER contacts_account_scope_update BEFORE UPDATE OF primary_account_id ON contacts
WHEN NEW.primary_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id=NEW.primary_account_id AND a.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'contact account workspace mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER contact_duplicate_tenant_insert BEFORE INSERT ON contact_duplicate_suggestions
WHEN NOT EXISTS (SELECT 1 FROM contacts s JOIN contacts t ON t.id=NEW.target_contact_id WHERE s.id=NEW.source_contact_id AND s.workspace_id=NEW.workspace_id AND t.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'duplicate contact scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER contact_merge_tenant_insert BEFORE INSERT ON contact_merge_events
WHEN NOT EXISTS (SELECT 1 FROM contacts s JOIN contacts t ON t.id=NEW.target_contact_id WHERE s.id=NEW.source_contact_id AND s.workspace_id=NEW.workspace_id AND t.workspace_id=NEW.workspace_id)
BEGIN SELECT RAISE(ABORT,'merge contact scope mismatch'); END;
--> statement-breakpoint
-- ============================================================================
-- BACKFILL: resolve every existing active lead to a contact.
--
-- Four tiers, highest-confidence evidence first, mirroring the
-- deduplication rules this product already trusts: exact email, then exact
-- phone, then account+exact-name as a last-resort signal already used by
-- this app's own live duplicate-lead detection (app/api/leads/route.ts),
-- never fuzzy/similarity matching. Merged and erased leads are left
-- unresolved (contact_id stays NULL) - they are already excluded from every
-- active read in the app today, and an erased lead must not resurface
-- personal data by way of a new contact link.
-- ============================================================================

-- Tier 1: exact email match, scoped to workspace.
INSERT INTO contacts (id, workspace_id, full_name, email, phone, primary_account_id, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  g.workspace_id,
  (SELECT l2.full_name FROM leads l2 WHERE l2.workspace_id=g.workspace_id AND lower(trim(l2.email))=g.email_key AND l2.review_status NOT IN ('merged','erased') ORDER BY l2.created_at ASC LIMIT 1),
  (SELECT l2.email FROM leads l2 WHERE l2.workspace_id=g.workspace_id AND lower(trim(l2.email))=g.email_key AND l2.review_status NOT IN ('merged','erased') ORDER BY l2.created_at ASC LIMIT 1),
  (SELECT l2.phone FROM leads l2 WHERE l2.workspace_id=g.workspace_id AND lower(trim(l2.email))=g.email_key AND l2.review_status NOT IN ('merged','erased') AND l2.phone IS NOT NULL AND trim(l2.phone)!='' ORDER BY l2.created_at ASC LIMIT 1),
  (SELECT l2.account_id FROM leads l2 WHERE l2.workspace_id=g.workspace_id AND lower(trim(l2.email))=g.email_key AND l2.review_status NOT IN ('merged','erased') AND l2.account_id IS NOT NULL ORDER BY l2.created_at ASC LIMIT 1),
  MIN(g.created_at),
  MIN(g.created_at)
FROM (
  SELECT workspace_id, lower(trim(email)) AS email_key, created_at
  FROM leads
  WHERE review_status NOT IN ('merged','erased') AND contact_id IS NULL AND email IS NOT NULL AND trim(email) != ''
) g
GROUP BY g.workspace_id, g.email_key;
--> statement-breakpoint
UPDATE leads SET contact_id = (
  SELECT c.id FROM contacts c
  WHERE c.workspace_id = leads.workspace_id AND lower(trim(c.email)) = lower(trim(leads.email))
  LIMIT 1
)
WHERE contact_id IS NULL AND review_status NOT IN ('merged','erased') AND email IS NOT NULL AND trim(email) != '';
--> statement-breakpoint

-- Tier 2: exact phone match, only for leads with no usable email.
INSERT INTO contacts (id, workspace_id, full_name, email, phone, primary_account_id, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  g.workspace_id,
  (SELECT l2.full_name FROM leads l2 WHERE l2.workspace_id=g.workspace_id AND lower(trim(l2.phone))=g.phone_key AND l2.review_status NOT IN ('merged','erased') AND l2.contact_id IS NULL ORDER BY l2.created_at ASC LIMIT 1),
  NULL,
  (SELECT l2.phone FROM leads l2 WHERE l2.workspace_id=g.workspace_id AND lower(trim(l2.phone))=g.phone_key AND l2.review_status NOT IN ('merged','erased') AND l2.contact_id IS NULL ORDER BY l2.created_at ASC LIMIT 1),
  (SELECT l2.account_id FROM leads l2 WHERE l2.workspace_id=g.workspace_id AND lower(trim(l2.phone))=g.phone_key AND l2.review_status NOT IN ('merged','erased') AND l2.contact_id IS NULL AND l2.account_id IS NOT NULL ORDER BY l2.created_at ASC LIMIT 1),
  MIN(g.created_at),
  MIN(g.created_at)
FROM (
  SELECT workspace_id, lower(trim(phone)) AS phone_key, created_at
  FROM leads
  WHERE review_status NOT IN ('merged','erased') AND contact_id IS NULL AND (email IS NULL OR trim(email) = '') AND phone IS NOT NULL AND trim(phone) != ''
) g
GROUP BY g.workspace_id, g.phone_key;
--> statement-breakpoint
UPDATE leads SET contact_id = (
  SELECT c.id FROM contacts c
  WHERE c.workspace_id = leads.workspace_id AND c.email IS NULL AND lower(trim(c.phone)) = lower(trim(leads.phone))
  LIMIT 1
)
WHERE contact_id IS NULL AND review_status NOT IN ('merged','erased') AND (email IS NULL OR trim(email) = '') AND phone IS NOT NULL AND trim(phone) != '';
--> statement-breakpoint

-- Tier 3a: reuse an existing contact (already resolved above) that shares
-- this lead's account and exact name, so one real person captured once with
-- an email and once without does not fragment into two contacts.
UPDATE leads SET contact_id = (
  SELECT c.id FROM contacts c
  WHERE c.workspace_id = leads.workspace_id
    AND c.primary_account_id = leads.account_id
    AND lower(trim(c.full_name)) = lower(trim(leads.full_name))
  ORDER BY c.created_at ASC
  LIMIT 1
)
WHERE contact_id IS NULL AND review_status NOT IN ('merged','erased') AND account_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM contacts c
    WHERE c.workspace_id = leads.workspace_id
      AND c.primary_account_id = leads.account_id
      AND lower(trim(c.full_name)) = lower(trim(leads.full_name))
  );
--> statement-breakpoint

-- Tier 3b: account + exact name, for whatever tier 1/2/3a left unresolved.
INSERT INTO contacts (id, workspace_id, full_name, email, phone, primary_account_id, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  g.workspace_id,
  (SELECT l2.full_name FROM leads l2 WHERE l2.workspace_id=g.workspace_id AND l2.account_id=g.account_id AND lower(trim(l2.full_name))=g.name_key AND l2.review_status NOT IN ('merged','erased') AND l2.contact_id IS NULL ORDER BY l2.created_at ASC LIMIT 1),
  NULL,
  (SELECT l2.phone FROM leads l2 WHERE l2.workspace_id=g.workspace_id AND l2.account_id=g.account_id AND lower(trim(l2.full_name))=g.name_key AND l2.review_status NOT IN ('merged','erased') AND l2.contact_id IS NULL AND l2.phone IS NOT NULL AND trim(l2.phone)!='' ORDER BY l2.created_at ASC LIMIT 1),
  g.account_id,
  MIN(g.created_at),
  MIN(g.created_at)
FROM (
  SELECT workspace_id, account_id, lower(trim(full_name)) AS name_key, created_at
  FROM leads
  WHERE review_status NOT IN ('merged','erased') AND contact_id IS NULL AND account_id IS NOT NULL
) g
GROUP BY g.workspace_id, g.account_id, g.name_key;
--> statement-breakpoint
UPDATE leads SET contact_id = (
  SELECT c.id FROM contacts c
  WHERE c.workspace_id = leads.workspace_id
    AND c.primary_account_id = leads.account_id
    AND lower(trim(c.full_name)) = lower(trim(leads.full_name))
  ORDER BY c.created_at ASC
  LIMIT 1
)
WHERE contact_id IS NULL AND review_status NOT IN ('merged','erased') AND account_id IS NOT NULL;
--> statement-breakpoint

-- Tier 4: no email, no phone, no account - nothing to key on, so one
-- dedicated contact per lead. Id is derived from the lead's own id so no
-- correlated lookup is needed for the matching update.
INSERT INTO contacts (id, workspace_id, full_name, email, phone, primary_account_id, created_at, updated_at)
SELECT 'contact_' || id, workspace_id, full_name, email, phone, account_id, created_at, created_at
FROM leads
WHERE contact_id IS NULL AND review_status NOT IN ('merged','erased');
--> statement-breakpoint
UPDATE leads SET contact_id = 'contact_' || id
WHERE contact_id IS NULL AND review_status NOT IN ('merged','erased');
