import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('knowledge ingestion records provenance and enforces review lifecycle', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE knowledge_sources(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      source_type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO knowledge_sources VALUES
      ('s1','w1','Legacy PDF','file','stored',10),
      ('s2','w2','Other website','website','approved',20);
  `);
  const migration = readFileSync(
    new URL('../drizzle/0036_track_knowledge_ingestion.sql', import.meta.url),
    'utf8',
  ).replaceAll('--> statement-breakpoint', '');
  db.exec(migration);

  const backfilled = db
    .prepare(
      `SELECT status,content_hash AS contentHash,extraction_method AS extractionMethod FROM knowledge_ingestions WHERE source_id='s1'`,
    )
    .get() as {
    status: string;
    contentHash: string;
    extractionMethod: string;
  };
  assert.equal(backfilled.status, 'ready_for_review');
  assert.equal(backfilled.contentHash, 'legacy:s1');
  assert.equal(backfilled.extractionMethod, 'legacy_original');

  assert.throws(
    () =>
      db.exec(
        `INSERT INTO knowledge_ingestions(id,workspace_id,source_id,status,content_hash,extraction_method,provenance_json,attempts,created_at,updated_at) VALUES ('bad','w1','s2','ready_for_review','12345678','manual','{}',1,1,1)`,
      ),
    /workspace mismatch/,
  );
  assert.throws(
    () =>
      db.exec(
        `UPDATE knowledge_ingestions SET status='approved' WHERE source_id='s1'`,
      ),
    /review requires attribution/,
  );

  db.exec(
    `UPDATE knowledge_ingestions SET status='approved',reviewed_by='owner',reviewed_at=30,updated_at=30 WHERE source_id='s1'`,
  );
  assert.throws(
    () =>
      db.exec(
        `UPDATE knowledge_ingestions SET status='failed',updated_at=31 WHERE source_id='s1'`,
      ),
    /invalid knowledge ingestion transition/,
  );
  db.exec(
    `UPDATE knowledge_ingestions SET status='removed',updated_at=32 WHERE source_id='s1'`,
  );
  assert.throws(
    () =>
      db.exec(
        `UPDATE knowledge_ingestions SET status='ready_for_review',updated_at=33 WHERE source_id='s1'`,
      ),
    /removed knowledge ingestion is final/,
  );

  db.exec(`
    INSERT INTO knowledge_sources VALUES ('s3','w1','Retry source','file','pending_review',40);
    INSERT INTO knowledge_ingestions(id,workspace_id,source_id,status,content_hash,extraction_method,provenance_json,attempts,last_error,created_at,updated_at)
    VALUES ('i3','w1','s3','failed','abcdef123456','binary_original','{}',3,'temporary error',40,40);
    UPDATE knowledge_ingestions SET status='ready_for_review',attempts=1,last_error=NULL,updated_at=41 WHERE id='i3';
  `);
  const retried = db
    .prepare(
      `SELECT status,attempts,last_error AS lastError FROM knowledge_ingestions WHERE id='i3'`,
    )
    .get() as {
    status: string;
    attempts: number;
    lastError: string | null;
  };
  assert.equal(retried.status, 'ready_for_review');
  assert.equal(retried.attempts, 1);
  assert.equal(retried.lastError, null);
  db.close();
});
