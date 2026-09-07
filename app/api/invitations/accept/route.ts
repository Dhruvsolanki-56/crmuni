import { database, enforceSameOrigin, requestUser } from '@/lib/db';

export async function POST(request: Request) {
  enforceSameOrigin(request);
  const user = requestUser(request);
  const body = await request.json().catch(() => null) as { invitationId?: unknown } | null;
  const invitationId = typeof body?.invitationId === 'string' ? body.invitationId : '';
  if (!invitationId) return Response.json({ error: 'Invitation ID is required.' }, { status: 400 });
  const db = database();
  const invitation = await db.prepare(`SELECT id, workspace_id AS workspaceId, email, role, expires_at AS expiresAt FROM invitations WHERE id = ? AND status = 'pending'`).bind(invitationId).first<{ id: string; workspaceId: string; email: string; role: string; expiresAt: number }>();
  if (!invitation || invitation.email.toLowerCase() !== user.email.toLowerCase()) return Response.json({ error: 'Invitation not found for this signed-in email.' }, { status: 404 });
  if (invitation.expiresAt < Date.now()) { await db.prepare(`UPDATE invitations SET status = 'expired' WHERE id = ?`).bind(invitationId).run(); return Response.json({ error: 'This invitation has expired.' }, { status: 410 }); }
  const workspace = await db.prepare(`SELECT plan,status FROM workspaces WHERE id=?`).bind(invitation.workspaceId).first<{ plan: string; status: string }>();
  if (!workspace || workspace.status !== 'active') return Response.json({ error: 'This workspace is unavailable.' }, { status: 409 });
  if (workspace.plan === 'trial') {
    const active = await db.prepare(`SELECT COUNT(*) AS count FROM memberships WHERE workspace_id=? AND status='active'`).bind(invitation.workspaceId).first<{ count: number }>();
    if (Number(active?.count || 0) >= 3) return Response.json({ error: 'This trial workspace has reached its member limit.' }, { status: 402 });
  }
  const now = Date.now();
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO memberships (id, workspace_id, user_id, email, display_name, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`).bind(crypto.randomUUID(), invitation.workspaceId, user.id, user.email, user.email.split('@')[0], invitation.role, now, now),
    db.prepare(`UPDATE invitations SET status = 'accepted' WHERE id = ? AND status = 'pending'`).bind(invitationId),
    db.prepare(`INSERT INTO audit_events (id, workspace_id, actor_id, action, entity_type, entity_id, created_at) VALUES (?, ?, ?, 'invitation.accepted', 'invitation', ?, ?)`).bind(crypto.randomUUID(), invitation.workspaceId, user.id, invitationId, now),
  ]);
  return Response.json({ ok: true, workspaceId: invitation.workspaceId });
}
