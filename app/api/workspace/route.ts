import { database, DEFAULT_WORKSPACE, requestUser } from '@/lib/db';

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function GET(request: Request) {
  const user = requestUser(request);
  const db = database();
  const [leadRows, taskRows, opportunityRows] = await Promise.all([
    db.prepare(`SELECT l.id, l.full_name AS fullName, l.company, l.role, l.review_status AS reviewStatus,
      l.created_at AS createdAt, i.note, t.title AS nextAction, t.due_date AS dueDate
      FROM leads l
      LEFT JOIN interactions i ON i.id = (SELECT id FROM interactions WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN tasks t ON t.id = (SELECT id FROM tasks WHERE lead_id = l.id AND status = 'open' ORDER BY created_at DESC LIMIT 1)
      WHERE l.workspace_id = ? AND l.owner_id = ? ORDER BY l.created_at DESC LIMIT 100`).bind(DEFAULT_WORKSPACE, user.id).all(),
    db.prepare(`SELECT t.id, t.lead_id AS leadId, t.title, t.due_date AS dueDate, t.status,
      l.full_name AS fullName, l.company FROM tasks t JOIN leads l ON l.id = t.lead_id
      WHERE t.workspace_id = ? AND t.owner_id = ? ORDER BY t.status ASC, t.due_date ASC, t.created_at DESC LIMIT 100`).bind(DEFAULT_WORKSPACE, user.id).all(),
    db.prepare(`SELECT id, lead_id AS leadId, company, title, stage, value, currency, probability,
      expected_close_date AS expectedCloseDate, created_at AS createdAt
      FROM opportunities WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 100`).bind(DEFAULT_WORKSPACE).all(),
  ]);
  const leads = leadRows.results;
  const accounts = Object.values(leads.reduce<Record<string, { company: string; contacts: number; latestAt: number }>>((all, item) => {
    const company = String(item.company); const createdAt = Number(item.createdAt);
    const current = all[company] || { company, contacts: 0, latestAt: 0 };
    current.contacts += 1; current.latestAt = Math.max(current.latestAt, createdAt); all[company] = current; return all;
  }, {}));
  const opportunities = opportunityRows.results;
  const pipelineValue = opportunities.reduce((sum, item) => sum + Number(item.value || 0), 0);
  return Response.json({ leads, accounts, tasks: taskRows.results, opportunities, metrics: {
    totalLeads: leads.length, qualifiedLeads: leads.filter((item) => item.reviewStatus === 'confirmed').length,
    openTasks: taskRows.results.filter((item) => item.status === 'open').length,
    pipelineValue,
  } });
}

export async function POST(request: Request) {
  const user = requestUser(request);
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const action = clean(body.action, 30);
  if (action === 'complete_task') {
    const id = clean(body.id, 80); if (!id) return Response.json({ error: 'Task id is required.' }, { status: 400 });
    const result = await database().prepare(`UPDATE tasks SET status = 'complete', updated_at = ? WHERE id = ? AND workspace_id = ? AND owner_id = ?`).bind(Date.now(), id, DEFAULT_WORKSPACE, user.id).run();
    if (!result.meta.changes) return Response.json({ error: 'Task not found.' }, { status: 404 });
    return Response.json({ ok: true });
  }
  if (action === 'create_opportunity') {
    const company = clean(body.company, 160); const title = clean(body.title, 200);
    const leadId = clean(body.leadId, 80); const value = Math.max(0, Math.min(1_000_000_000, Number(body.value) || 0));
    if (!company || !title) return Response.json({ error: 'Company and opportunity title are required.' }, { status: 400 });
    const id = crypto.randomUUID(); const now = Date.now();
    await database().prepare(`INSERT INTO opportunities (id, workspace_id, lead_id, company, title, stage, value, currency, probability, expected_close_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'qualified', ?, 'INR', 20, ?, ?, ?)`).bind(id, DEFAULT_WORKSPACE, leadId || null, company, title, value, clean(body.expectedCloseDate, 10) || null, now, now).run();
    return Response.json({ opportunity: { id, leadId, company, title, stage: 'qualified', value, currency: 'INR', probability: 20, expectedCloseDate: clean(body.expectedCloseDate, 10), createdAt: now } }, { status: 201 });
  }
  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
