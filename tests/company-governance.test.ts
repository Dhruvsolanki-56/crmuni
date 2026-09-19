import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('company governance migration versions profiles and guards approved claims', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces(id TEXT PRIMARY KEY);
    CREATE TABLE knowledge_sources(id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, status TEXT NOT NULL);
    CREATE TABLE company_profiles(
      workspace_id TEXT PRIMARY KEY, legal_name TEXT NOT NULL, website_url TEXT,
      description TEXT, target_industries_json TEXT NOT NULL,
      target_geographies_json TEXT NOT NULL, event_objective TEXT,
      updated_by TEXT NOT NULL, updated_at INTEGER NOT NULL
    );
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO knowledge_sources VALUES ('s1','w1','approved'),('s2','w2','approved');
    INSERT INTO company_profiles VALUES ('w1','Acme',NULL,'Machines','["Pharma"]','["India"]','Book demos','owner',10);
  `);
  const migration = readFileSync(
    new URL('../drizzle/0035_govern_company_claims.sql', import.meta.url),
    'utf8',
  ).replaceAll('--> statement-breakpoint', '');
  db.exec(migration);
  const version = db.prepare("SELECT version,snapshot_json AS snapshotJson FROM company_profile_versions WHERE workspace_id='w1'").get() as { version: number; snapshotJson: string };
  assert.equal(version.version, 1);
  assert.equal(JSON.parse(version.snapshotJson).legalName, 'Acme');
  db.exec("INSERT INTO approved_claims(id,workspace_id,claim_text,evidence_note,source_id,status,version,created_by,created_at,updated_at) VALUES ('c1','w1','Reduces monitored downtime','Validated in case study','s1','draft',1,'owner',1,1)");
  assert.throws(
    () => db.exec("INSERT INTO approved_claims(id,workspace_id,claim_text,source_id,status,version,created_by,created_at,updated_at) VALUES ('bad','w1','Cross tenant source','s2','draft',1,'owner',1,1)"),
    /workspace mismatch/,
  );
  assert.throws(
    () => db.exec("UPDATE approved_claims SET status='approved' WHERE id='c1'"),
    /approval attribution/,
  );
  db.exec("UPDATE approved_claims SET status='approved',approved_by='owner',approved_at=2,updated_at=2 WHERE id='c1'");
  db.exec("UPDATE approved_claims SET status='retired',retired_by='owner',retired_at=3,updated_at=3 WHERE id='c1'");
  assert.throws(
    () => db.exec("UPDATE approved_claims SET status='approved',updated_at=4 WHERE id='c1'"),
    /retired claim is final/,
  );
  db.close();
});
