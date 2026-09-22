import {
  auditStatement,
  database,
  eventAccessClause,
  filesAvailable,
  requireEventAccess,
  requireLeadAccess,
  requireRole,
  requireWorkspace,
  revenueEnv,
  storageUnavailableResponse,
} from '@/lib/db';
import { validateUpload } from '@/lib/file-validation';
import { accountIdentity } from '@/lib/accounts';
import { resolveContact } from '@/lib/contacts';
import {
  enforceStorageEntitlement,
  isEntitlementConstraint,
  storageLimitResponse,
} from '@/lib/entitlements';

type NewLead = {
  action?: unknown;
  leadId?: unknown;
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
  emailConsent?: unknown;
  whatsappConsent?: unknown;
  consentSource?: unknown;
  localOcrConfirmed?: unknown;
  localOcrFields?: unknown;
};

const allowedFiles = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
]);

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const access = eventAccessClause(context, 'l.event_id');
  const result = await database()
    .prepare(`
    SELECT l.id, l.full_name AS fullName, l.company, l.role, l.email, l.phone, l.review_status AS reviewStatus,
           l.created_at AS createdAt, i.note, t.title AS nextAction, t.due_date AS dueDate
    FROM leads l
    LEFT JOIN interactions i ON i.lead_id = l.id
    LEFT JOIN tasks t ON t.lead_id = l.id AND t.status = 'open'
    WHERE l.workspace_id = ? AND l.review_status!='merged'${access.sql}
    ORDER BY l.created_at DESC
    LIMIT 25
  `)
    .bind(context.workspace.id, ...access.bindings)
    .all();
  return Response.json({ leads: result.results });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, [
    'owner',
    'admin',
    'manager',
    'salesperson',
    'marketing',
  ]);
  let body: NewLead;
  let file: File | null = null;
  const customFieldEntries: Record<string, string> = {};
  try {
    if (
      (request.headers.get('content-type') || '').includes(
        'multipart/form-data',
      )
    ) {
      const form = await request.formData();
      body = Object.fromEntries(form.entries()) as NewLead;
      const candidate = form.get('attachment');
      file = candidate instanceof File && candidate.size ? candidate : null;
      for (const [key, value] of form.entries()) {
        if (
          key.startsWith('custom:') &&
          typeof value === 'string' &&
          Object.keys(customFieldEntries).length < 30
        ) {
          const label = key.slice('custom:'.length).trim().slice(0, 80);
          const trimmed = value.trim().slice(0, 500);
          if (label && trimmed) customFieldEntries[label] = trimmed;
        }
      }
    } else body = (await request.json()) as NewLead;
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (clean(body.action, 30) === 'attach_capture') {
    // A conversation often produces more than one piece of evidence after
    // the lead already exists - an audio note recorded mid-conversation, a
    // brochure handed over on the way out. This reuses the exact storage,
    // validation and entitlement path the initial capture uses; extraction
    // for the new asset is the existing /api/capture-extraction call, which
    // already operates on a lead's most recent asset.
    const leadId = clean(body.leadId, 80);
    if (!leadId)
      return Response.json({ error: 'Lead ID is required.' }, { status: 400 });
    const requestedKind = clean(body.attachmentKind, 20);
    const kind = ['audio', 'document'].includes(requestedKind)
      ? requestedKind
      : 'document';
    if (!file)
      return Response.json(
        { error: 'Choose a recording or file to attach.' },
        { status: 400 },
      );
    // This action has no fallback: it has nothing to persist except the
    // file. Fail with a clear reason rather than let a missing binding
    // throw mid-request.
    if (!filesAvailable())
      return storageUnavailableResponse(
        kind === 'audio' ? 'Audio notes' : 'Brochure attachments',
      );
    if (kind === 'audio' && !file.type.startsWith('audio/'))
      return Response.json(
        { error: 'An audio note must be an audio file.' },
        { status: 400 },
      );
    if (
      await validateUpload(file, allowedFiles, 15 * 1024 * 1024)
    )
      return Response.json(
        {
          error:
            'The attachment content does not match a supported image, PDF, or audio file up to 15 MB.',
        },
        { status: 400 },
      );
    await requireLeadAccess(context, leadId);
    const lead = await database()
      .prepare(
        `SELECT review_status AS reviewStatus FROM leads WHERE id=? AND workspace_id=?`,
      )
      .bind(leadId, context.workspace.id)
      .first<{ reviewStatus: string }>();
    if (!lead || ['merged', 'erased'].includes(lead.reviewStatus))
      return Response.json({ error: 'Lead not found.' }, { status: 404 });
    await enforceStorageEntitlement(
      database(),
      context.workspace.id,
      context.workspace.plan,
      file.size,
    );
    const assetId = crypto.randomUUID();
    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'capture';
    const storageKey = `${context.workspace.id}/lead-captures/${leadId}/${assetId}-${safeName}`;
    try {
      await revenueEnv().FILES.put(storageKey, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: {
          workspaceId: context.workspace.id,
          leadId,
          uploadedBy: context.user.id,
          kind,
        },
      });
      const now = Date.now();
      await database().batch([
        database()
          .prepare(
            `INSERT INTO lead_capture_assets (id, workspace_id, lead_id, kind, original_name, storage_key, content_type, size_bytes, processing_status, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stored_pending_extraction', ?, ?)`,
          )
          .bind(
            assetId,
            context.workspace.id,
            leadId,
            kind,
            file.name.slice(0, 180),
            storageKey,
            file.type,
            file.size,
            context.user.id,
            now,
          ),
        auditStatement(context, 'lead_capture.attached', 'lead_capture_asset', assetId, {
          leadId,
          kind,
        }),
      ]);
    } catch (error) {
      await revenueEnv().FILES.delete(storageKey);
      if (isEntitlementConstraint(error, 'STORAGE_LIMIT'))
        throw storageLimitResponse(context.workspace.plan);
      throw error;
    }
    return Response.json(
      { asset: { id: assetId, kind, processingStatus: 'stored_pending_extraction' } },
      { status: 201 },
    );
  }

  const suppliedFullName = clean(body.fullName, 120);
  const suppliedCompany = clean(body.company, 160);
  const role = clean(body.role, 120);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 40);
  const note = clean(body.note, 4000);
  const nextAction = clean(body.nextAction, 240);
  const dueDate = clean(body.dueDate, 10);
  const clientCaptureId = clean(body.clientCaptureId, 80);
  const requestedAttachmentKind = clean(body.attachmentKind, 20);
  const consentSource =
    clean(body.consentSource, 80) || 'salesperson_attestation';
  const consentChannels = [
    ...(body.emailConsent === 'on' || body.emailConsent === true
      ? ['email']
      : []),
    ...(body.whatsappConsent === 'on' || body.whatsappConsent === true
      ? ['whatsapp']
      : []),
  ];
  const allowedLocalOcrFields = new Set([
    'fullName',
    'company',
    'role',
    'email',
    'phone',
  ]);
  const localOcrFields = [
    ...new Set(
      clean(body.localOcrFields, 120)
        .split(',')
        .filter((field) => allowedLocalOcrFields.has(field)),
    ),
  ];
  const localOcrConfirmed =
    body.localOcrConfirmed === 'true' &&
    Boolean(file?.type.startsWith('image/')) &&
    localOcrFields.length > 0;
  if ((!suppliedFullName || !suppliedCompany) && !file)
    return Response.json(
      {
        error:
          'Add a full name and company, or attach a card, badge, QR image, or recording.',
      },
      { status: 400 },
    );
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return Response.json(
      { error: 'Enter a valid email address.' },
      { status: 400 },
    );
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
    return Response.json(
      { error: 'Due date must use YYYY-MM-DD.' },
      { status: 400 },
    );
  if (file && (await validateUpload(file, allowedFiles, 15 * 1024 * 1024)))
    return Response.json(
      {
        error:
          'The attachment content does not match a supported image, PDF, or audio file up to 15 MB.',
      },
      { status: 400 },
    );
  if (
    file &&
    ['card', 'badge', 'qr'].includes(requestedAttachmentKind) &&
    !file.type.startsWith('image/')
  )
    return Response.json(
      { error: 'Card, badge and QR captures must be image files.' },
      { status: 400 },
    );
  if (
    file &&
    requestedAttachmentKind === 'audio' &&
    !file.type.startsWith('audio/')
  )
    return Response.json(
      { error: 'Conversation recordings must be audio files.' },
      { status: 400 },
    );
  // R2 is unbound in the current production deployment (r2_buckets: []).
  // Local OCR/QR reading already happens entirely in the browser before
  // this request is sent, so a scan that found a name and company still
  // saves normally - only the original file and any server-side
  // extraction (which needs to read that file back) are unavailable.
  // A file with nothing else to go on can't become a useful lead without
  // one of those, so that specific case is rejected with an actionable
  // message instead of silently saving an "Unidentified visitor" record
  // no one can ever recover the real details for.
  const storageOk = filesAvailable();
  if (file && !storageOk && (!suppliedFullName || !suppliedCompany))
    return Response.json(
      {
        error:
          'Automatic reading of images and recordings is unavailable in this environment. Enter the visitor’s name and company to save this lead.',
        code: 'STORAGE_UNAVAILABLE',
      },
      { status: 503 },
    );
  if (file && storageOk)
    await enforceStorageEntitlement(
      database(),
      context.workspace.id,
      context.workspace.plan,
      file.size,
    );

  const now = Date.now();
  const requestedEventId = clean(request.headers.get('x-revenue-event-id'), 80);
  if (!requestedEventId)
    return Response.json(
      { error: 'Select an event before capturing a lead.' },
      { status: 409 },
    );
  const selectedEvent = await requireEventAccess(context, requestedEventId);
  if (selectedEvent.status !== 'active')
    return Response.json(
      {
        error:
          'This event is not activated for capture. Run and pass readiness first.',
      },
      { status: 409 },
    );
  const eventId = selectedEvent.id;
  if (clientCaptureId) {
    const existing = await database()
      .prepare(
        `SELECT id, full_name AS fullName, company, role, review_status AS reviewStatus, created_at AS createdAt FROM leads WHERE workspace_id=? AND event_id=? AND client_capture_id=?`,
      )
      .bind(context.workspace.id, eventId, clientCaptureId)
      .first();
    if (existing) return Response.json({ lead: existing, duplicate: true });
  }
  const leadId = crypto.randomUUID();
  const fullName = suppliedFullName || 'Unidentified visitor';
  const company = suppliedCompany || 'Company pending';
  const account = suppliedCompany
    ? await accountIdentity(context.workspace.id, suppliedCompany)
    : null;
  const duplicate = await database()
    .prepare(
      `SELECT id,full_name AS fullName,company,email,phone FROM leads WHERE workspace_id=? AND event_id=? AND review_status NOT IN ('erased','merged') AND ((?!='' AND email=?) OR (?!='' AND phone=?) OR (? IS NOT NULL AND account_id=? AND LOWER(full_name)=LOWER(?))) ORDER BY CASE WHEN ?!='' AND email=? THEN 0 WHEN ?!='' AND phone=? THEN 1 ELSE 2 END,created_at ASC LIMIT 1`,
    )
    .bind(
      context.workspace.id,
      eventId,
      email,
      email,
      phone,
      phone,
      account?.id || null,
      account?.id || null,
      fullName,
      email,
      email,
      phone,
      phone,
    )
    .first<{
      id: string;
      fullName: string;
      company: string;
      email: string | null;
      phone: string | null;
    }>();
  // Workspace-wide identity resolution, independent of the event-scoped
  // duplicate check above: the same person met at a different event must
  // resolve to the same contact, which an event-scoped query can never see.
  const contact = await resolveContact(database(), context.workspace.id, {
    fullName,
    email,
    phone,
    accountId: account?.id || null,
  });
  const interactionId = note ? crypto.randomUUID() : null;
  const taskId = nextAction ? crypto.randomUUID() : null;
  const attachmentKind = ['card', 'badge', 'qr', 'audio'].includes(
    requestedAttachmentKind,
  )
    ? requestedAttachmentKind
    : 'document';
  const source = file ? attachmentKind : 'manual';
  const assetId = file && storageOk ? crypto.randomUUID() : null;
  let storageKey: string | null = null;
  if (file && assetId) {
    const safeName =
      file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120) || 'capture';
    storageKey = `${context.workspace.id}/lead-captures/${leadId}/${assetId}-${safeName}`;
    await revenueEnv().FILES.put(storageKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        workspaceId: context.workspace.id,
        leadId,
        uploadedBy: context.user.id,
        kind: attachmentKind,
      },
    });
  }
  const statements = [
    database()
      .prepare(`
    INSERT INTO leads (id, workspace_id, event_id, account_id, contact_id, client_capture_id, owner_id, full_name, company, role, email, phone, source, review_status, custom_fields_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
      .bind(
        leadId,
        context.workspace.id,
        eventId,
        account?.id || null,
        contact.contactId,
        clientCaptureId || null,
        context.user.id,
        fullName,
        company,
        role || null,
        email || null,
        phone || null,
        source,
        // A visitor's personal workspace has no second reviewer — the
        // capturer confirming the fields on the way in is the review.
        context.workspace.kind === 'visitor' ? 'confirmed' : 'needs_review',
        JSON.stringify(customFieldEntries),
        now,
        now,
      ),
  ];
  statements.push(
    database()
      .prepare(
        `INSERT INTO lead_assignment_history (id,workspace_id,lead_id,previous_owner_id,owner_id,reason,changed_by,created_at) VALUES (?,?,?,NULL,?,'captured_by',?,?)`,
      )
      .bind(
        crypto.randomUUID(),
        context.workspace.id,
        leadId,
        context.user.id,
        context.user.id,
        now,
      ),
  );
  if (duplicate) {
    const reasons = [
      ...(email && duplicate.email === email ? ['same_email'] : []),
      ...(phone && duplicate.phone === phone ? ['same_phone'] : []),
      ...(duplicate.fullName.toLowerCase() === fullName.toLowerCase() &&
      duplicate.company.toLowerCase() === company.toLowerCase()
        ? ['same_name_company']
        : []),
    ];
    statements.push(
      database()
        .prepare(
          `INSERT INTO lead_duplicate_suggestions (id,workspace_id,source_lead_id,target_lead_id,status,confidence_basis_points,reasons_json,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          leadId,
          duplicate.id,
          reasons.includes('same_email')
            ? 9800
            : reasons.includes('same_phone')
              ? 9500
              : 8000,
          JSON.stringify(reasons),
          now,
          now,
        ),
    );
  }
  for (const channel of consentChannels)
    statements.push(
      database()
        .prepare(
          `INSERT INTO lead_consents (id,workspace_id,lead_id,purpose,channel,status,source,captured_at,updated_by,updated_at) VALUES (?,?,?,'follow_up',?,'granted',?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          leadId,
          channel,
          consentSource,
          now,
          context.user.id,
          now,
        ),
    );
  // Same ordering requirement as the account insert below: this has to
  // land before the lead insert in the final batch, and before the account
  // insert if a new contact references it. unshift() puts whichever call
  // runs last at index 0, so this call must execute BEFORE the account
  // block's unshift() for the final order to come out [account, contact,
  // lead, ...].
  if (contact.isNew)
    statements.unshift(
      database()
        .prepare(
          `INSERT INTO contacts (id, workspace_id, full_name, email, phone, primary_account_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          contact.contactId,
          context.workspace.id,
          fullName,
          email || null,
          phone || null,
          account?.id || null,
          now,
          now,
        ),
    );
  // Medium-confidence account+name evidence never auto-attaches (Phase 5:
  // never merge solely on a shared name), so it always creates a new
  // contact above and separately records the match here for a human to
  // confirm or dismiss - the same shape lead_duplicate_suggestions already
  // uses for the equivalent lead-level decision.
  if (contact.suggestedContactId)
    statements.push(
      database()
        .prepare(
          `INSERT INTO contact_duplicate_suggestions (id,workspace_id,source_contact_id,target_contact_id,status,confidence_basis_points,reasons_json,created_at,updated_at) VALUES (?,?,?,?,'pending',8000,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          contact.contactId,
          contact.suggestedContactId,
          JSON.stringify(['same_account_and_name']),
          now,
          now,
        ),
    );
  if (account)
    statements.unshift(
      database()
        .prepare(
          `INSERT INTO accounts (id, workspace_id, name, normalized_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?) ON CONFLICT(workspace_id, normalized_name) DO UPDATE SET name=excluded.name, updated_at=excluded.updated_at`,
        )
        .bind(
          account.id,
          context.workspace.id,
          suppliedCompany,
          account.normalized,
          now,
          now,
        ),
    );

  if (interactionId)
    statements.push(
      database()
        .prepare(`
    INSERT INTO interactions (id, workspace_id, lead_id, note, source, occurred_at, created_at)
    VALUES (?, ?, ?, ?, 'typed_note', ?, ?)
  `)
        .bind(interactionId, context.workspace.id, leadId, note, now, now),
    );
  if (taskId)
    statements.push(
      database()
        .prepare(`
    INSERT INTO tasks (id, workspace_id, lead_id, owner_id, title, due_date, status, source_interaction_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `)
        .bind(
          taskId,
          context.workspace.id,
          leadId,
          context.user.id,
          nextAction,
          dueDate || null,
          interactionId,
          now,
          now,
        ),
    );
  if (file && assetId && storageKey)
    statements.push(
      database()
        .prepare(
          `INSERT INTO lead_capture_assets (id, workspace_id, lead_id, kind, original_name, storage_key, content_type, size_bytes, processing_status, extracted_json, accepted_fields_json, reviewed_by, reviewed_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          assetId,
          context.workspace.id,
          leadId,
          attachmentKind,
          file.name.slice(0, 180),
          storageKey,
          file.type,
          file.size,
          localOcrConfirmed ? 'confirmed' : 'stored_pending_extraction',
          localOcrConfirmed
            ? JSON.stringify({
                fullName: suppliedFullName || null,
                company: suppliedCompany || null,
                role: role || null,
                email: email || null,
                phone: phone || null,
                transcript: null,
                confidence: null,
                fieldConfidence: null,
                warnings: [
                  'Free on-device OCR result reviewed by the capturing user.',
                ],
                method: 'tesseract_js_and_qr',
              })
            : null,
          localOcrConfirmed ? JSON.stringify(localOcrFields) : null,
          localOcrConfirmed ? context.user.id : null,
          localOcrConfirmed ? now : null,
          context.user.id,
          now,
        ),
    );
  statements.push(
    auditStatement(context, 'lead.created', 'lead', leadId, {
      source,
      consentChannels,
      captureAssistance: localOcrConfirmed ? 'local_ocr_reviewed' : null,
    }),
  );

  try {
    await database().batch(statements);
  } catch (error) {
    if (storageKey) await revenueEnv().FILES.delete(storageKey);
    if (isEntitlementConstraint(error, 'STORAGE_LIMIT'))
      throw storageLimitResponse(context.workspace.plan);
    throw error;
  }
  return Response.json(
    {
      lead: {
        id: leadId,
        fullName,
        company,
        role,
        email,
        phone,
        note,
        nextAction,
        dueDate,
        reviewStatus: 'needs_review',
        qualificationState: 'unqualified',
        ownerId: context.user.id,
        emailConsentStatus: consentChannels.includes('email')
          ? 'granted'
          : null,
        whatsappConsentStatus: consentChannels.includes('whatsapp')
          ? 'granted'
          : null,
        duplicateLeadId: duplicate?.id || null,
        duplicateLeadName: duplicate?.fullName || null,
        captureStatus: assetId
          ? localOcrConfirmed
            ? 'confirmed'
            : 'stored_pending_extraction'
          : null,
        captureKind: assetId ? attachmentKind : null,
        createdAt: now,
      },
      asset: assetId
        ? {
            id: assetId,
            kind: attachmentKind,
            processingStatus: localOcrConfirmed
              ? 'confirmed'
              : 'stored_pending_extraction',
          }
        : null,
      // Only set when a file was supplied but storage isn't available. The
      // contact fields - whatever was typed, or filled by on-device OCR,
      // which never touches storage - were saved normally either way; this
      // is purely about the original file and server-side extraction.
      warning:
        file && !storageOk
          ? localOcrConfirmed
            ? 'File storage is unavailable in this environment, so the original could not be kept. The on-device reading of the contact fields is unaffected.'
            : 'File storage is unavailable in this environment, so the original could not be kept and automatic reading could not run. The lead was saved with the details entered.'
          : null,
    },
    { status: 201 },
  );
}
