export type EventAuthorizationContext = {
  role: string;
  membershipId: string;
  workspace: { id: string };
};

export function canAccessAllEvents(context: EventAuthorizationContext) {
  return (
    context.role === 'owner' ||
    context.role === 'admin' ||
    context.role === 'support'
  );
}

export function eventAccessClause(
  context: EventAuthorizationContext,
  eventExpression: string,
) {
  if (!/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/i.test(eventExpression))
    throw new Error('Unsafe event column expression.');
  if (canAccessAllEvents(context)) return { sql: '', bindings: [] as string[] };
  return {
    sql: ` AND EXISTS (SELECT 1 FROM event_memberships event_access WHERE event_access.workspace_id = ? AND event_access.event_id = ${eventExpression} AND event_access.membership_id = ? AND event_access.status = 'active')`,
    bindings: [context.workspace.id, context.membershipId],
  };
}
