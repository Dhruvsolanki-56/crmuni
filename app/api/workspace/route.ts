import { auditStatement, database, requireRole, requireWorkspace } from '@/lib/db';
import { accountIdentity } from '@/lib/accounts';

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const db = database();
  const selectedEventId = clean(request.headers.get('x-revenue-event-id'), 80);
  const [leadRows, taskRows, opportunityRows, accountRows] = await Promise.all([
    db.prepare(`SELECT l.id, l.event_id AS eventId, l.account_id AS accountId, l.full_name AS fullName, l.company, l.role, l.email, l.phone, s.buying_role AS buyingRole, l.review_status AS reviewStatus,
      l.created_at AS createdAt, i.note, t.title AS nextAction, t.due_date AS dueDate, q.score, q.rationale AS scoreRationale,
      a.id AS assetId, a.kind AS captureKind, a.processing_status AS captureStatus, a.extracted_json AS extractedJson
      FROM leads l
      LEFT JOIN account_stakeholders s ON s.lead_id=l.id AND s.workspace_id=l.workspace_id
      LEFT JOIN interactions i ON i.id = (SELECT id FROM interactions WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN tasks t ON t.id = (SELECT id FROM tasks WHERE lead_id = l.id AND status = 'open' ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN qualification_scores q ON q.id = (SELECT id FROM qualification_scores WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN lead_capture_assets a ON a.id = (SELECT id FROM lead_capture_assets WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1)
      WHERE l.workspace_id = ? ORDER BY l.created_at DESC LIMIT 100`).bind(context.workspace.id).all(),
    db.prepare(`SELECT t.id, t.lead_id AS leadId, t.title, t.due_date AS dueDate, t.status,
      l.event_id AS eventId, l.full_name AS fullName, l.company FROM tasks t JOIN leads l ON l.id = t.lead_id
      WHERE t.workspace_id = ? ORDER BY t.status ASC, CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC, t.created_at DESC LIMIT 100`).bind(context.workspace.id).all(),
    db.prepare(`SELECT id, event_id AS eventId, lead_id AS leadId, company, title, stage, value, currency, probability,
      expected_close_date AS expectedCloseDate, created_at AS createdAt
      FROM opportunities WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 100`).bind(context.workspace.id).all(),
    db.prepare(`SELECT a.id, a.name AS company, COUNT(l.id) AS contacts, MAX(l.created_at) AS latestAt, COUNT(s.id) AS stakeholders FROM accounts a LEFT JOIN leads l ON l.account_id=a.id LEFT JOIN account_stakeholders s ON s.lead_id=l.id WHERE a.workspace_id=? GROUP BY a.id, a.name ORDER BY latestAt DESC`).bind(context.workspace.id).all(),
  ]);
  const leads = leadRows.results;
  const linkedNames = new Set(accountRows.results.map((item) => String(item.company).toLowerCase())); const legacyAccounts = Object.values(leads.reduce<Record<string, { id: string; company: string; contacts: number; latestAt: number; stakeholders: number }>>((all, item) => {
    const company = String(item.company); const createdAt = Number(item.createdAt);
    if (linkedNames.has(company.toLowerCase())) return all; const current = all[company] || { id: `legacy:${company}`, company, contacts: 0, latestAt: 0, stakeholders: 0 };
    current.contacts += 1; current.latestAt = Math.max(current.latestAt, createdAt); all[company] = current; return all;
  }, {}));
  const accounts = [...accountRows.results, ...legacyAccounts];
  const opportunities = opportunityRows.results; const metricLeads = selectedEventId ? leads.filter((item) => item.eventId === selectedEventId) : leads; const metricTasks = selectedEventId ? taskRows.results.filter((item) => item.eventId === selectedEventId) : taskRows.results; const metricOpportunities = selectedEventId ? opportunities.filter((item) => item.eventId === selectedEventId) : opportunities;
  const pipelineValue = metricOpportunities.reduce((sum, item) => sum + Number(item.value || 0), 0);
  return Response.json({ context: { workspace: context.workspace, role: context.role, user: context.user }, leads, accounts, tasks: taskRows.results, opportunities, metrics: {
    totalLeads: metricLeads.length, qualifiedLeads: metricLeads.filter((item) => item.reviewStatus === 'confirmed').length,
    openTasks: metricTasks.filter((item) => item.status === 'open').length,
    pipelineValue,
  } });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const action = clean(body.action, 30);
  if (action === 'complete_task') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const id = clean(body.id, 80); if (!id) return Response.json({ error: 'Task id is required.' }, { status: 400 });
    const result = await database().prepare(`UPDATE tasks SET status = 'complete', updated_at = ? WHERE id = ? AND workspace_id = ?`).bind(Date.now(), id, context.workspace.id).run();
    if (!result.meta.changes) return Response.json({ error: 'Task not found.' }, { status: 404 });
    await auditStatement(context, 'task.completed', 'task', id).run(); return Response.json({ ok: true });
  }
  if (action === 'create_task') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']); const leadId = clean(body.leadId, 80); const title = clean(body.title, 240); const dueDate = clean(body.dueDate, 10);
    if (!leadId || !title) return Response.json({ error: 'Lead and task title are required.' }, { status: 400 });
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return Response.json({ error: 'Due date must use YYYY-MM-DD.' }, { status: 400 });
    if (!(await database().prepare(`SELECT id FROM leads WHERE id=? AND workspace_id=?`).bind(leadId, context.workspace.id).first())) return Response.json({ error: 'Lead not found.' }, { status: 404 });
    const id = crypto.randomUUID(); const now = Date.now(); await database().batch([database().prepare(`INSERT INTO tasks (id,workspace_id,lead_id,owner_id,title,due_date,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'open',?,?)`).bind(id, context.workspace.id, leadId, context.user.id, title, dueDate || null, now, now), auditStatement(context, 'task.created', 'task', id, { leadId })]); return Response.json({ task: { id, leadId, title, dueDate: dueDate || null, status: 'open' } }, { status: 201 });
  }
  if (action === 'update_lead') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']); const id = clean(body.id, 80); const fullName = clean(body.fullName, 120); const company = clean(body.company, 160); const role = clean(body.role, 120); const email = clean(body.email, 254).toLowerCase(); const phone = clean(body.phone, 40);
    if (!id || !fullName || !company) return Response.json({ error: 'Lead, full name and company are required.' }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
    if (!(await database().prepare(`SELECT id FROM leads WHERE id=? AND workspace_id=?`).bind(id, context.workspace.id).first())) return Response.json({ error: 'Lead not found.' }, { status: 404 });
    const account = await accountIdentity(context.workspace.id, company); const now = Date.now(); await database().batch([database().prepare(`INSERT INTO accounts (id,workspace_id,name,normalized_name,status,created_at,updated_at) VALUES (?,?,?,?,'active',?,?) ON CONFLICT(workspace_id,normalized_name) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at`).bind(account.id, context.workspace.id, company, account.normalized, now, now), database().prepare(`UPDATE leads SET account_id=?,full_name=?,company=?,role=NULLIF(?,''),email=NULLIF(?,''),phone=NULLIF(?,''),updated_at=? WHERE id=? AND workspace_id=?`).bind(account.id, fullName, company, role, email, phone, now, id, context.workspace.id), auditStatement(context, 'lead.updated', 'lead', id)]); return Response.json({ lead: { id, fullName, company, role, email, phone } });
  }
  if (action === 'create_opportunity') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const company = clean(body.company, 160); const title = clean(body.title, 200);
    const leadId = clean(body.leadId, 80); const value = Math.max(0, Math.min(1_000_000_000, Number(body.value) || 0));
    if (!company || !title) return Response.json({ error: 'Company and opportunity title are required.' }, { status: 400 });
    const id = crypto.randomUUID(); const now = Date.now(); const accountId = leadId ? (await database().prepare(`SELECT account_id AS accountId FROM leads WHERE id=? AND workspace_id=?`).bind(leadId, context.workspace.id).first<{accountId:string}>())?.accountId || null : null; const eventId = clean(request.headers.get('x-revenue-event-id'), 80) || null;
    if (eventId && !(await database().prepare(`SELECT id FROM events WHERE id=? AND workspace_id=? AND status!='archived'`).bind(eventId, context.workspace.id).first())) return Response.json({ error: 'The selected event is unavailable.' }, { status: 409 });
    await database().prepare(`INSERT INTO opportunities (id, workspace_id, event_id, lead_id, account_id, company, title, stage, value, currency, probability, expected_close_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'qualified', ?, ?, 20, ?, ?, ?)`).bind(id, context.workspace.id, eventId, leadId || null, accountId, company, title, value, context.workspace.currency, clean(body.expectedCloseDate, 10) || null, now, now).run();
    await auditStatement(context, 'opportunity.created', 'opportunity', id, { value }).run();
    return Response.json({ opportunity: { id, leadId, company, title, stage: 'qualified', value, currency: context.workspace.currency, probability: 20, expectedCloseDate: clean(body.expectedCloseDate, 10), createdAt: now } }, { status: 201 });
  }
  if (action === 'update_opportunity') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']); const id = clean(body.id, 80); const stage = clean(body.stage, 30); const probabilities: Record<string, number> = { qualified: 20, requirement: 30, sample: 40, rfq: 50, quotation: 60, meeting: 70, negotiation: 80, won: 100, lost: 0 };
    if (!id || probabilities[stage] === undefined) return Response.json({ error: 'Choose a valid opportunity stage.' }, { status: 400 });
    const result = await database().prepare(`UPDATE opportunities SET stage=?,probability=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(stage, probabilities[stage], Date.now(), id, context.workspace.id).run(); if (!result.meta.changes) return Response.json({ error: 'Opportunity not found.' }, { status: 404 }); await auditStatement(context, 'opportunity.stage_updated', 'opportunity', id, { stage }).run(); return Response.json({ ok: true, stage, probability: probabilities[stage] });
  }
  if (action === 'set_stakeholder') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']); const leadId = clean(body.leadId, 80); const buyingRole = clean(body.buyingRole, 40); const allowed = ['buyer','technical_evaluator','internal_champion','decision_maker','influencer','user','unknown']; if (!allowed.includes(buyingRole)) return Response.json({ error: 'Choose a valid buying role.' }, { status: 400 }); const lead = await database().prepare(`SELECT account_id AS accountId FROM leads WHERE id=? AND workspace_id=?`).bind(leadId, context.workspace.id).first<{accountId:string|null}>(); if (!lead?.accountId) return Response.json({ error: 'This contact is not linked to an account yet.' }, { status: 409 }); const now=Date.now(); await database().prepare(`INSERT INTO account_stakeholders (id,workspace_id,account_id,lead_id,buying_role,influence_level,updated_by,updated_at) VALUES (?,?,?,?,?,'unknown',?,?) ON CONFLICT(account_id,lead_id) DO UPDATE SET buying_role=excluded.buying_role,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),context.workspace.id,lead.accountId,leadId,buyingRole,context.user.id,now).run(); await auditStatement(context,'stakeholder.updated','lead',leadId,{buyingRole}).run(); return Response.json({ok:true,buyingRole});
  }
  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
