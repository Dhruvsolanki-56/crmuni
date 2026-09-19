import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { buildMeetingIcs } from '../lib/ics.ts';

test('meeting migration enforces tenant and event scope with optimistic lifecycle updates',()=>{
  const db=new DatabaseSync(':memory:');db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE workspaces (id text PRIMARY KEY NOT NULL);
    CREATE TABLE events (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL);
    CREATE TABLE leads (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,event_id text NOT NULL);
    CREATE TABLE opportunities (id text PRIMARY KEY NOT NULL,workspace_id text NOT NULL,event_id text NOT NULL);
    CREATE TABLE tasks (id text PRIMARY KEY NOT NULL);
    INSERT INTO workspaces VALUES ('w1'),('w2');
    INSERT INTO events VALUES ('e1','w1'),('e2','w2');
    INSERT INTO leads VALUES ('l1','w1','e1'),('l2','w2','e2');
    INSERT INTO opportunities VALUES ('o1','w1','e1'),('o2','w2','e2');
  `);
  for(const file of ['0023_zippy_leopardon.sql','0024_flippant_mandroid.sql']){const migration=readFileSync(new URL(`../drizzle/${file}`,import.meta.url),'utf8');for(const statement of migration.split('--> statement-breakpoint').map((part)=>part.trim()).filter(Boolean))db.exec(statement);}
  db.prepare(`INSERT INTO meetings (id,workspace_id,event_id,lead_id,opportunity_id,organizer_id,title,starts_at,ends_at,timezone,status,version,created_at,updated_at) VALUES ('m1','w1','e1','l1','o1','u1','Review',1000,2000,'UTC','scheduled',1,1,1)`).run();
  assert.throws(()=>db.prepare(`INSERT INTO meetings (id,workspace_id,event_id,organizer_id,title,starts_at,ends_at,timezone,status,version,created_at,updated_at) VALUES ('bad-event','w1','e2','u1','Bad',1000,2000,'UTC','scheduled',1,1,1)`).run(),/meeting event workspace mismatch/);
  assert.throws(()=>db.prepare(`INSERT INTO meetings (id,workspace_id,event_id,lead_id,organizer_id,title,starts_at,ends_at,timezone,status,version,created_at,updated_at) VALUES ('bad-lead','w1','e1','l2','u1','Bad',1000,2000,'UTC','scheduled',1,1,1)`).run(),/meeting lead scope mismatch/);
  assert.throws(()=>db.prepare(`INSERT INTO meetings (id,workspace_id,event_id,organizer_id,title,starts_at,ends_at,timezone,status,version,created_at,updated_at) VALUES ('bad-time','w1','e1','u1','Bad',2000,1000,'UTC','scheduled',1,1,1)`).run(),/invalid meeting schedule/);
  db.prepare(`INSERT INTO meeting_participants (id,workspace_id,meeting_id,lead_id,email,participant_type,response_status,created_at) VALUES ('p1','w1','m1','l1','person@example.com','external','needs_action',1)`).run();
  assert.throws(()=>db.prepare(`INSERT INTO meeting_participants (id,workspace_id,meeting_id,email,participant_type,response_status,created_at) VALUES ('p2','w2','m1','other@example.com','external','needs_action',1)`).run(),/meeting participant workspace mismatch/);
  assert.throws(()=>db.prepare(`INSERT INTO meeting_participants (id,workspace_id,meeting_id,email,participant_type,response_status,created_at) VALUES ('p3','w1','m1','person@example.com','external','needs_action',1)`).run(),/UNIQUE/);
  const completed=db.prepare(`UPDATE meetings SET status='complete',version=version+1,mutation_token='token-1',updated_at=2 WHERE id='m1' AND workspace_id='w1' AND status='scheduled' AND version=1`).run();assert.equal(completed.changes,1);
  db.prepare(`INSERT INTO meeting_history (id,workspace_id,meeting_id,action,from_status,to_status,version,actor_id,created_at) SELECT 'h1',workspace_id,id,'complete','scheduled','complete',2,'u1',2 FROM meetings WHERE id='m1' AND workspace_id='w1' AND mutation_token='token-1' AND version=2`).run();
  const rejectedHistory=db.prepare(`INSERT INTO meeting_history (id,workspace_id,meeting_id,action,from_status,to_status,version,actor_id,created_at) SELECT 'h2',workspace_id,id,'cancel','scheduled','cancelled',2,'u2',3 FROM meetings WHERE id='m1' AND workspace_id='w1' AND mutation_token='stale-token' AND version=2`).run();assert.equal(rejectedHistory.changes,0);
  const stale=db.prepare(`UPDATE meetings SET status='cancelled',version=version+1,updated_at=3 WHERE id='m1' AND workspace_id='w1' AND status='scheduled' AND version=1`).run();assert.equal(stale.changes,0);db.close();
});

test('calendar export escapes untrusted text and emits UTC dates',()=>{
  const text=buildMeetingIcs({id:'meeting-1',title:'Review, scope; next\nInjected',startsAt:0,endsAt:3_600_000,location:'Room; 1',agenda:'Line 1\nLine 2',status:'scheduled'},[{name:'Raj "Buyer"\nProcurement',email:'rajesh@example.com'}],0);
  assert.match(text,/DTSTART:19700101T000000Z/);assert.match(text,/SUMMARY:Review\\, scope\\; next\\nInjected/);assert.match(text,/LOCATION:Room\\; 1/);assert.match(text,/ATTENDEE;CN="Raj \^'Buyer\^'\^nProcurement":mailto:rajesh@example.com/);assert.ok(text.endsWith('\r\n'));
});
