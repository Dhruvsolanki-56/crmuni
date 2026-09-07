import { auditStatement, database, requireRole, requireWorkspace, revenueEnv } from '@/lib/db';
import { validateUpload } from '@/lib/file-validation';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const allowedFiles = new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

export async function GET(request: Request) {
  const context = await requireWorkspace(request); const db = database(); const url = new URL(request.url); const downloadId = clean(url.searchParams.get('download'), 80);
  if (downloadId) {
    const document = await db.prepare(`SELECT original_name AS originalName,storage_key AS storageKey,content_type AS contentType FROM quotations WHERE id=? AND workspace_id=? AND storage_key IS NOT NULL`).bind(downloadId, context.workspace.id).first<{ originalName: string; storageKey: string; contentType: string }>();
    if (!document) return Response.json({ error: 'Quotation document not found.' }, { status: 404 }); const object = await revenueEnv().FILES.get(document.storageKey); if (!object) return Response.json({ error: 'Stored quotation document not found.' }, { status: 404 });
    const safeName = document.originalName.replace(/["\r\n]/g, '_'); return new Response(object.body, { headers: { 'content-type': document.contentType, 'content-disposition': `attachment; filename="${safeName}"`, 'cache-control': 'private, no-store' } });
  }
  const rows = await db.prepare(`SELECT id,rfq_id AS rfqId,opportunity_id AS opportunityId,quote_number AS quoteNumber,customer,amount,currency,valid_until AS validUntil,status,CASE WHEN storage_key IS NULL THEN 0 ELSE 1 END AS hasDocument,original_name AS originalName,created_at AS createdAt FROM quotations WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100`).bind(context.workspace.id).all(); return Response.json({ quotations: rows.results });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request); requireRole(context, ['owner', 'admin', 'manager', 'salesperson']); const db = database(); const contentType = request.headers.get('content-type') || ''; const form = contentType.includes('multipart/form-data') ? await request.formData() : null; const body = form ? Object.fromEntries(form.entries()) : await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 }); const action = clean(body.action, 30) || 'create'; const now = Date.now();
  if (action === 'update_status') {
    const id = clean(body.id, 80); const status = clean(body.status, 30); if (!['draft', 'approved', 'sent', 'accepted', 'rejected', 'expired'].includes(status)) return Response.json({ error: 'Choose a valid quotation status.' }, { status: 400 });
    const result = await db.prepare(`UPDATE quotations SET status=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(status, now, id, context.workspace.id).run(); if (!result.meta.changes) return Response.json({ error: 'Quotation not found.' }, { status: 404 }); await auditStatement(context, 'quotation.status_updated', 'quotation', id, { status }).run(); return Response.json({ ok: true, status });
  }
  if (action !== 'create') return Response.json({ error: 'Unknown action.' }, { status: 400 });
  const quoteNumber = clean(body.quoteNumber, 80); const customer = clean(body.customer, 180); const amount = Math.max(0, Math.min(1_000_000_000, Number(body.amount) || 0)); const validUntil = clean(body.validUntil, 10); const rfqId = clean(body.rfqId, 80); const opportunityId = clean(body.opportunityId, 80);
  if (!quoteNumber || !customer || !amount) return Response.json({ error: 'Quotation number, customer and a positive amount are required.' }, { status: 400 }); if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) return Response.json({ error: 'Valid-until date must use YYYY-MM-DD.' }, { status: 400 });
  if (rfqId && !(await db.prepare(`SELECT id FROM rfqs WHERE id=? AND workspace_id=?`).bind(rfqId, context.workspace.id).first())) return Response.json({ error: 'The selected RFQ is unavailable.' }, { status: 409 }); if (opportunityId && !(await db.prepare(`SELECT id FROM opportunities WHERE id=? AND workspace_id=?`).bind(opportunityId, context.workspace.id).first())) return Response.json({ error: 'The selected opportunity is unavailable.' }, { status: 409 });
  const candidate = form?.get('document'); const file = candidate instanceof File && candidate.size ? candidate : null; if (file && await validateUpload(file, allowedFiles, 15 * 1024 * 1024)) return Response.json({ error: 'Attach a valid PDF or DOCX quotation up to 15 MB.' }, { status: 400 });
  const duplicate = await db.prepare(`SELECT id FROM quotations WHERE workspace_id=? AND quote_number=?`).bind(context.workspace.id, quoteNumber).first(); if (duplicate) return Response.json({ error: 'This quotation number already exists.' }, { status: 409 });
  const id = crypto.randomUUID(); let storageKey: string | null = null; if (file) { const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'quotation'; storageKey = `${context.workspace.id}/quotations/${id}/${safeName}`; await revenueEnv().FILES.put(storageKey, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { workspaceId: context.workspace.id, quotationId: id, uploadedBy: context.user.id } }); }
  try {
    await db.batch([db.prepare(`INSERT INTO quotations (id,workspace_id,rfq_id,opportunity_id,quote_number,customer,amount,currency,valid_until,status,original_name,storage_key,content_type,size_bytes,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,'draft',?,?,?,?,?,?,?)`).bind(id, context.workspace.id, rfqId || null, opportunityId || null, quoteNumber, customer, amount, context.workspace.currency, validUntil || null, file?.name.slice(0, 180) || null, storageKey, file?.type || null, file?.size || null, context.user.id, now, now), auditStatement(context, 'quotation.created', 'quotation', id, { quoteNumber, amount, rfqId: rfqId || null })]);
  } catch (error) { if (storageKey) await revenueEnv().FILES.delete(storageKey); throw error; }
  return Response.json({ quotation: { id, rfqId: rfqId || null, opportunityId: opportunityId || null, quoteNumber, customer, amount, currency: context.workspace.currency, validUntil: validUntil || null, status: 'draft', hasDocument: Boolean(file), originalName: file?.name || null, createdAt: now } }, { status: 201 });
}
