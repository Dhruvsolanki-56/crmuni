import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('follow-up draft migration backfills timestamps and stale versions cannot edit or approve', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE communication_drafts (
      id text PRIMARY KEY NOT NULL,
      workspace_id text NOT NULL,
      lead_id text NOT NULL,
      subject text,
      body text NOT NULL,
      status text NOT NULL,
      approved_by text,
      created_at integer NOT NULL,
      approved_at integer
    );
    INSERT INTO communication_drafts
      (id,workspace_id,lead_id,subject,body,status,created_at)
    VALUES
      ('draft-1','workspace-1','lead-1','Original','Original body','draft',100);
  `);

  const migration = readFileSync(new URL('../drizzle/0021_sticky_miek.sql', import.meta.url), 'utf8');
  for (const statement of migration.split('--> statement-breakpoint').map((part) => part.trim()).filter(Boolean)) db.exec(statement);

  const migrated = db.prepare(`SELECT version,updated_at AS updatedAt FROM communication_drafts WHERE id='draft-1'`).get() as { version: number; updatedAt: number };
  assert.equal(migrated.version, 1);
  assert.equal(migrated.updatedAt, 100);

  const firstApproval = db.prepare(`UPDATE communication_drafts SET status='approved',approved_by=?,approved_at=?,updated_at=? WHERE id=? AND workspace_id=? AND status='draft' AND version=?`).run('user-1', 110, 110, 'draft-1', 'workspace-1', 1);
  assert.equal(firstApproval.changes, 1);

  const edit = db.prepare(`UPDATE communication_drafts SET subject=NULLIF(?,''),body=?,status='draft',approved_by=NULL,approved_at=NULL,version=version+1,edited_by=?,updated_at=? WHERE id=? AND workspace_id=? AND version=?`).run('Revised', 'Revised body', 'user-2', 120, 'draft-1', 'workspace-1', 1);
  assert.equal(edit.changes, 1);

  const staleApproval = db.prepare(`UPDATE communication_drafts SET status='approved',approved_by=?,approved_at=?,updated_at=? WHERE id=? AND workspace_id=? AND status='draft' AND version=?`).run('user-1', 130, 130, 'draft-1', 'workspace-1', 1);
  assert.equal(staleApproval.changes, 0);

  const freshApproval = db.prepare(`UPDATE communication_drafts SET status='approved',approved_by=?,approved_at=?,updated_at=? WHERE id=? AND workspace_id=? AND status='draft' AND version=?`).run('user-1', 140, 140, 'draft-1', 'workspace-1', 2);
  assert.equal(freshApproval.changes, 1);

  const final = db.prepare(`SELECT subject,body,status,version,approved_by AS approvedBy,edited_by AS editedBy FROM communication_drafts WHERE id='draft-1'`).get() as Record<string, string | number>;
  assert.deepEqual({ ...final }, { subject: 'Revised', body: 'Revised body', status: 'approved', version: 2, approvedBy: 'user-1', editedBy: 'user-2' });
  db.close();
});
