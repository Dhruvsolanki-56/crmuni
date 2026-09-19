import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { entitlementsFor } from '../lib/entitlements.ts';

test('unknown plans fail closed to trial entitlements', () => {
  assert.deepEqual(entitlementsFor('unknown'), entitlementsFor('trial'));
  assert.equal(entitlementsFor('growth').activeMembers, 30);
  assert.ok(entitlementsFor('scale').storageBytes > entitlementsFor('starter').storageBytes);
});

test('plan migration atomically enforces member and aggregate storage limits', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE workspaces(id TEXT PRIMARY KEY, plan TEXT NOT NULL);
    CREATE TABLE memberships(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE knowledge_sources(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, size_bytes INTEGER);
    CREATE TABLE lead_capture_assets(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, size_bytes INTEGER);
    CREATE TABLE rfq_documents(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, size_bytes INTEGER);
    CREATE TABLE quotations(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, size_bytes INTEGER);
    INSERT INTO workspaces VALUES ('trial-workspace','trial'),('growth-workspace','growth');
  `);
  const migration = readFileSync(
    new URL('../drizzle/0033_enforce_plan_entitlements.sql', import.meta.url),
    'utf8',
  ).replaceAll('--> statement-breakpoint', '');
  db.exec(migration);

  db.exec("INSERT INTO memberships VALUES ('m1','trial-workspace','active'),('m2','trial-workspace','active'),('m3','trial-workspace','active')");
  assert.throws(
    () => db.exec("INSERT INTO memberships VALUES ('m4','trial-workspace','active')"),
    /ACTIVE_MEMBER_LIMIT/,
  );
  db.exec("INSERT INTO memberships VALUES ('inactive','trial-workspace','inactive')");
  assert.throws(
    () => db.exec("UPDATE memberships SET status='active' WHERE id='inactive'"),
    /ACTIVE_MEMBER_LIMIT/,
  );
  db.exec("INSERT INTO memberships VALUES ('g1','growth-workspace','active'),('g2','growth-workspace','active'),('g3','growth-workspace','active'),('g4','growth-workspace','active')");
  assert.throws(
    () => db.exec("UPDATE workspaces SET plan='trial' WHERE id='growth-workspace'"),
    /ACTIVE_MEMBER_LIMIT/,
  );

  db.exec("INSERT INTO knowledge_sources VALUES ('k1','trial-workspace',94371840)");
  db.exec("INSERT INTO lead_capture_assets VALUES ('a1','trial-workspace',10485760)");
  assert.throws(
    () => db.exec("INSERT INTO rfq_documents VALUES ('r1','trial-workspace',1)"),
    /STORAGE_LIMIT/,
  );
  assert.throws(
    () => db.exec("INSERT INTO workspaces VALUES ('bad','enterprise')"),
    /INVALID_WORKSPACE_PLAN/,
  );
  db.close();
});
