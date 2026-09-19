import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('event access migration backfills assignments and enforces tenant relationships', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces (id text PRIMARY KEY NOT NULL);
    CREATE TABLE memberships (id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, user_id text NOT NULL, status text NOT NULL);
    CREATE TABLE events (id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, team_member_ids_json text NOT NULL, created_by text NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL);
    CREATE TABLE rfqs (id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, event_id text);
    CREATE TABLE opportunities (id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, event_id text);
    CREATE TABLE quotations (id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, rfq_id text, opportunity_id text);
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO memberships VALUES ('m1','w1','owner-user','active'),('m2','w1','sales-user','active'),('m3','w2','other-user','active');
    INSERT INTO events VALUES ('e1','w1','["sales-user"]','owner-user',100,100),('e2','w2','[]','other-user',100,100);
    INSERT INTO rfqs VALUES ('r1','w1','e1');
    INSERT INTO quotations VALUES ('q1','w1','r1',NULL);
  `);
  const migration = readFileSync(new URL('../drizzle/0015_tan_gauntlet.sql', import.meta.url), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)) db.exec(statement);

  const assignments = db.prepare(`SELECT membership_id AS membershipId FROM event_memberships WHERE event_id='e1' ORDER BY membership_id`).all() as Array<{ membershipId: string }>;
  assert.deepEqual(assignments.map((row) => row.membershipId), ['m1', 'm2']);
  assert.equal((db.prepare(`SELECT event_id AS eventId FROM quotations WHERE id='q1'`).get() as { eventId: string }).eventId, 'e1');
  assert.throws(() => db.prepare(`INSERT INTO event_memberships (id,workspace_id,event_id,membership_id,status,created_by,created_at,updated_at) VALUES ('bad','w1','e1','m3','active','owner-user',1,1)`).run(), /membership workspace mismatch/);
  assert.throws(() => db.prepare(`INSERT INTO quotations (id,workspace_id,event_id) VALUES ('bad-quote','w1','e2')`).run(), /quotation event workspace mismatch/);
  db.close();
});
