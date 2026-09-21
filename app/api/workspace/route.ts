import {
  auditStatement,
  database,
  eventAccessClause,
  requireEventAccess,
  requireLeadAccess,
  requireOpportunityAccess,
  requireRole,
  requireWorkspace,
} from '@/lib/db';
import { accountIdentity, normalizeCompany } from '@/lib/accounts';
import { suppressionIdentifier, type ContactChannel } from '@/lib/consent';
import { runDueJobs } from '@/lib/jobs';

function clean(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function opportunityContacts(value: unknown) {
  try {
    return typeof value === 'string'
      ? (JSON.parse(value) as Array<{
          leadId: string;
          fullName: string;
          company: string;
          buyingRole: string | null;
          contactRole: string | null;
          isPrimary: number;
        }>)
      : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const db = database();
  const selectedEventId = clean(request.headers.get('x-revenue-event-id'), 80);
  const leadAccess = eventAccessClause(context, 'l.event_id');
  const opportunityAccess = eventAccessClause(
    context,
    'opportunities.event_id',
  );
  const mergeAccess = eventAccessClause(context, 'sl.event_id');
  const [leadRows, taskRows, opportunityRows, accountRows, mergeRows] =
    await Promise.all([
      db
        .prepare(`SELECT l.id, l.event_id AS eventId, l.account_id AS accountId,l.owner_id AS ownerId,om.display_name AS ownerName,l.full_name AS fullName, l.company, l.role, l.email, l.phone, s.buying_role AS buyingRole, l.review_status AS reviewStatus,l.qualification_state AS qualificationState,l.qualification_reason AS qualificationReason,
      l.created_at AS createdAt, i.note, t.title AS nextAction, t.due_date AS dueDate, q.score, q.rationale AS scoreRationale,
      a.id AS assetId, a.kind AS captureKind, a.processing_status AS captureStatus, a.extracted_json AS extractedJson,d.target_lead_id AS duplicateLeadId,dl.full_name AS duplicateLeadName,dl.company AS duplicateLeadCompany,
      (SELECT status FROM lead_consents WHERE workspace_id=l.workspace_id AND lead_id=l.id AND purpose='follow_up' AND channel='email') AS emailConsentStatus,
      (SELECT status FROM lead_consents WHERE workspace_id=l.workspace_id AND lead_id=l.id AND purpose='follow_up' AND channel='whatsapp') AS whatsappConsentStatus,
      l.custom_fields_json AS customFieldsJson, l.relationship_status AS relationshipStatus
      FROM leads l
      LEFT JOIN account_stakeholders s ON s.lead_id=l.id AND s.workspace_id=l.workspace_id
      LEFT JOIN memberships om ON om.workspace_id=l.workspace_id AND om.user_id=l.owner_id
      LEFT JOIN interactions i ON i.id = (SELECT id FROM interactions WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN tasks t ON t.id = (SELECT id FROM tasks WHERE lead_id = l.id AND status = 'open' ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN qualification_scores q ON q.id = (SELECT id FROM qualification_scores WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN lead_capture_assets a ON a.id = (SELECT id FROM lead_capture_assets WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN lead_duplicate_suggestions d ON d.id=(SELECT id FROM lead_duplicate_suggestions WHERE source_lead_id=l.id AND workspace_id=l.workspace_id AND status='pending' ORDER BY created_at DESC LIMIT 1)
      LEFT JOIN leads dl ON dl.id=d.target_lead_id AND dl.event_id=l.event_id AND dl.workspace_id=l.workspace_id
      WHERE l.workspace_id = ? AND l.review_status!='merged'${leadAccess.sql} ORDER BY l.created_at DESC LIMIT 100`)
        .bind(context.workspace.id, ...leadAccess.bindings)
        .all(),
      db
        .prepare(`SELECT t.id,t.lead_id AS leadId,t.title,t.due_date AS dueDate,t.status,t.reminder_at AS reminderAt,t.version,
      t.completed_at AS completedAt,t.cancelled_at AS cancelledAt,t.cancellation_reason AS cancellationReason,
      l.event_id AS eventId, l.full_name AS fullName, l.company FROM tasks t JOIN leads l ON l.id = t.lead_id
      WHERE t.workspace_id = ?${leadAccess.sql} ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'complete' THEN 1 ELSE 2 END,CASE WHEN t.reminder_at IS NOT NULL AND t.reminder_at<=? THEN 0 ELSE 1 END,CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,t.due_date ASC,t.updated_at DESC LIMIT 100`)
        .bind(context.workspace.id, ...leadAccess.bindings, Date.now())
        .all(),
      db
        .prepare(`SELECT opportunities.id, opportunities.event_id AS eventId, opportunities.lead_id AS leadId, opportunities.company, opportunities.title, opportunities.stage, opportunities.value, opportunities.currency, opportunities.probability,
      opportunities.expected_close_date AS expectedCloseDate,opportunities.loss_reason AS lossReason,opportunities.closed_at AS closedAt,opportunities.version,opportunities.created_at AS createdAt,
      COALESCE((SELECT json_group_array(json_object('leadId',l2.id,'fullName',l2.full_name,'company',l2.company,'buyingRole',s2.buying_role,'contactRole',oc.contact_role,'isPrimary',oc.is_primary)) FROM opportunity_contacts oc JOIN leads l2 ON l2.id=oc.lead_id LEFT JOIN account_stakeholders s2 ON s2.lead_id=l2.id AND s2.workspace_id=l2.workspace_id WHERE oc.opportunity_id=opportunities.id AND oc.workspace_id=opportunities.workspace_id),'[]') AS contactsJson
      FROM opportunities WHERE opportunities.workspace_id = ?${opportunityAccess.sql} ORDER BY opportunities.updated_at DESC LIMIT 100`)
        .bind(context.workspace.id, ...opportunityAccess.bindings)
        .all(),
      db
        .prepare(
          `SELECT a.id, a.name AS company, a.normalized_name AS normalizedName, COUNT(l.id) AS contacts, MAX(l.created_at) AS latestAt, COUNT(s.id) AS stakeholders FROM accounts a JOIN leads l ON l.account_id=a.id LEFT JOIN account_stakeholders s ON s.lead_id=l.id WHERE a.workspace_id=? AND l.review_status!='merged'${leadAccess.sql} GROUP BY a.id, a.name, a.normalized_name ORDER BY latestAt DESC`,
        )
        .bind(context.workspace.id, ...leadAccess.bindings)
        .all(),
      db
        .prepare(
          `SELECT me.id,me.source_lead_id AS sourceLeadId,me.target_lead_id AS targetLeadId,sl.full_name AS sourceName,tl.full_name AS targetName,me.merged_at AS mergedAt FROM lead_merge_events me JOIN leads sl ON sl.id=me.source_lead_id JOIN leads tl ON tl.id=me.target_lead_id WHERE me.workspace_id=? AND me.status='merged'${mergeAccess.sql} ORDER BY me.merged_at DESC LIMIT 20`,
        )
        .bind(context.workspace.id, ...mergeAccess.bindings)
        .all(),
    ]);
  const leads: Record<string, unknown>[] = leadRows.results.map((row) => {
    const item = row as Record<string, unknown>;
    let customFields: Record<string, string> = {};
    try {
      customFields =
        typeof item.customFieldsJson === 'string' && item.customFieldsJson
          ? JSON.parse(item.customFieldsJson)
          : {};
    } catch {
      customFields = {};
    }
    return { ...item, customFieldsJson: undefined, customFields };
  });
  const linkedNames = new Set(
    accountRows.results.map((item) => String(item.normalizedName)),
  );
  const legacyAccounts = Object.values(
    leads.reduce<
      Record<
        string,
        {
          id: string;
          company: string;
          contacts: number;
          latestAt: number;
          stakeholders: number;
        }
      >
    >((all, item) => {
      const company = String(item.company);
      const normalized = normalizeCompany(company);
      const createdAt = Number(item.createdAt);
      if (linkedNames.has(normalized)) return all;
      const current = all[normalized] || {
        id: `legacy:${normalized}`,
        company,
        contacts: 0,
        latestAt: 0,
        stakeholders: 0,
      };
      current.contacts += 1;
      current.latestAt = Math.max(current.latestAt, createdAt);
      all[normalized] = current;
      return all;
    }, {}),
  );
  const accounts = [...accountRows.results, ...legacyAccounts];
  const opportunities = (
    opportunityRows.results as Array<
      Record<string, unknown> & {
        eventId: string | null;
        value: number;
        stage: string;
        contactsJson: string;
      }
    >
  ).map((item) => ({
    ...item,
    contacts: opportunityContacts(item.contactsJson),
    contactsJson: undefined,
  }));
  const metricLeads = selectedEventId
    ? leads.filter((item) => item.eventId === selectedEventId)
    : leads;
  const metricTasks = selectedEventId
    ? taskRows.results.filter((item) => item.eventId === selectedEventId)
    : taskRows.results;
  const metricOpportunities = selectedEventId
    ? opportunities.filter((item) => item.eventId === selectedEventId)
    : opportunities;
  const pipelineValue = metricOpportunities
    .filter((item) => !['won', 'lost'].includes(String(item.stage)))
    .reduce((sum, item) => sum + Number(item.value || 0), 0);
  return Response.json({
    context: {
      workspace: context.workspace,
      role: context.role,
      user: context.user,
    },
    leads,
    accounts,
    tasks: taskRows.results,
    opportunities,
    merges: mergeRows.results,
    metrics: {
      totalLeads: metricLeads.length,
      qualifiedLeads: metricLeads.filter(
        (item) => item.reviewStatus === 'confirmed',
      ).length,
      openTasks: metricTasks.filter((item) => item.status === 'open').length,
      pipelineValue,
    },
  });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  }
  const action = clean(body.action, 30);
  if (action === 'complete_task') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    body.command = 'complete';
  }
  if (action === 'complete_task' || action === 'update_task') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const id = clean(body.id, 80);
    const command = clean(body.command, 30);
    const version = Number(body.version);
    const reason = clean(body.reason, 1000);
    if (!id || !Number.isInteger(version) || version < 1)
      return Response.json(
        { error: 'Task id and current version are required.' },
        { status: 400 },
      );
    const db = database();
    const task = await db
      .prepare(
        `SELECT lead_id AS leadId,status,version FROM tasks WHERE id=? AND workspace_id=?`,
      )
      .bind(id, context.workspace.id)
      .first<{ leadId: string; status: string; version: number }>();
    if (!task)
      return Response.json({ error: 'Task not found.' }, { status: 404 });
    await requireLeadAccess(context, task.leadId);
    if (task.version !== version)
      return Response.json(
        {
          error:
            'This task changed in another session. Reload before updating it.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    const now = Date.now();
    const mutationToken = crypto.randomUUID();
    let nextStatus = task.status;
    let reminderAt: number | null = null;
    let updateSql = '';
    let bindings: unknown[] = [];
    if (command === 'complete') {
      if (task.status !== 'open')
        return Response.json(
          { error: 'Only an open task can be completed.' },
          { status: 409 },
        );
      nextStatus = 'complete';
      updateSql = `UPDATE tasks SET status='complete',completed_by=?,completed_at=?,cancelled_by=NULL,cancelled_at=NULL,cancellation_reason=NULL,reminder_at=NULL,version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND status='open' AND version=?`;
      bindings = [
        context.user.id,
        now,
        mutationToken,
        now,
        id,
        context.workspace.id,
        version,
      ];
    } else if (command === 'cancel') {
      if (task.status !== 'open')
        return Response.json(
          { error: 'Only an open task can be cancelled.' },
          { status: 409 },
        );
      if (!reason)
        return Response.json(
          { error: 'A cancellation reason is required.' },
          { status: 400 },
        );
      nextStatus = 'cancelled';
      updateSql = `UPDATE tasks SET status='cancelled',cancelled_by=?,cancelled_at=?,cancellation_reason=?,completed_by=NULL,completed_at=NULL,reminder_at=NULL,version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND status='open' AND version=?`;
      bindings = [
        context.user.id,
        now,
        reason,
        mutationToken,
        now,
        id,
        context.workspace.id,
        version,
      ];
    } else if (command === 'reopen') {
      if (!['complete', 'cancelled'].includes(task.status))
        return Response.json(
          { error: 'Only a completed or cancelled task can be reopened.' },
          { status: 409 },
        );
      if (!reason)
        return Response.json(
          { error: 'A reopen reason is required.' },
          { status: 400 },
        );
      nextStatus = 'open';
      updateSql = `UPDATE tasks SET status='open',completed_by=NULL,completed_at=NULL,cancelled_by=NULL,cancelled_at=NULL,cancellation_reason=NULL,reminder_at=NULL,version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND status=? AND version=?`;
      bindings = [
        mutationToken,
        now,
        id,
        context.workspace.id,
        task.status,
        version,
      ];
    } else if (command === 'schedule_reminder') {
      if (task.status !== 'open')
        return Response.json(
          { error: 'Reminders can only be scheduled for open tasks.' },
          { status: 409 },
        );
      reminderAt = Number(body.reminderAt);
      if (
        !Number.isSafeInteger(reminderAt) ||
        reminderAt <= now ||
        reminderAt > now + 366 * 24 * 60 * 60 * 1000
      )
        return Response.json(
          { error: 'Choose a future reminder within one year.' },
          { status: 400 },
        );
      updateSql = `UPDATE tasks SET reminder_at=?,version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND status='open' AND version=?`;
      bindings = [
        reminderAt,
        mutationToken,
        now,
        id,
        context.workspace.id,
        version,
      ];
    } else if (command === 'clear_reminder') {
      if (task.status !== 'open')
        return Response.json(
          { error: 'Only an open task can clear a reminder.' },
          { status: 409 },
        );
      updateSql = `UPDATE tasks SET reminder_at=NULL,version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND status='open' AND version=?`;
      bindings = [mutationToken, now, id, context.workspace.id, version];
    } else
      return Response.json(
        { error: 'Choose a valid task action.' },
        { status: 400 },
      );
    const nextVersion = version + 1;
    const detail = JSON.stringify({
      fromStatus: task.status,
      toStatus: nextStatus,
      version: nextVersion,
    });
    const results = await db.batch([
      db.prepare(updateSql).bind(...bindings),
      db
        .prepare(
          `INSERT INTO task_history (id,workspace_id,task_id,action,from_status,to_status,reason,reminder_at,version,actor_id,created_at) SELECT ?,t.workspace_id,t.id,?,?,?,?,?,?,?,? FROM tasks t WHERE t.id=? AND t.workspace_id=? AND t.mutation_token=? AND t.version=?`,
        )
        .bind(
          crypto.randomUUID(),
          command,
          task.status,
          nextStatus,
          reason || null,
          reminderAt,
          nextVersion,
          context.user.id,
          now,
          id,
          context.workspace.id,
          mutationToken,
          nextVersion,
        ),
      db
        .prepare(
          `INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) SELECT ?,t.workspace_id,?,?,'task',t.id,?,? FROM tasks t WHERE t.id=? AND t.workspace_id=? AND t.mutation_token=? AND t.version=?`,
        )
        .bind(
          crypto.randomUUID(),
          context.user.id,
          `task.${command}`,
          detail,
          now,
          id,
          context.workspace.id,
          mutationToken,
          nextVersion,
        ),
      ...(command === 'schedule_reminder' && reminderAt
        ? [
            db
              .prepare(
                `INSERT INTO background_jobs (id,workspace_id,kind,entity_type,entity_id,dedupe_key,payload_json,status,attempts,max_attempts,available_at,created_at,updated_at) VALUES (?,?, 'task_reminder','task',?,?,'{}','queued',0,5,?,?,?) ON CONFLICT(workspace_id,kind,dedupe_key) DO UPDATE SET status='queued',attempts=0,available_at=excluded.available_at,locked_at=NULL,last_error=NULL,completed_at=NULL,updated_at=excluded.updated_at`,
              )
              .bind(
                crypto.randomUUID(),
                context.workspace.id,
                id,
                id,
                reminderAt,
                now,
                now,
              ),
          ]
        : [
            db
              .prepare(
                `UPDATE background_jobs SET status='canceled',locked_at=NULL,updated_at=? WHERE workspace_id=? AND kind='task_reminder' AND dedupe_key=? AND status NOT IN ('completed','canceled')`,
              )
              .bind(now, context.workspace.id, id),
          ]),
    ]);
    if (!results[0].meta.changes)
      return Response.json(
        {
          error:
            'This task changed in another session. Reload before updating it.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    return Response.json({
      task: {
        id,
        status: nextStatus,
        version: nextVersion,
        reminderAt,
        completedAt: command === 'complete' ? now : null,
        cancelledAt: command === 'cancel' ? now : null,
        cancellationReason: command === 'cancel' ? reason : null,
      },
    });
  }
  if (action === 'create_task') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const leadId = clean(body.leadId, 80);
    const title = clean(body.title, 240);
    const dueDate = clean(body.dueDate, 10);
    if (!leadId || !title)
      return Response.json(
        { error: 'Lead and task title are required.' },
        { status: 400 },
      );
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
      return Response.json(
        { error: 'Due date must use YYYY-MM-DD.' },
        { status: 400 },
      );
    await requireLeadAccess(context, leadId);
    const id = crypto.randomUUID();
    const now = Date.now();
    await database().batch([
      database()
        .prepare(
          `INSERT INTO tasks (id,workspace_id,lead_id,owner_id,title,due_date,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'open',?,?)`,
        )
        .bind(
          id,
          context.workspace.id,
          leadId,
          context.user.id,
          title,
          dueDate || null,
          now,
          now,
        ),
      database()
        .prepare(
          `INSERT INTO task_history (id,workspace_id,task_id,action,from_status,to_status,version,actor_id,created_at) VALUES (?,?,?,'created','open','open',1,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          id,
          context.user.id,
          now,
        ),
      auditStatement(context, 'task.created', 'task', id, { leadId }),
    ]);
    return Response.json(
      {
        task: {
          id,
          leadId,
          title,
          dueDate: dueDate || null,
          status: 'open',
          version: 1,
          reminderAt: null,
        },
      },
      { status: 201 },
    );
  }
  if (action === 'set_relationship_status') {
    const id = clean(body.id, 80);
    const status = clean(body.status, 20);
    if (!id || !['active', 'archived'].includes(status))
      return Response.json(
        { error: 'A contact and a valid status are required.' },
        { status: 400 },
      );
    await requireLeadAccess(context, id);
    const result = await database()
      .prepare(
        `UPDATE leads SET relationship_status=?,updated_at=? WHERE id=? AND workspace_id=?`,
      )
      .bind(status, Date.now(), id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json({ error: 'Contact not found.' }, { status: 404 });
    await auditStatement(context, 'lead.relationship_status_changed', 'lead', id, {
      status,
    }).run();
    return Response.json({ ok: true, status });
  }
  if (action === 'update_lead') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const id = clean(body.id, 80);
    const fullName = clean(body.fullName, 120);
    const company = clean(body.company, 160);
    const role = clean(body.role, 120);
    const email = clean(body.email, 254).toLowerCase();
    const phone = clean(body.phone, 40);
    const customFields: Record<string, string> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!key.startsWith('custom:') || typeof value !== 'string') continue;
      if (Object.keys(customFields).length >= 30) break;
      const label = key.slice('custom:'.length).trim().slice(0, 80);
      const trimmed = value.trim().slice(0, 500);
      if (label && trimmed) customFields[label] = trimmed;
    }
    if (!id || !fullName || !company)
      return Response.json(
        { error: 'Lead, full name and company are required.' },
        { status: 400 },
      );
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return Response.json(
        { error: 'Enter a valid email address.' },
        { status: 400 },
      );
    await requireLeadAccess(context, id);
    const account = await accountIdentity(context.workspace.id, company);
    const now = Date.now();
    await database().batch([
      database()
        .prepare(
          `INSERT INTO accounts (id,workspace_id,name,normalized_name,status,created_at,updated_at) VALUES (?,?,?,?,'active',?,?) ON CONFLICT(workspace_id,normalized_name) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at`,
        )
        .bind(
          account.id,
          context.workspace.id,
          company,
          account.normalized,
          now,
          now,
        ),
      database()
        .prepare(
          `UPDATE leads SET account_id=?,full_name=?,company=?,role=NULLIF(?,''),email=NULLIF(?,''),phone=NULLIF(?,''),custom_fields_json=CASE WHEN ?=1 THEN ? ELSE custom_fields_json END,updated_at=? WHERE id=? AND workspace_id=?`,
        )
        .bind(
          account.id,
          fullName,
          company,
          role,
          email,
          phone,
          Object.keys(customFields).length ? 1 : 0,
          JSON.stringify(customFields),
          now,
          id,
          context.workspace.id,
        ),
      auditStatement(context, 'lead.updated', 'lead', id),
    ]);
    return Response.json({
      lead: { id, fullName, company, role, email, phone },
    });
  }
  if (action === 'confirm_contact') {
    // Confirming who the contact is (name, company, role) must not require
    // a conversation note to analyze - a card scan with nothing said yet is
    // still a real contact the salesperson may want to draft a follow-up
    // to. Conversation analysis remains the richer, separate path for
    // qualification scoring and commitments when a note exists.
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const id = clean(body.id, 80);
    if (!id)
      return Response.json({ error: 'Lead id is required.' }, { status: 400 });
    await requireLeadAccess(context, id);
    const now = Date.now();
    const db = database();
    const result = await db
      .prepare(
        `UPDATE leads SET review_status='confirmed',updated_at=? WHERE id=? AND workspace_id=? AND review_status='needs_review'`,
      )
      .bind(now, id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'This contact is already reviewed or cannot be confirmed.' },
        { status: 409 },
      );
    await db.batch([
      auditStatement(context, 'lead.contact_confirmed', 'lead', id),
    ]);
    return Response.json({ ok: true, reviewStatus: 'confirmed' });
  }
  if (action === 'erase_lead') {
    requireRole(context, ['owner', 'admin']);
    const id = clean(body.id, 80);
    if (!id)
      return Response.json({ error: 'Lead id is required.' }, { status: 400 });
    const db = database();
    const lead = await db
      .prepare(`SELECT id FROM leads WHERE id=? AND workspace_id=?`)
      .bind(id, context.workspace.id)
      .first();
    if (!lead)
      return Response.json({ error: 'Lead not found.' }, { status: 404 });
    const assets = await db
      .prepare(
        `SELECT storage_key AS storageKey FROM lead_capture_assets WHERE lead_id=? AND workspace_id=?`,
      )
      .bind(id, context.workspace.id)
      .all<{ storageKey: string }>();
    const now = Date.now();
    const existing = await db.prepare(`SELECT id,status FROM lead_erasure_requests WHERE workspace_id=? AND lead_id=?`)
      .bind(context.workspace.id, id)
      .first<{ id: string; status: string }>();
    if (existing?.status === 'completed')
      return Response.json({ ok: true, status: 'completed', duplicate: true });
    const requestId = existing?.id || crypto.randomUUID();
    const jobId = crypto.randomUUID();
    await db.batch([
      db.prepare(`UPDATE leads SET full_name='Deleted contact',role=NULL,email=NULL,phone=NULL,source='privacy_erasure_pending',review_status='erasure_pending',qualification_state='unqualified',qualification_reason=NULL,qualification_updated_by=NULL,qualification_updated_at=NULL,updated_at=? WHERE id=? AND workspace_id=?`).bind(now, id, context.workspace.id),
      db.prepare(`INSERT INTO lead_erasure_requests (id,workspace_id,lead_id,status,asset_keys_json,requested_by,attempts,created_at,updated_at) VALUES (?,?,?,'queued',?,?,0,?,?) ON CONFLICT(workspace_id,lead_id) DO UPDATE SET status=CASE WHEN lead_erasure_requests.status='completed' THEN 'completed' ELSE 'queued' END,asset_keys_json=CASE WHEN lead_erasure_requests.status='completed' THEN lead_erasure_requests.asset_keys_json ELSE excluded.asset_keys_json END,requested_by=excluded.requested_by,attempts=CASE WHEN lead_erasure_requests.status='failed' THEN 0 ELSE lead_erasure_requests.attempts END,last_error=NULL,updated_at=excluded.updated_at`).bind(requestId, context.workspace.id, id, JSON.stringify(assets.results.map((asset) => asset.storageKey)), context.user.id, now, now),
      db.prepare(`INSERT INTO background_jobs (id,workspace_id,kind,entity_type,entity_id,dedupe_key,payload_json,status,attempts,max_attempts,available_at,created_at,updated_at) VALUES (?,?,'lead_contact_erasure','lead_erasure_request',?,?,'{}','queued',0,8,?,?,?) ON CONFLICT(workspace_id,kind,dedupe_key) DO UPDATE SET status=CASE WHEN background_jobs.status='running' THEN 'running' ELSE 'queued' END,attempts=CASE WHEN background_jobs.status='running' THEN background_jobs.attempts ELSE 0 END,available_at=excluded.available_at,locked_at=CASE WHEN background_jobs.status='running' THEN background_jobs.locked_at ELSE NULL END,last_error=NULL,completed_at=NULL,updated_at=excluded.updated_at`).bind(jobId, context.workspace.id, requestId, id, now, now, now),
      auditStatement(context, 'lead.erasure_requested', 'lead', id, { requestId, assetCount: assets.results.length }),
    ]);
    const job = await db.prepare(`SELECT id FROM background_jobs WHERE workspace_id=? AND kind='lead_contact_erasure' AND dedupe_key=?`).bind(context.workspace.id, id).first<{ id: string }>();
    const run = job ? await runDueJobs(context.workspace.id, job.id) : null;
    const erasure = await db.prepare(`SELECT status,last_error AS lastError FROM lead_erasure_requests WHERE id=? AND workspace_id=?`).bind(requestId, context.workspace.id).first<{ status: string; lastError: string | null }>();
    return Response.json({ ok: true, status: erasure?.status || 'queued', requestId, run });
  }
  if (action === 'create_opportunity') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const company = clean(body.company, 160);
    const title = clean(body.title, 200);
    const leadId = clean(body.leadId, 80);
    const value = Math.max(0, Math.min(1_000_000_000, Number(body.value) || 0));
    if (!company || !title)
      return Response.json(
        { error: 'Company and opportunity title are required.' },
        { status: 400 },
      );
    const id = crypto.randomUUID();
    const now = Date.now();
    let accountId: string | null = null;
    let eventId = clean(request.headers.get('x-revenue-event-id'), 80);
    const requestedContacts = Array.isArray(body.contactIds)
      ? body.contactIds
          .map((item) => clean(item, 80))
          .filter(Boolean)
          .slice(0, 20)
      : [];
    if (leadId && !requestedContacts.includes(leadId))
      requestedContacts.unshift(leadId);
    if (leadId) {
      const lead = await requireLeadAccess(context, leadId);
      const row = await database()
        .prepare(
          `SELECT account_id AS accountId FROM leads WHERE id=? AND workspace_id=?`,
        )
        .bind(leadId, context.workspace.id)
        .first<{ accountId: string | null }>();
      accountId = row?.accountId || null;
      if (eventId && eventId !== lead.eventId)
        return Response.json(
          { error: 'The lead belongs to a different event.' },
          { status: 409 },
        );
      eventId = lead.eventId;
    }
    await requireEventAccess(context, eventId);
    const db = database();
    const contacts: Array<{
      leadId: string;
      fullName: string;
      company: string;
      buyingRole: string | null;
    }> = [];
    for (const contactId of new Set(requestedContacts)) {
      const contact = await requireLeadAccess(context, contactId);
      if (contact.eventId !== eventId)
        return Response.json(
          { error: 'Every opportunity contact must belong to the same event.' },
          { status: 409 },
        );
      const row = await db
        .prepare(
          `SELECT l.account_id AS accountId,l.full_name AS fullName,l.company,s.buying_role AS buyingRole FROM leads l LEFT JOIN account_stakeholders s ON s.lead_id=l.id AND s.workspace_id=l.workspace_id WHERE l.id=? AND l.workspace_id=? AND l.review_status!='merged'`,
        )
        .bind(contactId, context.workspace.id)
        .first<{
          accountId: string | null;
          fullName: string;
          company: string;
          buyingRole: string | null;
        }>();
      if (!row)
        return Response.json(
          { error: 'An opportunity contact is unavailable.' },
          { status: 404 },
        );
      if (accountId && row.accountId !== accountId)
        return Response.json(
          {
            error: 'All opportunity contacts must belong to the same account.',
          },
          { status: 409 },
        );
      if (!accountId) accountId = row.accountId;
      contacts.push({
        leadId: contactId,
        fullName: row.fullName,
        company: row.company,
        buyingRole: row.buyingRole,
      });
    }
    if (
      contacts.length &&
      normalizeCompany(contacts[0].company) !== normalizeCompany(company)
    )
      return Response.json(
        { error: 'The opportunity company must match its linked account.' },
        { status: 409 },
      );
    const mutationToken = crypto.randomUUID();
    const statements = [
      db
        .prepare(`INSERT INTO opportunities (id, workspace_id, event_id, lead_id, account_id, company, title, stage, value, currency, probability, expected_close_date, version, mutation_token, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'qualified', ?, ?, 20, ?, 1, ?, ?, ?)`)
        .bind(
          id,
          context.workspace.id,
          eventId,
          leadId || null,
          accountId,
          company,
          title,
          value,
          context.workspace.currency,
          clean(body.expectedCloseDate, 10) || null,
          mutationToken,
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO opportunity_history (id,workspace_id,opportunity_id,change_type,to_stage,to_value,reason,mutation_token,changed_by,created_at) VALUES (?,?,?,'created','qualified',?,?,?, ?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          id,
          value,
          'Opportunity created',
          mutationToken,
          context.user.id,
          now,
        ),
      auditStatement(context, 'opportunity.created', 'opportunity', id, {
        value,
        contactCount: contacts.length,
      }),
    ];
    contacts.forEach((contact, index) =>
      statements.push(
        db
          .prepare(
            `INSERT INTO opportunity_contacts (id,workspace_id,opportunity_id,lead_id,contact_role,is_primary,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            id,
            contact.leadId,
            contact.buyingRole,
            index === 0 ? 1 : 0,
            context.user.id,
            now,
          ),
      ),
    );
    await db.batch(statements);
    return Response.json(
      {
        opportunity: {
          id,
          eventId,
          leadId,
          company,
          title,
          stage: 'qualified',
          value,
          currency: context.workspace.currency,
          probability: 20,
          expectedCloseDate: clean(body.expectedCloseDate, 10),
          version: 1,
          lossReason: null,
          contacts,
          createdAt: now,
        },
      },
      { status: 201 },
    );
  }
  if (action === 'update_opportunity') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const id = clean(body.id, 80);
    const stage = clean(body.stage, 30);
    const probabilities: Record<string, number> = {
      qualified: 20,
      requirement: 30,
      sample: 40,
      rfq: 50,
      quotation: 60,
      meeting: 70,
      negotiation: 80,
      won: 100,
      lost: 0,
    };
    const version = Number(body.version);
    const reason = clean(body.reason, 1000);
    if (
      !id ||
      probabilities[stage] === undefined ||
      !Number.isInteger(version) ||
      version < 1
    )
      return Response.json(
        { error: 'Opportunity, stage and current version are required.' },
        { status: 400 },
      );
    await requireOpportunityAccess(context, id);
    const db = database();
    const current = await db
      .prepare(
        `SELECT stage,value,version,loss_reason AS lossReason,closed_at AS closedAt FROM opportunities WHERE id=? AND workspace_id=?`,
      )
      .bind(id, context.workspace.id)
      .first<{
        stage: string;
        value: number;
        version: number;
        lossReason: string | null;
        closedAt: number | null;
      }>();
    if (!current)
      return Response.json(
        { error: 'Opportunity not found.' },
        { status: 404 },
      );
    if (current.version !== version)
      return Response.json(
        {
          error:
            'This opportunity changed in another session. Reload before updating it.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    const nextValue =
      body.value === undefined
        ? current.value
        : Math.max(0, Math.min(1_000_000_000, Number(body.value) || 0));
    const stageChanged = stage !== current.stage;
    const valueChanged = nextValue !== current.value;
    if (!stageChanged && !valueChanged)
      return Response.json(
        { error: 'No opportunity changes were supplied.' },
        { status: 400 },
      );
    if (stage === 'lost' && !reason && !current.lossReason)
      return Response.json(
        { error: 'A loss reason is required.' },
        { status: 400 },
      );
    if (['won', 'lost'].includes(current.stage) && stageChanged && !reason)
      return Response.json(
        { error: 'A reason is required to change a closed opportunity.' },
        { status: 400 },
      );
    const now = Date.now();
    const mutationToken = crypto.randomUUID();
    const closed = ['won', 'lost'].includes(stage);
    const nextClosedAt = stageChanged
      ? closed
        ? now
        : null
      : current.closedAt;
    const nextLossReason =
      stage === 'lost' ? reason || current.lossReason : null;
    const nextVersion = version + 1;
    const detail = JSON.stringify({
      fromStage: current.stage,
      toStage: stage,
      fromValue: current.value,
      toValue: nextValue,
      reason: reason || null,
    });
    const result = await db.batch([
      db
        .prepare(
          `UPDATE opportunities SET stage=?,value=?,probability=?,loss_reason=?,closed_at=?,version=version+1,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND version=?`,
        )
        .bind(
          stage,
          nextValue,
          probabilities[stage],
          nextLossReason,
          nextClosedAt,
          mutationToken,
          now,
          id,
          context.workspace.id,
          version,
        ),
      db
        .prepare(
          `INSERT INTO opportunity_history (id,workspace_id,opportunity_id,change_type,from_stage,to_stage,from_value,to_value,reason,mutation_token,changed_by,created_at) SELECT ?,o.workspace_id,o.id,?,?,?,?,?,?,?,?,? FROM opportunities o WHERE o.id=? AND o.workspace_id=? AND o.version=? AND o.mutation_token=?`,
        )
        .bind(
          crypto.randomUUID(),
          stageChanged && valueChanged
            ? 'stage_and_value'
            : stageChanged
              ? 'stage'
              : 'value',
          current.stage,
          stage,
          current.value,
          nextValue,
          reason || null,
          mutationToken,
          context.user.id,
          now,
          id,
          context.workspace.id,
          nextVersion,
          mutationToken,
        ),
      db
        .prepare(
          `INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) SELECT ?,o.workspace_id,?,'opportunity.updated','opportunity',o.id,?,? FROM opportunities o WHERE o.id=? AND o.workspace_id=? AND o.version=? AND o.mutation_token=?`,
        )
        .bind(
          crypto.randomUUID(),
          context.user.id,
          detail,
          now,
          id,
          context.workspace.id,
          nextVersion,
          mutationToken,
        ),
    ]);
    if (!result[0].meta.changes)
      return Response.json(
        {
          error:
            'This opportunity changed in another session. Reload before updating it.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    return Response.json({
      ok: true,
      stage,
      value: nextValue,
      probability: probabilities[stage],
      version: nextVersion,
      lossReason: nextLossReason,
      closedAt: nextClosedAt,
    });
  }
  if (
    action === 'add_opportunity_contact' ||
    action === 'remove_opportunity_contact'
  ) {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const opportunityId = clean(body.id, 80);
    const leadId = clean(body.leadId, 80);
    if (!opportunityId || !leadId)
      return Response.json(
        { error: 'Opportunity and contact are required.' },
        { status: 400 },
      );
    const access = await requireOpportunityAccess(context, opportunityId);
    const leadAccess = await requireLeadAccess(context, leadId);
    if (access.eventId !== leadAccess.eventId)
      return Response.json(
        { error: 'The contact must belong to the opportunity event.' },
        { status: 409 },
      );
    const db = database();
    const [opportunity, lead] = await Promise.all([
      db
        .prepare(
          `SELECT account_id AS accountId FROM opportunities WHERE id=? AND workspace_id=?`,
        )
        .bind(opportunityId, context.workspace.id)
        .first<{ accountId: string | null }>(),
      db
        .prepare(
          `SELECT account_id AS accountId,full_name AS fullName,company FROM leads WHERE id=? AND workspace_id=? AND review_status!='merged'`,
        )
        .bind(leadId, context.workspace.id)
        .first<{
          accountId: string | null;
          fullName: string;
          company: string;
        }>(),
    ]);
    if (!lead)
      return Response.json({ error: 'Contact not found.' }, { status: 404 });
    if (opportunity?.accountId && lead.accountId !== opportunity.accountId)
      return Response.json(
        { error: 'The contact must belong to the opportunity account.' },
        { status: 409 },
      );
    const now = Date.now();
    if (action === 'add_opportunity_contact') {
      try {
        await db.batch([
          db
            .prepare(
              `INSERT INTO opportunity_contacts (id,workspace_id,opportunity_id,lead_id,contact_role,is_primary,created_by,created_at) VALUES (?,?,?,?,NULL,0,?,?)`,
            )
            .bind(
              crypto.randomUUID(),
              context.workspace.id,
              opportunityId,
              leadId,
              context.user.id,
              now,
            ),
          auditStatement(
            context,
            'opportunity.contact_added',
            'opportunity',
            opportunityId,
            { leadId },
          ),
        ]);
      } catch {
        return Response.json(
          { error: 'This contact is already linked to the opportunity.' },
          { status: 409 },
        );
      }
      return Response.json({
        ok: true,
        contact: { leadId, fullName: lead.fullName, company: lead.company },
      });
    }
    const result = await db
      .prepare(
        `DELETE FROM opportunity_contacts WHERE workspace_id=? AND opportunity_id=? AND lead_id=?`,
      )
      .bind(context.workspace.id, opportunityId, leadId)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'This contact is not linked to the opportunity.' },
        { status: 404 },
      );
    await auditStatement(
      context,
      'opportunity.contact_removed',
      'opportunity',
      opportunityId,
      { leadId },
    ).run();
    return Response.json({ ok: true });
  }
  if (action === 'set_qualification') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const leadId = clean(body.leadId, 80);
    const state = clean(body.state, 20);
    const reason = clean(body.reason, 1000);
    if (
      !leadId ||
      !['hot', 'warm', 'cold', 'unqualified'].includes(state) ||
      !reason
    )
      return Response.json(
        { error: 'Lead, qualification state and reason are required.' },
        { status: 400 },
      );
    await requireLeadAccess(context, leadId);
    const db = database();
    const current = await db
      .prepare(
        `SELECT qualification_state AS qualificationState FROM leads WHERE id=? AND workspace_id=?`,
      )
      .bind(leadId, context.workspace.id)
      .first<{ qualificationState: string }>();
    const now = Date.now();
    await db.batch([
      db
        .prepare(
          `INSERT INTO lead_qualification_history (id,workspace_id,lead_id,state,reason,source,previous_state,changed_by,created_at) VALUES (?,?,?,?,?,'manual_override',?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          leadId,
          state,
          reason,
          current?.qualificationState || null,
          context.user.id,
          now,
        ),
      db
        .prepare(
          `UPDATE leads SET qualification_state=?,qualification_reason=?,qualification_updated_by=?,qualification_updated_at=?,updated_at=? WHERE id=? AND workspace_id=?`,
        )
        .bind(
          state,
          reason,
          context.user.id,
          now,
          now,
          leadId,
          context.workspace.id,
        ),
      auditStatement(context, 'lead.qualification_overridden', 'lead', leadId, {
        state,
        reason,
      }),
    ]);
    return Response.json({ ok: true, state, reason });
  }
  if (action === 'assign_lead') {
    requireRole(context, ['owner', 'admin', 'manager']);
    const leadId = clean(body.leadId, 80);
    const ownerId = clean(body.ownerId, 160);
    const reason = clean(body.reason, 500) || 'manager_assignment';
    if (!leadId || !ownerId)
      return Response.json(
        { error: 'Lead and owner are required.' },
        { status: 400 },
      );
    const lead = await requireLeadAccess(context, leadId);
    const db = database();
    const target = await db
      .prepare(
        `SELECT id,user_id AS userId,role FROM memberships WHERE workspace_id=? AND user_id=? AND status='active'`,
      )
      .bind(context.workspace.id, ownerId)
      .first<{ id: string; userId: string; role: string }>();
    if (!target)
      return Response.json(
        { error: 'The selected owner is unavailable.' },
        { status: 409 },
      );
    if (!['owner', 'admin'].includes(target.role)) {
      const assigned = await db
        .prepare(
          `SELECT id FROM event_memberships WHERE workspace_id=? AND event_id=? AND membership_id=? AND status='active'`,
        )
        .bind(context.workspace.id, lead.eventId, target.id)
        .first();
      if (!assigned)
        return Response.json(
          { error: 'The selected owner is not assigned to this event.' },
          { status: 409 },
        );
    }
    const current = await db
      .prepare(
        `SELECT owner_id AS ownerId, full_name AS fullName FROM leads WHERE id=? AND workspace_id=?`,
      )
      .bind(leadId, context.workspace.id)
      .first<{ ownerId: string; fullName: string }>();
    if (current?.ownerId === ownerId)
      return Response.json({ ok: true, duplicate: true });
    const now = Date.now();
    await db.batch([
      db
        .prepare(
          `UPDATE leads SET owner_id=?,updated_at=? WHERE id=? AND workspace_id=?`,
        )
        .bind(ownerId, now, leadId, context.workspace.id),
      db
        .prepare(
          `INSERT INTO lead_assignment_history (id,workspace_id,lead_id,previous_owner_id,owner_id,reason,changed_by,created_at) VALUES (?,?,?,?,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          leadId,
          current?.ownerId || null,
          ownerId,
          reason,
          context.user.id,
          now,
        ),
      db
        .prepare(
          `INSERT INTO in_app_notifications (id,workspace_id,recipient_user_id,kind,title,body,entity_type,entity_id,dedupe_key,created_at) VALUES (?,?,?,'lead_assigned',?,?,'lead',?,?,?) ON CONFLICT (workspace_id,dedupe_key) DO NOTHING`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          ownerId,
          'New lead assigned to you',
          `${current?.fullName || 'A lead'} was assigned to you.`,
          leadId,
          `lead_assigned:${leadId}:${now}`,
          now,
        ),
      auditStatement(context, 'lead.assigned', 'lead', leadId, {
        previousOwnerId: current?.ownerId || null,
        ownerId,
        reason,
      }),
    ]);
    return Response.json({ ok: true, ownerId });
  }
  if (action === 'set_stakeholder') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const leadId = clean(body.leadId, 80);
    const buyingRole = clean(body.buyingRole, 40);
    const allowed = [
      'buyer',
      'technical_evaluator',
      'internal_champion',
      'decision_maker',
      'influencer',
      'user',
      'unknown',
    ];
    if (!allowed.includes(buyingRole))
      return Response.json(
        { error: 'Choose a valid buying role.' },
        { status: 400 },
      );
    await requireLeadAccess(context, leadId);
    const lead = await database()
      .prepare(
        `SELECT account_id AS accountId FROM leads WHERE id=? AND workspace_id=?`,
      )
      .bind(leadId, context.workspace.id)
      .first<{ accountId: string | null }>();
    if (!lead?.accountId)
      return Response.json(
        { error: 'This contact is not linked to an account yet.' },
        { status: 409 },
      );
    const now = Date.now();
    await database()
      .prepare(
        `INSERT INTO account_stakeholders (id,workspace_id,account_id,lead_id,buying_role,influence_level,updated_by,updated_at) VALUES (?,?,?,?,?,'unknown',?,?) ON CONFLICT(account_id,lead_id) DO UPDATE SET buying_role=excluded.buying_role,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(),
        context.workspace.id,
        lead.accountId,
        leadId,
        buyingRole,
        context.user.id,
        now,
      )
      .run();
    await auditStatement(context, 'stakeholder.updated', 'lead', leadId, {
      buyingRole,
    }).run();
    return Response.json({ ok: true, buyingRole });
  }
  if (action === 'set_consent') {
    requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
    const leadId = clean(body.leadId, 80);
    const channel = clean(body.channel, 20) as ContactChannel;
    const status = clean(body.status, 20);
    const source = clean(body.source, 80) || 'salesperson_attestation';
    if (
      !leadId ||
      !['email', 'whatsapp'].includes(channel) ||
      !['granted', 'withdrawn'].includes(status)
    )
      return Response.json(
        { error: 'Lead, channel and permission status are required.' },
        { status: 400 },
      );
    await requireLeadAccess(context, leadId);
    const lead = await database()
      .prepare(`SELECT email,phone FROM leads WHERE id=? AND workspace_id=?`)
      .bind(leadId, context.workspace.id)
      .first<{ email: string | null; phone: string | null }>();
    const identifierHash = await suppressionIdentifier(
      channel,
      channel === 'email' ? lead?.email || '' : lead?.phone || '',
    );
    if (!identifierHash)
      return Response.json(
        {
          error: `Add a valid ${channel === 'email' ? 'email address' : 'phone number'} before updating permission.`,
        },
        { status: 409 },
      );
    const db = database();
    const suppression = await db
      .prepare(
        `SELECT id FROM suppression_entries WHERE workspace_id=? AND channel=? AND identifier_hash=? AND status='active'`,
      )
      .bind(context.workspace.id, channel, identifierHash)
      .first();
    if (status === 'granted' && suppression)
      return Response.json(
        {
          error:
            'This contact is suppressed. An owner or admin must clear suppression before permission can be granted again.',
        },
        { status: 409 },
      );
    const now = Date.now();
    const statements = [
      db
        .prepare(
          `INSERT INTO lead_consents (id,workspace_id,lead_id,purpose,channel,status,source,captured_at,withdrawn_at,updated_by,updated_at) VALUES (?,?,?,'follow_up',?,?,?,?,?,?,?) ON CONFLICT(workspace_id,lead_id,purpose,channel) DO UPDATE SET status=excluded.status,source=excluded.source,captured_at=excluded.captured_at,withdrawn_at=excluded.withdrawn_at,updated_by=excluded.updated_by,updated_at=excluded.updated_at`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          leadId,
          channel,
          status,
          source,
          status === 'granted' ? now : null,
          status === 'withdrawn' ? now : null,
          context.user.id,
          now,
        ),
      auditStatement(context, `consent.${status}`, 'lead', leadId, {
        channel,
        source,
      }),
    ];
    if (status === 'withdrawn')
      statements.push(
        db
          .prepare(
            `INSERT INTO suppression_entries (id,workspace_id,channel,identifier_hash,reason,source_lead_id,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,'active',?,?,?) ON CONFLICT(workspace_id,channel,identifier_hash) DO UPDATE SET status='active',reason=excluded.reason,source_lead_id=excluded.source_lead_id,updated_at=excluded.updated_at`,
          )
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            channel,
            identifierHash,
            'permission_withdrawn',
            leadId,
            context.user.id,
            now,
            now,
          ),
      );
    await db.batch(statements);
    return Response.json({ ok: true, status, channel });
  }
  if (action === 'clear_suppression') {
    requireRole(context, ['owner', 'admin']);
    const leadId = clean(body.leadId, 80);
    const channel = clean(body.channel, 20) as ContactChannel;
    if (!leadId || !['email', 'whatsapp'].includes(channel))
      return Response.json(
        { error: 'Lead and channel are required.' },
        { status: 400 },
      );
    await requireLeadAccess(context, leadId);
    const lead = await database()
      .prepare(`SELECT email,phone FROM leads WHERE id=? AND workspace_id=?`)
      .bind(leadId, context.workspace.id)
      .first<{ email: string | null; phone: string | null }>();
    const identifierHash = await suppressionIdentifier(
      channel,
      channel === 'email' ? lead?.email || '' : lead?.phone || '',
    );
    const result = await database()
      .prepare(
        `UPDATE suppression_entries SET status='cleared',updated_at=? WHERE workspace_id=? AND channel=? AND identifier_hash=? AND status='active'`,
      )
      .bind(Date.now(), context.workspace.id, channel, identifierHash)
      .run();
    if (!result.meta.changes)
      return Response.json(
        { error: 'No active suppression was found.' },
        { status: 404 },
      );
    await auditStatement(context, 'suppression.cleared', 'lead', leadId, {
      channel,
    }).run();
    return Response.json({ ok: true });
  }
  if (action === 'merge_leads') {
    requireRole(context, ['owner', 'admin', 'manager']);
    const sourceLeadId = clean(body.sourceLeadId, 80);
    const targetLeadId = clean(body.targetLeadId, 80);
    if (!sourceLeadId || !targetLeadId || sourceLeadId === targetLeadId)
      return Response.json(
        { error: 'Choose two different contacts.' },
        { status: 400 },
      );
    const sourceAccess = await requireLeadAccess(context, sourceLeadId);
    const targetAccess = await requireLeadAccess(context, targetLeadId);
    if (sourceAccess.eventId !== targetAccess.eventId)
      return Response.json(
        { error: 'Contacts can only be merged inside the same event.' },
        { status: 409 },
      );
    const db = database();
    const source = await db
      .prepare(
        `SELECT review_status AS reviewStatus,merged_into_id AS mergedIntoId FROM leads WHERE id=? AND workspace_id=?`,
      )
      .bind(sourceLeadId, context.workspace.id)
      .first<{ reviewStatus: string; mergedIntoId: string | null }>();
    if (!source || source.reviewStatus === 'erased' || source.mergedIntoId)
      return Response.json(
        { error: 'This source contact cannot be merged.' },
        { status: 409 },
      );
    const tables = [
      'interactions',
      'tasks',
      'ai_extractions',
      'lead_facts',
      'qualification_scores',
      'communication_drafts',
      'lead_capture_assets',
      'rfqs',
      'opportunities',
      'meetings',
      'meeting_participants',
    ] as const;
    const [rows, opportunityContactRows] = await Promise.all([
      Promise.all(
        tables.map((table) =>
          db
            .prepare(
              `SELECT id FROM ${table} WHERE workspace_id=? AND lead_id=?`,
            )
            .bind(context.workspace.id, sourceLeadId)
            .all<{ id: string }>(),
        ),
      ),
      db
        .prepare(
          `SELECT opportunity_id AS opportunityId,contact_role AS contactRole,is_primary AS isPrimary FROM opportunity_contacts WHERE workspace_id=? AND lead_id=?`,
        )
        .bind(context.workspace.id, sourceLeadId)
        .all<{
          opportunityId: string;
          contactRole: string | null;
          isPrimary: number;
        }>(),
    ]);
    const moved = Object.fromEntries(
      tables.map((table, index) => [
        table,
        rows[index].results.map((item) => item.id),
      ]),
    );
    const opportunityContacts = opportunityContactRows.results;
    const now = Date.now();
    const mergeId = crypto.randomUUID();
    const statements = tables.map((table) =>
      db
        .prepare(
          `UPDATE ${table} SET lead_id=? WHERE workspace_id=? AND lead_id=?`,
        )
        .bind(targetLeadId, context.workspace.id, sourceLeadId),
    );
    for (const contact of opportunityContacts) {
      statements.push(
        db
          .prepare(
            `INSERT INTO opportunity_contacts (id,workspace_id,opportunity_id,lead_id,contact_role,is_primary,created_by,created_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM opportunity_contacts WHERE workspace_id=? AND opportunity_id=? AND lead_id=?)`,
          )
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            contact.opportunityId,
            targetLeadId,
            contact.contactRole,
            contact.isPrimary,
            context.user.id,
            now,
            context.workspace.id,
            contact.opportunityId,
            targetLeadId,
          ),
      );
    }
    statements.push(
      db
        .prepare(
          `DELETE FROM opportunity_contacts WHERE workspace_id=? AND lead_id=?`,
        )
        .bind(context.workspace.id, sourceLeadId),
      db
        .prepare(
          `UPDATE leads SET review_status='merged',merged_into_id=?,updated_at=? WHERE id=? AND workspace_id=?`,
        )
        .bind(targetLeadId, now, sourceLeadId, context.workspace.id),
      db
        .prepare(
          `UPDATE lead_duplicate_suggestions SET status='merged',resolved_by=?,resolved_at=?,updated_at=? WHERE workspace_id=? AND source_lead_id=? AND target_lead_id=? AND status='pending'`,
        )
        .bind(
          context.user.id,
          now,
          now,
          context.workspace.id,
          sourceLeadId,
          targetLeadId,
        ),
      db
        .prepare(
          `INSERT INTO lead_merge_events (id,workspace_id,source_lead_id,target_lead_id,status,snapshot_json,merged_by,merged_at) VALUES (?,?,?,?,'merged',?,?,?)`,
        )
        .bind(
          mergeId,
          context.workspace.id,
          sourceLeadId,
          targetLeadId,
          JSON.stringify({
            sourceReviewStatus: source.reviewStatus,
            moved,
            opportunityContacts,
          }),
          context.user.id,
          now,
        ),
      auditStatement(context, 'lead.merged', 'lead', sourceLeadId, {
        targetLeadId,
        mergeId,
      }),
    );
    await db.batch(statements);
    return Response.json({ ok: true, mergeId });
  }
  if (action === 'revert_lead_merge') {
    requireRole(context, ['owner', 'admin', 'manager']);
    const mergeId = clean(body.mergeId, 80);
    const db = database();
    const merge = await db
      .prepare(
        `SELECT source_lead_id AS sourceLeadId,target_lead_id AS targetLeadId,snapshot_json AS snapshotJson FROM lead_merge_events WHERE id=? AND workspace_id=? AND status='merged'`,
      )
      .bind(mergeId, context.workspace.id)
      .first<{
        sourceLeadId: string;
        targetLeadId: string;
        snapshotJson: string;
      }>();
    if (!merge)
      return Response.json(
        { error: 'Active merge not found.' },
        { status: 404 },
      );
    await requireLeadAccess(context, merge.targetLeadId);
    const snapshot = JSON.parse(merge.snapshotJson) as {
      sourceReviewStatus: string;
      moved: Record<string, string[]>;
      opportunityContacts?: Array<{
        opportunityId: string;
        contactRole: string | null;
        isPrimary: number;
      }>;
    };
    const tables = [
      'interactions',
      'tasks',
      'ai_extractions',
      'lead_facts',
      'qualification_scores',
      'communication_drafts',
      'lead_capture_assets',
      'rfqs',
      'opportunities',
      'meetings',
      'meeting_participants',
    ] as const;
    const statements = [];
    for (const table of tables) {
      const ids = snapshot.moved[table] || [];
      if (ids.length)
        statements.push(
          db
            .prepare(
              `UPDATE ${table} SET lead_id=? WHERE workspace_id=? AND lead_id=? AND id IN (${ids.map(() => '?').join(',')})`,
            )
            .bind(
              merge.sourceLeadId,
              context.workspace.id,
              merge.targetLeadId,
              ...ids,
            ),
        );
    }
    const now = Date.now();
    statements.push(
      db
        .prepare(
          `UPDATE leads SET review_status=?,merged_into_id=NULL,updated_at=? WHERE id=? AND workspace_id=?`,
        )
        .bind(
          snapshot.sourceReviewStatus || 'needs_review',
          now,
          merge.sourceLeadId,
          context.workspace.id,
        ),
    );
    for (const contact of snapshot.opportunityContacts || []) {
      statements.push(
        db
          .prepare(
            `INSERT INTO opportunity_contacts (id,workspace_id,opportunity_id,lead_id,contact_role,is_primary,created_by,created_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM opportunity_contacts WHERE workspace_id=? AND opportunity_id=? AND lead_id=?)`,
          )
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            contact.opportunityId,
            merge.sourceLeadId,
            contact.contactRole,
            contact.isPrimary,
            context.user.id,
            now,
            context.workspace.id,
            contact.opportunityId,
            merge.sourceLeadId,
          ),
      );
    }
    statements.push(
      db
        .prepare(
          `UPDATE lead_merge_events SET status='reverted',reverted_by=?,reverted_at=? WHERE id=? AND workspace_id=?`,
        )
        .bind(context.user.id, now, mergeId, context.workspace.id),
      db
        .prepare(
          `UPDATE lead_duplicate_suggestions SET status='pending',resolved_by=NULL,resolved_at=NULL,updated_at=? WHERE workspace_id=? AND source_lead_id=? AND target_lead_id=?`,
        )
        .bind(
          now,
          context.workspace.id,
          merge.sourceLeadId,
          merge.targetLeadId,
        ),
      auditStatement(
        context,
        'lead.merge_reverted',
        'lead',
        merge.sourceLeadId,
        { targetLeadId: merge.targetLeadId, mergeId },
      ),
    );
    await db.batch(statements);
    return Response.json({ ok: true });
  }
  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
