import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

function loadMigration(db: DatabaseSync, file: string) {
  const sql = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8');
  for (const statement of sql
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter(Boolean))
    db.exec(statement);
}

test('lead comments require non-empty body and a JSON array of mentions', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE workspaces (id text PRIMARY KEY);
    CREATE TABLE leads (id text PRIMARY KEY);
    INSERT INTO workspaces (id) VALUES ('workspace-1');
    INSERT INTO leads (id) VALUES ('lead-1');
  `);
  loadMigration(db, '0040_lead_comments.sql');

  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO lead_comments (id,workspace_id,lead_id,author_id,body,mentioned_user_ids_json,created_at) VALUES (?,?,?,?,?,?,?)`,
        )
        .run('c1', 'workspace-1', 'lead-1', 'user-1', '   ', '[]', 100),
    /comment body is required/,
  );

  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO lead_comments (id,workspace_id,lead_id,author_id,body,mentioned_user_ids_json,created_at) VALUES (?,?,?,?,?,?,?)`,
        )
        .run('c2', 'workspace-1', 'lead-1', 'user-1', 'Hello', '{}', 100),
    /mentioned_user_ids_json must be a JSON array/,
  );

  const insert = db
    .prepare(
      `INSERT INTO lead_comments (id,workspace_id,lead_id,author_id,body,mentioned_user_ids_json,created_at) VALUES (?,?,?,?,?,?,?)`,
    )
    .run('c3', 'workspace-1', 'lead-1', 'user-1', 'Following up next week', '["user-2"]', 100);
  assert.equal(insert.changes, 1);

  const row = db
    .prepare(`SELECT body,mentioned_user_ids_json AS mentions FROM lead_comments WHERE id='c3'`)
    .get() as Record<string, string>;
  assert.deepEqual({ ...row }, { body: 'Following up next week', mentions: '["user-2"]' });
  db.close();
});
