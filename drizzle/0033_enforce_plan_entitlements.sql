CREATE TRIGGER workspace_plan_validate_insert BEFORE INSERT ON workspaces
BEGIN
  SELECT CASE WHEN NEW.plan NOT IN ('trial','starter','growth','scale')
    THEN RAISE(ABORT, 'INVALID_WORKSPACE_PLAN') END;
END;
--> statement-breakpoint
CREATE TRIGGER workspace_plan_validate_update BEFORE UPDATE OF plan ON workspaces
BEGIN
  SELECT CASE WHEN NEW.plan NOT IN ('trial','starter','growth','scale')
    THEN RAISE(ABORT, 'INVALID_WORKSPACE_PLAN') END;
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM memberships WHERE workspace_id=NEW.id AND status='active'
  ) > CASE NEW.plan WHEN 'trial' THEN 3 WHEN 'starter' THEN 10 WHEN 'growth' THEN 30 ELSE 100 END
    THEN RAISE(ABORT, 'ACTIVE_MEMBER_LIMIT') END;
  SELECT CASE WHEN (
    (SELECT COALESCE(SUM(size_bytes),0) FROM knowledge_sources WHERE workspace_id=NEW.id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM lead_capture_assets WHERE workspace_id=NEW.id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM rfq_documents WHERE workspace_id=NEW.id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM quotations WHERE workspace_id=NEW.id)
  ) > CASE NEW.plan
    WHEN 'trial' THEN 104857600
    WHEN 'starter' THEN 5368709120
    WHEN 'growth' THEN 26843545600
    ELSE 107374182400 END
    THEN RAISE(ABORT, 'STORAGE_LIMIT') END;
END;
--> statement-breakpoint
CREATE TRIGGER membership_plan_limit_insert BEFORE INSERT ON memberships
WHEN NEW.status='active'
BEGIN
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM memberships WHERE workspace_id=NEW.workspace_id AND status='active'
  ) >= CASE COALESCE((SELECT plan FROM workspaces WHERE id=NEW.workspace_id),'trial')
    WHEN 'trial' THEN 3 WHEN 'starter' THEN 10 WHEN 'growth' THEN 30 ELSE 100 END
    THEN RAISE(ABORT, 'ACTIVE_MEMBER_LIMIT') END;
END;
--> statement-breakpoint
CREATE TRIGGER membership_plan_limit_update BEFORE UPDATE OF status,workspace_id ON memberships
WHEN NEW.status='active' AND (OLD.status!='active' OR OLD.workspace_id!=NEW.workspace_id)
BEGIN
  SELECT CASE WHEN (
    SELECT COUNT(*) FROM memberships WHERE workspace_id=NEW.workspace_id AND status='active'
  ) >= CASE COALESCE((SELECT plan FROM workspaces WHERE id=NEW.workspace_id),'trial')
    WHEN 'trial' THEN 3 WHEN 'starter' THEN 10 WHEN 'growth' THEN 30 ELSE 100 END
    THEN RAISE(ABORT, 'ACTIVE_MEMBER_LIMIT') END;
END;
--> statement-breakpoint
CREATE TRIGGER knowledge_storage_limit_insert BEFORE INSERT ON knowledge_sources
WHEN COALESCE(NEW.size_bytes,0)>0
BEGIN
  SELECT CASE WHEN COALESCE(NEW.size_bytes,0) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM knowledge_sources WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM lead_capture_assets WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM rfq_documents WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM quotations WHERE workspace_id=NEW.workspace_id)
  > CASE COALESCE((SELECT plan FROM workspaces WHERE id=NEW.workspace_id),'trial')
    WHEN 'trial' THEN 104857600 WHEN 'starter' THEN 5368709120 WHEN 'growth' THEN 26843545600 ELSE 107374182400 END
  THEN RAISE(ABORT, 'STORAGE_LIMIT') END;
END;
--> statement-breakpoint
CREATE TRIGGER lead_capture_storage_limit_insert BEFORE INSERT ON lead_capture_assets
WHEN COALESCE(NEW.size_bytes,0)>0
BEGIN
  SELECT CASE WHEN COALESCE(NEW.size_bytes,0) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM knowledge_sources WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM lead_capture_assets WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM rfq_documents WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM quotations WHERE workspace_id=NEW.workspace_id)
  > CASE COALESCE((SELECT plan FROM workspaces WHERE id=NEW.workspace_id),'trial')
    WHEN 'trial' THEN 104857600 WHEN 'starter' THEN 5368709120 WHEN 'growth' THEN 26843545600 ELSE 107374182400 END
  THEN RAISE(ABORT, 'STORAGE_LIMIT') END;
END;
--> statement-breakpoint
CREATE TRIGGER rfq_document_storage_limit_insert BEFORE INSERT ON rfq_documents
WHEN COALESCE(NEW.size_bytes,0)>0
BEGIN
  SELECT CASE WHEN COALESCE(NEW.size_bytes,0) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM knowledge_sources WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM lead_capture_assets WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM rfq_documents WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM quotations WHERE workspace_id=NEW.workspace_id)
  > CASE COALESCE((SELECT plan FROM workspaces WHERE id=NEW.workspace_id),'trial')
    WHEN 'trial' THEN 104857600 WHEN 'starter' THEN 5368709120 WHEN 'growth' THEN 26843545600 ELSE 107374182400 END
  THEN RAISE(ABORT, 'STORAGE_LIMIT') END;
END;
--> statement-breakpoint
CREATE TRIGGER quotation_storage_limit_insert BEFORE INSERT ON quotations
WHEN COALESCE(NEW.size_bytes,0)>0
BEGIN
  SELECT CASE WHEN COALESCE(NEW.size_bytes,0) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM knowledge_sources WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM lead_capture_assets WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM rfq_documents WHERE workspace_id=NEW.workspace_id) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM quotations WHERE workspace_id=NEW.workspace_id)
  > CASE COALESCE((SELECT plan FROM workspaces WHERE id=NEW.workspace_id),'trial')
    WHEN 'trial' THEN 104857600 WHEN 'starter' THEN 5368709120 WHEN 'growth' THEN 26843545600 ELSE 107374182400 END
  THEN RAISE(ABORT, 'STORAGE_LIMIT') END;
END;
