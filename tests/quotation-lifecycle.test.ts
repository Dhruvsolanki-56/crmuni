import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('quotation migrations enforce approval, revisions and linked commercial scope',()=>{
  const db=new DatabaseSync(':memory:');db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces (id text PRIMARY KEY NOT NULL);
    CREATE TABLE events (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL);
    CREATE TABLE accounts (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL);
    CREATE TABLE rfqs (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,event_id text NOT NULL,account_id text);
    CREATE TABLE opportunities (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,event_id text NOT NULL,account_id text);
    CREATE TABLE quotations (
      id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,event_id text,rfq_id text,opportunity_id text,quote_number text NOT NULL,customer text NOT NULL,
      amount integer NOT NULL DEFAULT 0,currency text NOT NULL,valid_until text,status text NOT NULL DEFAULT 'draft',original_name text,storage_key text,content_type text,
      size_bytes integer,created_by text NOT NULL,created_at integer NOT NULL,updated_at integer NOT NULL
    );
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO events VALUES ('e1','w1'),('e2','w1'),('e3','w2');
    INSERT INTO accounts VALUES ('a1','w1'),('a2','w1'),('a3','w2');
    INSERT INTO rfqs VALUES ('r1','w1','e1','a1'),('r2','w1','e2','a2');
    INSERT INTO opportunities VALUES ('o1','w1','e1','a1'),('o2','w1','e1','a2');
    INSERT INTO quotations VALUES ('q1','w1','e1','r1','o1','Q-1','ABC',1000,'INR','2026-10-01','draft',NULL,NULL,NULL,NULL,'u1',100,100);
  `);
  for(const file of ['0027_great_pyro.sql','0028_majestic_sharon_carter.sql']){const migration=readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8');for(const statement of migration.split('--> statement-breakpoint').map((part)=>part.trim()).filter(Boolean))db.exec(statement);}
  const migrated=db.prepare(`SELECT account_id AS accountId,version,mutation_token AS mutationToken FROM quotations WHERE id='q1'`).get() as {accountId:string;version:number;mutationToken:string};assert.equal(migrated.accountId,'a1');assert.equal(migrated.version,1);assert.ok(migrated.mutationToken);
  const revision=db.prepare(`SELECT version,amount FROM quotation_revisions WHERE quotation_id='q1'`).get() as {version:number;amount:number};assert.equal(revision.version,1);assert.equal(revision.amount,1000);
  assert.throws(()=>db.prepare(`UPDATE quotations SET status='approved' WHERE id='q1'`).run(),/invalid quotation lifecycle/);
  const approved=db.prepare(`UPDATE quotations SET status='approved',approved_by='manager',approved_at=200,version=2,mutation_token='approve-1' WHERE id='q1' AND version=1`).run();assert.equal(approved.changes,1);
  db.prepare(`INSERT INTO quotation_history VALUES ('h2','w1','q1','status_approved','draft','approved',NULL,2,'approve-1','manager',200)`).run();
  assert.throws(()=>db.prepare(`INSERT INTO quotation_history VALUES ('bad-history','w1','q1','status_sent','approved','sent',NULL,2,'wrong','u1',201)`).run(),/quotation history scope mismatch/);
  assert.throws(()=>db.prepare(`INSERT INTO quotations (id,workspace_id,event_id,account_id,rfq_id,quote_number,customer,amount,currency,status,version,created_by,created_at,updated_at) VALUES ('bad-event','w1','e2','a1','r1','BAD-1','ABC',1,'INR','draft',1,'u1',1,1)`).run(),/quotation scope mismatch/);
  assert.throws(()=>db.prepare(`INSERT INTO quotations (id,workspace_id,event_id,account_id,rfq_id,opportunity_id,quote_number,customer,amount,currency,status,version,created_by,created_at,updated_at) VALUES ('bad-account','w1','e1','a1','r1','o2','BAD-2','ABC',1,'INR','draft',1,'u1',1,1)`).run(),/quotation scope mismatch/);
  db.prepare(`INSERT INTO quotation_revisions (id,workspace_id,quotation_id,version,amount,note,created_by,created_at) VALUES ('rev2','w1','q1',2,1200,'Scope change','u1',300)`).run();
  assert.throws(()=>db.prepare(`INSERT INTO quotation_revisions (id,workspace_id,quotation_id,version,amount,created_by,created_at) VALUES ('dup','w1','q1',2,1300,'u1',301)`).run(),/UNIQUE/);
  const stale=db.prepare(`UPDATE quotations SET amount=9999,version=3 WHERE id='q1' AND version=1`).run();assert.equal(stale.changes,0);db.close();
});
