import {
  auditStatement,
  database,
  eventAccessClause,
  requireEventAccess,
  requireRole,
  requireWorkspace,
} from '@/lib/db';
import {
  attributedWithinWindow,
  rankNextActions,
  toCsv,
  type PriorityCandidate,
} from '@/lib/reporting';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';
const date = (value: unknown) =>
  /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : '';
const COST_STATUSES = new Set(['planned', 'actual']);

type EventRow = {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  budget: number;
  attributionWindowDays: number;
  grossMarginBps: number;
};

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const db = database();
  const url = new URL(request.url);
  const requestedEventId = clean(
    url.searchParams.get('eventId') ||
      request.headers.get('x-revenue-event-id'),
    80,
  );
  if (requestedEventId) await requireEventAccess(context, requestedEventId);
  const eventAccess = eventAccessClause(context, 'e.id');
  const eventFilter = requestedEventId ? ' AND e.id=?' : '';
  const eventBindings = requestedEventId ? [requestedEventId] : [];
  const events = await db
    .prepare(
      `SELECT e.id,e.name,e.starts_on AS startsOn,e.ends_on AS endsOn,e.budget,e.attribution_window_days AS attributionWindowDays,e.gross_margin_bps AS grossMarginBps FROM events e WHERE e.workspace_id=? AND e.status!='archived'${eventAccess.sql}${eventFilter} ORDER BY e.starts_on DESC`,
    )
    .bind(context.workspace.id, ...eventAccess.bindings, ...eventBindings)
    .all<EventRow>();
  const eventIds = events.results.map((item) => item.id);
  if (!eventIds.length) {
    return Response.json({
      report: emptyReport(),
      costs: [],
      nextBestActions: [],
    });
  }
  const placeholders = eventIds.map(() => '?').join(',');
  const [leadRows, opportunityRows, costRows, taskRows, rfqRows, quoteRows] =
    await Promise.all([
      db
        .prepare(
          `SELECT id,event_id AS eventId,full_name AS fullName,company,email,phone,qualification_state AS qualificationState,review_status AS reviewStatus,created_at AS createdAt FROM leads WHERE workspace_id=? AND review_status!='merged' AND event_id IN (${placeholders}) ORDER BY created_at DESC`,
        )
        .bind(context.workspace.id, ...eventIds)
        .all(),
      db
        .prepare(
          `SELECT id,event_id AS eventId,company,title,stage,value,currency,probability,created_at AS createdAt FROM opportunities WHERE workspace_id=? AND event_id IN (${placeholders}) ORDER BY created_at DESC`,
        )
        .bind(context.workspace.id, ...eventIds)
        .all(),
      db
        .prepare(
          `SELECT id,event_id AS eventId,category,description,vendor,amount,status,incurred_on AS incurredOn,version,created_at AS createdAt FROM event_cost_lines WHERE workspace_id=? AND event_id IN (${placeholders}) AND status!='void' ORDER BY incurred_on DESC,created_at DESC`,
        )
        .bind(context.workspace.id, ...eventIds)
        .all(),
      db
        .prepare(
          `SELECT t.id,t.lead_id AS leadId,l.event_id AS eventId,t.title,l.full_name AS subject,COALESCE(t.reminder_at,CASE WHEN t.due_date IS NULL THEN NULL ELSE unixepoch(t.due_date || ' 23:59:59')*1000 END) AS dueAt,t.created_at AS createdAt FROM tasks t JOIN leads l ON l.id=t.lead_id AND l.workspace_id=t.workspace_id WHERE t.workspace_id=? AND t.status='open' AND l.event_id IN (${placeholders})`,
        )
        .bind(context.workspace.id, ...eventIds)
        .all(),
      db
        .prepare(
          `SELECT id,event_id AS eventId,title,requester_company AS subject,COALESCE(owner_due_at,CASE WHEN submission_deadline IS NULL THEN NULL ELSE unixepoch(submission_deadline || ' 23:59:59')*1000 END) AS dueAt,created_at AS createdAt FROM rfqs WHERE workspace_id=? AND status NOT IN ('won','lost') AND event_id IN (${placeholders})`,
        )
        .bind(context.workspace.id, ...eventIds)
        .all(),
      db
        .prepare(
          `SELECT q.id,q.event_id AS eventId,q.quote_number AS title,q.customer AS subject,CASE WHEN q.valid_until IS NULL THEN NULL ELSE unixepoch(q.valid_until || ' 23:59:59')*1000 END AS dueAt,q.created_at AS createdAt,q.status,q.opportunity_id AS opportunityId,q.amount FROM quotations q WHERE q.workspace_id=? AND q.event_id IN (${placeholders})`,
        )
        .bind(context.workspace.id, ...eventIds)
        .all(),
    ]);

  const eventById = new Map(events.results.map((item) => [item.id, item]));
  const attributedOpportunities = opportunityRows.results.filter((item) => {
    const event = eventById.get(String(item.eventId));
    return Boolean(
      event &&
      attributedWithinWindow(
        Number(item.createdAt),
        event.endsOn,
        Number(event.attributionWindowDays),
      ),
    );
  });
  const openOpportunities = attributedOpportunities.filter(
    (item) => !['won', 'lost'].includes(String(item.stage)),
  );
  const wonOpportunities = attributedOpportunities.filter(
    (item) => item.stage === 'won',
  );
  const pipelineValue = openOpportunities.reduce(
    (sum, item) => sum + Number(item.value || 0),
    0,
  );
  const weightedPipelineValue = openOpportunities.reduce(
    (sum, item) =>
      sum +
      (Number(item.value || 0) * Math.max(0, Number(item.probability || 0))) /
        100,
    0,
  );
  const closedRevenue = wonOpportunities.reduce(
    (sum, item) => sum + Number(item.value || 0),
    0,
  );
  const plannedInvestment = events.results.reduce(
    (sum, item) => sum + Number(item.budget || 0),
    0,
  );
  const actualInvestment = costRows.results
    .filter((item) => item.status === 'actual')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const plannedCostLines = costRows.results
    .filter((item) => item.status === 'planned')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  // Until a separate accounting close is available, use the highest evidenced
  // cost total so a partial set of invoices cannot overstate ROI.
  const investmentBasis = Math.max(
    actualInvestment,
    plannedCostLines,
    plannedInvestment,
  );
  const grossProfit = wonOpportunities.reduce((sum, item) => {
    const event = eventById.get(String(item.eventId));
    return (
      sum +
      (Number(item.value || 0) * Number(event?.grossMarginBps || 0)) / 10_000
    );
  }, 0);
  const acceptedQuotes = quoteRows.results.filter(
    (item) => item.status === 'accepted',
  );
  const wonIds = new Set(wonOpportunities.map((item) => item.id));
  const acceptedOpportunityIds = new Set(
    acceptedQuotes.map((item) => item.opportunityId).filter(Boolean),
  );
  const report = {
    attributionModel: 'event_origin_100_percent',
    attributionWindowDays: requestedEventId
      ? Number(events.results[0]?.attributionWindowDays || 0)
      : null,
    totalLeads: leadRows.results.length,
    qualifiedLeads: leadRows.results.filter(
      (item) => item.reviewStatus === 'confirmed',
    ).length,
    openOpportunities: openOpportunities.length,
    pipelineValue,
    weightedPipelineValue,
    wonOpportunities: wonOpportunities.length,
    closedRevenue,
    plannedInvestment,
    plannedCostLines,
    actualInvestment,
    investmentBasis,
    investmentBasisSource:
      investmentBasis > 0 && investmentBasis === actualInvestment
        ? 'actual_cost_lines'
        : investmentBasis > 0 && investmentBasis === plannedCostLines
          ? 'planned_cost_lines'
          : 'event_budget',
    grossProfit,
    revenueRoiPercent: investmentBasis
      ? ((closedRevenue - investmentBasis) / investmentBasis) * 100
      : null,
    profitRoiPercent: investmentBasis
      ? ((grossProfit - investmentBasis) / investmentBasis) * 100
      : null,
    reconciliation: {
      acceptedQuotationValue: acceptedQuotes.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0,
      ),
      wonWithoutAcceptedQuotation: wonOpportunities.filter(
        (item) => !acceptedOpportunityIds.has(item.id),
      ).length,
      acceptedQuotationWithoutWonOpportunity: acceptedQuotes.filter(
        (item) => !item.opportunityId || !wonIds.has(item.opportunityId),
      ).length,
      excludedOutsideAttributionWindow:
        opportunityRows.results.length - attributedOpportunities.length,
    },
  };

  const candidates: PriorityCandidate[] = [
    ...taskRows.results.map((item) => ({
      ...item,
      id: String(item.id),
      kind: 'task' as const,
      title: String(item.title),
      subject: String(item.subject),
      dueAt: item.dueAt == null ? null : Number(item.dueAt),
      createdAt: Number(item.createdAt),
    })),
    ...rfqRows.results.map((item) => ({
      ...item,
      id: String(item.id),
      kind: 'rfq' as const,
      title: String(item.title),
      subject: String(item.subject),
      dueAt: item.dueAt == null ? null : Number(item.dueAt),
      createdAt: Number(item.createdAt),
    })),
    ...quoteRows.results
      .filter((item) => ['sent', 'approved'].includes(String(item.status)))
      .map((item) => ({
        id: String(item.id),
        kind: 'quotation' as const,
        title: String(item.title),
        subject: String(item.subject),
        dueAt: item.dueAt == null ? null : Number(item.dueAt),
        createdAt: Number(item.createdAt),
      })),
  ];
  const leadIdsWithTask = new Set(
    taskRows.results.map((item) => String(item.leadId)),
  );
  for (const lead of leadRows.results) {
    if (
      lead.qualificationState === 'hot' &&
      !leadIdsWithTask.has(String(lead.id))
    ) {
      candidates.push({
        id: String(lead.id),
        kind: 'lead',
        title: 'Create a follow-up commitment',
        subject: `${String(lead.fullName)} · ${String(lead.company)}`,
        qualificationState: 'hot',
        createdAt: Number(lead.createdAt),
      });
    }
  }
  const nextBestActions = rankNextActions(candidates, Date.now()).slice(0, 20);

  const exportType = clean(url.searchParams.get('export'), 30);
  if (exportType) {
    requireRole(context, ['owner', 'admin', 'manager']);
    const exports: Record<string, { headers: string[]; rows: unknown[][] }> = {
      leads: {
        headers: [
          'event_id',
          'lead_id',
          'name',
          'company',
          'email',
          'phone',
          'qualification',
          'review_status',
          'captured_at',
        ],
        rows: leadRows.results.map((item) => [
          item.eventId,
          item.id,
          item.fullName,
          item.company,
          item.email,
          item.phone,
          item.qualificationState,
          item.reviewStatus,
          new Date(Number(item.createdAt)).toISOString(),
        ]),
      },
      opportunities: {
        headers: [
          'event_id',
          'opportunity_id',
          'company',
          'title',
          'stage',
          'value',
          'currency',
          'probability_percent',
          'attributed',
          'created_at',
        ],
        rows: opportunityRows.results.map((item) => [
          item.eventId,
          item.id,
          item.company,
          item.title,
          item.stage,
          item.value,
          item.currency,
          item.probability,
          attributedOpportunities.includes(item) ? 'yes' : 'no',
          new Date(Number(item.createdAt)).toISOString(),
        ]),
      },
      costs: {
        headers: [
          'event_id',
          'cost_id',
          'category',
          'description',
          'vendor',
          'amount',
          'status',
          'incurred_on',
        ],
        rows: costRows.results.map((item) => [
          item.eventId,
          item.id,
          item.category,
          item.description,
          item.vendor,
          item.amount,
          item.status,
          item.incurredOn,
        ]),
      },
      actions: {
        headers: [
          'type',
          'record_id',
          'title',
          'subject',
          'priority',
          'reason',
          'due_at',
        ],
        rows: nextBestActions.map((item) => [
          item.kind,
          item.id,
          item.title,
          item.subject,
          item.priority,
          item.reason,
          item.dueAt ? new Date(item.dueAt).toISOString() : '',
        ]),
      },
      summary: {
        headers: ['metric', 'value'],
        rows: [
          ...Object.entries(report)
            .filter(([, value]) => typeof value !== 'object')
            .map(([key, value]) => [key, value]),
          ...Object.entries(report.reconciliation).map(([key, value]) => [
            `reconciliation.${key}`,
            value,
          ]),
        ],
      },
    };
    const selected = exports[exportType];
    if (!selected)
      return Response.json(
        { error: 'Unknown report export.' },
        { status: 400 },
      );
    await auditStatement(
      context,
      'report.exported',
      'event',
      requestedEventId || 'all',
      { exportType },
    ).run();
    return new Response(toCsv(selected.headers, selected.rows), {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${context.workspace.slug}-${exportType}.csv"`,
        'cache-control': 'private, no-store',
      },
    });
  }

  return Response.json({
    events: events.results,
    report,
    costs: costRows.results,
    nextBestActions,
  });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin', 'manager']);
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body)
    return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 30);
  const db = database();
  const now = Date.now();
  if (action === 'create_cost') {
    const eventId = clean(body.eventId, 80);
    await requireEventAccess(context, eventId, true);
    const category = clean(body.category, 60);
    const description = clean(body.description, 300);
    const vendor = clean(body.vendor, 180) || null;
    const amount = Number(body.amount);
    const status = clean(body.status, 20);
    const incurredOn = date(body.incurredOn) || null;
    if (
      !eventId ||
      !category ||
      !description ||
      !Number.isSafeInteger(amount) ||
      amount < 0 ||
      !COST_STATUSES.has(status)
    ) {
      return Response.json(
        {
          error:
            'Event, category, description, non-negative whole amount and cost status are required.',
        },
        { status: 400 },
      );
    }
    const id = crypto.randomUUID();
    const mutationToken = crypto.randomUUID();
    const snapshot = {
      category,
      description,
      vendor,
      amount,
      status,
      incurredOn,
    };
    await db.batch([
      db
        .prepare(
          `INSERT INTO event_cost_lines (id,workspace_id,event_id,category,description,vendor,amount,status,incurred_on,version,mutation_token,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,1,?,?,?,?)`,
        )
        .bind(
          id,
          context.workspace.id,
          eventId,
          category,
          description,
          vendor,
          amount,
          status,
          incurredOn,
          mutationToken,
          context.user.id,
          now,
          now,
        ),
      db
        .prepare(
          `INSERT INTO event_cost_history (id,workspace_id,event_id,cost_line_id,action,from_version,to_version,snapshot_json,mutation_token,changed_by,created_at) VALUES (?,?,?,?,'created',NULL,1,?,?,?,?)`,
        )
        .bind(
          crypto.randomUUID(),
          context.workspace.id,
          eventId,
          id,
          JSON.stringify(snapshot),
          mutationToken,
          context.user.id,
          now,
        ),
      auditStatement(context, 'event_cost.created', 'event_cost', id, {
        eventId,
        amount,
        status,
      }),
    ]);
    return Response.json(
      { cost: { id, eventId, ...snapshot, version: 1 } },
      { status: 201 },
    );
  }
  if (action === 'void_cost') {
    const id = clean(body.id, 80);
    const version = Number(body.version);
    const reason = clean(body.reason, 500);
    const cost = await db
      .prepare(
        `SELECT event_id AS eventId,category,description,vendor,amount,status,incurred_on AS incurredOn,version FROM event_cost_lines WHERE id=? AND workspace_id=?`,
      )
      .bind(id, context.workspace.id)
      .first<Record<string, unknown>>();
    if (!cost)
      return Response.json({ error: 'Cost line not found.' }, { status: 404 });
    await requireEventAccess(context, String(cost.eventId), true);
    if (!Number.isInteger(version) || version !== Number(cost.version))
      return Response.json(
        {
          error: 'This cost line changed in another session.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    if (!reason)
      return Response.json(
        { error: 'A void reason is required.' },
        { status: 400 },
      );
    if (cost.status === 'void')
      return Response.json(
        { error: 'This cost line is already void.' },
        { status: 409 },
      );
    const mutationToken = crypto.randomUUID();
    const nextVersion = version + 1;
    let results;
    try {
      results = await db.batch([
        db
          .prepare(
            `UPDATE event_cost_lines SET status='void',voided_at=?,version=?,mutation_token=?,updated_at=? WHERE id=? AND workspace_id=? AND version=? AND status!='void'`,
          )
          .bind(
            now,
            nextVersion,
            mutationToken,
            now,
            id,
            context.workspace.id,
            version,
          ),
        db
          .prepare(
            `INSERT INTO event_cost_history (id,workspace_id,event_id,cost_line_id,action,from_version,to_version,snapshot_json,mutation_token,changed_by,created_at) VALUES (?,?,?,?, 'voided',?,?,?,?,?,?)`,
          )
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            cost.eventId,
            id,
            version,
            nextVersion,
            JSON.stringify({ ...cost, status: 'void', reason }),
            mutationToken,
            context.user.id,
            now,
          ),
        auditStatement(context, 'event_cost.voided', 'event_cost', id, {
          reason,
          eventId: cost.eventId,
        }),
      ]);
    } catch {
      return Response.json(
        {
          error: 'This cost line changed in another session.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    }
    if (!results[0].meta.changes)
      return Response.json(
        {
          error: 'This cost line changed in another session.',
          code: 'VERSION_CONFLICT',
        },
        { status: 409 },
      );
    return Response.json({ ok: true, version: nextVersion });
  }
  return Response.json({ error: 'Unknown report action.' }, { status: 400 });
}

function emptyReport() {
  return {
    attributionModel: 'event_origin_100_percent',
    attributionWindowDays: null,
    totalLeads: 0,
    qualifiedLeads: 0,
    openOpportunities: 0,
    pipelineValue: 0,
    weightedPipelineValue: 0,
    wonOpportunities: 0,
    closedRevenue: 0,
    plannedInvestment: 0,
    plannedCostLines: 0,
    actualInvestment: 0,
    investmentBasis: 0,
    investmentBasisSource: 'event_budget',
    grossProfit: 0,
    revenueRoiPercent: null,
    profitRoiPercent: null,
    reconciliation: {
      acceptedQuotationValue: 0,
      wonWithoutAcceptedQuotation: 0,
      acceptedQuotationWithoutWonOpportunity: 0,
      excludedOutsideAttributionWindow: 0,
    },
  };
}
