import { auditStatement, database, requireRole, requireWorkspace } from '@/lib/db';

const ROLES = ['owner', 'admin', 'manager', 'salesperson', 'marketing', 'viewer'];
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: Request) {
  const context = await requireWorkspace(request); const db = database();
  const [members, invitations, audit] = await Promise.all([
    db.prepare(`SELECT id, user_id AS userId, email, display_name AS displayName, role, status, created_at AS createdAt FROM memberships WHERE workspace_id = ? ORDER BY created_at ASC`).bind(context.workspace.id).all(),
    db.prepare(`SELECT id, email, role, status, expires_at AS expiresAt, created_at AS createdAt FROM invitations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 30`).bind(context.workspace.id).all(),
    db.prepare(`SELECT id, actor_id AS actorId, action, entity_type AS entityType, entity_id AS entityId, created_at AS createdAt FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 30`).bind(context.workspace.id).all(),
  ]);
  return Response.json({ context: { workspace: context.workspace, role: context.role, user: context.user }, members: members.results, invitations: invitations.results, audit: audit.results });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request); requireRole(context, ['owner', 'admin']);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 30); const db = database(); const now = Date.now();
  if (action === 'invite') {
    const email = clean(body.email, 254).toLowerCase(); const role = clean(body.role, 30);
    if (!/^\S+@\S+\.\S+$/.test(email) || !ROLES.includes(role) || role === 'owner') return Response.json({ error: 'Enter a valid email and assignable role.' }, { status: 400 });
    const duplicate = await db.prepare(`SELECT id FROM invitations WHERE workspace_id = ? AND email = ? AND status = 'pending'`).bind(context.workspace.id, email).first();
    if (duplicate) return Response.json({ error: 'A pending invitation already exists.' }, { status: 409 });
    const id = crypto.randomUUID();
    await db.batch([
      db.prepare(`INSERT INTO invitations (id, workspace_id, email, role, status, invited_by, expires_at, created_at) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`).bind(id, context.workspace.id, email, role, context.user.id, now + 7 * 86400000, now),
      auditStatement(context, 'invitation.created', 'invitation', id, { email, role }),
    ]);
    return Response.json({ invitation: { id, email, role, status: 'pending', expiresAt: now + 7 * 86400000, createdAt: now } }, { status: 201 });
  }
  if (action === 'update_workspace') {
    const name = clean(body.name, 120); const timezone = clean(body.timezone, 80); const currency = clean(body.currency, 3).toUpperCase();
    if (!name || !timezone || !/^[A-Z]{3}$/.test(currency)) return Response.json({ error: 'Name, timezone and a three-letter currency are required.' }, { status: 400 });
    await db.batch([
      db.prepare(`UPDATE workspaces SET name = ?, timezone = ?, currency = ?, updated_at = ? WHERE id = ?`).bind(name, timezone, currency, now, context.workspace.id),
      auditStatement(context, 'workspace.updated', 'workspace', context.workspace.id, { name, timezone, currency }),
    ]);
    return Response.json({ workspace: { ...context.workspace, name, timezone, currency } });
  }
  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
