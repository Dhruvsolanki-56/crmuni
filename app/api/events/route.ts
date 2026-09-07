import { auditStatement, database, requireRole, requireWorkspace } from '@/lib/db';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown) => clean(value, 3000).split(',').map((item) => item.trim()).filter(Boolean).slice(0, 100);
const date = (value: unknown) => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : '';

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const rows = await database().prepare(`SELECT id, name, venue, hall, booth, starts_on AS startsOn, ends_on AS endsOn, timezone, budget, objective, products_json AS products, target_accounts_json AS targetAccounts, qualification_questions_json AS qualificationQuestions, team_member_ids_json AS teamMemberIds, lead_routing_rule AS leadRoutingRule, followup_sla_hours AS followupSlaHours, daily_lead_target AS dailyLeadTarget, badge_provider AS badgeProvider, qr_campaign_code AS qrCampaignCode, status FROM events WHERE workspace_id = ? ORDER BY starts_on DESC`).bind(context.workspace.id).all();
  const parse = (value: unknown) => { if (typeof value !== 'string') return []; try { return JSON.parse(value); } catch { return []; } };
  return Response.json({ events: rows.results.map((item) => ({ ...item, products: parse(item.products), targetAccounts: parse(item.targetAccounts), qualificationQuestions: parse(item.qualificationQuestions), teamMemberIds: parse(item.teamMemberIds) })) });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request); requireRole(context, ['owner', 'admin', 'manager']);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null; if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 30); const db = database(); const now = Date.now();
  if (action === 'archive') {
    const id = clean(body.id, 80); const result = await db.prepare(`UPDATE events SET status = 'archived', updated_at = ? WHERE id = ? AND workspace_id = ?`).bind(now, id, context.workspace.id).run();
    if (!result.meta.changes) return Response.json({ error: 'Event not found.' }, { status: 404 }); await auditStatement(context, 'event.archived', 'event', id).run(); return Response.json({ ok: true });
  }
  if (action === 'duplicate') {
    const sourceId = clean(body.id, 80); const source = await db.prepare(`SELECT * FROM events WHERE id = ? AND workspace_id = ?`).bind(sourceId, context.workspace.id).first<Record<string, unknown>>(); if (!source) return Response.json({ error: 'Event not found.' }, { status: 404 });
    const id = crypto.randomUUID(); await db.batch([db.prepare(`INSERT INTO events (id, workspace_id, name, venue, hall, booth, starts_on, ends_on, timezone, budget, objective, products_json, target_accounts_json, qualification_questions_json, team_member_ids_json, lead_routing_rule, followup_sla_hours, daily_lead_target, badge_provider, qr_campaign_code, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`).bind(id, context.workspace.id, `${String(source.name)} copy`.slice(0, 180), source.venue, source.hall, source.booth, source.starts_on, source.ends_on, source.timezone, source.budget, source.objective, source.products_json, source.target_accounts_json, source.qualification_questions_json, source.team_member_ids_json, source.lead_routing_rule, source.followup_sla_hours, source.daily_lead_target, source.badge_provider, crypto.randomUUID().slice(0, 8).toUpperCase(), context.user.id, now, now), auditStatement(context, 'event.duplicated', 'event', id, { sourceId })]); return Response.json({ ok: true, id }, { status: 201 });
  }
  if (!['create', 'update'].includes(action)) return Response.json({ error: 'Unknown action.' }, { status: 400 });
  const name = clean(body.name, 180); const startsOn = date(body.startsOn); const endsOn = date(body.endsOn); if (!name || !startsOn || !endsOn || endsOn < startsOn) return Response.json({ error: 'Name and a valid date range are required.' }, { status: 400 });
  const id = action === 'update' ? clean(body.id, 80) : crypto.randomUUID(); const values = [name, clean(body.venue, 180) || null, clean(body.hall, 80) || null, clean(body.booth, 80) || null, startsOn, endsOn, clean(body.timezone, 80) || context.workspace.timezone, Math.max(0, Number(body.budget) || 0), clean(body.objective, 1200) || null, JSON.stringify(list(body.products)), JSON.stringify(list(body.targetAccounts)), JSON.stringify(list(body.qualificationQuestions)), JSON.stringify(list(body.teamMemberIds)), clean(body.leadRoutingRule, 40) || 'capturer', Math.max(1, Math.min(720, Number(body.followupSlaHours) || 24)), Math.max(1, Math.min(10000, Number(body.dailyLeadTarget) || 25)), clean(body.badgeProvider, 120) || null];
  if (action === 'create') await db.batch([db.prepare(`INSERT INTO events (id, workspace_id, name, venue, hall, booth, starts_on, ends_on, timezone, budget, objective, products_json, target_accounts_json, qualification_questions_json, team_member_ids_json, lead_routing_rule, followup_sla_hours, daily_lead_target, badge_provider, qr_campaign_code, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`).bind(id, context.workspace.id, ...values, crypto.randomUUID().slice(0, 8).toUpperCase(), context.user.id, now, now), auditStatement(context, 'event.created', 'event', id)]);
  else { const result = await db.prepare(`UPDATE events SET name=?, venue=?, hall=?, booth=?, starts_on=?, ends_on=?, timezone=?, budget=?, objective=?, products_json=?, target_accounts_json=?, qualification_questions_json=?, team_member_ids_json=?, lead_routing_rule=?, followup_sla_hours=?, daily_lead_target=?, badge_provider=?, updated_at=? WHERE id=? AND workspace_id=?`).bind(...values, now, id, context.workspace.id).run(); if (!result.meta.changes) return Response.json({ error: 'Event not found.' }, { status: 404 }); await auditStatement(context, 'event.updated', 'event', id).run(); }
  return Response.json({ ok: true, id }, { status: action === 'create' ? 201 : 200 });
}
