ALTER TABLE `quotations` ADD `account_id` text REFERENCES accounts(id);
--> statement-breakpoint
UPDATE quotations SET account_id=COALESCE((SELECT account_id FROM rfqs r WHERE r.id=quotations.rfq_id AND r.workspace_id=quotations.workspace_id),(SELECT account_id FROM opportunities o WHERE o.id=quotations.opportunity_id AND o.workspace_id=quotations.workspace_id)) WHERE account_id IS NULL;
--> statement-breakpoint
CREATE TRIGGER quotations_scope_insert BEFORE INSERT ON quotations
WHEN NOT EXISTS (SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id)
  OR (NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id=NEW.account_id AND a.workspace_id=NEW.workspace_id))
  OR (NEW.rfq_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rfqs r WHERE r.id=NEW.rfq_id AND r.workspace_id=NEW.workspace_id AND r.event_id=NEW.event_id AND (NEW.account_id IS NULL OR r.account_id IS NULL OR r.account_id=NEW.account_id)))
  OR (NEW.opportunity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id=NEW.opportunity_id AND o.workspace_id=NEW.workspace_id AND o.event_id=NEW.event_id AND (NEW.account_id IS NULL OR o.account_id IS NULL OR o.account_id=NEW.account_id)))
BEGIN SELECT RAISE(ABORT,'quotation scope mismatch'); END;
--> statement-breakpoint
CREATE TRIGGER quotations_scope_update BEFORE UPDATE OF workspace_id,event_id,account_id,rfq_id,opportunity_id ON quotations
WHEN NOT EXISTS (SELECT 1 FROM events e WHERE e.id=NEW.event_id AND e.workspace_id=NEW.workspace_id)
  OR (NEW.account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id=NEW.account_id AND a.workspace_id=NEW.workspace_id))
  OR (NEW.rfq_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rfqs r WHERE r.id=NEW.rfq_id AND r.workspace_id=NEW.workspace_id AND r.event_id=NEW.event_id AND (NEW.account_id IS NULL OR r.account_id IS NULL OR r.account_id=NEW.account_id)))
  OR (NEW.opportunity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.id=NEW.opportunity_id AND o.workspace_id=NEW.workspace_id AND o.event_id=NEW.event_id AND (NEW.account_id IS NULL OR o.account_id IS NULL OR o.account_id=NEW.account_id)))
BEGIN SELECT RAISE(ABORT,'quotation scope mismatch'); END;
