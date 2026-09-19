import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessAllEvents, eventAccessClause } from '../lib/authorization.ts';

const context = (role: string) => ({ role, membershipId: 'member-1', workspace: { id: 'workspace-1' } });

test('owners and admins receive workspace-wide event access', () => {
  for (const role of ['owner', 'admin']) {
    assert.equal(canAccessAllEvents(context(role)), true);
    assert.deepEqual(eventAccessClause(context(role), 'l.event_id'), { sql: '', bindings: [] });
  }
});

test('operational roles are restricted to active event assignments', () => {
  for (const role of ['manager', 'salesperson', 'marketing', 'viewer']) {
    const access = eventAccessClause(context(role), 'l.event_id');
    assert.equal(canAccessAllEvents(context(role)), false);
    assert.match(access.sql, /event_memberships/);
    assert.match(access.sql, /event_access\.status = 'active'/);
    assert.deepEqual(access.bindings, ['workspace-1', 'member-1']);
  }
});

test('event access SQL rejects dynamic or unsafe expressions', () => {
  assert.throws(() => eventAccessClause(context('salesperson'), 'l.event_id OR 1=1'), /Unsafe event column/);
  assert.throws(() => eventAccessClause(context('salesperson'), 'event_id'), /Unsafe event column/);
});
