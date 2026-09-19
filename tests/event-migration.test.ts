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
    CREATE TABLE leads (id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, event_id text);
    CREATE TABLE quotations (id text PRIMARY KEY NOT NULL, workspace_id text NOT NULL, rfq_id text, opportunity_id text);
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO memberships VALUES ('m1','w1','owner-user','active'),('m2','w1','sales-user','active'),('m3','w2','other-user','active');
    INSERT INTO events VALUES ('e1','w1','["sales-user"]','owner-user',100,100),('e2','w2','[]','other-user',100,100);
    INSERT INTO rfqs VALUES ('r1','w1','e1');
    INSERT INTO quotations VALUES ('q1','w1','r1',NULL);
    INSERT INTO leads VALUES ('l1','w1','e1'),('l2','w1','e1'),('l3','w2','e2');
  `);
  const migration = readFileSync(new URL('../drizzle/0015_tan_gauntlet.sql', import.meta.url), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)) db.exec(statement);

  const assignments = db.prepare(`SELECT membership_id AS membershipId FROM event_memberships WHERE event_id='e1' ORDER BY membership_id`).all() as Array<{ membershipId: string }>;
  assert.deepEqual(assignments.map((row) => row.membershipId), ['m1', 'm2']);
  assert.equal((db.prepare(`SELECT event_id AS eventId FROM quotations WHERE id='q1'`).get() as { eventId: string }).eventId, 'e1');
  assert.throws(() => db.prepare(`INSERT INTO event_memberships (id,workspace_id,event_id,membership_id,status,created_by,created_at,updated_at) VALUES ('bad','w1','e1','m3','active','owner-user',1,1)`).run(), /membership workspace mismatch/);
  assert.throws(() => db.prepare(`INSERT INTO quotations (id,workspace_id,event_id) VALUES ('bad-quote','w1','e2')`).run(), /quotation event workspace mismatch/);
  for (const file of ['0016_opposite_maximus.sql','0017_glamorous_gamma_corps.sql','0018_previous_sinister_six.sql','0019_secret_johnny_blaze.sql']) {
    const sql=readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8');
    for(const statement of sql.split('--> statement-breakpoint').map((part)=>part.trim()).filter(Boolean))db.exec(statement);
  }
  db.prepare(`INSERT INTO request_rate_limits (id,workspace_id,rate_key,window_start,request_count,updated_at) VALUES ('limit-1','w1','user:mutation',1,1,1)`).run();
  assert.throws(()=>db.prepare(`INSERT INTO request_rate_limits (id,workspace_id,rate_key,window_start,request_count,updated_at) VALUES ('limit-2','w1','user:mutation',1,1,1)`).run(),/UNIQUE/);
  db.prepare(`INSERT INTO workspace_deletion_requests (id,workspace_id,status,requested_by,scheduled_for,created_at,updated_at) VALUES ('delete-1','w1','scheduled','owner-user',10,1,1)`).run();
  assert.throws(()=>db.prepare(`INSERT INTO workspace_deletion_requests (id,workspace_id,status,requested_by,scheduled_for,created_at,updated_at) VALUES ('delete-2','w1','scheduled','owner-user',10,1,1)`).run(),/UNIQUE/);
  db.prepare(`INSERT INTO lead_consents (id,workspace_id,lead_id,purpose,channel,status,source,updated_by,updated_at) VALUES ('consent-1','w1','l1','follow_up','email','granted','test','owner-user',1)`).run();
  assert.throws(()=>db.prepare(`INSERT INTO lead_consents (id,workspace_id,lead_id,purpose,channel,status,source,updated_by,updated_at) VALUES ('consent-2','w1','l1','follow_up','email','granted','test','owner-user',1)`).run(),/UNIQUE/);
  db.prepare(`INSERT INTO suppression_entries (id,workspace_id,channel,identifier_hash,reason,status,created_by,created_at,updated_at) VALUES ('suppression-1','w1','email','hash','withdrawn','active','owner-user',1,1)`).run();
  assert.throws(()=>db.prepare(`INSERT INTO suppression_entries (id,workspace_id,channel,identifier_hash,reason,status,created_by,created_at,updated_at) VALUES ('suppression-2','w1','email','hash','withdrawn','active','owner-user',1,1)`).run(),/UNIQUE/);
  db.prepare(`INSERT INTO lead_duplicate_suggestions (id,workspace_id,source_lead_id,target_lead_id,status,confidence_basis_points,reasons_json,created_at,updated_at) VALUES ('duplicate-1','w1','l1','l2','pending',9000,'[]',1,1)`).run();
  assert.throws(()=>db.prepare(`INSERT INTO lead_merge_events (id,workspace_id,source_lead_id,target_lead_id,status,snapshot_json,merged_by,merged_at) VALUES ('merge-bad','w1','l1','l3','merged','{}','owner-user',1)`).run(),/merge lead scope mismatch/);
  db.close();
});
