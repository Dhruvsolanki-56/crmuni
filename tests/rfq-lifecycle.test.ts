import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('RFQ migration adds owner SLA, guarded history and unique submission versions', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces (id text PRIMARY KEY NOT NULL);
    CREATE TABLE rfqs (
      id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,account_id text,lead_id text,event_id text,title text NOT NULL,reference text,
      requester_company text NOT NULL,contact_name text,delivery_location text,submission_deadline text,status text NOT NULL DEFAULT 'received',
      processing_status text NOT NULL DEFAULT 'manual_review',owner_id text NOT NULL,created_at integer NOT NULL,updated_at integer NOT NULL
    );
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO rfqs VALUES ('r1','w1',NULL,NULL,'e1','Sensors',NULL,'ABC',NULL,NULL,NULL,'received','manual_review','u1',100,100);
  `);
  const migration = readFileSync(
    new URL('../drizzle/0026_dear_viper.sql', import.meta.url),
    'utf8',
  );
  for (const statement of migration
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter(Boolean))
    db.exec(statement);
  const migrated = db
    .prepare(
      `SELECT owner_due_at AS ownerDueAt,version,mutation_token AS mutationToken FROM rfqs WHERE id='r1'`,
    )
    .get() as { ownerDueAt: number; version: number; mutationToken: string };
  assert.equal(migrated.ownerDueAt, 100 + 86_400_000);
  assert.equal(migrated.version, 1);
  assert.ok(migrated.mutationToken);
  const imported = db
    .prepare(
      `SELECT action,to_status AS toStatus FROM rfq_history WHERE rfq_id='r1'`,
    )
    .get() as { action: string; toStatus: string };
  assert.equal(imported.action, 'imported');
  assert.equal(imported.toStatus, 'received');
  assert.throws(
    () => db.prepare(`UPDATE rfqs SET status='unknown' WHERE id='r1'`).run(),
    /invalid RFQ status/,
  );
  const updated = db
    .prepare(
      `UPDATE rfqs SET status='clarification',version=2,mutation_token='change-1' WHERE id='r1' AND version=1`,
    )
    .run();
  assert.equal(updated.changes, 1);
  const history = db
    .prepare(
      `INSERT INTO rfq_history VALUES ('h2','w1','r1','status_clarification','received','clarification','Need voltage detail',2,'change-1','u1',200)`,
    )
    .run();
  assert.equal(history.changes, 1);
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO rfq_history VALUES ('bad','w1','r1','status_quoted','clarification','quoted',NULL,2,'wrong','u1',201)`,
        )
        .run(),
    /RFQ history scope mismatch/,
  );
  db.prepare(
    `INSERT INTO rfq_submissions VALUES ('s1','w1','r1',1,'Proposal Q-1','submitted','u1',300)`,
  ).run();
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO rfq_submissions VALUES ('s2','w1','r1',1,'Duplicate','submitted','u1',301)`,
        )
        .run(),
    /UNIQUE/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO rfq_submissions VALUES ('s3','w2','r1',2,'Wrong tenant','submitted','u2',302)`,
        )
        .run(),
    /RFQ submission scope mismatch/,
  );
  const stale = db
    .prepare(
      `UPDATE rfqs SET status='quoted',version=3 WHERE id='r1' AND version=1`,
    )
    .run();
  assert.equal(stale.changes, 0);
  db.close();
});
