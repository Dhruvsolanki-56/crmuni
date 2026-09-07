import { auditStatement, database, DEFAULT_EVENT, requireWorkspace } from '@/lib/db';

type NewLead = {
  fullName?: unknown;
  company?: unknown;
  role?: unknown;
  note?: unknown;
  nextAction?: unknown;
  dueDate?: unknown;
};

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const result = await database().prepare(`
    SELECT l.id, l.full_name AS fullName, l.company, l.role, l.review_status AS reviewStatus,
           l.created_at AS createdAt, i.note, t.title AS nextAction, t.due_date AS dueDate
    FROM leads l
    LEFT JOIN interactions i ON i.lead_id = l.id
    LEFT JOIN tasks t ON t.lead_id = l.id AND t.status = 'open'
    WHERE l.workspace_id = ? AND l.owner_id = ?
    ORDER BY l.created_at DESC
    LIMIT 25
  `).bind(context.workspace.id, context.user.id).all();
  return Response.json({ leads: result.results });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  let body: NewLead;
  try { body = await request.json() as NewLead; } catch { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }

  const fullName = clean(body.fullName, 120);
  const company = clean(body.company, 160);
  const role = clean(body.role, 120);
  const note = clean(body.note, 4000);
  const nextAction = clean(body.nextAction, 240);
  const dueDate = clean(body.dueDate, 10);
  if (!fullName || !company) return Response.json({ error: 'Full name and company are required.' }, { status: 400 });
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return Response.json({ error: 'Due date must use YYYY-MM-DD.' }, { status: 400 });

  const now = Date.now();
  const leadId = crypto.randomUUID();
  const interactionId = note ? crypto.randomUUID() : null;
  const taskId = nextAction ? crypto.randomUUID() : null;
  const statements = [database().prepare(`
    INSERT INTO leads (id, workspace_id, event_id, owner_id, full_name, company, role, source, review_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', 'needs_review', ?, ?)
  `).bind(leadId, context.workspace.id, DEFAULT_EVENT, context.user.id, fullName, company, role || null, now, now)];

  if (interactionId) statements.push(database().prepare(`
    INSERT INTO interactions (id, workspace_id, lead_id, note, source, occurred_at, created_at)
    VALUES (?, ?, ?, ?, 'typed_note', ?, ?)
  `).bind(interactionId, context.workspace.id, leadId, note, now, now));
  if (taskId) statements.push(database().prepare(`
    INSERT INTO tasks (id, workspace_id, lead_id, owner_id, title, due_date, status, source_interaction_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).bind(taskId, context.workspace.id, leadId, context.user.id, nextAction, dueDate || null, interactionId, now, now));
  statements.push(auditStatement(context, 'lead.created', 'lead', leadId, { source: 'manual' }));

  await database().batch(statements);
  return Response.json({ lead: { id: leadId, fullName, company, role, note, nextAction, dueDate, reviewStatus: 'needs_review', createdAt: now } }, { status: 201 });
}
