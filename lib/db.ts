import { env } from 'cloudflare:workers';

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

export type WorkspaceContext = { user: { id: string; email: string }; workspace: { id: string; name: string; slug: string; timezone: string; currency: string; plan: string; status: string }; role: string };

export function enforceSameOrigin(request: Request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return;
  const origin = request.headers.get('origin');
  if (origin) { try { if (new URL(origin).origin !== new URL(request.url).origin) throw new Error('cross_origin'); } catch { throw new Response('Cross-origin mutation rejected.', { status: 403 }); } }
}

export async function requireWorkspace(request: Request): Promise<WorkspaceContext> {
  enforceSameOrigin(request);
  const user = requestUser(request); const db = database(); const requested = request.headers.get('x-revenue-workspace-id');
  let membership = await db.prepare(`SELECT m.role, w.id, w.name, w.slug, w.timezone, w.currency, w.plan, w.status
    FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
    WHERE m.user_id = ? AND m.status = 'active' AND w.status = 'active' ${requested ? 'AND w.id = ?' : ''}
    ORDER BY m.created_at ASC LIMIT 1`).bind(...(requested ? [user.id, requested] : [user.id])).first<Record<string, string>>();
  if (!membership) {
    const invitation = await db.prepare(`SELECT i.id, i.workspace_id AS workspaceId, i.role
      FROM invitations i JOIN workspaces w ON w.id=i.workspace_id
      WHERE LOWER(i.email)=LOWER(?) AND i.status='pending' AND i.expires_at>? AND w.status='active' ${requested ? 'AND i.workspace_id=?' : ''}
      ORDER BY i.created_at ASC LIMIT 1`).bind(...(requested ? [user.email, Date.now(), requested] : [user.email, Date.now()])).first<{ id: string; workspaceId: string; role: string }>();
    if (invitation) {
      const activeMembers = await db.prepare(`SELECT COUNT(*) AS count FROM memberships WHERE workspace_id=? AND status='active'`).bind(invitation.workspaceId).first<{ count: number }>();
      const targetWorkspace = await db.prepare(`SELECT plan FROM workspaces WHERE id=?`).bind(invitation.workspaceId).first<{ plan: string }>();
      if (targetWorkspace?.plan === 'trial' && Number(activeMembers?.count || 0) >= 3) throw new Response('This trial workspace has reached its member limit.', { status: 402 });
      const now = Date.now(); const membershipId = crypto.randomUUID();
      await db.batch([
        db.prepare(`INSERT INTO memberships (id,workspace_id,user_id,email,display_name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'active',?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET email=excluded.email,role=excluded.role,status='active',updated_at=excluded.updated_at`).bind(membershipId, invitation.workspaceId, user.id, user.email, user.email.split('@')[0], invitation.role, now, now),
        db.prepare(`UPDATE invitations SET status='accepted' WHERE id=? AND status='pending'`).bind(invitation.id),
        db.prepare(`INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,'invitation.accepted','invitation',?,?)`).bind(crypto.randomUUID(), invitation.workspaceId, user.id, invitation.id, now),
      ]);
      membership = await db.prepare(`SELECT m.role, w.id, w.name, w.slug, w.timezone, w.currency, w.plan, w.status FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=? AND m.workspace_id=? AND m.status='active' AND w.status='active' LIMIT 1`).bind(user.id, invitation.workspaceId).first<Record<string, string>>();
    }
  }
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
