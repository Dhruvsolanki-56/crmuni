import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('event readiness gates activation to the assessed configuration', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE events(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      status TEXT NOT NULL
    );
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO events VALUES ('e1','w1','draft'),('e2','w2','draft');
  `);
  const migration = readFileSync(
    new URL('../drizzle/0037_gate_event_readiness.sql', import.meta.url),
    'utf8',
  ).replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  const hash = 'a'.repeat(64);
  const passingChecks = JSON.stringify(
    Array.from({ length: 10 }, (_, index) => ({
      key: `check-${index}`,
      required: true,
      passed: true,
    })),
  );
  const blockedChecks = JSON.stringify([
    ...Array.from({ length: 9 }, (_, index) => ({
      key: `check-${index}`,
      required: true,
      passed: true,
    })),
    { key: 'check-9', required: true, passed: false },
  ]);

  assert.throws(
    () => db.exec(`UPDATE events SET status='active' WHERE id='e1'`),
    /passing readiness assessment/,
  );
  assert.throws(
    () =>
      db.exec(
        `INSERT INTO event_readiness_snapshots(id,workspace_id,event_id,version,config_version,status,checks_json,config_json,config_hash,assessed_by,assessed_at) VALUES ('bad','w1','e2',1,1,'ready','${passingChecks}','{}','${hash}','owner',1)`,
      ),
    /scope or config mismatch/,
  );
  assert.throws(
    () =>
      db.exec(
        `INSERT INTO event_readiness_snapshots(id,workspace_id,event_id,version,config_version,status,checks_json,config_json,config_hash,assessed_by,assessed_at,activated_by,activated_at) VALUES ('blocked','w1','e1',1,1,'blocked','${blockedChecks}','{}','${hash}','owner',1,'owner',1)`,
      ),
    /blocked event cannot be activated/,
  );

  db.exec(
    `INSERT INTO event_readiness_snapshots(id,workspace_id,event_id,version,config_version,status,checks_json,config_json,config_hash,assessed_by,assessed_at) VALUES ('r1','w1','e1',1,1,'ready','${passingChecks}','{}','${hash}','owner',2)`,
  );
  db.exec(`UPDATE events SET status='ready' WHERE id='e1'`);
  db.exec(
    `UPDATE event_readiness_snapshots SET activated_by='owner',activated_at=3 WHERE id='r1'`,
  );
  db.exec(`UPDATE events SET status='active' WHERE id='e1'`);
  assert.equal(
    (
      db.prepare(`SELECT status FROM events WHERE id='e1'`).get() as {
        status: string;
      }
    ).status,
    'active',
  );
  assert.throws(
    () =>
      db.exec(
        `UPDATE event_readiness_snapshots SET checks_json='[1]' WHERE id='r1'`,
      ),
    /assessment is immutable/,
  );

  db.exec(`UPDATE events SET config_version=2,status='draft' WHERE id='e1'`);
  assert.throws(
    () => db.exec(`UPDATE events SET status='active' WHERE id='e1'`),
    /passing readiness assessment/,
  );
  db.exec(`UPDATE events SET status='archived' WHERE id='e1'`);
  assert.throws(
    () => db.exec(`UPDATE events SET status='draft' WHERE id='e1'`),
    /archived event is final/,
  );
  db.close();
});
