import {
  auditStatement,
  database,
  requireRole,
  requireWorkspace,
  revenueEnv,
} from '@/lib/db';

const ROLES = [
  'owner',
  'admin',
  'manager',
  'salesperson',
  'marketing',
  'viewer',
];
const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const db = database();
  const url = new URL(request.url);
  if (url.searchParams.get('export') === '1') {
    requireRole(context, ['owner', 'admin']);
    const tables = [
      'memberships',
      'invitations',
      'accounts',
      'leads',
      'lead_consents',
      'suppression_entries',
      'lead_duplicate_suggestions',
      'lead_merge_events',
      'lead_qualification_history',
      'lead_assignment_history',
      'account_stakeholders',
      'lead_capture_assets',
      'interactions',
      'tasks',
      'task_history',
      'meetings',
      'meeting_participants',
      'meeting_history',
      'ai_extractions',
      'lead_facts',
      'qualification_scores',
      'communication_drafts',
      'rfqs',
      'rfq_items',
      'rfq_documents',
      'rfq_ai_extractions',
      'rfq_history',
      'rfq_submissions',
      'opportunities',
      'opportunity_contacts',
      'opportunity_history',
      'quotations',
      'quotation_revisions',
      'quotation_history',
      'company_profiles',
      'products',
      'ideal_customer_profiles',
      'qualification_rules',
      'knowledge_sources',
      'event_cost_history',
      'event_cost_lines',
      'background_jobs',
      'in_app_notifications',
      'operational_alerts',
      'events',
      'event_memberships',
    ] as const;
    const results = await Promise.all(
      tables.map((table) =>
        db
          .prepare(`SELECT * FROM ${table} WHERE workspace_id=?`)
          .bind(context.workspace.id)
          .all(),
      ),
    );
    const data = Object.fromEntries(
      tables.map((table, index) => [table, results[index].results]),
    );
    await auditStatement(
      context,
      'workspace.exported',
      'workspace',
      context.workspace.id,
    ).run();
    return new Response(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          workspace: context.workspace,
          note: 'Stored file metadata is included; binary file contents remain in protected storage.',
          data,
        },
        null,
        2,
      ),
      {
        headers: {
          'content-type': 'application/json',
          'content-disposition': `attachment; filename="${context.workspace.slug}-export.json"`,
          'cache-control': 'private, no-store',
        },
      },
    );
  }
  const privileged = context.role === 'owner' || context.role === 'admin';
  const canAssignTeam = privileged || context.role === 'manager';
  const [
    members,
    invitations,
    audit,
    workspaces,
    leadUsage,
    eventUsage,
    sourceUsage,
    captureUsage,
    rfqUsage,
    quotationUsage,
    deletionRequest,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT id, user_id AS userId, email, display_name AS displayName, role, status, created_at AS createdAt FROM memberships WHERE workspace_id = ? ORDER BY created_at ASC`,
      )
      .bind(context.workspace.id)
      .all(),
    db
      .prepare(
        `SELECT id, email, role, status, expires_at AS expiresAt, created_at AS createdAt FROM invitations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 30`,
      )
      .bind(context.workspace.id)
      .all(),
    db
      .prepare(
        `SELECT id, actor_id AS actorId, action, entity_type AS entityType, entity_id AS entityId, created_at AS createdAt FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 30`,
      )
      .bind(context.workspace.id)
      .all(),
    db
      .prepare(
        `SELECT w.id, w.name, w.slug, w.timezone, w.currency, w.plan, w.status, m.role FROM memberships m JOIN workspaces w ON w.id = m.workspace_id WHERE m.user_id = ? AND m.status = 'active' AND w.status = 'active' ORDER BY m.created_at ASC`,
      )
      .bind(context.user.id)
      .all(),
    db
      .prepare(`SELECT COUNT(*) AS count FROM leads WHERE workspace_id=?`)
      .bind(context.workspace.id)
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count FROM events WHERE workspace_id=? AND status!='archived'`,
      )
      .bind(context.workspace.id)
      .first<{ count: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes),0) AS bytes FROM knowledge_sources WHERE workspace_id=?`,
      )
      .bind(context.workspace.id)
      .first<{ count: number; bytes: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM lead_capture_assets WHERE workspace_id=?`,
      )
      .bind(context.workspace.id)
      .first<{ bytes: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM rfq_documents WHERE workspace_id=?`,
      )
      .bind(context.workspace.id)
      .first<{ bytes: number }>(),
    db
      .prepare(
        `SELECT COALESCE(SUM(size_bytes),0) AS bytes FROM quotations WHERE workspace_id=?`,
      )
      .bind(context.workspace.id)
      .first<{ bytes: number }>(),
    privileged
      ? db
          .prepare(
            `SELECT id,status,scheduled_for AS scheduledFor,created_at AS createdAt FROM workspace_deletion_requests WHERE workspace_id=? AND status='scheduled'`,
          )
          .bind(context.workspace.id)
          .first()
      : Promise.resolve(null),
  ]);
  const usage = privileged
    ? {
        leads: Number(leadUsage?.count || 0),
        activeEvents: Number(eventUsage?.count || 0),
        knowledgeSources: Number(sourceUsage?.count || 0),
        storageBytes:
          Number(sourceUsage?.bytes || 0) +
          Number(captureUsage?.bytes || 0) +
          Number(rfqUsage?.bytes || 0) +
          Number(quotationUsage?.bytes || 0),
        activeMembers: members.results.filter(
          (item) => item.status === 'active',
        ).length,
      }
    : null;
  const visibleMembers = canAssignTeam
    ? members.results.map((item) =>
        privileged
          ? item
          : {
              id: item.id,
              userId: item.userId,
              displayName: item.displayName,
              role: item.role,
              status: item.status,
            },
      )
    : [];
  return Response.json({
    context: {
      workspace: context.workspace,
      role: context.role,
      user: context.user,
    },
    serverTime: Date.now(),
    workspaces: workspaces.results,
    members: visibleMembers,
    invitations: privileged ? invitations.results : [],
    audit: privileged ? audit.results : [],
    usage,
    deletionRequest,
    capabilities: { aiConfigured: Boolean(revenueEnv().OPENAI_API_KEY) },
  });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin']);
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 30);
  const db = database();
  const now = Date.now();
  if (action === 'request_deletion') {
    requireRole(context, ['owner']);
    const confirmName = clean(body.confirmName, 120);
    if (confirmName !== context.workspace.name)
      return Response.json(
        { error: 'Enter the exact workspace name to schedule deletion.' },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    const scheduledFor = now + 7 * 86400000;
    await db.batch([
      db
        .prepare(
          `INSERT INTO workspace_deletion_requests (id,workspace_id,status,requested_by,scheduled_for,created_at,updated_at) VALUES (?,?,'scheduled',?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET status='scheduled',requested_by=excluded.requested_by,scheduled_for=excluded.scheduled_for,canceled_by=NULL,canceled_at=NULL,updated_at=excluded.updated_at`,
        )
        .bind(
          id,
          context.workspace.id,
          context.user.id,
          scheduledFor,
          now,
          now,
        ),
      auditStatement(
        context,
        'workspace.deletion_scheduled',
        'workspace',
        context.workspace.id,
        { scheduledFor },
      ),
      db
        .prepare(
          `INSERT INTO background_jobs (id,workspace_id,kind,entity_type,entity_id,dedupe_key,payload_json,status,attempts,max_attempts,available_at,created_at,updated_at) VALUES (?,?, 'workspace_deletion_due','workspace',?,?,'{}','queued',0,5,?,?,?) ON CONFLICT(workspace_id,kind,dedupe_key) DO UPDATE SET status='queued',attempts=0,available_at=excluded.available_at,locked_at=NULL,last_error=NULL,completed_at=NULL,updated_at=excluded.updated_at`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          context.workspace.id,
          context.workspace.id,
          scheduledFor,
          now,
          now,
        ),
    ]);
    return Response.json({
      deletionRequest: {
        id,
        status: 'scheduled',
        scheduledFor,
        createdAt: now,
      },
    });
  }
  if (action === 'cancel_deletion') {
    requireRole(context, ['owner']);
    const result = await db
      .prepare(
        `UPDATE workspace_deletion_requests SET status='canceled',canceled_by=?,canceled_at=?,updated_at=? WHERE workspace_id=? AND status='scheduled'`,
      )
      .bind(context.user.id, now, now, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'No scheduled deletion was found.' },
        { status: 404 },
      );
    await auditStatement(
      context,
      'workspace.deletion_canceled',
      'workspace',
      context.workspace.id,
    ).run();
    await db
      .prepare(
        `UPDATE background_jobs SET status='canceled',locked_at=NULL,updated_at=? WHERE workspace_id=? AND kind='workspace_deletion_due' AND dedupe_key=? AND status NOT IN ('completed','canceled')`,
      )
      .bind(now, context.workspace.id, context.workspace.id)
      .run();
    return Response.json({ ok: true });
  }
  if (action === 'execute_deletion') {
    requireRole(context, ['owner']);
    const confirmName = clean(body.confirmName, 120);
    if (confirmName !== context.workspace.name)
      return Response.json(
        { error: 'Enter the exact workspace name to permanently delete it.' },
        { status: 400 },
      );
    const pending = await db
      .prepare(
        `SELECT scheduled_for AS scheduledFor FROM workspace_deletion_requests WHERE workspace_id=? AND status='scheduled'`,
      )
      .bind(context.workspace.id)
      .first<{ scheduledFor: number }>();
    if (!pending)
      return Response.json(
        { error: 'No scheduled deletion was found.' },
        { status: 404 },
      );
    if (pending.scheduledFor > now)
      return Response.json(
        {
          error: 'The seven-day recovery period has not ended.',
          scheduledFor: pending.scheduledFor,
        },
        { status: 409 },
      );
    const deleteOrder = [
      'lead_facts',
      'qualification_scores',
      'communication_drafts',
      'lead_consents',
      'suppression_entries',
      'lead_duplicate_suggestions',
      'lead_merge_events',
      'lead_qualification_history',
      'lead_assignment_history',
      'meeting_participants',
      'meeting_history',
      'meetings',
      'task_history',
      'ai_extractions',
      'tasks',
      'interactions',
      'account_stakeholders',
      'lead_capture_assets',
      'quotation_history',
      'quotation_revisions',
      'quotations',
      'rfq_ai_extractions',
      'rfq_items',
      'rfq_documents',
      'rfq_submissions',
      'rfq_history',
      'rfqs',
      'opportunity_contacts',
      'opportunity_history',
      'opportunities',
      'leads',
      'accounts',
      'event_cost_history',
      'event_cost_lines',
      'in_app_notifications',
      'operational_alerts',
      'background_jobs',
      'event_memberships',
      'events',
      'company_documents',
      'knowledge_sources',
      'qualification_rules',
      'ideal_customer_profiles',
      'products',
      'company_profiles',
      'request_rate_limits',
      'invitations',
      'audit_events',
      'workspace_deletion_requests',
      'memberships',
    ] as const;
    await db.batch([
      ...deleteOrder.map((table) =>
        db
          .prepare(`DELETE FROM ${table} WHERE workspace_id=?`)
          .bind(context.workspace.id),
      ),
      db
        .prepare(`DELETE FROM workspaces WHERE id=?`)
        .bind(context.workspace.id),
    ]);
    let cursor: string | undefined;
    do {
      const page = await revenueEnv().FILES.list({
        prefix: `${context.workspace.id}/`,
        cursor,
        limit: 1000,
      });
      if (page.objects.length)
        await revenueEnv().FILES.delete(page.objects.map((item) => item.key));
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    return Response.json({
      ok: true,
      deletedWorkspaceId: context.workspace.id,
    });
  }
  if (action === 'invite') {
    const email = clean(body.email, 254).toLowerCase();
    const role = clean(body.role, 30);
    if (
      !/^\S+@\S+\.\S+$/.test(email) ||
      !ROLES.includes(role) ||
      role === 'owner'
    )
      return Response.json(
        { error: 'Enter a valid email and assignable role.' },
        { status: 400 },
      );
    const count = await db
      .prepare(
        `SELECT COUNT(*) AS count FROM memberships WHERE workspace_id = ? AND status = 'active'`,
      )
      .bind(context.workspace.id)
      .first<{ count: number }>();
    if (context.workspace.plan === 'trial' && Number(count?.count || 0) >= 3)
      return Response.json(
        { error: 'Trial workspaces support up to three active members.' },
        { status: 402 },
      );
    const duplicate = await db
      .prepare(
        `SELECT id FROM invitations WHERE workspace_id = ? AND email = ? AND status = 'pending'`,
      )
      .bind(context.workspace.id, email)
      .first();
    if (duplicate)
      return Response.json(
        { error: 'A pending invitation already exists.' },
        { status: 409 },
      );
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO invitations (id, workspace_id, email, role, status, invited_by, expires_at, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
        )
        .bind(
          id,
          context.workspace.id,
          email,
          role,
          context.user.id,
          now + 7 * 86400000,
          now,
        ),
      auditStatement(context, 'invitation.created', 'invitation', id, {
        email,
        role,
      }),
    ]);
    return Response.json(
      {
        invitation: {
          id,
          email,
          role,
          status: 'pending',
          expiresAt: now + 7 * 86400000,
          createdAt: now,
        },
      },
      { status: 201 },
    );
  }
  if (action === 'update_workspace') {
    const name = clean(body.name, 120);
    const timezone = clean(body.timezone, 80);
    const currency = clean(body.currency, 3).toUpperCase();
    if (!name || !timezone || !/^[A-Z]{3}$/.test(currency))
      return Response.json(
        { error: 'Name, timezone and a three-letter currency are required.' },
        { status: 400 },
      );
    await db.batch([
      db
        .prepare(
          `UPDATE workspaces SET name = ?, timezone = ?, currency = ?, updated_at = ? WHERE id = ?`,
        )
        .bind(name, timezone, currency, now, context.workspace.id),
      auditStatement(
        context,
        'workspace.updated',
        'workspace',
        context.workspace.id,
        { name, timezone, currency },
      ),
    ]);
    return Response.json({
      workspace: { ...context.workspace, name, timezone, currency },
    });
  }
  if (action === 'create_workspace') {
    const name = clean(body.name, 120);
    if (!name)
      return Response.json(
        { error: 'Workspace name is required.' },
        { status: 400 },
      );
    const existing = await db
      .prepare(
        `SELECT COUNT(*) AS count FROM memberships WHERE user_id = ? AND status = 'active'`,
      )
      .bind(context.user.id)
      .first<{ count: number }>();
    if (Number(existing?.count || 0) >= 3)
      return Response.json(
        { error: 'A user can create up to three trial workspaces.' },
        { status: 402 },
      );
    const id = crypto.randomUUID();
    const slug = `${
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 42) || 'workspace'
    }-${id.slice(0, 6)}`;
    await db.batch([
      db
        .prepare(
          `INSERT INTO workspaces (id, name, slug, timezone, currency, plan, status, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'trial', 'active', ?, ?, ?)`,
        )
        .bind(
          id,
          name,
          slug,
          clean(body.timezone, 80) || context.workspace.timezone,
          clean(body.currency, 3).toUpperCase() || context.workspace.currency,
          context.user.id,
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO memberships (id, workspace_id, user_id, email, display_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'owner', 'active', ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          id,
          context.user.id,
          context.user.email,
          context.user.email.split('@')[0],
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO audit_events (id, workspace_id, actor_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, 'workspace.created', 'workspace', ?, ?)`,
        )
        .bind(crypto.randomUUID(), id, context.user.id, id, now),
    ]);
    return Response.json(
      {
        workspace: {
          id,
          name,
          slug,
          timezone: clean(body.timezone, 80) || context.workspace.timezone,
          currency:
            clean(body.currency, 3).toUpperCase() || context.workspace.currency,
          plan: 'trial',
          status: 'active',
          role: 'owner',
        },
      },
      { status: 201 },
    );
  }
  if (action === 'update_member') {
    const membershipId = clean(body.id, 80);
    const role = clean(body.role, 30);
    const status = clean(body.status, 20);
    if (
      !membershipId ||
      !ROLES.includes(role) ||
      !['active', 'inactive'].includes(status)
    )
      return Response.json(
        { error: 'Valid member, role and status are required.' },
        { status: 400 },
      );
    const target = await db
      .prepare(
        `SELECT user_id AS userId, role, status FROM memberships WHERE id = ? AND workspace_id = ?`,
      )
      .bind(membershipId, context.workspace.id)
      .first<{ userId: string; role: string; status: string }>();
    if (!target)
      return Response.json({ error: 'Member not found.' }, { status: 404 });
    if (target.role === 'owner')
      return Response.json(
        { error: 'Transfer ownership before changing the owner.' },
        { status: 409 },
      );
    if (
      status === 'active' &&
      target.status !== 'active' &&
      context.workspace.plan === 'trial'
    ) {
      const count = await db
        .prepare(
          `SELECT COUNT(*) AS count FROM memberships WHERE workspace_id=? AND status='active'`,
        )
        .bind(context.workspace.id)
        .first<{ count: number }>();
      if (Number(count?.count || 0) >= 3)
        return Response.json(
          { error: 'Trial workspaces support up to three active members.' },
          { status: 402 },
        );
    }
    await db.batch([
      db
        .prepare(
          `UPDATE memberships SET role = ?, status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
        )
        .bind(role, status, now, membershipId, context.workspace.id),
      auditStatement(
        context,
        'membership.updated',
        'membership',
        membershipId,
        { role, status },
      ),
    ]);
    return Response.json({ ok: true });
  }
  if (action === 'revoke_invitation') {
    const id = clean(body.id, 80);
    const result = await db
      .prepare(
        `UPDATE invitations SET status = 'revoked' WHERE id = ? AND workspace_id = ? AND status = 'pending'`,
      )
      .bind(id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'Pending invitation not found.' },
        { status: 404 },
      );
    await auditStatement(context, 'invitation.revoked', 'invitation', id).run();
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
