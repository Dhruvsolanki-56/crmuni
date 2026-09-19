import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('opportunity migration preserves contacts and enforces audited lifecycle scope', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces (id text PRIMARY KEY NOT NULL);
    CREATE TABLE events (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL);
    CREATE TABLE accounts (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL);
    CREATE TABLE leads (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,event_id text NOT NULL,account_id text,full_name text NOT NULL,company text NOT NULL,review_status text NOT NULL);
    CREATE TABLE account_stakeholders (id text PRIMARY KEY,workspace_id text NOT NULL,lead_id text NOT NULL,buying_role text);
    CREATE TABLE opportunities (
      id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,event_id text,lead_id text,account_id text,company text NOT NULL,title text NOT NULL,
      stage text NOT NULL DEFAULT 'qualified',value integer NOT NULL DEFAULT 0,currency text NOT NULL DEFAULT 'INR',probability integer NOT NULL DEFAULT 20,
      expected_close_date text,created_at integer NOT NULL,updated_at integer NOT NULL
    );
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO events VALUES ('e1','w1'),('e2','w2'),('e3','w1');
    INSERT INTO accounts VALUES ('a1','w1'),('a2','w1'),('a3','w2');
    INSERT INTO leads VALUES ('l1','w1','e1','a1','Raj','ABC','confirmed'),('l2','w1','e1','a1','Neha','ABC','confirmed'),('wrong-account','w1','e1','a2','Other','Other','confirmed'),('wrong-event','w1','e3','a1','Later','ABC','confirmed'),('wrong-tenant','w2','e2','a3','No','No','confirmed');
    INSERT INTO account_stakeholders VALUES ('s1','w1','l1','buyer');
    INSERT INTO opportunities VALUES ('o1','w1','e1','l1','a1','ABC','Monitoring','qualified',1000,'INR',20,NULL,1,1);
  `);
  const migration = readFileSync(
    new URL('../drizzle/0025_dazzling_kylun.sql', import.meta.url),
    'utf8',
  );
  for (const statement of migration
    .split('--> statement-breakpoint')
    .map((part) => part.trim())
    .filter(Boolean))
    db.exec(statement);

  const contact = db
    .prepare(
      `SELECT lead_id AS leadId,contact_role AS contactRole,is_primary AS isPrimary FROM opportunity_contacts WHERE opportunity_id='o1'`,
    )
    .get() as { leadId: string; contactRole: string; isPrimary: number };
  assert.equal(contact.leadId, 'l1');
  assert.equal(contact.contactRole, 'buyer');
  assert.equal(contact.isPrimary, 1);
  const imported = db
    .prepare(
      `SELECT change_type AS changeType,to_stage AS toStage,to_value AS toValue FROM opportunity_history WHERE opportunity_id='o1'`,
    )
    .get() as { changeType: string; toStage: string; toValue: number };
  assert.equal(imported.changeType, 'imported');
  assert.equal(imported.toStage, 'qualified');
  assert.equal(imported.toValue, 1000);
  db.prepare(
    `INSERT INTO opportunity_contacts VALUES ('c2','w1','o1','l2',NULL,0,'u1',2)`,
  ).run();
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO opportunity_contacts VALUES ('bad-account','w1','o1','wrong-account',NULL,0,'u1',2)`,
        )
        .run(),
    /opportunity contact scope mismatch/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO opportunity_contacts VALUES ('bad-event','w1','o1','wrong-event',NULL,0,'u1',2)`,
        )
        .run(),
    /opportunity contact scope mismatch/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO opportunity_contacts VALUES ('bad-tenant','w1','o1','wrong-tenant',NULL,0,'u1',2)`,
        )
        .run(),
    /opportunity contact scope mismatch/,
  );
  assert.throws(
    () =>
      db
        .prepare(
          `UPDATE opportunities SET stage='lost',closed_at=3 WHERE id='o1'`,
        )
        .run(),
    /invalid opportunity lifecycle/,
  );

  const updated = db
    .prepare(
      `UPDATE opportunities SET stage='lost',probability=0,loss_reason='Budget cancelled',closed_at=3,version=version+1,mutation_token='change-1',updated_at=3 WHERE id='o1' AND version=1`,
    )
    .run();
  assert.equal(updated.changes, 1);
  const written = db
    .prepare(
      `INSERT INTO opportunity_history (id,workspace_id,opportunity_id,change_type,from_stage,to_stage,from_value,to_value,reason,mutation_token,changed_by,created_at) SELECT 'h2',workspace_id,id,'stage','qualified','lost',value,value,'Budget cancelled','change-1','u1',3 FROM opportunities WHERE id='o1' AND version=2 AND mutation_token='change-1'`,
    )
    .run();
  assert.equal(written.changes, 1);
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO opportunity_history VALUES ('bad-history','w1','o1','stage','lost','qualified',1000,1000,'stale','wrong-token','u2',4)`,
        )
        .run(),
    /opportunity history scope mismatch/,
  );
  const stale = db
    .prepare(
      `UPDATE opportunities SET value=2000,version=version+1 WHERE id='o1' AND version=1`,
    )
    .run();
  assert.equal(stale.changes, 0);
  db.close();
});
