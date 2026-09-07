import { auditStatement, database, DEFAULT_EVENT, requireWorkspace, revenueEnv } from '@/lib/db';

type NewLead = {
  fullName?: unknown;
  company?: unknown;
  role?: unknown;
  email?: unknown;
  phone?: unknown;
  note?: unknown;
  nextAction?: unknown;
  dueDate?: unknown;
  clientCaptureId?: unknown;
  attachmentKind?: unknown;
};

const allowedFiles = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']);

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const result = await database().prepare(`
    SELECT l.id, l.full_name AS fullName, l.company, l.role, l.email, l.phone, l.review_status AS reviewStatus,
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
  let body: NewLead; let file: File | null = null;
  try {
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const form = await request.formData(); body = Object.fromEntries(form.entries()) as NewLead; const candidate = form.get('attachment'); file = candidate instanceof File && candidate.size ? candidate : null;
    } else body = await request.json() as NewLead;
  } catch { return Response.json({ error: 'Invalid request body.' }, { status: 400 }); }

  const fullName = clean(body.fullName, 120);
  const company = clean(body.company, 160);
  const role = clean(body.role, 120);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 40);
  const note = clean(body.note, 4000);
  const nextAction = clean(body.nextAction, 240);
  const dueDate = clean(body.dueDate, 10);
  const clientCaptureId = clean(body.clientCaptureId, 80);
  if (!fullName || !company) return Response.json({ error: 'Full name and company are required.' }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return Response.json({ error: 'Due date must use YYYY-MM-DD.' }, { status: 400 });
  if (file && (!allowedFiles.has(file.type) || file.size > 15 * 1024 * 1024)) return Response.json({ error: 'Attachments must be an image, PDF, or audio file up to 15 MB.' }, { status: 400 });

  if (clientCaptureId) {
    const existing = await database().prepare(`SELECT id, full_name AS fullName, company, role, review_status AS reviewStatus, created_at AS createdAt FROM leads WHERE workspace_id = ? AND client_capture_id = ?`).bind(context.workspace.id, clientCaptureId).first();
    if (existing) return Response.json({ lead: existing, duplicate: true });
  }

  const now = Date.now();
  const requestedEventId = clean(request.headers.get('x-revenue-event-id'), 80);
  let eventId = DEFAULT_EVENT;
  if (requestedEventId) {
    const selectedEvent = await database().prepare(`SELECT id FROM events WHERE id = ? AND workspace_id = ? AND status != 'archived'`).bind(requestedEventId, context.workspace.id).first<{ id: string }>();
    if (!selectedEvent) return Response.json({ error: 'The selected event is unavailable. Choose another event before capturing.' }, { status: 409 });
    eventId = selectedEvent.id;
  }
  const leadId = crypto.randomUUID();
  const interactionId = note ? crypto.randomUUID() : null;
  const taskId = nextAction ? crypto.randomUUID() : null;
  const attachmentKind = ['card', 'badge', 'audio'].includes(clean(body.attachmentKind, 20)) ? clean(body.attachmentKind, 20) : 'document';
  const source = file ? attachmentKind : 'manual'; const assetId = file ? crypto.randomUUID() : null; let storageKey: string | null = null;
  if (file && assetId) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'capture'; storageKey = `${context.workspace.id}/lead-captures/${leadId}/${assetId}-${safeName}`;
    await revenueEnv().FILES.put(storageKey, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { workspaceId: context.workspace.id, leadId, uploadedBy: context.user.id, kind: attachmentKind } });
  }
  const statements = [database().prepare(`
    INSERT INTO leads (id, workspace_id, event_id, client_capture_id, owner_id, full_name, company, role, email, phone, source, review_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'needs_review', ?, ?)
  `).bind(leadId, context.workspace.id, eventId, clientCaptureId || null, context.user.id, fullName, company, role || null, email || null, phone || null, source, now, now)];

  if (interactionId) statements.push(database().prepare(`
    INSERT INTO interactions (id, workspace_id, lead_id, note, source, occurred_at, created_at)
    VALUES (?, ?, ?, ?, 'typed_note', ?, ?)
  `).bind(interactionId, context.workspace.id, leadId, note, now, now));
  if (taskId) statements.push(database().prepare(`
    INSERT INTO tasks (id, workspace_id, lead_id, owner_id, title, due_date, status, source_interaction_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).bind(taskId, context.workspace.id, leadId, context.user.id, nextAction, dueDate || null, interactionId, now, now));
  if (file && assetId && storageKey) statements.push(database().prepare(`INSERT INTO lead_capture_assets (id, workspace_id, lead_id, kind, original_name, storage_key, content_type, size_bytes, processing_status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stored_pending_extraction', ?, ?)`).bind(assetId, context.workspace.id, leadId, attachmentKind, file.name.slice(0, 180), storageKey, file.type, file.size, context.user.id, now));
  statements.push(auditStatement(context, 'lead.created', 'lead', leadId, { source }));

  try { await database().batch(statements); } catch (error) { if (storageKey) await revenueEnv().FILES.delete(storageKey); throw error; }
  return Response.json({ lead: { id: leadId, fullName, company, role, email, phone, note, nextAction, dueDate, reviewStatus: 'needs_review', createdAt: now }, asset: assetId ? { id: assetId, kind: attachmentKind, processingStatus: 'stored_pending_extraction' } : null }, { status: 201 });
}
