import {
  auditStatement,
  database,
  eventAccessClause,
  requireEventAccess,
  requireOpportunityAccess,
  requireQuotationAccess,
  requireRfqAccess,
  requireRole,
  requireWorkspace,
  revenueEnv,
} from '@/lib/db';
import { validateUpload } from '@/lib/file-validation';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const allowedFiles = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const db = database();
  const url = new URL(request.url);
  const downloadId = clean(url.searchParams.get('download'), 80);
  if (downloadId) {
    await requireQuotationAccess(context, downloadId);
    const document = await db
      .prepare(
        `SELECT original_name AS originalName,storage_key AS storageKey,content_type AS contentType FROM quotations WHERE id=? AND workspace_id=? AND storage_key IS NOT NULL`,
      )
      .bind(downloadId, context.workspace.id)
      .first<{
        originalName: string;
        storageKey: string;
        contentType: string;
      }>();
    if (!document)
      return Response.json(
        { error: 'Quotation document not found.' },
        { status: 404 },
      );
    const object = await revenueEnv().FILES.get(document.storageKey);
    if (!object)
      return Response.json(
        { error: 'Stored quotation document not found.' },
        { status: 404 },
      );
    const safeName = document.originalName.replace(/["\r\n]/g, '_');
    return new Response(object.body, {
      headers: {
        'content-type': document.contentType,
        'content-disposition': `attachment; filename="${safeName}"`,
        'cache-control': 'private, no-store',
      },
    });
  }
  const access = eventAccessClause(context, 'q.event_id');
  const rows = await db
    .prepare(
      `SELECT q.id,q.event_id AS eventId,q.account_id AS accountId,q.rfq_id AS rfqId,q.opportunity_id AS opportunityId,q.quote_number AS quoteNumber,q.customer,q.amount,q.currency,q.valid_until AS validUntil,q.status,q.version,q.approved_by AS approvedBy,q.approved_at AS approvedAt,q.sent_at AS sentAt,CASE WHEN q.storage_key IS NULL THEN 0 ELSE 1 END AS hasDocument,q.original_name AS originalName,(SELECT COUNT(*) FROM quotation_revisions r WHERE r.quotation_id=q.id AND r.workspace_id=q.workspace_id) AS revisionCount,q.created_at AS createdAt FROM quotations q WHERE q.workspace_id=?${access.sql} ORDER BY q.created_at DESC LIMIT 100`,
    )
    .bind(context.workspace.id, ...access.bindings)
    .all();
  return Response.json({ quotations: rows.results });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
  const db = database();
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
  const now = Date.now();
  if (action === 'update_status') {
    const id = clean(body.id, 80);
    const status = clean(body.status, 30);
    const version = Number(body.version);
    const note = clean(body.note, 1200);
    if (!['approved', 'sent', 'accepted', 'rejected', 'expired'].includes(status) || !Number.isInteger(version) || version < 1)
      return Response.json(
        { error: 'Quotation, transition and current version are required.' },
        { status: 400 },
      );
    await requireQuotationAccess(context, id);
    const current=await db.prepare(`SELECT status,version,approved_by AS approvedBy,approved_at AS approvedAt,sent_at AS sentAt FROM quotations WHERE id=? AND workspace_id=?`).bind(id,context.workspace.id).first<{status:string;version:number;approvedBy:string|null;approvedAt:number|null;sentAt:number|null}>();
    if(!current)return Response.json({error:'Quotation not found.'},{status:404});
    if(current.version!==version)return Response.json({error:'This quotation changed in another session. Reload before updating it.',code:'VERSION_CONFLICT'},{status:409});
    const allowed:Record<string,string[]>={approved:['draft'],sent:['approved'],accepted:['sent'],rejected:['sent'],expired:['approved','sent']};
    if(!allowed[status].includes(current.status))return Response.json({error:`A ${current.status} quotation cannot move directly to ${status}.`},{status:409});
    if(status==='approved')requireRole(context,['owner','admin','manager']);
    if(status==='rejected'&&!note)return Response.json({error:'A rejection reason is required.'},{status:400});
    const approvedBy=status==='approved'?context.user.id:current.approvedBy;const approvedAt=status==='approved'?now:current.approvedAt;const sentAt=status==='sent'?now:current.sentAt;const token=crypto.randomUUID();const nextVersion=version+1;const detail=JSON.stringify({fromStatus:current.status,toStatus:status,note:note||null,version:nextVersion});
    const results=await db.batch([db.prepare(`UPDATE quotations SET status=?,approved_by=?,approved_at=?,sent_at=?,version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND version=?`).bind(status,approvedBy,approvedAt,sentAt,token,now,id,context.workspace.id,version),db.prepare(`INSERT INTO quotation_history (id,workspace_id,quotation_id,action,from_status,to_status,note,version,mutation_token,actor_id,created_at) SELECT ?,q.workspace_id,q.id,?,?,?,?,?,?,?,? FROM quotations q WHERE q.id=? AND q.workspace_id=? AND q.version=? AND q.mutation_token=?`).bind(crypto.randomUUID(),`status_${status}`,current.status,status,note||null,nextVersion,token,context.user.id,now,id,context.workspace.id,nextVersion,token),db.prepare(`INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) SELECT ?,q.workspace_id,?,'quotation.status_updated','quotation',q.id,?,? FROM quotations q WHERE q.id=? AND q.workspace_id=? AND q.version=? AND q.mutation_token=?`).bind(crypto.randomUUID(),context.user.id,detail,now,id,context.workspace.id,nextVersion,token)]);
    if(!results[0].meta.changes)return Response.json({error:'This quotation changed in another session. Reload before updating it.',code:'VERSION_CONFLICT'},{status:409});
    return Response.json({ok:true,status,version:nextVersion,approvedBy,approvedAt,sentAt});
  }
  if(action==='revise'){
    const id=clean(body.id,80);const version=Number(body.version);const amount=Math.max(0,Math.min(1_000_000_000,Number(body.amount)||0));const validUntil=clean(body.validUntil,10);const note=clean(body.note,1200);if(!id||!Number.isInteger(version)||version<1||!amount||!note)return Response.json({error:'Quotation, current version, positive amount and revision reason are required.'},{status:400});if(validUntil&&!/^\d{4}-\d{2}-\d{2}$/.test(validUntil))return Response.json({error:'Valid-until date must use YYYY-MM-DD.'},{status:400});await requireQuotationAccess(context,id);const current=await db.prepare(`SELECT status,version,original_name AS originalName,storage_key AS storageKey,content_type AS contentType,size_bytes AS sizeBytes FROM quotations WHERE id=? AND workspace_id=?`).bind(id,context.workspace.id).first<{status:string;version:number;originalName:string|null;storageKey:string|null;contentType:string|null;sizeBytes:number|null}>();if(!current)return Response.json({error:'Quotation not found.'},{status:404});if(current.version!==version)return Response.json({error:'This quotation changed in another session. Reload before revising it.',code:'VERSION_CONFLICT'},{status:409});if(current.status==='accepted')return Response.json({error:'An accepted quotation is final. Create a new quotation for later commercial changes.'},{status:409});const token=crypto.randomUUID();const nextVersion=version+1;const results=await db.batch([db.prepare(`UPDATE quotations SET amount=?,valid_until=NULLIF(?,''),status='draft',approved_by=NULL,approved_at=NULL,sent_at=NULL,version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND version=?`).bind(amount,validUntil,token,now,id,context.workspace.id,version),db.prepare(`INSERT INTO quotation_revisions (id,workspace_id,quotation_id,version,amount,valid_until,note,original_name,storage_key,content_type,size_bytes,created_by,created_at) SELECT ?,q.workspace_id,q.id,?,?,?,?,q.original_name,q.storage_key,q.content_type,q.size_bytes,?,? FROM quotations q WHERE q.id=? AND q.workspace_id=? AND q.version=? AND q.mutation_token=?`).bind(crypto.randomUUID(),nextVersion,amount,validUntil||null,note,context.user.id,now,id,context.workspace.id,nextVersion,token),db.prepare(`INSERT INTO quotation_history (id,workspace_id,quotation_id,action,from_status,to_status,note,version,mutation_token,actor_id,created_at) SELECT ?,q.workspace_id,q.id,'revised',?,'draft',?,?,?,?,? FROM quotations q WHERE q.id=? AND q.workspace_id=? AND q.version=? AND q.mutation_token=?`).bind(crypto.randomUUID(),current.status,note,nextVersion,token,context.user.id,now,id,context.workspace.id,nextVersion,token),db.prepare(`INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) SELECT ?,q.workspace_id,?,'quotation.revised','quotation',q.id,?,? FROM quotations q WHERE q.id=? AND q.workspace_id=? AND q.version=? AND q.mutation_token=?`).bind(crypto.randomUUID(),context.user.id,JSON.stringify({version:nextVersion,amount,note}),now,id,context.workspace.id,nextVersion,token)]);if(!results[0].meta.changes)return Response.json({error:'This quotation changed in another session. Reload before revising it.',code:'VERSION_CONFLICT'},{status:409});return Response.json({ok:true,status:'draft',version:nextVersion,amount,validUntil:validUntil||null});
  }
  if (action !== 'create')
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  const quoteNumber = clean(body.quoteNumber, 80);
  const customer = clean(body.customer, 180);
  const amount = Math.max(0, Math.min(1_000_000_000, Number(body.amount) || 0));
  const validUntil = clean(body.validUntil, 10);
  const rfqId = clean(body.rfqId, 80);
  const opportunityId = clean(body.opportunityId, 80);
  if (!quoteNumber || !customer || !amount)
    return Response.json(
      {
        error: 'Quotation number, customer and a positive amount are required.',
      },
      { status: 400 },
    );
  if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil))
    return Response.json(
      { error: 'Valid-until date must use YYYY-MM-DD.' },
      { status: 400 },
    );
  let eventId = clean(request.headers.get('x-revenue-event-id'), 80);
  let accountId:string|null=null;
  if (rfqId) {
    const rfq = await requireRfqAccess(context, rfqId);
    if (eventId && eventId !== rfq.eventId)
      return Response.json(
        { error: 'The RFQ belongs to a different event.' },
        { status: 409 },
      );
    eventId = rfq.eventId || '';
    const row=await db.prepare(`SELECT account_id AS accountId FROM rfqs WHERE id=? AND workspace_id=?`).bind(rfqId,context.workspace.id).first<{accountId:string|null}>();accountId=row?.accountId||null;
  }
  if (opportunityId) {
    const opportunity = await requireOpportunityAccess(context, opportunityId);
    if (eventId && eventId !== opportunity.eventId)
      return Response.json(
        { error: 'The opportunity belongs to a different event.' },
        { status: 409 },
      );
    eventId = opportunity.eventId || '';
    const row=await db.prepare(`SELECT account_id AS accountId FROM opportunities WHERE id=? AND workspace_id=?`).bind(opportunityId,context.workspace.id).first<{accountId:string|null}>();if(accountId&&row?.accountId&&accountId!==row.accountId)return Response.json({error:'The RFQ and opportunity belong to different accounts.'},{status:409});accountId=accountId||row?.accountId||null;
  }
  await requireEventAccess(context, eventId);
  const candidate = form?.get('document');
  const file = candidate instanceof File && candidate.size ? candidate : null;
  if (file && (await validateUpload(file, allowedFiles, 15 * 1024 * 1024)))
    return Response.json(
      { error: 'Attach a valid PDF or DOCX quotation up to 15 MB.' },
      { status: 400 },
    );
  const duplicate = await db
    .prepare(
      `SELECT id FROM quotations WHERE workspace_id=? AND quote_number=?`,
    )
    .bind(context.workspace.id, quoteNumber)
    .first();
  if (duplicate)
    return Response.json(
      { error: 'This quotation number already exists.' },
      { status: 409 },
    );
  const id = crypto.randomUUID();
  const mutationToken=crypto.randomUUID();
  let storageKey: string | null = null;
  if (file) {
    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'quotation';
    storageKey = `${context.workspace.id}/quotations/${id}/${safeName}`;
    await revenueEnv().FILES.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        workspaceId: context.workspace.id,
        quotationId: id,
        uploadedBy: context.user.id,
      },
    });
  }
  try {
    await db.batch([
      db
        .prepare(
          `INSERT INTO quotations (id,workspace_id,event_id,account_id,rfq_id,opportunity_id,quote_number,customer,amount,currency,valid_until,status,version,mutation_token,original_name,storage_key,content_type,size_bytes,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,'draft',1,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          id,
          context.workspace.id,
          eventId,
          accountId,
          rfqId || null,
          opportunityId || null,
          quoteNumber,
          customer,
          amount,
          context.workspace.currency,
          validUntil || null,
          mutationToken,
          file?.name.slice(0, 180) || null,
          storageKey,
          file?.type || null,
          file?.size || null,
          context.user.id,
          now,
          now,
        ),
      db.prepare(`INSERT INTO quotation_revisions (id,workspace_id,quotation_id,version,amount,valid_until,note,original_name,storage_key,content_type,size_bytes,created_by,created_at) VALUES (?,?,?,1,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),context.workspace.id,id,amount,validUntil||null,'Initial quotation',file?.name.slice(0,180)||null,storageKey,file?.type||null,file?.size||null,context.user.id,now),
      db.prepare(`INSERT INTO quotation_history (id,workspace_id,quotation_id,action,to_status,note,version,mutation_token,actor_id,created_at) VALUES (?,?,?,'created','draft','Quotation created',1,?,?,?)`).bind(crypto.randomUUID(),context.workspace.id,id,mutationToken,context.user.id,now),
      auditStatement(context, 'quotation.created', 'quotation', id, {
        quoteNumber,
        amount,
        rfqId: rfqId || null,
        eventId,
      }),
    ]);
  } catch (error) {
    if (storageKey) await revenueEnv().FILES.delete(storageKey);
    throw error;
  }
  return Response.json(
    {
      quotation: {
        id,
        eventId,
        rfqId: rfqId || null,
        opportunityId: opportunityId || null,
        quoteNumber,
        customer,
        amount,
        currency: context.workspace.currency,
        validUntil: validUntil || null,
        status: 'draft',
        hasDocument: Boolean(file),
        originalName: file?.name || null,
        version:1,
        revisionCount:1,
        createdAt: now,
      },
    },
    { status: 201 },
  );
}
