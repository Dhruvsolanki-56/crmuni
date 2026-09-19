import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  attributedWithinWindow,
  rankNextActions,
  safeCsvCell,
  toCsv,
} from '../lib/reporting.ts';

test('next best actions use deterministic urgency rules', () => {
  const now = Date.UTC(2026, 8, 19, 12);
  const ranked = rankNextActions(
    [
      {
        id: 'hot',
        kind: 'lead',
        title: 'Call',
        subject: 'Hot lead',
        qualificationState: 'hot',
      },
      {
        id: 'task',
        kind: 'task',
        title: 'Send proposal',
        subject: 'ABC',
        dueAt: now + 3600000,
      },
      {
        id: 'rfq',
        kind: 'rfq',
        title: 'Submit RFQ',
        subject: 'XYZ',
        dueAt: now - 1,
      },
    ],
    now,
  );
  assert.deepEqual(
    ranked.map((item) => item.id),
    ['rfq', 'task', 'hot'],
  );
  assert.equal(ranked[0].priority, 100);
  assert.equal(ranked[2].reason, 'Hot lead without an open commitment');
});

test('attribution window has an explicit inclusive end', () => {
  assert.equal(
    attributedWithinWindow(
      Date.parse('2026-09-30T23:59:59.999Z'),
      '2026-09-20',
      10,
    ),
    true,
  );
  assert.equal(
    attributedWithinWindow(
      Date.parse('2026-10-01T00:00:00.000Z'),
      '2026-09-20',
      10,
    ),
    false,
  );
});

test('CSV output neutralizes spreadsheet formulas and quotes content', () => {
  assert.equal(safeCsvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"');
  const csv = toCsv(['name', 'note'], [['Alice', 'hello, world']]);
  assert.equal(csv, '"name","note"\r\n"Alice","hello, world"');
});

test('reporting migration enforces event scope and guarded history', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  db.exec('CREATE TABLE workspaces(id TEXT PRIMARY KEY)');
  db.exec(
    'CREATE TABLE events(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,budget INTEGER NOT NULL DEFAULT 0)',
  );
  const migration = readFileSync(
    new URL('../drizzle/0029_fine_ultron.sql', import.meta.url),
    'utf8',
  )
    .replaceAll('--> statement-breakpoint', '')
    .replace(
      'ALTER TABLE `events` ADD `attribution_window_days` integer DEFAULT 180 NOT NULL;',
      'ALTER TABLE events ADD attribution_window_days INTEGER NOT NULL DEFAULT 180;',
    )
    .replace(
      'ALTER TABLE `events` ADD `gross_margin_bps` integer DEFAULT 4000 NOT NULL;',
      'ALTER TABLE events ADD gross_margin_bps INTEGER NOT NULL DEFAULT 4000;',
    );
  db.exec(migration);
  db.exec("INSERT INTO workspaces VALUES ('w1'),('w2')");
  db.exec(
    "INSERT INTO events(id,workspace_id,budget) VALUES ('e1','w1',100),('e2','w2',200)",
  );
  assert.throws(() =>
    db.exec(
      "INSERT INTO event_cost_lines(id,workspace_id,event_id,category,description,amount,status,version,created_by,created_at,updated_at) VALUES ('bad','w1','e2','travel','Flight',100,'actual',1,'u',1,1)",
    ),
  );
  db.exec(
    "INSERT INTO event_cost_lines(id,workspace_id,event_id,category,description,amount,status,version,mutation_token,created_by,created_at,updated_at) VALUES ('c1','w1','e1','travel','Flight',100,'actual',1,'m1','u',1,1)",
  );
  db.exec(
    "INSERT INTO event_cost_history(id,workspace_id,event_id,cost_line_id,action,to_version,snapshot_json,mutation_token,changed_by,created_at) VALUES ('h1','w1','e1','c1','created',1,'{}','m1','u',1)",
  );
  assert.throws(() =>
    db.exec(
      "INSERT INTO event_cost_history(id,workspace_id,event_id,cost_line_id,action,to_version,snapshot_json,mutation_token,changed_by,created_at) VALUES ('h2','w1','e1','c1','updated',2,'{}','wrong','u',2)",
    ),
  );
});
