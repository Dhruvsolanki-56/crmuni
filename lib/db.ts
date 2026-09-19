import { env } from 'cloudflare:workers';
import { eventAccessClause } from '@/lib/authorization';
export { canAccessAllEvents, eventAccessClause } from '@/lib/authorization';

export type RevenueEnv = { DB: D1Database; FILES: R2Bucket; OPENAI_API_KEY?: string; OPENAI_MODEL?: string; OPENAI_VISION_MODEL?: string; OPENAI_TRANSCRIBE_MODEL?: string };

export function database(): D1Database {
  return (env as unknown as RevenueEnv).DB;
}

export function revenueEnv(): RevenueEnv {
  return env as unknown as RevenueEnv;
}

export function requestUser(request: Request) {
  const local = new URL(request.url).hostname === 'localhost';
  const id = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if ((!id || !email) && !local) throw new Response('Authentication required.', { status: 401 });
  return {
    id: id || 'local-preview-user',
    email: email || 'preview@revenue-os.local',
  };
}

export type WorkspaceContext = { user: { id: string; email: string }; membershipId: string; workspace: { id: string; name: string; slug: string; timezone: string; currency: string; plan: string; status: string }; role: string };

export function enforceSameOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if (origin) { try { if (new URL(origin).origin !== new URL(request.url).origin) throw new Error('cross_origin'); } catch { throw new Response('Cross-origin mutation rejected.', { status: 403 }); } }
}

export async function requireWorkspace(request: Request): Promise<WorkspaceContext> {
  enforceSameOrigin(request);
  const user = requestUser(request); const db = database(); const requested = request.headers.get('x-revenue-workspace-id');
  let membership = await db.prepare(`SELECT m.id AS membershipId, m.role, w.id, w.name, w.slug, w.timezone, w.currency, w.plan, w.status
    FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ? AND m.status = 'active' AND w.status = 'active' ${requested ? 'AND w.id = ?' : ''}
    ORDER BY m.created_at ASC LIMIT 1`).bind(...(requested ? [user.id, requested] : [user.id])).first<Record<string, string>>();
  if (!membership) {
    const anyWorkspace = await db.prepare(`SELECT id FROM workspaces LIMIT 1`).first<{ id: string }>();
    if (anyWorkspace) throw new Response('You do not have access to this workspace.', { status: 403 });
    const now = Date.now(); const workspaceId = DEFAULT_WORKSPACE; const membershipId = crypto.randomUUID();
    await db.batch([
      db.prepare(`INSERT INTO workspaces (id, name, slug, timezone, currency, plan, status, created_by, created_at, updated_at) VALUES (?, 'Nova Automation', 'nova-automation', 'Asia/Kolkata', 'INR', 'trial', 'active', ?, ?, ?)`).bind(workspaceId, user.id, now, now),
      db.prepare(`INSERT INTO memberships (id, workspace_id, user_id, email, display_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'Arjun Singh', 'owner', 'active', ?, ?)`).bind(membershipId, workspaceId, user.id, user.email, now, now),
    ]);
    membership = { membershipId, role: 'owner', id: workspaceId, name: 'Nova Automation', slug: 'nova-automation', timezone: 'Asia/Kolkata', currency: 'INR', plan: 'trial', status: 'active' };
  }
  const context = { user, membershipId: membership.membershipId, role: membership.role, workspace: { id: membership.id, name: membership.name, slug: membership.slug, timezone: membership.timezone, currency: membership.currency, plan: membership.plan, status: membership.status } };
  if (!['GET','HEAD','OPTIONS'].includes(request.method)) await enforceRateLimit(context, 'mutation', 120, 60_000);
  return context;
}

export async function enforceRateLimit(context: WorkspaceContext, bucket: string, limit: number, windowMs: number) {
  const now=Date.now(); const windowStart=Math.floor(now/windowMs)*windowMs; const rateKey=`${context.user.id}:${bucket}`.slice(0,180); const db=database();
  await db.prepare(`INSERT INTO request_rate_limits (id,workspace_id,rate_key,window_start,request_count,updated_at) VALUES (?,?,?,?,1,?) ON CONFLICT(workspace_id,rate_key) DO UPDATE SET window_start=CASE WHEN request_rate_limits.window_start=? THEN request_rate_limits.window_start ELSE excluded.window_start END,request_count=CASE WHEN request_rate_limits.window_start=? THEN request_rate_limits.request_count+1 ELSE 1 END,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),context.workspace.id,rateKey,windowStart,now,windowStart,windowStart).run();
  const row=await db.prepare(`SELECT request_count AS requestCount FROM request_rate_limits WHERE workspace_id=? AND rate_key=?`).bind(context.workspace.id,rateKey).first<{requestCount:number}>();
  if(Number(row?.requestCount||0)>limit) throw new Response('Too many requests. Try again shortly.',{status:429,headers:{'retry-after':String(Math.max(1,Math.ceil((windowStart+windowMs-now)/1000)))}});
}

export function requireRole(context: WorkspaceContext, allowed: string[]) {
  if (!allowed.includes(context.role)) throw new Response('Insufficient workspace permission.', { status: 403 });
}

export async function requireEventAccess(context: WorkspaceContext, eventId: string, includeArchived = false) {
  if (!eventId) throw new Response('Select an event before continuing.', { status: 409 });
  const access = eventAccessClause(context, 'e.id');
  const event = await database().prepare(`SELECT e.id, e.status FROM events e WHERE e.id = ? AND e.workspace_id = ? ${includeArchived ? '' : "AND e.status != 'archived'"}${access.sql}`)
    .bind(eventId, context.workspace.id, ...access.bindings).first<{ id: string; status: string }>();
  if (!event) throw new Response('You do not have access to this event.', { status: 403 });
  return event;
}

export async function requireLeadAccess(context: WorkspaceContext, leadId: string) {
  const access = eventAccessClause(context, 'l.event_id');
  const lead = await database().prepare(`SELECT l.id, l.event_id AS eventId FROM leads l WHERE l.id = ? AND l.workspace_id = ?${access.sql}`)
    .bind(leadId, context.workspace.id, ...access.bindings).first<{ id: string; eventId: string }>();
  if (!lead) throw new Response('Lead not found or unavailable.', { status: 404 });
  return lead;
}

export async function requireRfqAccess(context: WorkspaceContext, rfqId: string) {
  const access = eventAccessClause(context, 'r.event_id');
  const rfq = await database().prepare(`SELECT r.id, r.event_id AS eventId FROM rfqs r WHERE r.id = ? AND r.workspace_id = ?${access.sql}`)
    .bind(rfqId, context.workspace.id, ...access.bindings).first<{ id: string; eventId: string | null }>();
  if (!rfq) throw new Response('RFQ not found or unavailable.', { status: 404 });
  return rfq;
}

export async function requireOpportunityAccess(context: WorkspaceContext, opportunityId: string) {
  const access = eventAccessClause(context, 'o.event_id');
  const opportunity = await database().prepare(`SELECT o.id, o.event_id AS eventId FROM opportunities o WHERE o.id = ? AND o.workspace_id = ?${access.sql}`)
    .bind(opportunityId, context.workspace.id, ...access.bindings).first<{ id: string; eventId: string | null }>();
  if (!opportunity) throw new Response('Opportunity not found or unavailable.', { status: 404 });
  return opportunity;
}

export async function requireQuotationAccess(context: WorkspaceContext, quotationId: string) {
  const access = eventAccessClause(context, 'q.event_id');
  const quotation = await database().prepare(`SELECT q.id,q.event_id AS eventId FROM quotations q WHERE q.id=? AND q.workspace_id=?${access.sql}`)
    .bind(quotationId, context.workspace.id, ...access.bindings).first<{ id: string; eventId: string | null }>();
  if (!quotation) throw new Response('Quotation not found or unavailable.', { status: 404 });
  return quotation;
}

export function auditStatement(context: WorkspaceContext, action: string, entityType: string, entityId?: string, detail?: unknown) {
  return database().prepare(`INSERT INTO audit_events (id, workspace_id, actor_id, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), context.workspace.id, context.user.id, action, entityType, entityId || null, detail ? JSON.stringify(detail).slice(0, 4000) : null, Date.now());
}

export const DEFAULT_WORKSPACE = 'nova-automation';
export const DEFAULT_EVENT = 'industrialtech-expo-2026';
