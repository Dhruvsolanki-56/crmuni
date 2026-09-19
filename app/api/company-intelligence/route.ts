import {
  auditStatement,
  database,
  requireRole,
  requireWorkspace,
  revenueEnv,
} from '@/lib/db';
import { validateUpload } from '@/lib/file-validation';
import {
  enforceStorageEntitlement,
  isEntitlementConstraint,
  storageLimitResponse,
} from '@/lib/entitlements';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown) =>
  clean(value, 2000)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
const allowedFiles = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
]);

async function sha256Hex(value: ArrayBuffer | string) {
  const bytes =
    typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const db = database();
  const [profile, products, icps, rules, sources, claims, profileVersions] =
    await Promise.all([
      db
        .prepare(
          `SELECT legal_name AS legalName, website_url AS websiteUrl, description, target_industries_json AS targetIndustries, target_geographies_json AS targetGeographies, event_objective AS eventObjective, onboarding_step AS onboardingStep FROM company_profiles WHERE workspace_id = ?`,
        )
        .bind(context.workspace.id)
        .first(),
      db
        .prepare(
          `SELECT id, name, kind, description, buyer_roles_json AS buyerRoles, pain_points_json AS painPoints, status FROM products WHERE workspace_id = ? AND status = 'active' ORDER BY created_at DESC`,
        )
        .bind(context.workspace.id)
        .all(),
      db
        .prepare(
          `SELECT id, name, industries_json AS industries, company_sizes_json AS companySizes, geographies_json AS geographies, buyer_roles_json AS buyerRoles, must_have_signals_json AS mustHaveSignals, disqualifiers_json AS disqualifiers FROM ideal_customer_profiles WHERE workspace_id = ? ORDER BY created_at DESC`,
        )
        .bind(context.workspace.id)
        .all(),
      db
        .prepare(
          `SELECT id, label, field, operator, expected_value AS expectedValue, weight, rule_type AS ruleType, status FROM qualification_rules WHERE workspace_id = ? AND status = 'active' ORDER BY created_at DESC`,
        )
        .bind(context.workspace.id)
        .all(),
      db
        .prepare(
          `SELECT s.id, s.name, s.source_type AS sourceType, s.source_url AS sourceUrl, s.content_type AS contentType, s.size_bytes AS sizeBytes, s.status, s.created_at AS createdAt, i.content_hash AS contentHash, i.extraction_method AS extractionMethod, i.status AS ingestionStatus, i.attempts, i.last_error AS lastError, i.review_note AS reviewNote, i.reviewed_by AS reviewedBy, i.reviewed_at AS reviewedAt FROM knowledge_sources s LEFT JOIN knowledge_ingestions i ON i.source_id=s.id AND i.workspace_id=s.workspace_id WHERE s.workspace_id = ? ORDER BY s.created_at DESC`,
        )
        .bind(context.workspace.id)
        .all(),
      db
        .prepare(
          `SELECT c.id,c.claim_text AS claimText,c.evidence_note AS evidenceNote,c.source_id AS sourceId,c.status,c.version,c.created_by AS createdBy,c.approved_by AS approvedBy,c.approved_at AS approvedAt,c.created_at AS createdAt,s.name AS sourceName FROM approved_claims c LEFT JOIN knowledge_sources s ON s.id=c.source_id AND s.workspace_id=c.workspace_id WHERE c.workspace_id=? ORDER BY CASE c.status WHEN 'draft' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END,c.updated_at DESC`,
        )
        .bind(context.workspace.id)
        .all(),
      db
        .prepare(
          `SELECT id,version,snapshot_json AS snapshotJson,change_reason AS changeReason,created_by AS createdBy,created_at AS createdAt FROM company_profile_versions WHERE workspace_id=? ORDER BY version DESC LIMIT 20`,
        )
        .bind(context.workspace.id)
        .all(),
    ]);
  const parse = (value: unknown) => {
    if (typeof value !== 'string') return [];
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  };
  return Response.json({
    profile: profile
      ? {
          ...profile,
          targetIndustries: parse(profile.targetIndustries),
          targetGeographies: parse(profile.targetGeographies),
        }
      : null,
    products: products.results.map((item) => ({
      ...item,
      buyerRoles: parse(item.buyerRoles),
      painPoints: parse(item.painPoints),
    })),
    icps: icps.results.map((item) => ({
      ...item,
      industries: parse(item.industries),
      companySizes: parse(item.companySizes),
      geographies: parse(item.geographies),
      buyerRoles: parse(item.buyerRoles),
      mustHaveSignals: parse(item.mustHaveSignals),
      disqualifiers: parse(item.disqualifiers),
    })),
    rules: rules.results,
    sources: sources.results,
    claims: claims.results,
    profileVersions: profileVersions.results.map((item) => ({
      ...item,
      snapshot: parse(item.snapshotJson),
    })),
  });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin', 'manager']);
  const db = database();
  const now = Date.now();
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File))
      return Response.json(
        { error: 'Choose a file to upload.' },
        { status: 400 },
      );
    if (await validateUpload(file, allowedFiles, 10 * 1024 * 1024))
      return Response.json(
        {
          error:
            'The file content must match a PDF, DOCX, XLSX, CSV, TXT, PNG or JPG file up to 10 MB.',
        },
        { status: 400 },
      );
    await enforceStorageEntitlement(
      db,
      context.workspace.id,
      context.workspace.plan,
      file.size,
    );
    const bytes = await file.arrayBuffer();
    const contentHash = await sha256Hex(bytes);
    const duplicate = await db
      .prepare(
        `SELECT s.id FROM knowledge_ingestions i JOIN knowledge_sources s ON s.id=i.source_id AND s.workspace_id=i.workspace_id WHERE i.workspace_id=? AND i.content_hash=? AND i.status!='removed' LIMIT 1`,
      )
      .bind(context.workspace.id, contentHash)
      .first();
    if (duplicate)
      return Response.json(
        {
          error:
            'This exact file is already in the workspace knowledge library.',
        },
        { status: 409 },
      );
    const id = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120);
    const key = `${context.workspace.id}/${id}/${safeName}`;
    const canExtractPlainText =
      file.type === 'text/plain' || file.type === 'text/csv';
    const extractionMethod = canExtractPlainText
      ? 'plain_text_v1'
      : 'binary_original';
    const extractedText = canExtractPlainText
      ? new TextDecoder('utf-8', { fatal: false })
          .decode(bytes)
          .replaceAll('\0', '')
          .slice(0, 100_000)
      : null;
    await revenueEnv().FILES.put(key, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        workspaceId: context.workspace.id,
        uploadedBy: context.user.id,
        sha256: contentHash,
      },
    });
    try {
      await db.batch([
        db
          .prepare(
            `INSERT INTO knowledge_sources (id, workspace_id, name, source_type, storage_key, content_type, size_bytes, status, created_by, created_at) VALUES (?, ?, ?, 'file', ?, ?, ?, 'pending_review', ?, ?)`,
          )
          .bind(
            id,
            context.workspace.id,
            file.name.slice(0, 180),
            key,
            file.type,
            file.size,
            context.user.id,
            now,
          ),
        db
          .prepare(
            `INSERT INTO knowledge_ingestions (id,workspace_id,source_id,status,content_hash,extraction_method,extracted_text,provenance_json,attempts,created_at,updated_at) VALUES (?,?,?,'ready_for_review',?,?,?,?,1,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            id,
            contentHash,
            extractionMethod,
            extractedText,
            JSON.stringify({
              sourceType: 'file',
              originalName: file.name,
              contentType: file.type,
              sizeBytes: file.size,
              uploadedBy: context.user.id,
            }),
            now,
            now,
          ),
        auditStatement(context, 'knowledge.uploaded', 'knowledge_source', id, {
          name: file.name,
          size: file.size,
          contentHash,
          extractionMethod,
        }),
      ]);
    } catch (error) {
      await revenueEnv().FILES.delete(key);
      if (isEntitlementConstraint(error, 'STORAGE_LIMIT'))
        throw storageLimitResponse(context.workspace.plan);
      throw error;
    }
    return Response.json(
      {
        source: {
          id,
          name: file.name,
          sourceType: 'file',
          contentType: file.type,
          sizeBytes: file.size,
          status: 'pending_review',
          ingestionStatus: 'ready_for_review',
          contentHash,
          extractionMethod,
          createdAt: now,
        },
      },
      { status: 201 },
    );
  }
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 40);
  if (action === 'remove_source') {
    const id = clean(body.id, 80);
    const source = await db
      .prepare(
        `SELECT storage_key AS storageKey FROM knowledge_sources WHERE id=? AND workspace_id=?`,
      )
      .bind(id, context.workspace.id)
      .first<{ storageKey: string | null }>();
    if (!source)
      return Response.json(
        { error: 'Knowledge source not found.' },
        { status: 404 },
      );
    const activeClaim = await db
      .prepare(
        `SELECT id FROM approved_claims WHERE workspace_id=? AND source_id=? AND status IN ('draft','approved') LIMIT 1`,
      )
      .bind(context.workspace.id, id)
      .first();
    if (activeClaim)
      return Response.json(
        { error: 'Retire claims linked to this source before removing it.' },
        { status: 409 },
      );
    await db.batch([
      db
        .prepare(
          `UPDATE knowledge_sources SET storage_key=NULL,content_type=NULL,size_bytes=0,status='removed' WHERE id=? AND workspace_id=?`,
        )
        .bind(id, context.workspace.id),
      db
        .prepare(
          `UPDATE knowledge_ingestions SET status='removed',extracted_text=NULL,updated_at=? WHERE source_id=? AND workspace_id=?`,
        )
        .bind(now, id, context.workspace.id),
      auditStatement(context, 'knowledge.removed', 'knowledge_source', id),
    ]);
    if (source.storageKey) await revenueEnv().FILES.delete(source.storageKey);
    return Response.json({ ok: true });
  }
  if (action === 'archive_product') {
    const id = clean(body.id, 80);
    const result = await db
      .prepare(
        `UPDATE products SET status='archived',updated_at=? WHERE id=? AND workspace_id=? AND status='active'`,
      )
      .bind(now, id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'Active product or service not found.' },
        { status: 404 },
      );
    await auditStatement(context, 'product.archived', 'product', id).run();
    return Response.json({ ok: true });
  }
  if (action === 'remove_icp') {
    const id = clean(body.id, 80);
    const result = await db
      .prepare(
        `DELETE FROM ideal_customer_profiles WHERE id=? AND workspace_id=?`,
      )
      .bind(id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'Ideal customer profile not found.' },
        { status: 404 },
      );
    await auditStatement(
      context,
      'icp.removed',
      'ideal_customer_profile',
      id,
    ).run();
    return Response.json({ ok: true });
  }
  if (action === 'archive_rule') {
    const id = clean(body.id, 80);
    const result = await db
      .prepare(
        `UPDATE qualification_rules SET status='archived' WHERE id=? AND workspace_id=? AND status='active'`,
      )
      .bind(id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'Active qualification rule not found.' },
        { status: 404 },
      );
    await auditStatement(
      context,
      'qualification_rule.archived',
      'qualification_rule',
      id,
    ).run();
    return Response.json({ ok: true });
  }
  if (action === 'approve_source' || action === 'reject_source') {
    requireRole(context, ['owner', 'admin']);
    const id = clean(body.id, 80);
    const nextStatus = action === 'approve_source' ? 'approved' : 'rejected';
    const reviewNote = clean(body.reviewNote, 1000);
    const reviewable = await db
      .prepare(
        `SELECT s.id FROM knowledge_sources s JOIN knowledge_ingestions i ON i.source_id=s.id AND i.workspace_id=s.workspace_id WHERE s.id=? AND s.workspace_id=? AND s.status IN ('stored','pending_review') AND i.status='ready_for_review'`,
      )
      .bind(id, context.workspace.id)
      .first();
    if (!reviewable)
      return Response.json(
        { error: 'Reviewable knowledge source not found.' },
        { status: 404 },
      );
    await db.batch([
      db
        .prepare(
          `UPDATE knowledge_sources SET status=? WHERE id=? AND workspace_id=? AND status IN ('stored','pending_review')`,
        )
        .bind(nextStatus, id, context.workspace.id),
      db
        .prepare(
          `UPDATE knowledge_ingestions SET status=?,review_note=?,reviewed_by=?,reviewed_at=?,updated_at=? WHERE source_id=? AND workspace_id=? AND status='ready_for_review'`,
        )
        .bind(
          nextStatus,
          reviewNote || null,
          context.user.id,
          now,
          now,
          id,
          context.workspace.id,
        ),
      auditStatement(
        context,
        `knowledge.${nextStatus}`,
        'knowledge_source',
        id,
        { reviewNote: reviewNote || null },
      ),
    ]);
    return Response.json({ ok: true, status: nextStatus });
  }
  if (action === 'retry_source') {
    requireRole(context, ['owner', 'admin']);
    const id = clean(body.id, 80);
    const result = await db
      .prepare(
        `UPDATE knowledge_ingestions SET status='ready_for_review',attempts=1,last_error=NULL,review_note=NULL,reviewed_by=NULL,reviewed_at=NULL,updated_at=? WHERE source_id=? AND workspace_id=? AND status='failed'`,
      )
      .bind(now, id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'Failed knowledge ingestion not found.' },
        { status: 404 },
      );
    await db.batch([
      db
        .prepare(
          `UPDATE knowledge_sources SET status='pending_review' WHERE id=? AND workspace_id=?`,
        )
        .bind(id, context.workspace.id),
      auditStatement(
        context,
        'knowledge.retry_requested',
        'knowledge_source',
        id,
      ),
    ]);
    return Response.json({ ok: true, status: 'ready_for_review' });
  }
  if (action === 'add_claim') {
    const claimText = clean(body.claimText, 1000);
    const evidenceNote = clean(body.evidenceNote, 2000);
    const sourceId = clean(body.sourceId, 80);
    if (claimText.length < 5 || (!evidenceNote && !sourceId))
      return Response.json(
        {
          error:
            'Add a specific claim and either an evidence source or evidence note.',
        },
        { status: 400 },
      );
    if (sourceId) {
      const source = await db
        .prepare(
          `SELECT id FROM knowledge_sources WHERE id=? AND workspace_id=?`,
        )
        .bind(sourceId, context.workspace.id)
        .first();
      if (!source)
        return Response.json(
          { error: 'Evidence source not found.' },
          { status: 404 },
        );
    }
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO approved_claims (id,workspace_id,claim_text,evidence_note,source_id,status,version,created_by,created_at,updated_at) VALUES (?,?,?,?,?,'draft',1,?,?,?)`,
        )
        .bind(
          id,
          context.workspace.id,
          claimText,
          evidenceNote || null,
          sourceId || null,
          context.user.id,
          now,
          now,
        ),
      auditStatement(context, 'claim.created', 'approved_claim', id, {
        sourceId: sourceId || null,
      }),
    ]);
    return Response.json({ ok: true, id, status: 'draft' }, { status: 201 });
  }
  if (action === 'approve_claim') {
    requireRole(context, ['owner', 'admin']);
    const id = clean(body.id, 80);
    const claim = await db
      .prepare(
        `SELECT c.source_id AS sourceId,s.status AS sourceStatus FROM approved_claims c LEFT JOIN knowledge_sources s ON s.id=c.source_id AND s.workspace_id=c.workspace_id WHERE c.id=? AND c.workspace_id=? AND c.status='draft'`,
      )
      .bind(id, context.workspace.id)
      .first<{ sourceId: string | null; sourceStatus: string | null }>();
    if (!claim)
      return Response.json(
        { error: 'Draft claim not found.' },
        { status: 404 },
      );
    if (claim.sourceId && claim.sourceStatus !== 'approved')
      return Response.json(
        {
          error:
            'Review and approve the linked evidence source before approving this claim.',
        },
        { status: 409 },
      );
    await db.batch([
      db
        .prepare(
          `UPDATE approved_claims SET status='approved',approved_by=?,approved_at=?,updated_at=? WHERE id=? AND workspace_id=? AND status='draft'`,
        )
        .bind(context.user.id, now, now, id, context.workspace.id),
      auditStatement(context, 'claim.approved', 'approved_claim', id),
    ]);
    return Response.json({ ok: true, status: 'approved' });
  }
  if (action === 'retire_claim') {
    requireRole(context, ['owner', 'admin']);
    const id = clean(body.id, 80);
    const result = await db
      .prepare(
        `UPDATE approved_claims SET status='retired',retired_by=?,retired_at=?,updated_at=? WHERE id=? AND workspace_id=? AND status IN ('draft','approved')`,
      )
      .bind(context.user.id, now, now, id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'Active claim not found.' },
        { status: 404 },
      );
    await auditStatement(context, 'claim.retired', 'approved_claim', id).run();
    return Response.json({ ok: true, status: 'retired' });
  }
  if (action === 'save_profile') {
    const legalName = clean(body.legalName, 160);
    if (!legalName)
      return Response.json(
        { error: 'Company name is required.' },
        { status: 400 },
      );
    const websiteUrl = clean(body.websiteUrl, 500);
    if (websiteUrl) {
      try {
        const url = new URL(websiteUrl);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        return Response.json(
          { error: 'Enter a valid HTTP or HTTPS website URL.' },
          { status: 400 },
        );
      }
    }
    const snapshot = {
      legalName,
      websiteUrl: websiteUrl || null,
      description: clean(body.description, 3000) || null,
      targetIndustries: list(body.targetIndustries),
      targetGeographies: list(body.targetGeographies),
      eventObjective: clean(body.eventObjective, 1000) || null,
    };
    const latest = await db
      .prepare(
        `SELECT COALESCE(MAX(version),0) AS version FROM company_profile_versions WHERE workspace_id=?`,
      )
      .bind(context.workspace.id)
      .first<{ version: number }>();
    const version = Number(latest?.version || 0) + 1;
    await db.batch([
      db
        .prepare(
          `INSERT INTO company_profiles (workspace_id, legal_name, website_url, description, target_industries_json, target_geographies_json, event_objective, onboarding_step, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET legal_name=excluded.legal_name, website_url=excluded.website_url, description=excluded.description, target_industries_json=excluded.target_industries_json, target_geographies_json=excluded.target_geographies_json, event_objective=excluded.event_objective, onboarding_step=MAX(company_profiles.onboarding_step,2), updated_by=excluded.updated_by, updated_at=excluded.updated_at`,
        )
        .bind(
          context.workspace.id,
          legalName,
          websiteUrl || null,
          clean(body.description, 3000) || null,
          JSON.stringify(list(body.targetIndustries)),
          JSON.stringify(list(body.targetGeographies)),
          clean(body.eventObjective, 1000) || null,
          context.user.id,
          now,
        ),
      db
        .prepare(
          `INSERT INTO company_profile_versions (id,workspace_id,version,snapshot_json,change_reason,created_by,created_at) VALUES (?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          version,
          JSON.stringify(snapshot),
          clean(body.changeReason, 500) ||
            (version === 1
              ? 'Initial company profile'
              : 'Company profile updated'),
          context.user.id,
          now,
        ),
      auditStatement(
        context,
        'company_profile.updated',
        'company_profile',
        context.workspace.id,
        { version },
      ),
    ]);
    return Response.json({ ok: true, version });
  }
  if (action === 'add_product') {
    const name = clean(body.name, 160);
    const kind = clean(body.kind, 20);
    if (!name || !['product', 'service'].includes(kind))
      return Response.json(
        { error: 'Product/service name and type are required.' },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO products (id, workspace_id, name, kind, description, buyer_roles_json, pain_points_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        )
        .bind(
          id,
          context.workspace.id,
          name,
          kind,
          clean(body.description, 2000) || null,
          JSON.stringify(list(body.buyerRoles)),
          JSON.stringify(list(body.painPoints)),
          now,
          now,
        ),
      auditStatement(context, 'product.created', 'product', id),
    ]);
    return Response.json({ ok: true, id }, { status: 201 });
  }
  if (action === 'add_icp') {
    const name = clean(body.name, 160);
    if (!name)
      return Response.json({ error: 'ICP name is required.' }, { status: 400 });
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO ideal_customer_profiles (id, workspace_id, name, industries_json, company_sizes_json, geographies_json, buyer_roles_json, must_have_signals_json, disqualifiers_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          context.workspace.id,
          name,
          JSON.stringify(list(body.industries)),
          JSON.stringify(list(body.companySizes)),
          JSON.stringify(list(body.geographies)),
          JSON.stringify(list(body.buyerRoles)),
          JSON.stringify(list(body.mustHaveSignals)),
          JSON.stringify(list(body.disqualifiers)),
          now,
          now,
        ),
      auditStatement(context, 'icp.created', 'ideal_customer_profile', id),
    ]);
    return Response.json({ ok: true, id }, { status: 201 });
  }
  if (action === 'add_rule') {
    const label = clean(body.label, 160);
    const field = clean(body.field, 60);
    const expectedValue = clean(body.expectedValue, 500);
    const weight = Math.max(-100, Math.min(100, Number(body.weight) || 0));
    if (!label || !field || !expectedValue)
      return Response.json(
        { error: 'Rule label, field and expected value are required.' },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO qualification_rules (id, workspace_id, label, field, operator, expected_value, weight, rule_type, status, created_at) VALUES (?, ?, ?, ?, 'contains', ?, ?, ?, 'active', ?)`,
        )
        .bind(
          id,
          context.workspace.id,
          label,
          field,
          expectedValue,
          weight,
          weight < 0 ? 'negative' : 'positive',
          now,
        ),
      auditStatement(
        context,
        'qualification_rule.created',
        'qualification_rule',
        id,
      ),
    ]);
    return Response.json({ ok: true, id }, { status: 201 });
  }
  if (action === 'add_url') {
    const name = clean(body.name, 180);
    const sourceUrl = clean(body.sourceUrl, 500);
    let normalizedUrl: string;
    let hostname: string;
    try {
      const url = new URL(sourceUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      url.hash = '';
      normalizedUrl = url.toString();
      hostname = url.hostname;
    } catch {
      return Response.json(
        { error: 'Enter a valid HTTP or HTTPS URL.' },
        { status: 400 },
      );
    }
    const contentHash = await sha256Hex(normalizedUrl);
    const duplicate = await db
      .prepare(
        `SELECT source_id AS sourceId FROM knowledge_ingestions WHERE workspace_id=? AND content_hash=? AND status!='removed' LIMIT 1`,
      )
      .bind(context.workspace.id, contentHash)
      .first();
    if (duplicate)
      return Response.json(
        {
          error: 'This website is already in the workspace knowledge library.',
        },
        { status: 409 },
      );
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO knowledge_sources (id, workspace_id, name, source_type, source_url, status, created_by, created_at) VALUES (?, ?, ?, 'website', ?, 'pending_review', ?, ?)`,
        )
        .bind(
          id,
          context.workspace.id,
          name || hostname,
          normalizedUrl,
          context.user.id,
          now,
        ),
      db
        .prepare(
          `INSERT INTO knowledge_ingestions (id,workspace_id,source_id,status,content_hash,extraction_method,provenance_json,attempts,created_at,updated_at) VALUES (?,?,?,'ready_for_review',?,'url_reference',?,1,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          id,
          contentHash,
          JSON.stringify({
            sourceType: 'website',
            normalizedUrl,
            submittedBy: context.user.id,
            fetchPolicy: 'not_fetched_server_side',
          }),
          now,
          now,
        ),
      auditStatement(context, 'knowledge_url.added', 'knowledge_source', id, {
        normalizedUrl,
        contentHash,
        fetchPolicy: 'not_fetched_server_side',
      }),
    ]);
    return Response.json(
      { ok: true, id, status: 'ready_for_review' },
      { status: 201 },
    );
  }
  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
