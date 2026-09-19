import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('lead erasure requests are tenant scoped, retryable and final after completion', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE leads(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL);
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO leads VALUES ('l1','w1'),('l2','w2');
  `);
  const migration = readFileSync(
    new URL('../drizzle/0034_durable_contact_erasure.sql', import.meta.url),
    'utf8',
  ).replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  db.exec("INSERT INTO lead_erasure_requests(id,workspace_id,lead_id,status,asset_keys_json,requested_by,created_at,updated_at) VALUES ('r1','w1','l1','queued','[]','owner',1,1)");
  assert.throws(
    () => db.exec("INSERT INTO lead_erasure_requests(id,workspace_id,lead_id,status,asset_keys_json,requested_by,created_at,updated_at) VALUES ('wrong','w1','l2','queued','[]','owner',1,1)"),
    /workspace mismatch/,
  );
  assert.throws(
    () => db.exec("INSERT INTO lead_erasure_requests(id,workspace_id,lead_id,status,asset_keys_json,requested_by,created_at,updated_at) VALUES ('bad','w1','l1','unknown','[]','owner',1,1)"),
  );
  db.exec("UPDATE lead_erasure_requests SET status='processing',attempts=1,updated_at=2 WHERE id='r1'");
  db.exec("UPDATE lead_erasure_requests SET status='failed',last_error='temporary',updated_at=3 WHERE id='r1'");
  db.exec("UPDATE lead_erasure_requests SET status='queued',attempts=0,last_error=NULL,updated_at=4 WHERE id='r1'");
  db.exec("UPDATE lead_erasure_requests SET status='completed',completed_at=5,updated_at=5 WHERE id='r1'");
  assert.throws(
    () => db.exec("UPDATE lead_erasure_requests SET status='queued',updated_at=6 WHERE id='r1'"),
    /completed lead erasure is final/,
  );
  db.close();
});
