import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('support grants are time bounded, unique while active and irrevocable after revocation', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec('CREATE TABLE workspaces(id TEXT PRIMARY KEY)');
  db.exec("INSERT INTO workspaces VALUES ('w1')");
  const migration = readFileSync(
    new URL('../drizzle/0032_woozy_johnny_blaze.sql', import.meta.url),
    'utf8',
  ).replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  assert.throws(() =>
    db.exec(
      "INSERT INTO support_access_grants(id,workspace_id,support_user_id,support_email,reason,status,granted_by,expires_at,created_at,updated_at) VALUES ('expired','w1','s1','s@example.com','test','active','o1',1,1,1)",
    ),
  );
  db.exec(
    "INSERT INTO support_access_grants(id,workspace_id,support_user_id,support_email,reason,status,granted_by,expires_at,created_at,updated_at) VALUES ('g1','w1','s1','s@example.com','ticket','active','o1',100,1,1)",
  );
  assert.throws(() =>
    db.exec(
      "INSERT INTO support_access_grants(id,workspace_id,support_user_id,support_email,reason,status,granted_by,expires_at,created_at,updated_at) VALUES ('g2','w1','s1','s@example.com','duplicate','active','o1',100,2,2)",
    ),
  );
  db.exec(
    "UPDATE support_access_grants SET status='revoked',revoked_at=3,updated_at=3 WHERE id='g1'",
  );
  assert.throws(() =>
    db.exec(
      "UPDATE support_access_grants SET status='active',updated_at=4 WHERE id='g1'",
    ),
  );
  db.close();
});
