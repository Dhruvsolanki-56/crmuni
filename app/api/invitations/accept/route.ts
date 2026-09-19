import { database, enforceSameOrigin, requestUser } from '@/lib/db';
import { entitlementsFor, isEntitlementConstraint } from '@/lib/entitlements';

export async function POST(request: Request) {
  enforceSameOrigin(request);
  const user = requestUser(request);
  const body = await request.json().catch(() => null) as { invitationId?: unknown } | null;
  const invitationId = typeof body?.invitationId === 'string' ? body.invitationId : '';
  if (!invitationId) return Response.json({ error: 'Invitation ID is required.' }, { status: 400 });
  const db = database();
  const invitation = await db.prepare(`SELECT id, workspace_id AS workspaceId, email, role, status, expires_at AS expiresAt FROM invitations WHERE id = ?`).bind(invitationId).first<{ id: string; workspaceId: string; email: string; role: string; status: string; expiresAt: number }>();
  if (!invitation || invitation.email.toLowerCase() !== user.email.toLowerCase()) return Response.json({ error: 'Invitation not found for this signed-in email.' }, { status: 404 });
  if (!['pending','accepted'].includes(invitation.status)) return Response.json({ error: 'This invitation is no longer available.' }, { status: 409 });
  if (invitation.status === 'pending' && invitation.expiresAt < Date.now()) { await db.prepare(`UPDATE invitations SET status = 'expired' WHERE id = ? AND status='pending'`).bind(invitationId).run(); return Response.json({ error: 'This invitation has expired.' }, { status: 410 }); }
  const workspace = await db.prepare(`SELECT plan,status FROM workspaces WHERE id=?`).bind(invitation.workspaceId).first<{ plan: string; status: string }>();
  if (!workspace || workspace.status !== 'active') return Response.json({ error: 'This workspace is unavailable.' }, { status: 409 });
  const existingMembership = await db.prepare(`SELECT status FROM memberships WHERE workspace_id=? AND user_id=?`).bind(invitation.workspaceId, user.id).first<{ status: string }>();
  if (existingMembership?.status === 'active') {
    if (invitation.status === 'pending') {
      const acceptedAt = Date.now();
      await db.batch([
        db.prepare(`UPDATE invitations SET status='accepted' WHERE id=? AND status='pending'`).bind(invitationId),
        db.prepare(`INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) VALUES (?,?,?,'invitation.accepted','invitation',?,'{"existingMembership":true}',?)`).bind(crypto.randomUUID(),invitation.workspaceId,user.id,invitationId,acceptedAt),
      ]);
    }
    return Response.json({ ok: true, duplicate: true, workspaceId: invitation.workspaceId });
  }
  const memberLimit = entitlementsFor(workspace.plan).activeMembers;
  if (invitation.status === 'pending') {
    const active = await db.prepare(`SELECT COUNT(*) AS count FROM memberships WHERE workspace_id=? AND status='active'`).bind(invitation.workspaceId).first<{ count: number }>();
    if (Number(active?.count || 0) >= memberLimit) return Response.json({ error: `This ${workspace.plan} workspace has reached its ${memberLimit}-member limit.` }, { status: 402 });
  }
  const now = Date.now();
  try {
    await db.batch([
      db.prepare(`UPDATE invitations SET status='accepted' WHERE id=? AND status='pending'`).bind(invitationId),
      db.prepare(`INSERT INTO memberships (id,workspace_id,user_id,email,display_name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'active',?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET email=excluded.email,role=excluded.role,status='active',updated_at=excluded.updated_at`).bind(crypto.randomUUID(),invitation.workspaceId,user.id,user.email,user.email.split('@')[0],invitation.role,now,now),
      ...(invitation.status === 'pending' ? [db.prepare(`INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,'invitation.accepted','invitation',?,?)`).bind(crypto.randomUUID(),invitation.workspaceId,user.id,invitationId,now)] : []),
    ]);
  } catch (error) {
    if (isEntitlementConstraint(error, 'ACTIVE_MEMBER_LIMIT'))
      return Response.json({ error: `This ${workspace.plan} workspace has reached its ${memberLimit}-member limit.` }, { status: 402 });
    throw error;
  }
  return Response.json({ ok: true, duplicate: invitation.status === 'accepted', workspaceId: invitation.workspaceId });
}
