import { env } from 'cloudflare:workers';

export type RevenueEnv = { DB: D1Database; OPENAI_API_KEY?: string; OPENAI_MODEL?: string };

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

export type WorkspaceContext = { user: { id: string; email: string }; workspace: { id: string; name: string; slug: string; timezone: string; currency: string; plan: string; status: string }; role: string };

export async function requireWorkspace(request: Request): Promise<WorkspaceContext> {
  const user = requestUser(request); const db = database(); const requested = request.headers.get('x-revenue-workspace-id');
  let membership = await db.prepare(`SELECT m.role, w.id, w.name, w.slug, w.timezone, w.currency, w.plan, w.status
    FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ? AND m.status = 'active' AND w.status = 'active' ${requested ? 'AND w.id = ?' : ''}
    ORDER BY m.created_at ASC LIMIT 1`).bind(...(requested ? [user.id, requested] : [user.id])).first<Record<string, string>>();
  if (!membership) {
    const anyWorkspace = await db.prepare(`SELECT id FROM workspaces LIMIT 1`).first<{ id: string }>();
    if (anyWorkspace) throw new Response('You do not have access to this workspace.', { status: 403 });
    const now = Date.now(); const workspaceId = DEFAULT_WORKSPACE;
    await db.batch([
      db.prepare(`INSERT INTO workspaces (id, name, slug, timezone, currency, plan, status, created_by, created_at, updated_at) VALUES (?, 'Nova Automation', 'nova-automation', 'Asia/Kolkata', 'INR', 'trial', 'active', ?, ?, ?)`).bind(workspaceId, user.id, now, now),
      db.prepare(`INSERT INTO memberships (id, workspace_id, user_id, email, display_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'Arjun Singh', 'owner', 'active', ?, ?)`).bind(crypto.randomUUID(), workspaceId, user.id, user.email, now, now),
    ]);
    membership = { role: 'owner', id: workspaceId, name: 'Nova Automation', slug: 'nova-automation', timezone: 'Asia/Kolkata', currency: 'INR', plan: 'trial', status: 'active' };
  }
  return { user, role: membership.role, workspace: { id: membership.id, name: membership.name, slug: membership.slug, timezone: membership.timezone, currency: membership.currency, plan: membership.plan, status: membership.status } };
}

export function requireRole(context: WorkspaceContext, allowed: string[]) {
  if (!allowed.includes(context.role)) throw new Response('Insufficient workspace permission.', { status: 403 });
}

export function auditStatement(context: WorkspaceContext, action: string, entityType: string, entityId?: string, detail?: unknown) {
  return database().prepare(`INSERT INTO audit_events (id, workspace_id, actor_id, action, entity_type, entity_id, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), context.workspace.id, context.user.id, action, entityType, entityId || null, detail ? JSON.stringify(detail).slice(0, 4000) : null, Date.now());
}

export const DEFAULT_WORKSPACE = 'nova-automation';
export const DEFAULT_EVENT = 'industrialtech-expo-2026';
