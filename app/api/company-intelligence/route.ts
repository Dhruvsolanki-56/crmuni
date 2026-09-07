import { auditStatement, database, requireRole, requireWorkspace, revenueEnv } from '@/lib/db';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown) => clean(value, 2000).split(',').map((item) => item.trim()).filter(Boolean).slice(0, 30);
const allowedFiles = new Set(['application/pdf', 'text/plain', 'text/csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'image/png', 'image/jpeg']);

export async function GET(request: Request) {
  const context = await requireWorkspace(request); const db = database();
  const [profile, products, icps, rules, sources] = await Promise.all([
    db.prepare(`SELECT legal_name AS legalName, website_url AS websiteUrl, description, target_industries_json AS targetIndustries, target_geographies_json AS targetGeographies, event_objective AS eventObjective, onboarding_step AS onboardingStep FROM company_profiles WHERE workspace_id = ?`).bind(context.workspace.id).first(),
    db.prepare(`SELECT id, name, kind, description, buyer_roles_json AS buyerRoles, pain_points_json AS painPoints, status FROM products WHERE workspace_id = ? AND status = 'active' ORDER BY created_at DESC`).bind(context.workspace.id).all(),
    db.prepare(`SELECT id, name, industries_json AS industries, company_sizes_json AS companySizes, geographies_json AS geographies, buyer_roles_json AS buyerRoles, must_have_signals_json AS mustHaveSignals, disqualifiers_json AS disqualifiers FROM ideal_customer_profiles WHERE workspace_id = ? ORDER BY created_at DESC`).bind(context.workspace.id).all(),
    db.prepare(`SELECT id, label, field, operator, expected_value AS expectedValue, weight, rule_type AS ruleType, status FROM qualification_rules WHERE workspace_id = ? AND status = 'active' ORDER BY created_at DESC`).bind(context.workspace.id).all(),
    db.prepare(`SELECT id, name, source_type AS sourceType, source_url AS sourceUrl, content_type AS contentType, size_bytes AS sizeBytes, status, created_at AS createdAt FROM knowledge_sources WHERE workspace_id = ? ORDER BY created_at DESC`).bind(context.workspace.id).all(),
  ]);
  const parse = (value: unknown) => { if (typeof value !== 'string') return []; try { return JSON.parse(value); } catch { return []; } };
  return Response.json({ profile: profile ? { ...profile, targetIndustries: parse(profile.targetIndustries), targetGeographies: parse(profile.targetGeographies) } : null,
    products: products.results.map((item) => ({ ...item, buyerRoles: parse(item.buyerRoles), painPoints: parse(item.painPoints) })),
    icps: icps.results.map((item) => ({ ...item, industries: parse(item.industries), companySizes: parse(item.companySizes), geographies: parse(item.geographies), buyerRoles: parse(item.buyerRoles), mustHaveSignals: parse(item.mustHaveSignals), disqualifiers: parse(item.disqualifiers) })),
    rules: rules.results, sources: sources.results });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request); requireRole(context, ['owner', 'admin', 'manager']); const db = database(); const now = Date.now();
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ error: 'Choose a file to upload.' }, { status: 400 });
    if (!allowedFiles.has(file.type) || file.size > 10 * 1024 * 1024) return Response.json({ error: 'Use PDF, DOCX, XLSX, CSV, TXT, PNG or JPG files up to 10 MB.' }, { status: 400 });
    const id = crypto.randomUUID(); const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 120); const key = `${context.workspace.id}/${id}/${safeName}`;
    await revenueEnv().FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { workspaceId: context.workspace.id, uploadedBy: context.user.id } });
    await db.batch([
      db.prepare(`INSERT INTO knowledge_sources (id, workspace_id, name, source_type, storage_key, content_type, size_bytes, status, created_by, created_at) VALUES (?, ?, ?, 'file', ?, ?, ?, 'stored', ?, ?)`).bind(id, context.workspace.id, file.name.slice(0, 180), key, file.type, file.size, context.user.id, now),
      auditStatement(context, 'knowledge.uploaded', 'knowledge_source', id, { name: file.name, size: file.size }),
    ]);
    return Response.json({ source: { id, name: file.name, sourceType: 'file', contentType: file.type, sizeBytes: file.size, status: 'stored', createdAt: now } }, { status: 201 });
  }
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 40);
  if (action === 'save_profile') {
    const legalName = clean(body.legalName, 160); if (!legalName) return Response.json({ error: 'Company name is required.' }, { status: 400 });
    const websiteUrl = clean(body.websiteUrl, 500); if (websiteUrl) { try { const url = new URL(websiteUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { return Response.json({ error: 'Enter a valid HTTP or HTTPS website URL.' }, { status: 400 }); } }
    await db.batch([
      db.prepare(`INSERT INTO company_profiles (workspace_id, legal_name, website_url, description, target_industries_json, target_geographies_json, event_objective, onboarding_step, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?) ON CONFLICT(workspace_id) DO UPDATE SET legal_name=excluded.legal_name, website_url=excluded.website_url, description=excluded.description, target_industries_json=excluded.target_industries_json, target_geographies_json=excluded.target_geographies_json, event_objective=excluded.event_objective, onboarding_step=MAX(company_profiles.onboarding_step,2), updated_by=excluded.updated_by, updated_at=excluded.updated_at`).bind(context.workspace.id, legalName, websiteUrl || null, clean(body.description, 3000) || null, JSON.stringify(list(body.targetIndustries)), JSON.stringify(list(body.targetGeographies)), clean(body.eventObjective, 1000) || null, context.user.id, now),
      auditStatement(context, 'company_profile.updated', 'company_profile', context.workspace.id),
    ]); return Response.json({ ok: true });
  }
  if (action === 'add_product') {
    const name = clean(body.name, 160); const kind = clean(body.kind, 20); if (!name || !['product', 'service'].includes(kind)) return Response.json({ error: 'Product/service name and type are required.' }, { status: 400 });
    const id = crypto.randomUUID(); await db.batch([db.prepare(`INSERT INTO products (id, workspace_id, name, kind, description, buyer_roles_json, pain_points_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`).bind(id, context.workspace.id, name, kind, clean(body.description, 2000) || null, JSON.stringify(list(body.buyerRoles)), JSON.stringify(list(body.painPoints)), now, now), auditStatement(context, 'product.created', 'product', id)]); return Response.json({ ok: true, id }, { status: 201 });
  }
  if (action === 'add_icp') {
    const name = clean(body.name, 160); if (!name) return Response.json({ error: 'ICP name is required.' }, { status: 400 }); const id = crypto.randomUUID();
    await db.batch([db.prepare(`INSERT INTO ideal_customer_profiles (id, workspace_id, name, industries_json, company_sizes_json, geographies_json, buyer_roles_json, must_have_signals_json, disqualifiers_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(id, context.workspace.id, name, JSON.stringify(list(body.industries)), JSON.stringify(list(body.companySizes)), JSON.stringify(list(body.geographies)), JSON.stringify(list(body.buyerRoles)), JSON.stringify(list(body.mustHaveSignals)), JSON.stringify(list(body.disqualifiers)), now, now), auditStatement(context, 'icp.created', 'ideal_customer_profile', id)]); return Response.json({ ok: true, id }, { status: 201 });
  }
  if (action === 'add_rule') {
    const label = clean(body.label, 160); const field = clean(body.field, 60); const expectedValue = clean(body.expectedValue, 500); const weight = Math.max(-100, Math.min(100, Number(body.weight) || 0)); if (!label || !field || !expectedValue) return Response.json({ error: 'Rule label, field and expected value are required.' }, { status: 400 }); const id = crypto.randomUUID();
    await db.batch([db.prepare(`INSERT INTO qualification_rules (id, workspace_id, label, field, operator, expected_value, weight, rule_type, status, created_at) VALUES (?, ?, ?, ?, 'contains', ?, ?, ?, 'active', ?)`).bind(id, context.workspace.id, label, field, expectedValue, weight, weight < 0 ? 'negative' : 'positive', now), auditStatement(context, 'qualification_rule.created', 'qualification_rule', id)]); return Response.json({ ok: true, id }, { status: 201 });
  }
  if (action === 'add_url') {
    const name = clean(body.name, 180); const sourceUrl = clean(body.sourceUrl, 500); try { const url = new URL(sourceUrl); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); } catch { return Response.json({ error: 'Enter a valid HTTP or HTTPS URL.' }, { status: 400 }); }
    const id = crypto.randomUUID(); await db.batch([db.prepare(`INSERT INTO knowledge_sources (id, workspace_id, name, source_type, source_url, status, created_by, created_at) VALUES (?, ?, ?, 'website', ?, 'pending_review', ?, ?)`).bind(id, context.workspace.id, name || new URL(sourceUrl).hostname, sourceUrl, context.user.id, now), auditStatement(context, 'knowledge_url.added', 'knowledge_source', id)]); return Response.json({ ok: true, id }, { status: 201 });
  }
  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
