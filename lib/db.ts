import { env } from 'cloudflare:workers';
import { eventAccessClause } from '@/lib/authorization';
export { canAccessAllEvents, eventAccessClause } from '@/lib/authorization';

export type RevenueEnv = {
  DB: D1Database;
  FILES: R2Bucket;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_VISION_MODEL?: string;
  OPENAI_TRANSCRIBE_MODEL?: string;
  AUTOMATION_SECRET?: string;
  // Development/test identity - see requestUser() below. Never read outside
  // of that explicit opt-in check.
  CRMUNI_LOCAL_TEST?: string;
  CRMUNI_TEST_USER_ID?: string;
  CRMUNI_TEST_USER_EMAIL?: string;
};

export function database(): D1Database {
  return (env as unknown as RevenueEnv).DB;
}

export function revenueEnv(): RevenueEnv {
  return env as unknown as RevenueEnv;
}

// The production Cloudflare deployment currently runs with r2_buckets: []
// (see vite.config.ts) - env.FILES is undefined there, not a working but
// empty bucket. Every call site that stores or reads a file must check this
// first: calling .put/.get/.delete on undefined throws a raw TypeError that
// takes down the whole request instead of degrading the feature.
export function filesAvailable(): boolean {
  return Boolean((env as unknown as RevenueEnv).FILES);
}

export function storageUnavailableResponse(action: string) {
  return Response.json(
    {
      error: `${action} is not available in this environment. File storage is not configured.`,
      code: 'STORAGE_UNAVAILABLE',
    },
    { status: 503 },
  );
}

export function requestUser(request: Request) {
  // Production identity always comes from the hosted runtime's headers,
  // regardless of hostname - a request can arrive from any forwarded
  // domain (Codespaces, a custom domain, etc.), so hostname was never a
  // sound signal for "this is safe to treat as authenticated."
  //
  // The one exception is explicit: CRMUNI_LOCAL_TEST must be set (it is
  // never set in a real deployment - see .env.example and README) before a
  // request without those headers is allowed through at all, and even then
  // it is answered with a clearly-labelled local test identity, never a
  // header pretending to be the trusted provider.
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (id && email) return { id, email };
  const testMode = revenueEnv().CRMUNI_LOCAL_TEST === 'true';
  if (!testMode)
    throw new Response('Authentication required.', { status: 401 });
  return {
    id: revenueEnv().CRMUNI_TEST_USER_ID || 'test-user',
    email: revenueEnv().CRMUNI_TEST_USER_EMAIL || 'tester@crm.local',
  };
}

export type WorkspaceContext = {
  user: { id: string; email: string };
  membershipId: string;
  workspace: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    plan: string;
    status: string;
    kind: string;
  };
  role: string;
};

export function enforceSameOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin)
        throw new Error('cross_origin');
    } catch {
      throw new Response('Cross-origin mutation rejected.', { status: 403 });
    }
  }
}

export async function requireWorkspace(
  request: Request,
): Promise<WorkspaceContext> {
  enforceSameOrigin(request);
  const user = requestUser(request);
  const db = database();
  const requested = request.headers.get('x-revenue-workspace-id');
  let membership = await db
    .prepare(`SELECT m.id AS membershipId, m.role, w.id, w.name, w.slug, w.timezone, w.currency, w.plan, w.status, w.kind
    FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ? AND m.status = 'active' AND w.status = 'active' ${requested ? 'AND w.id = ?' : ''}
    ORDER BY m.created_at ASC LIMIT 1`)
    .bind(...(requested ? [user.id, requested] : [user.id]))
    .first<Record<string, string>>();
  let supportGrant:
    | { grantId: string; lastAccessAt: number | null }
    | undefined;
  if (!membership) {
    const grant = await db
      .prepare(
        `SELECT g.id AS grantId,g.last_access_at AS lastAccessAt,w.id,w.name,w.slug,w.timezone,w.currency,w.plan,w.status,w.kind FROM support_access_grants g JOIN workspaces w ON w.id=g.workspace_id WHERE g.support_user_id=? AND g.status='active' AND g.expires_at>? AND w.status='active' ${requested ? 'AND w.id=?' : ''} ORDER BY g.created_at ASC LIMIT 1`,
      )
      .bind(user.id, Date.now(), ...(requested ? [requested] : []))
      .first<Record<string, string | number | null>>();
    if (grant) {
      supportGrant = {
        grantId: String(grant.grantId),
        lastAccessAt:
          grant.lastAccessAt == null ? null : Number(grant.lastAccessAt),
      };
      membership = {
        membershipId: `support:${String(grant.grantId)}`,
        role: 'support',
        id: String(grant.id),
        name: String(grant.name),
        slug: String(grant.slug),
        timezone: String(grant.timezone),
        currency: String(grant.currency),
        plan: String(grant.plan),
        status: String(grant.status),
        kind: String(grant.kind),
      };
    }
  }
  if (!membership) {
    if (requested)
      throw new Response('You do not have access to this workspace.', {
        status: 403,
      });
    const now = Date.now();
    const workspaceId = crypto.randomUUID();
    const membershipId = crypto.randomUUID();
    const label =
      user.email
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .trim()
        .slice(0, 60) || 'My company';
    const workspaceName = `${label}'s workspace`;
    const slug = `workspace-${workspaceId.slice(0, 8)}`;
    await db.batch([
      db
        .prepare(
          `INSERT INTO workspaces (id, name, slug, timezone, currency, plan, status, kind, created_by, created_at, updated_at) VALUES (?, ?, ?, 'UTC', 'USD', 'trial', 'active', 'exhibitor', ?, ?, ?)`,
        )
        .bind(workspaceId, workspaceName, slug, user.id, now, now),
      db
        .prepare(
          `INSERT INTO memberships (id, workspace_id, user_id, email, display_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'owner', 'active', ?, ?)`,
        )
        .bind(membershipId, workspaceId, user.id, user.email, label, now, now),
    ]);
    membership = {
      membershipId,
      role: 'owner',
      id: workspaceId,
      name: workspaceName,
      slug,
      timezone: 'UTC',
      currency: 'USD',
      plan: 'trial',
      status: 'active',
      kind: 'exhibitor',
    };
  }
  const context = {
    user,
    membershipId: membership.membershipId,
    role: membership.role,
    workspace: {
      id: membership.id,
      name: membership.name,
      slug: membership.slug,
      timezone: membership.timezone,
      currency: membership.currency,
      plan: membership.plan,
      status: membership.status,
      kind: membership.kind,
    },
  };
  if (
    supportGrant &&
    (!supportGrant.lastAccessAt ||
      supportGrant.lastAccessAt < Date.now() - 60 * 60 * 1000)
  ) {
    const accessedAt = Date.now();
    await db.batch([
      db
        .prepare(
          `UPDATE support_access_grants SET last_access_at=?,updated_at=? WHERE id=? AND workspace_id=? AND status='active' AND expires_at>?`,
        )
        .bind(
          accessedAt,
          accessedAt,
          supportGrant.grantId,
          context.workspace.id,
          accessedAt,
        ),
      db
        .prepare(
          `INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) VALUES (?,?,?,'support.session_accessed','support_access_grant',?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          user.id,
          supportGrant.grantId,
          JSON.stringify({ email: user.email }),
          accessedAt,
        ),
    ]);
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method))
    await enforceRateLimit(context, 'mutation', 120, 60_000);
  return context;
}

export async function enforceRateLimit(
  context: WorkspaceContext,
  bucket: string,
  limit: number,
  windowMs: number,
) {
  const now = Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const rateKey = `${context.user.id}:${bucket}`.slice(0, 180);
  const db = database();
  await db
    .prepare(
      `INSERT INTO request_rate_limits (id,workspace_id,rate_key,window_start,request_count,updated_at) VALUES (?,?,?,?,1,?) ON CONFLICT(workspace_id,rate_key) DO UPDATE SET window_start=CASE WHEN request_rate_limits.window_start=? THEN request_rate_limits.window_start ELSE excluded.window_start END,request_count=CASE WHEN request_rate_limits.window_start=? THEN request_rate_limits.request_count+1 ELSE 1 END,updated_at=excluded.updated_at`,
    )
    .bind(
      crypto.randomUUID(),
      context.workspace.id,
      rateKey,
      windowStart,
      now,
      windowStart,
      windowStart,
    )
    .run();
  const row = await db
    .prepare(
      `SELECT request_count AS requestCount FROM request_rate_limits WHERE workspace_id=? AND rate_key=?`,
    )
    .bind(context.workspace.id, rateKey)
    .first<{ requestCount: number }>();
  if (Number(row?.requestCount || 0) > limit)
    throw new Response('Too many requests. Try again shortly.', {
      status: 429,
      headers: {
        'retry-after': String(
          Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000)),
        ),
      },
    });
}

export function requireRole(context: WorkspaceContext, allowed: string[]) {
  if (!allowed.includes(context.role))
    throw new Response('Insufficient workspace permission.', { status: 403 });
}

export async function requireEventAccess(
  context: WorkspaceContext,
  eventId: string,
  includeArchived = false,
) {
  if (!eventId)
    throw new Response('Select an event before continuing.', { status: 409 });
  const access = eventAccessClause(context, 'e.id');
  const event = await database()
    .prepare(
      `SELECT e.id, e.status FROM events e WHERE e.id = ? AND e.workspace_id = ? ${includeArchived ? '' : "AND e.status != 'archived'"}${access.sql}`,
    )
    .bind(eventId, context.workspace.id, ...access.bindings)
    .first<{ id: string; status: string }>();
  if (!event)
    throw new Response('You do not have access to this event.', {
      status: 403,
    });
  return event;
}

export async function requireLeadAccess(
  context: WorkspaceContext,
  leadId: string,
) {
  const access = eventAccessClause(context, 'l.event_id');
  const lead = await database()
    .prepare(
      `SELECT l.id, l.event_id AS eventId FROM leads l WHERE l.id = ? AND l.workspace_id = ?${access.sql}`,
    )
    .bind(leadId, context.workspace.id, ...access.bindings)
    .first<{ id: string; eventId: string }>();
  if (!lead)
    throw new Response('Lead not found or unavailable.', { status: 404 });
  return lead;
}

export async function requireRfqAccess(
  context: WorkspaceContext,
  rfqId: string,
) {
  const access = eventAccessClause(context, 'r.event_id');
  const rfq = await database()
    .prepare(
      `SELECT r.id, r.event_id AS eventId FROM rfqs r WHERE r.id = ? AND r.workspace_id = ?${access.sql}`,
    )
    .bind(rfqId, context.workspace.id, ...access.bindings)
    .first<{ id: string; eventId: string | null }>();
  if (!rfq)
    throw new Response('RFQ not found or unavailable.', { status: 404 });
  return rfq;
}

export async function requireOpportunityAccess(
  context: WorkspaceContext,
  opportunityId: string,
) {
  const access = eventAccessClause(context, 'o.event_id');
  const opportunity = await database()
    .prepare(
      `SELECT o.id, o.event_id AS eventId FROM opportunities o WHERE o.id = ? AND o.workspace_id = ?${access.sql}`,
    )
    .bind(opportunityId, context.workspace.id, ...access.bindings)
    .first<{ id: string; eventId: string | null }>();
  if (!opportunity)
    throw new Response('Opportunity not found or unavailable.', {
      status: 404,
    });
  return opportunity;
}

export async function requireQuotationAccess(
  context: WorkspaceContext,
  quotationId: string,
) {
  const access = eventAccessClause(context, 'q.event_id');
  const quotation = await database()
    .prepare(
      `SELECT q.id,q.event_id AS eventId FROM quotations q WHERE q.id=? AND q.workspace_id=?${access.sql}`,
    )
    .bind(quotationId, context.workspace.id, ...access.bindings)
    .first<{ id: string; eventId: string | null }>();
  if (!quotation)
    throw new Response('Quotation not found or unavailable.', { status: 404 });
  return quotation;
}

export function auditStatement(
  context: WorkspaceContext,
  action: string,
  entityType: string,
  entityId?: string,
  detail?: unknown,
) {
  return database()
    .prepare(
      `INSERT INTO audit_events (id, workspace_id, actor_id, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      context.workspace.id,
      context.user.id,
      action,
      entityType,
      entityId || null,
      detail ? JSON.stringify(detail).slice(0, 4000) : null,
      Date.now(),
    );
}
