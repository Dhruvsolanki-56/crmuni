import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('capture extraction remains a suggestion until attributed review', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE leads(id TEXT PRIMARY KEY);
    CREATE TABLE lead_capture_assets(
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      processing_status TEXT NOT NULL
    );
    INSERT INTO workspaces VALUES ('w1');
    INSERT INTO leads VALUES ('l1'),('l2');
    INSERT INTO lead_capture_assets VALUES
      ('a1','w1','l1','stored_pending_extraction'),
      ('legacy','w1','l2','completed');
  `);
  const migration = readFileSync(
    new URL('../drizzle/0038_review_capture_extraction.sql', import.meta.url),
    'utf8',
  ).replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  assert.equal(
    (
      db
        .prepare(
          `SELECT processing_status AS status FROM lead_capture_assets WHERE id='legacy'`,
        )
        .get() as { status: string }
    ).status,
    'completed_pending_review',
  );

  db.exec(
    `UPDATE lead_capture_assets SET processing_status='processing' WHERE id='a1'`,
  );
  db.exec(
    `UPDATE lead_capture_assets SET processing_status='completed_pending_review' WHERE id='a1'`,
  );
  assert.throws(
    () =>
      db.exec(
        `UPDATE lead_capture_assets SET processing_status='confirmed' WHERE id='a1'`,
      ),
    /review attribution/,
  );
  assert.throws(
    () =>
      db.exec(
        `UPDATE lead_capture_assets SET processing_status='confirmed',accepted_fields_json='["unknown"]',reviewed_by='owner',reviewed_at=1 WHERE id='a1'`,
      ),
    /invalid accepted capture fields/,
  );
  db.exec(
    `UPDATE lead_capture_assets SET processing_status='confirmed',accepted_fields_json='["fullName","company"]',reviewed_by='owner',reviewed_at=1 WHERE id='a1'`,
  );
  assert.throws(
    () =>
      db.exec(
        `UPDATE lead_capture_assets SET processing_status='processing' WHERE id='a1'`,
      ),
    /confirmed capture review is final/,
  );
  db.close();
});
