import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { retryDelayMs } from '../lib/job-policy.ts';

test('background retries use bounded exponential delay', () => {
  assert.equal(retryDelayMs(1), 60_000);
  assert.equal(retryDelayMs(2), 120_000);
  assert.equal(retryDelayMs(20), 86_400_000);
});

test('operations migration validates jobs and backfills due work', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec('CREATE TABLE workspaces(id TEXT PRIMARY KEY)');
  db.exec('CREATE TABLE leads(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL)');
  db.exec(
    'CREATE TABLE tasks(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,lead_id TEXT,status TEXT NOT NULL,reminder_at INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)',
  );
  db.exec(
    'CREATE TABLE workspace_deletion_requests(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,status TEXT NOT NULL,scheduled_for INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)',
  );
  db.exec("INSERT INTO workspaces VALUES ('w1')");
  db.exec("INSERT INTO leads VALUES ('l1','w1')");
  db.exec("INSERT INTO tasks VALUES ('t1','w1','l1','open',100,1,1)");
  db.exec(
    "INSERT INTO workspace_deletion_requests VALUES ('d1','w1','scheduled',200,1,1)",
  );
  const migration = readFileSync(
    new URL('../drizzle/0030_perfect_texas_twister.sql', import.meta.url),
    'utf8',
  ).replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  const jobs = db
    .prepare(
      'SELECT kind,status,available_at AS availableAt FROM background_jobs ORDER BY available_at',
    )
    .all()
    .map((item) => ({ ...item }));
  assert.deepEqual(jobs, [
    { kind: 'task_reminder', status: 'queued', availableAt: 100 },
    { kind: 'workspace_deletion_due', status: 'queued', availableAt: 200 },
  ]);
  assert.throws(() =>
    db.exec(
      "INSERT INTO background_jobs(id,workspace_id,kind,entity_type,entity_id,dedupe_key,status,max_attempts,available_at,created_at,updated_at) VALUES ('bad','w1','x','x','x','x','invalid',5,1,1,1)",
    ),
  );
  db.exec(
    "UPDATE background_jobs SET status='completed',attempts=3 WHERE entity_id='t1'",
  );
  db.exec(
    "UPDATE background_jobs SET status='queued',attempts=0 WHERE entity_id='t1'",
  );
  assert.equal(
    db
      .prepare("SELECT attempts FROM background_jobs WHERE entity_id='t1'")
      .get()?.attempts,
    0,
  );
  db.close();
});
