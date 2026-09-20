import {
  auditStatement,
  database,
  requireRole,
  requireWorkspace,
  revenueEnv,
} from '@/lib/db';
import { runDueJobs } from '@/lib/jobs';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin']);
  const db = database();
  const [counts, jobs, alerts, notifications, lastRun] = await Promise.all([
    db
      .prepare(
        `SELECT status,COUNT(*) AS count FROM background_jobs WHERE workspace_id=? GROUP BY status`,
      )
      .bind(context.workspace.id)
      .all(),
    db
      .prepare(
        `SELECT id,kind,entity_type AS entityType,entity_id AS entityId,status,attempts,max_attempts AS maxAttempts,available_at AS availableAt,last_error AS lastError,updated_at AS updatedAt FROM background_jobs WHERE workspace_id=? ORDER BY CASE status WHEN 'dead' THEN 0 WHEN 'failed' THEN 1 WHEN 'running' THEN 2 ELSE 3 END,updated_at DESC LIMIT 50`,
      )
      .bind(context.workspace.id)
      .all(),
    db
      .prepare(
        `SELECT id,severity,code,message,status,created_at AS createdAt,updated_at AS updatedAt FROM operational_alerts WHERE workspace_id=? AND status!='resolved' ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,created_at DESC LIMIT 50`,
      )
      .bind(context.workspace.id)
      .all(),
    db
      .prepare(
        `SELECT id,kind,title,body,entity_type AS entityType,entity_id AS entityId,read_at AS readAt,created_at AS createdAt FROM in_app_notifications WHERE workspace_id=? AND (recipient_user_id IS NULL OR recipient_user_id=?) ORDER BY read_at IS NULL DESC,created_at DESC LIMIT 50`,
      )
      .bind(context.workspace.id, context.user.id)
      .all(),
    db
      .prepare(
        `SELECT id,status,claimed_count AS claimedCount,completed_count AS completedCount,failed_count AS failedCount,dead_count AS deadCount,error,started_at AS startedAt,finished_at AS finishedAt FROM job_runs WHERE workspace_id=? ORDER BY started_at DESC LIMIT 1`,
      )
      .bind(context.workspace.id)
      .first(),
  ]);
  return Response.json({
    health: {
      status: alerts.results.some((item) => item.severity === 'critical')
        ? 'attention'
        : 'healthy',
      jobsByStatus: Object.fromEntries(
        counts.results.map((item) => [String(item.status), Number(item.count)]),
      ),
      lastRun,
    },
    jobs: jobs.results,
    alerts: alerts.results,
    notifications: notifications.results,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 40);
  if (action === 'run_all') {
    const configured = revenueEnv().AUTOMATION_SECRET;
    const supplied = request.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '');
    if (!configured)
      return Response.json(
        { error: 'The production worker secret is not configured.' },
        { status: 503 },
      );
    if (!supplied || !constantTimeEqual(supplied, configured))
      return Response.json(
        { error: 'Worker authentication failed.' },
        { status: 401 },
      );
    return Response.json(await runDueJobs());
  }
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin']);
  const db = database();
  const now = Date.now();
  if (action === 'run_workspace_jobs') {
    const result = await runDueJobs(context.workspace.id);
    await auditStatement(
      context,
      'operations.jobs_run',
      'workspace',
      context.workspace.id,
      result,
    ).run();
    return Response.json(result);
  }
  if (action === 'retry_job') {
    const id = clean(body.id, 80);
    const result = await db
      .prepare(
        `UPDATE background_jobs SET status='queued',attempts=CASE WHEN status='dead' THEN 0 ELSE attempts END,available_at=?,locked_at=NULL,last_error=NULL,completed_at=NULL,updated_at=? WHERE id=? AND workspace_id=? AND status IN ('failed','dead')`,
      )
      .bind(now, now, id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'Only failed or dead jobs can be retried.' },
        { status: 409 },
      );
    await auditStatement(
      context,
      'operations.job_retried',
      'background_job',
      id,
    ).run();
    return Response.json({ ok: true });
  }
  if (action === 'acknowledge_alert') {
    const id = clean(body.id, 80);
    const result = await db
      .prepare(
        `UPDATE operational_alerts SET status='acknowledged',acknowledged_by=?,acknowledged_at=?,updated_at=? WHERE id=? AND workspace_id=? AND status='open'`,
      )
      .bind(context.user.id, now, now, id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json({ error: 'Open alert not found.' }, { status: 404 });
    await auditStatement(
      context,
      'operations.alert_acknowledged',
      'operational_alert',
      id,
    ).run();
    return Response.json({ ok: true });
  }
  if (action === 'read_notification') {
    const id = clean(body.id, 80);
    const result = await db
      .prepare(
        `UPDATE in_app_notifications SET read_at=? WHERE id=? AND workspace_id=? AND (recipient_user_id IS NULL OR recipient_user_id=?) AND read_at IS NULL`,
      )
      .bind(now, id, context.workspace.id, context.user.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'Unread notification not found.' },
        { status: 404 },
      );
    return Response.json({ ok: true });
  }
  return Response.json(
    { error: 'Unknown operations action.' },
    { status: 400 },
  );
}

function constantTimeEqual(left: string, right: string) {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1)
    difference |= (a[index % a.length] ?? 0) ^ (b[index % b.length] ?? 0);
  return difference === 0;
}
