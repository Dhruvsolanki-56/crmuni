import {
  auditStatement,
  database,
  eventAccessClause,
  requireEventAccess,
  requireRole,
  requireWorkspace,
} from '@/lib/db';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const list = (value: unknown) =>
  clean(value, 3000)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100);
const date = (value: unknown) =>
  /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : '';
const parse = (value: unknown) => {
  if (typeof value !== 'string') return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
};
const bounded = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(min, Math.min(max, parsed))
    : fallback;
};

async function assignedMembers(
  workspaceId: string,
  requestedUserIds: string[],
  currentMembershipId: string,
) {
  const userIds = [...new Set(requestedUserIds)];
  const rows = userIds.length
    ? await database()
        .prepare(
          `SELECT id,user_id AS userId FROM memberships WHERE workspace_id=? AND status='active' AND user_id IN (${userIds.map(() => '?').join(',')})`,
        )
        .bind(workspaceId, ...userIds)
        .all<{ id: string; userId: string }>()
    : { results: [] as { id: string; userId: string }[] };
  if (rows.results.length !== userIds.length)
    throw new Response('One or more selected team members are unavailable.', {
      status: 409,
    });
  const members = new Map(rows.results.map((row) => [row.id, row]));
  if (!members.has(currentMembershipId))
    members.set(currentMembershipId, { id: currentMembershipId, userId: '' });
  return [...members.values()];
}

function membershipStatements(
  eventId: string,
  workspaceId: string,
  members: { id: string }[],
  actorId: string,
  now: number,
) {
  const db = database();
  return members.map((member) =>
    db
      .prepare(
        `INSERT INTO event_memberships (id,workspace_id,event_id,membership_id,status,created_by,created_at,updated_at) VALUES (?,?,?,?,'active',?,?,?) ON CONFLICT(event_id,membership_id) DO UPDATE SET status='active',updated_at=excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(),
        workspaceId,
        eventId,
        member.id,
        actorId,
        now,
        now,
      ),
  );
}

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const access = eventAccessClause(context, 'e.id');
  const rows = await database()
    .prepare(
      `SELECT e.id,e.name,e.venue,e.hall,e.booth,e.starts_on AS startsOn,e.ends_on AS endsOn,e.timezone,e.budget,e.attribution_window_days AS attributionWindowDays,e.gross_margin_bps AS grossMarginBps,e.objective,e.products_json AS products,e.target_accounts_json AS targetAccounts,e.qualification_questions_json AS qualificationQuestions,e.team_member_ids_json AS teamMemberIds,e.lead_routing_rule AS leadRoutingRule,e.followup_sla_hours AS followupSlaHours,e.daily_lead_target AS dailyLeadTarget,e.badge_provider AS badgeProvider,e.qr_campaign_code AS qrCampaignCode,e.status FROM events e WHERE e.workspace_id=?${access.sql} ORDER BY e.starts_on DESC`,
    )
    .bind(context.workspace.id, ...access.bindings)
    .all();
  return Response.json({
    events: rows.results.map((item) => ({
      ...item,
      products: parse(item.products),
      targetAccounts: parse(item.targetAccounts),
      qualificationQuestions: parse(item.qualificationQuestions),
      teamMemberIds: parse(item.teamMemberIds),
    })),
  });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin', 'manager']);
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 30);
  const db = database();
  const now = Date.now();
  if (action === 'archive') {
    const id = clean(body.id, 80);
    await requireEventAccess(context, id, true);
    const result = await db
      .prepare(
        `UPDATE events SET status='archived',updated_at=? WHERE id=? AND workspace_id=?`,
      )
      .bind(now, id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json({ error: 'Event not found.' }, { status: 404 });
    await db.batch([
      db
        .prepare(
          `UPDATE event_memberships SET status='inactive',updated_at=? WHERE event_id=? AND workspace_id=?`,
        )
        .bind(now, id, context.workspace.id),
      auditStatement(context, 'event.archived', 'event', id),
    ]);
    return Response.json({ ok: true });
  }
  if (action === 'duplicate') {
    const sourceId = clean(body.id, 80);
    await requireEventAccess(context, sourceId, true);
    const source = await db
      .prepare(`SELECT * FROM events WHERE id=? AND workspace_id=?`)
      .bind(sourceId, context.workspace.id)
      .first<Record<string, unknown>>();
    if (!source)
      return Response.json({ error: 'Event not found.' }, { status: 404 });
    const id = crypto.randomUUID();
    const sourceMembers = await db
      .prepare(
        `SELECT membership_id AS membershipId FROM event_memberships WHERE event_id=? AND workspace_id=? AND status='active'`,
      )
      .bind(sourceId, context.workspace.id)
      .all<{ membershipId: string }>();
    const membershipIds = [
      ...new Set([
        context.membershipId,
        ...sourceMembers.results.map((item) => item.membershipId),
      ]),
    ];
    await db.batch([
      db
        .prepare(
          `INSERT INTO events (id,workspace_id,name,venue,hall,booth,starts_on,ends_on,timezone,budget,attribution_window_days,gross_margin_bps,objective,products_json,target_accounts_json,qualification_questions_json,team_member_ids_json,lead_routing_rule,followup_sla_hours,daily_lead_target,badge_provider,qr_campaign_code,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?)`,
        )
        .bind(
          id,
          context.workspace.id,
          `${String(source.name)} copy`.slice(0, 180),
          source.venue,
          source.hall,
          source.booth,
          source.starts_on,
          source.ends_on,
          source.timezone,
          source.budget,
          source.attribution_window_days,
          source.gross_margin_bps,
          source.objective,
          source.products_json,
          source.target_accounts_json,
          source.qualification_questions_json,
          source.team_member_ids_json,
          source.lead_routing_rule,
          source.followup_sla_hours,
          source.daily_lead_target,
          source.badge_provider,
          crypto.randomUUID().slice(0, 8).toUpperCase(),
          context.user.id,
          now,
          now,
        ),
      ...membershipIds.map((membershipId) =>
        db
          .prepare(
            `INSERT INTO event_memberships (id,workspace_id,event_id,membership_id,status,created_by,created_at,updated_at) VALUES (?,?,?,?,'active',?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            id,
            membershipId,
            context.user.id,
            now,
            now,
          ),
      ),
      auditStatement(context, 'event.duplicated', 'event', id, { sourceId }),
    ]);
    return Response.json({ ok: true, id }, { status: 201 });
  }
  if (!['create', 'update'].includes(action))
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  const name = clean(body.name, 180);
  const startsOn = date(body.startsOn);
  const endsOn = date(body.endsOn);
  if (!name || !startsOn || !endsOn || endsOn < startsOn)
    return Response.json(
      { error: 'Name and a valid date range are required.' },
      { status: 400 },
    );
  const id = action === 'update' ? clean(body.id, 80) : crypto.randomUUID();
  if (action === 'update') await requireEventAccess(context, id, true);
  const members = await assignedMembers(
    context.workspace.id,
    list(body.teamMemberIds),
    context.membershipId,
  );
  const persistedUserIds = members
    .map((member) => member.userId)
    .filter(Boolean);
  const values = [
    name,
    clean(body.venue, 180) || null,
    clean(body.hall, 80) || null,
    clean(body.booth, 80) || null,
    startsOn,
    endsOn,
    clean(body.timezone, 80) || context.workspace.timezone,
    Math.round(bounded(body.budget, 0, 0, Number.MAX_SAFE_INTEGER)),
    Math.round(bounded(body.attributionWindowDays, 180, 0, 730)),
    Math.round(bounded(body.grossMarginPercent, 40, 0, 100) * 100),
    clean(body.objective, 1200) || null,
    JSON.stringify(list(body.products)),
    JSON.stringify(list(body.targetAccounts)),
    JSON.stringify(list(body.qualificationQuestions)),
    JSON.stringify(persistedUserIds),
    clean(body.leadRoutingRule, 40) || 'capturer',
    Math.max(1, Math.min(720, Number(body.followupSlaHours) || 24)),
    Math.max(1, Math.min(10000, Number(body.dailyLeadTarget) || 25)),
    clean(body.badgeProvider, 120) || null,
  ];
  if (action === 'create') {
    await db.batch([
      db
        .prepare(
          `INSERT INTO events (id,workspace_id,name,venue,hall,booth,starts_on,ends_on,timezone,budget,attribution_window_days,gross_margin_bps,objective,products_json,target_accounts_json,qualification_questions_json,team_member_ids_json,lead_routing_rule,followup_sla_hours,daily_lead_target,badge_provider,qr_campaign_code,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?)`,
        )
        .bind(
          id,
          context.workspace.id,
          ...values,
          crypto.randomUUID().slice(0, 8).toUpperCase(),
          context.user.id,
          now,
          now,
        ),
      ...membershipStatements(
        id,
        context.workspace.id,
        members,
        context.user.id,
        now,
      ),
      auditStatement(context, 'event.created', 'event', id),
    ]);
  } else {
    const result = await db
      .prepare(
        `UPDATE events SET name=?,venue=?,hall=?,booth=?,starts_on=?,ends_on=?,timezone=?,budget=?,attribution_window_days=?,gross_margin_bps=?,objective=?,products_json=?,target_accounts_json=?,qualification_questions_json=?,team_member_ids_json=?,lead_routing_rule=?,followup_sla_hours=?,daily_lead_target=?,badge_provider=?,updated_at=? WHERE id=? AND workspace_id=?`,
      )
      .bind(...values, now, id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json({ error: 'Event not found.' }, { status: 404 });
    await db.batch([
      db
        .prepare(
          `UPDATE event_memberships SET status='inactive',updated_at=? WHERE event_id=? AND workspace_id=?`,
        )
        .bind(now, id, context.workspace.id),
      ...membershipStatements(
        id,
        context.workspace.id,
        members,
        context.user.id,
        now,
      ),
      auditStatement(context, 'event.updated', 'event', id),
    ]);
  }
  return Response.json(
    { ok: true, id },
    { status: action === 'create' ? 201 : 200 },
  );
}
