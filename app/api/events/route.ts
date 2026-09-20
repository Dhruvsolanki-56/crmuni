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

type ReadinessCheck = {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
  required: true;
};

async function hashConfig(configJson: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(configJson),
  );
  return [...new Uint8Array(digest)]
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

async function assessEventReadiness(workspaceId: string, eventId: string) {
  const db = database();
  const [event, profile, products, icps, rules, evidence, team] =
    await Promise.all([
      db
        .prepare(
          `SELECT id,name,venue,hall,booth,starts_on AS startsOn,ends_on AS endsOn,timezone,budget,attribution_window_days AS attributionWindowDays,gross_margin_bps AS grossMarginBps,objective,products_json AS products,target_accounts_json AS targetAccounts,qualification_questions_json AS qualificationQuestions,team_member_ids_json AS teamMemberIds,lead_routing_rule AS leadRoutingRule,followup_sla_hours AS followupSlaHours,daily_lead_target AS dailyLeadTarget,badge_provider AS badgeProvider,qr_campaign_code AS qrCampaignCode,config_version AS configVersion,status,updated_at AS updatedAt FROM events WHERE id=? AND workspace_id=? AND status!='archived'`,
        )
        .bind(eventId, workspaceId)
        .first<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT legal_name AS legalName,description,event_objective AS eventObjective FROM company_profiles WHERE workspace_id=?`,
        )
        .bind(workspaceId)
        .first<Record<string, unknown>>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM products WHERE workspace_id=? AND status='active'`,
        )
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM ideal_customer_profiles WHERE workspace_id=?`,
        )
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM qualification_rules WHERE workspace_id=? AND status='active'`,
        )
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM knowledge_sources s JOIN knowledge_ingestions i ON i.source_id=s.id AND i.workspace_id=s.workspace_id WHERE s.workspace_id=? AND s.status='approved' AND i.status='approved'`,
        )
        .bind(workspaceId)
        .first<{ count: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM event_memberships em JOIN memberships m ON m.id=em.membership_id AND m.workspace_id=em.workspace_id WHERE em.workspace_id=? AND em.event_id=? AND em.status='active' AND m.status='active'`,
        )
        .bind(workspaceId, eventId)
        .first<{ count: number }>(),
    ]);
  if (!event) return null;
  const productsList = parse(event.products);
  const questions = parse(event.qualificationQuestions);
  const venue = clean(event.venue, 180);
  const booth = clean(event.booth, 80);
  const checks: ReadinessCheck[] = [
    {
      key: 'company_profile',
      label: 'Company profile',
      passed: Boolean(profile?.legalName && profile?.description),
      detail: profile
        ? 'Company identity and offering are described.'
        : 'Add the company profile and offering description.',
      required: true,
    },
    {
      key: 'active_offering',
      label: 'Active offering',
      passed: Number(products?.count || 0) > 0,
      detail: Number(products?.count || 0)
        ? `${products?.count} active offering(s).`
        : 'Add at least one active product or service.',
      required: true,
    },
    {
      key: 'ideal_customer',
      label: 'Ideal customer profile',
      passed: Number(icps?.count || 0) > 0,
      detail: Number(icps?.count || 0)
        ? `${icps?.count} ICP(s) configured.`
        : 'Add at least one ideal customer profile.',
      required: true,
    },
    {
      key: 'qualification_rules',
      label: 'Qualification rules',
      passed: Number(rules?.count || 0) > 0,
      detail: Number(rules?.count || 0)
        ? `${rules?.count} active rule(s).`
        : 'Add at least one active qualification rule.',
      required: true,
    },
    {
      key: 'approved_evidence',
      label: 'Approved evidence',
      passed: Number(evidence?.count || 0) > 0,
      detail: Number(evidence?.count || 0)
        ? `${evidence?.count} approved source(s).`
        : 'Approve at least one reviewed knowledge source.',
      required: true,
    },
    {
      key: 'event_location',
      label: 'Venue and booth',
      passed: Boolean(venue && booth),
      detail:
        venue && booth
          ? `${venue} · Booth ${booth}`
          : 'Add the venue and booth location.',
      required: true,
    },
    {
      key: 'event_objective',
      label: 'Event objective',
      passed: Boolean(event.objective),
      detail: event.objective
        ? 'A measurable booth objective is configured.'
        : 'Add the business objective for this event.',
      required: true,
    },
    {
      key: 'event_products',
      label: 'Event offerings',
      passed: productsList.length > 0,
      detail: productsList.length
        ? `${productsList.length} offering(s) selected.`
        : 'Select at least one product or service for the event.',
      required: true,
    },
    {
      key: 'qualification_questions',
      label: 'Booth qualification questions',
      passed: questions.length > 0,
      detail: questions.length
        ? `${questions.length} question(s) configured.`
        : 'Add at least one qualification question.',
      required: true,
    },
    {
      key: 'assigned_team',
      label: 'Assigned team',
      passed: Number(team?.count || 0) > 0,
      detail: Number(team?.count || 0)
        ? `${team?.count} active member(s) assigned.`
        : 'Assign at least one active workspace member.',
      required: true,
    },
  ];
  const config = {
    id: event.id,
    name: event.name,
    venue: event.venue,
    hall: event.hall,
    booth: event.booth,
    startsOn: event.startsOn,
    endsOn: event.endsOn,
    timezone: event.timezone,
    objective: event.objective,
    products: productsList,
    targetAccounts: parse(event.targetAccounts),
    qualificationQuestions: questions,
    teamMemberIds: parse(event.teamMemberIds),
    leadRoutingRule: event.leadRoutingRule,
    followupSlaHours: event.followupSlaHours,
    dailyLeadTarget: event.dailyLeadTarget,
    badgeProvider: event.badgeProvider,
    qrCampaignCode: event.qrCampaignCode,
    configVersion: Number(event.configVersion),
  };
  const configJson = JSON.stringify(config);
  return {
    event,
    checks,
    ready: checks.every((check) => check.passed),
    config,
    configJson,
    configHash: await hashConfig(configJson),
  };
}

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
      `SELECT e.id,e.name,e.venue,e.hall,e.booth,e.starts_on AS startsOn,e.ends_on AS endsOn,e.timezone,e.budget,e.attribution_window_days AS attributionWindowDays,e.gross_margin_bps AS grossMarginBps,e.objective,e.products_json AS products,e.target_accounts_json AS targetAccounts,e.qualification_questions_json AS qualificationQuestions,e.team_member_ids_json AS teamMemberIds,e.lead_routing_rule AS leadRoutingRule,e.followup_sla_hours AS followupSlaHours,e.daily_lead_target AS dailyLeadTarget,e.badge_provider AS badgeProvider,e.qr_campaign_code AS qrCampaignCode,e.config_version AS configVersion,e.status,r.version AS readinessVersion,r.status AS readinessStatus,r.checks_json AS readinessChecks,r.config_json AS deviceConfig,r.config_hash AS configHash,r.assessed_at AS assessedAt,r.activated_at AS activatedAt FROM events e LEFT JOIN event_readiness_snapshots r ON r.workspace_id=e.workspace_id AND r.event_id=e.id AND r.version=(SELECT MAX(latest.version) FROM event_readiness_snapshots latest WHERE latest.workspace_id=e.workspace_id AND latest.event_id=e.id) WHERE e.workspace_id=?${access.sql} ORDER BY e.starts_on DESC`,
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
      readinessChecks: parse(item.readinessChecks),
      deviceConfig: item.deviceConfig ? parse(item.deviceConfig) : null,
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
  if (action === 'assess_readiness') {
    const id = clean(body.id, 80);
    await requireEventAccess(context, id);
    const assessment = await assessEventReadiness(context.workspace.id, id);
    if (!assessment)
      return Response.json({ error: 'Event not found.' }, { status: 404 });
    const latest = await db
      .prepare(
        `SELECT COALESCE(MAX(version),0) AS version FROM event_readiness_snapshots WHERE workspace_id=? AND event_id=?`,
      )
      .bind(context.workspace.id, id)
      .first<{ version: number }>();
    const version = Number(latest?.version || 0) + 1;
    const readinessStatus = assessment.ready ? 'ready' : 'blocked';
    const preserveActive =
      assessment.event.status === 'active' && assessment.ready;
    await db.batch([
      db
        .prepare(
          `INSERT INTO event_readiness_snapshots (id,workspace_id,event_id,version,config_version,status,checks_json,config_json,config_hash,assessed_by,assessed_at,activated_by,activated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          id,
          version,
          Number(assessment.event.configVersion),
          readinessStatus,
          JSON.stringify(assessment.checks),
          assessment.configJson,
          assessment.configHash,
          context.user.id,
          now,
          preserveActive ? context.user.id : null,
          preserveActive ? now : null,
        ),
      db
        .prepare(
          `UPDATE events SET status=?,updated_at=? WHERE id=? AND workspace_id=?`,
        )
        .bind(
          preserveActive ? 'active' : assessment.ready ? 'ready' : 'draft',
          now,
          id,
          context.workspace.id,
        ),
      auditStatement(context, 'event.readiness_assessed', 'event', id, {
        version,
        configVersion: assessment.event.configVersion,
        status: readinessStatus,
        failedChecks: assessment.checks
          .filter((check) => !check.passed)
          .map((check) => check.key),
      }),
    ]);
    return Response.json({
      ok: true,
      version,
      status: readinessStatus,
      checks: assessment.checks,
      configHash: assessment.configHash,
    });
  }
  if (action === 'activate') {
    const id = clean(body.id, 80);
    await requireEventAccess(context, id);
    const latest = await db
      .prepare(
        `SELECT r.id,r.version,r.config_version AS configVersion,r.status,e.config_version AS currentConfigVersion FROM event_readiness_snapshots r JOIN events e ON e.id=r.event_id AND e.workspace_id=r.workspace_id WHERE r.workspace_id=? AND r.event_id=? ORDER BY r.version DESC LIMIT 1`,
      )
      .bind(context.workspace.id, id)
      .first<{
        id: string;
        version: number;
        configVersion: number;
        status: string;
        currentConfigVersion: number;
      }>();
    if (
      !latest ||
      latest.status !== 'ready' ||
      latest.configVersion !== latest.currentConfigVersion
    )
      return Response.json(
        { error: 'Run readiness and resolve every required check first.' },
        { status: 409 },
      );
    await db.batch([
      db
        .prepare(
          `UPDATE event_readiness_snapshots SET activated_by=?,activated_at=? WHERE id=? AND workspace_id=? AND activated_at IS NULL`,
        )
        .bind(context.user.id, now, latest.id, context.workspace.id),
      db
        .prepare(
          `UPDATE events SET status='active',updated_at=? WHERE id=? AND workspace_id=? AND config_version=? AND status='ready'`,
        )
        .bind(now, id, context.workspace.id, latest.currentConfigVersion),
      auditStatement(context, 'event.activated', 'event', id, {
        readinessVersion: latest.version,
        configVersion: latest.configVersion,
      }),
    ]);
    return Response.json({ ok: true, status: 'active' });
  }
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
        `UPDATE events SET name=?,venue=?,hall=?,booth=?,starts_on=?,ends_on=?,timezone=?,budget=?,attribution_window_days=?,gross_margin_bps=?,objective=?,products_json=?,target_accounts_json=?,qualification_questions_json=?,team_member_ids_json=?,lead_routing_rule=?,followup_sla_hours=?,daily_lead_target=?,badge_provider=?,config_version=config_version+1,status='draft',updated_at=? WHERE id=? AND workspace_id=?`,
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
