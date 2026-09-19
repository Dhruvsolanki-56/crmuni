import { database } from '@/lib/db';
import { retryDelayMs } from '@/lib/job-policy';
import { processLeadErasure } from '@/lib/privacy-erasure';

const MAX_BATCH = 25;
const LOCK_TIMEOUT_MS = 10 * 60 * 1000;

type Job = {
  id: string;
  workspaceId: string;
  kind: string;
  entityId: string;
  attempts: number;
  maxAttempts: number;
};

export async function runDueJobs(workspaceId?: string, onlyJobId?: string) {
  const db = database();
  const now = Date.now();
  const runId = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO job_runs (id,workspace_id,status,started_at) VALUES (?,?,'running',?)`,
    )
    .bind(runId, workspaceId || null, now)
    .run();
  const filter = `${workspaceId ? ' AND workspace_id=?' : ''}${onlyJobId ? ' AND id=?' : ''}`;
  const rows = await db
    .prepare(
      `SELECT id,workspace_id AS workspaceId,kind,entity_id AS entityId,attempts,max_attempts AS maxAttempts FROM background_jobs WHERE ((status IN ('queued','failed') AND available_at<=?) OR (status='running' AND locked_at<?))${filter} ORDER BY available_at ASC LIMIT ${MAX_BATCH}`,
    )
    .bind(
      now,
      now - LOCK_TIMEOUT_MS,
      ...(workspaceId ? [workspaceId] : []),
      ...(onlyJobId ? [onlyJobId] : []),
    )
    .all<Job>();
  let completed = 0;
  let failed = 0;
  let dead = 0;
  for (const job of rows.results) {
    const claimed = await db
      .prepare(
        `UPDATE background_jobs SET status='running',attempts=attempts+1,locked_at=?,updated_at=? WHERE id=? AND attempts=? AND ((status IN ('queued','failed') AND available_at<=?) OR (status='running' AND locked_at<?))`,
      )
      .bind(now, now, job.id, job.attempts, now, now - LOCK_TIMEOUT_MS)
      .run();
    if (!claimed.meta.changes) continue;
    const attempt = job.attempts + 1;
    try {
      await processJob({ ...job, attempts: attempt }, now);
      await db
        .prepare(
          `UPDATE background_jobs SET status='completed',locked_at=NULL,last_error=NULL,completed_at=?,updated_at=? WHERE id=? AND status='running'`,
        )
        .bind(now, now, job.id)
        .run();
      completed += 1;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message.slice(0, 1000)
          : 'Unknown job failure';
      const isDead = attempt >= job.maxAttempts;
      await db.batch([
        db
          .prepare(
            `UPDATE background_jobs SET status=?,locked_at=NULL,last_error=?,available_at=?,updated_at=? WHERE id=? AND status='running'`,
          )
          .bind(
            isDead ? 'dead' : 'failed',
            message,
            now + retryDelayMs(attempt),
            now,
            job.id,
          ),
        ...(isDead
          ? [
              db
                .prepare(
                  `INSERT INTO operational_alerts (id,workspace_id,severity,code,message,dedupe_key,status,created_at,updated_at) VALUES (?,?, 'critical','job_dead_letter',?,?,'open',?,?) ON CONFLICT(workspace_id,dedupe_key) DO UPDATE SET severity='critical',message=excluded.message,status='open',resolved_at=NULL,updated_at=excluded.updated_at`,
                )
                .bind(
                  crypto.randomUUID(),
                  job.workspaceId,
                  `Background job ${job.kind} exhausted ${job.maxAttempts} attempts: ${message}`,
                  `dead-job:${job.id}`,
                  now,
                  now,
                ),
            ]
          : []),
      ]);
      if (isDead) dead += 1;
      else failed += 1;
    }
  }
  const finishedAt = Date.now();
  await db
    .prepare(
      `UPDATE job_runs SET status='complete',claimed_count=?,completed_count=?,failed_count=?,dead_count=?,finished_at=? WHERE id=?`,
    )
    .bind(completed + failed + dead, completed, failed, dead, finishedAt, runId)
    .run();
  return { runId, claimed: completed + failed + dead, completed, failed, dead };
}

async function processJob(job: Job, now: number) {
  const db = database();
  if (job.kind === 'task_reminder') {
    const task = await db
      .prepare(
        `SELECT t.title,t.reminder_at AS reminderAt,t.status,l.full_name AS fullName,l.company FROM tasks t JOIN leads l ON l.id=t.lead_id AND l.workspace_id=t.workspace_id WHERE t.id=? AND t.workspace_id=?`,
      )
      .bind(job.entityId, job.workspaceId)
      .first<{
        title: string;
        reminderAt: number | null;
        status: string;
        fullName: string;
        company: string;
      }>();
    if (!task || task.status !== 'open' || !task.reminderAt) return;
    if (task.reminderAt > now)
      throw new Error(
        'Reminder job became due before the task reminder timestamp.',
      );
    await db
      .prepare(
        `INSERT INTO in_app_notifications (id,workspace_id,kind,title,body,entity_type,entity_id,dedupe_key,created_at) VALUES (?,?, 'task_reminder',?,?, 'task',?,?,?) ON CONFLICT(workspace_id,dedupe_key) DO NOTHING`,
      )
      .bind(
        crypto.randomUUID(),
        job.workspaceId,
        task.title,
        `${task.fullName} · ${task.company}`,
        job.entityId,
        `task-reminder:${job.entityId}:${task.reminderAt}`,
        now,
      )
      .run();
    return;
  }
  if (job.kind === 'workspace_deletion_due') {
    const deletion = await db
      .prepare(
        `SELECT scheduled_for AS scheduledFor,status FROM workspace_deletion_requests WHERE workspace_id=?`,
      )
      .bind(job.workspaceId)
      .first<{ scheduledFor: number; status: string }>();
    if (!deletion || deletion.status !== 'scheduled') return;
    if (deletion.scheduledFor > now)
      throw new Error(
        'Deletion job became due before the recovery period ended.',
      );
    await db
      .prepare(
        `INSERT INTO operational_alerts (id,workspace_id,severity,code,message,dedupe_key,status,created_at,updated_at) VALUES (?,?, 'critical','workspace_deletion_due','A workspace deletion recovery period has ended. An owner must execute the protected deletion after confirming the workspace name.',?,'open',?,?) ON CONFLICT(workspace_id,dedupe_key) DO UPDATE SET status='open',resolved_at=NULL,updated_at=excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(),
        job.workspaceId,
        `workspace-deletion-due:${job.workspaceId}`,
        now,
        now,
      )
      .run();
    return;
  }
  if (job.kind === 'lead_contact_erasure') {
    await processLeadErasure(job.workspaceId, job.entityId, now);
    return;
  }
  throw new Error(`Unsupported job kind: ${job.kind}`);
}
