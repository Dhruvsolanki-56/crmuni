import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('task lifecycle migration enforces tenant scope, idempotency and optimistic updates', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces (id text PRIMARY KEY NOT NULL);
    CREATE TABLE leads (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL);
    CREATE TABLE interactions (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,lead_id text NOT NULL);
    CREATE TABLE ai_extractions (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,lead_id text NOT NULL,interaction_id text NOT NULL);
    CREATE TABLE qualification_scores (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,lead_id text NOT NULL,extraction_id text NOT NULL);
    CREATE TABLE meetings (id text PRIMARY KEY NOT NULL);
    CREATE TABLE tasks (
      id text PRIMARY KEY NOT NULL,
      workspace_id text NOT NULL,
      lead_id text NOT NULL REFERENCES leads(id),
      owner_id text NOT NULL,
      title text NOT NULL,
      due_date text,
      status text NOT NULL DEFAULT 'open',
      source_interaction_id text REFERENCES interactions(id),
      created_at integer NOT NULL,
      updated_at integer NOT NULL
    );
    CREATE INDEX idx_tasks_workspace_status_due ON tasks(workspace_id,status,due_date);
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO leads VALUES ('l1','w1'),('l2','w2');
    INSERT INTO interactions VALUES ('i1','w1','l1'),('i2','w2','l2');
    INSERT INTO ai_extractions VALUES ('a1','w1','l1','i1'),('a2','w2','l2','i2');
    INSERT INTO tasks (id,workspace_id,lead_id,owner_id,title,status,created_at,updated_at) VALUES ('t1','w1','l1','u1','Send proposal','open',1,1);
  `);

  for(const file of ['0022_awesome_warhawk.sql','0024_flippant_mandroid.sql']){const migration=readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8');for(const statement of migration.split('--> statement-breakpoint').map((part)=>part.trim()).filter(Boolean))db.exec(statement);}

  const migrated = db.prepare(`SELECT version FROM tasks WHERE id='t1'`).get() as { version: number };
  assert.equal(migrated.version, 1);
  assert.throws(() => db.prepare(`INSERT INTO tasks (id,workspace_id,lead_id,owner_id,title,status,created_at,updated_at) VALUES ('bad','w2','l1','u2','Bad','open',1,1)`).run(), /task lead workspace mismatch/);
  assert.throws(() => db.prepare(`INSERT INTO tasks (id,workspace_id,lead_id,owner_id,title,status,source_extraction_id,created_at,updated_at) VALUES ('bad-extraction','w1','l1','u1','Bad','open','a2',1,1)`).run(), /task extraction scope mismatch/);
  assert.throws(() => db.prepare(`INSERT INTO task_history (id,workspace_id,task_id,action,from_status,to_status,version,actor_id,created_at) VALUES ('bad-history','w2','t1','created','open','open',1,'u2',1)`).run(), /task history workspace mismatch/);

  db.prepare(`INSERT INTO tasks (id,workspace_id,lead_id,owner_id,title,status,source_extraction_id,source_commitment_key,created_at,updated_at) VALUES ('generated-1','w1','l1','u1','Generated','open','a1','0',1,1)`).run();
  assert.throws(() => db.prepare(`INSERT INTO tasks (id,workspace_id,lead_id,owner_id,title,status,source_extraction_id,source_commitment_key,created_at,updated_at) VALUES ('generated-2','w1','l1','u1','Duplicate','open','a1','0',1,1)`).run(), /UNIQUE/);

  const completed = db.prepare(`UPDATE tasks SET status='complete',completed_by='u1',completed_at=10,version=version+1,mutation_token='token-1',updated_at=10 WHERE id='t1' AND workspace_id='w1' AND status='open' AND version=1`).run();
  assert.equal(completed.changes, 1);
  db.prepare(`INSERT INTO task_history (id,workspace_id,task_id,action,from_status,to_status,version,actor_id,created_at) SELECT 'h1',workspace_id,id,'complete','open','complete',2,'u1',10 FROM tasks WHERE id='t1' AND workspace_id='w1' AND mutation_token='token-1' AND version=2`).run();
  const rejectedHistory=db.prepare(`INSERT INTO task_history (id,workspace_id,task_id,action,from_status,to_status,version,actor_id,created_at) SELECT 'h2',workspace_id,id,'cancel','open','cancelled',2,'u2',11 FROM tasks WHERE id='t1' AND workspace_id='w1' AND mutation_token='stale-token' AND version=2`).run();
  assert.equal(rejectedHistory.changes,0);
  const stale = db.prepare(`UPDATE tasks SET status='cancelled',version=version+1,updated_at=11 WHERE id='t1' AND workspace_id='w1' AND status='open' AND version=1`).run();
  assert.equal(stale.changes, 0);

  db.prepare(`INSERT INTO qualification_scores VALUES ('q1','w1','l1','a1')`).run();
  assert.throws(() => db.prepare(`INSERT INTO qualification_scores VALUES ('q2','w1','l1','a1')`).run(), /UNIQUE/);
  db.close();
});
