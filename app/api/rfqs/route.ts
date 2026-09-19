import {
  auditStatement,
  database,
  eventAccessClause,
  requireEventAccess,
  requireRfqAccess,
  requireRole,
  requireWorkspace,
  revenueEnv,
} from '@/lib/db';
import { validateUpload } from '@/lib/file-validation';
import { enforceStorageEntitlement, isEntitlementConstraint, storageLimitResponse } from '@/lib/entitlements';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const allowedFiles = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const access = eventAccessClause(context, 'r.event_id');
  const rows = await database()
    .prepare(
      `SELECT r.id,r.event_id AS eventId,r.title,r.reference,r.requester_company AS requesterCompany,r.contact_name AS contactName,r.delivery_location AS deliveryLocation,r.submission_deadline AS submissionDeadline,r.status,r.processing_status AS processingStatus,r.owner_id AS ownerId,COALESCE(m.display_name,m.email,r.owner_id) AS ownerName,r.owner_due_at AS ownerDueAt,r.version,r.created_at AS createdAt,COUNT(DISTINCT i.id) AS itemCount,COUNT(DISTINCT d.id) AS documentCount,(SELECT COUNT(*) FROM rfq_submissions s WHERE s.rfq_id=r.id AND s.workspace_id=r.workspace_id) AS submissionCount,(SELECT s.note FROM rfq_submissions s WHERE s.rfq_id=r.id AND s.workspace_id=r.workspace_id ORDER BY s.version DESC LIMIT 1) AS latestSubmissionNote,(SELECT h.note FROM rfq_history h WHERE h.rfq_id=r.id AND h.workspace_id=r.workspace_id AND h.action='status_clarification' ORDER BY h.created_at DESC LIMIT 1) AS clarificationNote,(SELECT x.id FROM rfq_ai_extractions x WHERE x.rfq_id=r.id ORDER BY x.created_at DESC LIMIT 1) AS extractionId,(SELECT x.status FROM rfq_ai_extractions x WHERE x.rfq_id=r.id ORDER BY x.created_at DESC LIMIT 1) AS extractionStatus,(SELECT x.result_json FROM rfq_ai_extractions x WHERE x.rfq_id=r.id ORDER BY x.created_at DESC LIMIT 1) AS extractionJson FROM rfqs r LEFT JOIN rfq_items i ON i.rfq_id=r.id LEFT JOIN rfq_documents d ON d.rfq_id=r.id LEFT JOIN memberships m ON m.workspace_id=r.workspace_id AND m.user_id=r.owner_id WHERE r.workspace_id=?${access.sql} GROUP BY r.id ORDER BY r.submission_deadline IS NULL,r.submission_deadline,r.created_at DESC`,
    )
    .bind(context.workspace.id, ...access.bindings)
    .all();
  return Response.json({ rfqs: rows.results });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
  const contentType = request.headers.get('content-type') || '';
  const form = contentType.includes('multipart/form-data')
    ? await request.formData()
    : null;
  const body = form
    ? Object.fromEntries(form.entries())
    : ((await request.json().catch(() => null)) as Record<
        string,
        unknown
      > | null);
  if (!body)
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 30) || 'create';
  const db = database();
  const now = Date.now();
  if (action === 'update_status') {
    const id = clean(body.id, 80);
    const status = clean(body.status, 30);
    const version = Number(body.version);
    const note = clean(body.note, 1200);
    if (
      ![
        'received',
        'reviewing',
        'clarification',
        'ready_to_quote',
        'quoted',
        'won',
        'lost',
      ].includes(status) ||
      !Number.isInteger(version) ||
      version < 1
    )
      return Response.json(
        { error: 'RFQ, status and current version are required.' },
        { status: 400 },
      );
    await requireRfqAccess(context, id);
    const current = await db
      .prepare(`SELECT status,version FROM rfqs WHERE id=? AND workspace_id=?`)
      .bind(id, context.workspace.id)
      .first<{ status: string; version: number }>();
    if (!current)
      return Response.json({ error: 'RFQ not found.' }, { status: 404 });
    if (current.version !== version)
      return Response.json(
        {
          error:
            'This RFQ changed in another session. Reload before updating it.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    if (status === current.status)
      return Response.json({ ok: true, duplicate: true, status, version });
    if (
      (status === 'clarification' ||
        status === 'lost' ||
        ['won', 'lost'].includes(current.status)) &&
      !note
    )
      return Response.json(
        {
          error:
            'A reason is required for clarification, loss, or changing a closed RFQ.',
        },
        { status: 400 },
      );
    const token = crypto.randomUUID();
    const nextVersion = version + 1;
    const detail = JSON.stringify({
      fromStatus: current.status,
      toStatus: status,
      note: note || null,
    });
    const results = await db.batch([
      db
        .prepare(
          `UPDATE rfqs SET status=?,version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND version=?`,
        )
        .bind(status, token, now, id, context.workspace.id, version),
      db
        .prepare(
          `INSERT INTO rfq_history (id,workspace_id,rfq_id,action,from_status,to_status,note,version,mutation_token,actor_id,created_at) SELECT ?,r.workspace_id,r.id,?,?,?,?,?,?,?,? FROM rfqs r WHERE r.id=? AND r.workspace_id=? AND r.version=? AND r.mutation_token=?`,
        )
        .bind(
          crypto.randomUUID(),
          `status_${status}`,
          current.status,
          status,
          note || null,
          nextVersion,
          token,
          context.user.id,
          now,
          id,
          context.workspace.id,
          nextVersion,
          token,
        ),
      db
        .prepare(
          `INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) SELECT ?,r.workspace_id,?,'rfq.status_updated','rfq',r.id,?,? FROM rfqs r WHERE r.id=? AND r.workspace_id=? AND r.version=? AND r.mutation_token=?`,
        )
        .bind(
          crypto.randomUUID(),
          context.user.id,
          detail,
          now,
          id,
          context.workspace.id,
          nextVersion,
          token,
        ),
    ]);
    if (!results[0].meta.changes)
      return Response.json(
        {
          error:
            'This RFQ changed in another session. Reload before updating it.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    return Response.json({
      ok: true,
      status,
      version: nextVersion,
      clarificationNote: status === 'clarification' ? note : null,
    });
  }
  if (action === 'record_submission') {
    const id = clean(body.id, 80);
    const version = Number(body.version);
    const note = clean(body.note, 1200);
    if (!id || !Number.isInteger(version) || version < 1 || !note)
      return Response.json(
        { error: 'RFQ, current version and a submission note are required.' },
        { status: 400 },
      );
    await requireRfqAccess(context, id);
    const current = await db
      .prepare(
        `SELECT status,version,(SELECT COALESCE(MAX(version),0) FROM rfq_submissions WHERE workspace_id=rfqs.workspace_id AND rfq_id=rfqs.id) AS submissionVersion FROM rfqs WHERE id=? AND workspace_id=?`,
      )
      .bind(id, context.workspace.id)
      .first<{ status: string; version: number; submissionVersion: number }>();
    if (!current)
      return Response.json({ error: 'RFQ not found.' }, { status: 404 });
    if (current.version !== version)
      return Response.json(
        {
          error:
            'This RFQ changed in another session. Reload before recording submission.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    if (!['ready_to_quote', 'quoted'].includes(current.status))
      return Response.json(
        { error: 'Only an RFQ ready to quote can record a submission.' },
        { status: 409 },
      );
    const token = crypto.randomUUID();
    const nextVersion = version + 1;
    const submissionVersion = Number(current.submissionVersion) + 1;
    const results = await db.batch([
      db
        .prepare(
          `UPDATE rfqs SET status='quoted',version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND version=?`,
        )
        .bind(token, now, id, context.workspace.id, version),
      db
        .prepare(
          `INSERT INTO rfq_submissions (id,workspace_id,rfq_id,version,note,status,submitted_by,submitted_at) SELECT ?,r.workspace_id,r.id,?,?,'submitted',?,? FROM rfqs r WHERE r.id=? AND r.workspace_id=? AND r.version=? AND r.mutation_token=?`,
        )
        .bind(
          crypto.randomUUID(),
          submissionVersion,
          note,
          context.user.id,
          now,
          id,
          context.workspace.id,
          nextVersion,
          token,
        ),
      db
        .prepare(
          `INSERT INTO rfq_history (id,workspace_id,rfq_id,action,from_status,to_status,note,version,mutation_token,actor_id,created_at) SELECT ?,r.workspace_id,r.id,'submission_recorded',?,'quoted',?,?,?,?,? FROM rfqs r WHERE r.id=? AND r.workspace_id=? AND r.version=? AND r.mutation_token=?`,
        )
        .bind(
          crypto.randomUUID(),
          current.status,
          `v${submissionVersion}: ${note}`,
          nextVersion,
          token,
          context.user.id,
          now,
          id,
          context.workspace.id,
          nextVersion,
          token,
        ),
      db
        .prepare(
          `INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) SELECT ?,r.workspace_id,?,'rfq.submission_recorded','rfq',r.id,?,? FROM rfqs r WHERE r.id=? AND r.workspace_id=? AND r.version=? AND r.mutation_token=?`,
        )
        .bind(
          crypto.randomUUID(),
          context.user.id,
          JSON.stringify({ submissionVersion }),
          now,
          id,
          context.workspace.id,
          nextVersion,
          token,
        ),
    ]);
    if (!results[0].meta.changes)
      return Response.json(
        {
          error:
            'This RFQ changed in another session. Reload before recording submission.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    return Response.json({
      ok: true,
      status: 'quoted',
      version: nextVersion,
      submissionVersion,
    });
  }
  if (action !== 'create')
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  const title = clean(body.title, 200);
  const requesterCompany = clean(body.requesterCompany, 180);
  const deadline = clean(body.submissionDeadline, 10);
  if (!title || !requesterCompany)
    return Response.json(
      { error: 'RFQ title and requester company are required.' },
      { status: 400 },
    );
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline))
    return Response.json(
      { error: 'Deadline must use YYYY-MM-DD.' },
      { status: 400 },
    );
  const file = form?.get('document');
  if (
    file &&
    (!(file instanceof File) ||
      !allowedFiles.has(file.type) ||
      file.size > 15 * 1024 * 1024)
  )
    return Response.json(
      { error: 'Use PDF, DOCX, XLSX, CSV, TXT, PNG or JPG files up to 15 MB.' },
      { status: 400 },
    );
  if (
    file instanceof File &&
    (await validateUpload(file, allowedFiles, 15 * 1024 * 1024))
  )
    return Response.json(
      {
        error:
          'The file content must match a PDF, DOCX, XLSX, CSV, TXT, PNG or JPG file up to 15 MB.',
      },
      { status: 400 },
    );
  const id = crypto.randomUUID();
  const eventId = clean(request.headers.get('x-revenue-event-id'), 80);
  await requireEventAccess(context, eventId);
  const event = await db
    .prepare(
      `SELECT followup_sla_hours AS followupSlaHours FROM events WHERE id=? AND workspace_id=?`,
    )
    .bind(eventId, context.workspace.id)
    .first<{ followupSlaHours: number }>();
  const ownerDueAt =
    now +
    Math.max(1, Math.min(168, Number(event?.followupSlaHours) || 24)) *
      60 *
      60 *
      1000;
  const mutationToken = crypto.randomUUID();
  const itemLines = clean(body.items, 8000)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100);
  const statements = [
    db
      .prepare(
        `INSERT INTO rfqs (id,workspace_id,event_id,title,reference,requester_company,contact_name,delivery_location,submission_deadline,status,processing_status,owner_id,owner_due_at,version,mutation_token,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'received',?,?,?,1,?,?,?)`,
      )
      .bind(
        id,
        context.workspace.id,
        eventId,
        title,
        clean(body.reference, 120) || null,
        requesterCompany,
        clean(body.contactName, 160) || null,
        clean(body.deliveryLocation, 300) || null,
        deadline || null,
        file ? 'stored_pending_extraction' : 'manual_review',
        context.user.id,
        ownerDueAt,
        mutationToken,
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO rfq_history (id,workspace_id,rfq_id,action,to_status,note,version,mutation_token,actor_id,created_at) VALUES (?,?,?,'created','received','RFQ received',1,?,?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        context.workspace.id,
        id,
        mutationToken,
        context.user.id,
        now,
      ),
  ];
  for (const line of itemLines) {
    const [product, quantity, ...spec] = line
      .split('|')
      .map((part) => part.trim());
    if (product)
      statements.push(
        db
          .prepare(
            `INSERT INTO rfq_items (id,workspace_id,rfq_id,product,quantity,specifications,source_evidence,created_at) VALUES (?,?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            id,
            product.slice(0, 240),
            quantity?.slice(0, 80) || null,
            spec.join(' | ').slice(0, 3000) || null,
            line.slice(0, 3000),
            now,
          ),
      );
  }
  let storageKey: string | null = null;
  if (file instanceof File) {
    await enforceStorageEntitlement(db, context.workspace.id, context.workspace.plan, file.size);
    const documentId = crypto.randomUUID();
    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'rfq';
    storageKey = `${context.workspace.id}/rfqs/${id}/${documentId}-${safeName}`;
    await revenueEnv().FILES.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        workspaceId: context.workspace.id,
        rfqId: id,
        uploadedBy: context.user.id,
      },
    });
    statements.push(
      db
        .prepare(
          `INSERT INTO rfq_documents (id,workspace_id,rfq_id,original_name,storage_key,content_type,size_bytes,processing_status,created_by,created_at) VALUES (?,?,?,?,?,?,?,'stored_pending_extraction',?,?)`,
        )
        .bind(
          documentId,
          context.workspace.id,
          id,
          file.name.slice(0, 180),
          storageKey,
          file.type,
          file.size,
          context.user.id,
          now,
        ),
    );
  }
  statements.push(
    auditStatement(context, 'rfq.created', 'rfq', id, {
      hasDocument: Boolean(file),
      itemCount: itemLines.length,
      ownerDueAt,
    }),
  );
  try {
    await db.batch(statements);
  } catch (error) {
    if (storageKey) await revenueEnv().FILES.delete(storageKey);
    if (isEntitlementConstraint(error, 'STORAGE_LIMIT'))
      throw storageLimitResponse(context.workspace.plan);
    throw error;
  }
  return Response.json(
    {
      rfq: {
        id,
        title,
        requesterCompany,
        submissionDeadline: deadline,
        status: 'received',
        processingStatus: file ? 'stored_pending_extraction' : 'manual_review',
        ownerId: context.user.id,
        ownerDueAt,
        version: 1,
        submissionCount: 0,
        itemCount: itemLines.length,
        documentCount: file ? 1 : 0,
        createdAt: now,
      },
    },
    { status: 201 },
  );
}
