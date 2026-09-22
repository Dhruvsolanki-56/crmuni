/**
 * Read-only analytics aggregation.
 *
 * Everything here is derived from records the workspace already owns. It adds no
 * state, writes nothing, and never recomputes a business formula that
 * /api/reports already defines - investment basis, ROI, weighted pipeline,
 * gross profit and the attribution window all come from lib/reporting so the
 * per-event breakdown can never disagree with the headline report.
 *
 * Scope matches /api/reports exactly: non-archived events the caller can reach,
 * optionally narrowed to one event.
 */
import {
  database,
  eventAccessClause,
  requireEventAccess,
  requireWorkspace,
} from '@/lib/db';
import {
  attributedWithinWindow,
  grossProfitOf,
  investmentBasisOf,
  roiPercent,
  weightedOpportunityValue,
} from '@/lib/reporting';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const OPEN_STAGES = [
  'qualified',
  'requirement',
  'sample',
  'rfq',
  'quotation',
  'meeting',
  'negotiation',
] as const;

type EventRow = {
  id: string;
  name: string;
  status: string;
  startsOn: string;
  endsOn: string;
  budget: number;
  attributionWindowDays: number;
  grossMarginBps: number;
  dailyLeadTarget: number;
};

type OpportunityRow = {
  eventId: string | null;
  leadId: string | null;
  stage: string;
  value: number;
  probability: number;
  createdAt: number;
};

const sum = (rows: Array<Record<string, unknown>>, key: string) =>
  rows.reduce((total, row) => total + Number(row[key] || 0), 0);

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const db = database();
  const url = new URL(request.url);
  // Matches /api/reports: scope=all keeps an explicit "All events" choice from
  // being narrowed by the device's selected capture event header.
  const requestedEventId =
    clean(url.searchParams.get('scope'), 10) === 'all'
      ? ''
      : clean(
          url.searchParams.get('eventId') ||
            request.headers.get('x-revenue-event-id'),
          80,
        );
  if (requestedEventId) await requireEventAccess(context, requestedEventId);
  const access = eventAccessClause(context, 'e.id');
  const eventFilter = requestedEventId ? ' AND e.id=?' : '';
  const eventBindings = requestedEventId ? [requestedEventId] : [];
  const events = await db
    .prepare(
      `SELECT e.id,e.name,e.status,e.starts_on AS startsOn,e.ends_on AS endsOn,e.budget,e.attribution_window_days AS attributionWindowDays,e.gross_margin_bps AS grossMarginBps,e.daily_lead_target AS dailyLeadTarget FROM events e WHERE e.workspace_id=? AND e.status!='archived'${access.sql}${eventFilter} ORDER BY e.starts_on DESC`,
    )
    .bind(context.workspace.id, ...access.bindings, ...eventBindings)
    .all<EventRow>();
  const eventIds = events.results.map((item) => item.id);
  if (!eventIds.length) {
    return Response.json({
      currency: context.workspace.currency,
      scope: { eventId: requestedEventId || null, eventCount: 0 },
      events: [],
      leadTimeline: [],
      captureSources: [],
      leadOwners: [],
      pipelineStages: [],
      closedStages: [],
      costCategories: [],
      rfqStatuses: [],
      quotationStatuses: [],
      meetingStatuses: [],
      coverage: null,
      conversion: null,
    });
  }
  const scope = eventIds.map(() => '?').join(',');
  const workspaceScope = [context.workspace.id, ...eventIds];
  const now = Date.now();

  const [
    leadGroups,
    leadTimeline,
    captureSources,
    leadOwners,
    opportunityRows,
    costGroups,
    rfqGroups,
    rfqQuoted,
    quotationGroups,
    meetingGroups,
    coverageRow,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT event_id AS eventId,review_status AS reviewStatus,qualification_state AS qualificationState,COUNT(*) AS total FROM leads WHERE workspace_id=? AND review_status!='merged' AND event_id IN (${scope}) GROUP BY 1,2,3`,
      )
      .bind(...workspaceScope)
      .all(),
    db
      .prepare(
        `SELECT date(created_at/1000,'unixepoch') AS day,COUNT(*) AS captured,SUM(CASE WHEN review_status='confirmed' THEN 1 ELSE 0 END) AS confirmed FROM leads WHERE workspace_id=? AND review_status!='merged' AND event_id IN (${scope}) GROUP BY 1 ORDER BY 1`,
      )
      .bind(...workspaceScope)
      .all(),
    db
      .prepare(
        `SELECT source,COUNT(*) AS total,SUM(CASE WHEN review_status='confirmed' THEN 1 ELSE 0 END) AS confirmed FROM leads WHERE workspace_id=? AND review_status!='merged' AND event_id IN (${scope}) GROUP BY 1 ORDER BY total DESC`,
      )
      .bind(...workspaceScope)
      .all(),
    db
      .prepare(
        `SELECT l.owner_id AS ownerId,COALESCE(m.display_name,m.email) AS ownerName,COUNT(*) AS total,SUM(CASE WHEN l.review_status='confirmed' THEN 1 ELSE 0 END) AS confirmed FROM leads l LEFT JOIN memberships m ON m.workspace_id=l.workspace_id AND m.user_id=l.owner_id WHERE l.workspace_id=? AND l.review_status!='merged' AND l.event_id IN (${scope}) GROUP BY 1,2 ORDER BY total DESC LIMIT 12`,
      )
      .bind(...workspaceScope)
      .all(),
    // Opportunities stay row-level so the attribution window and the weighted
    // pipeline run through the same helpers /api/reports uses. The projection is
    // narrow and opportunity counts are orders of magnitude below lead counts.
    db
      .prepare(
        `SELECT event_id AS eventId,lead_id AS leadId,stage,value,probability,created_at AS createdAt FROM opportunities WHERE workspace_id=? AND event_id IN (${scope})`,
      )
      .bind(...workspaceScope)
      .all<OpportunityRow>(),
    db
      .prepare(
        `SELECT event_id AS eventId,category,status,COUNT(*) AS lines,SUM(amount) AS amount FROM event_cost_lines WHERE workspace_id=? AND event_id IN (${scope}) AND status!='void' GROUP BY 1,2,3`,
      )
      .bind(...workspaceScope)
      .all(),
    db
      .prepare(
        `SELECT status,COUNT(*) AS total,SUM(CASE WHEN status NOT IN ('won','lost') AND COALESCE(owner_due_at,CASE WHEN submission_deadline IS NULL THEN NULL ELSE unixepoch(submission_deadline || ' 23:59:59')*1000 END)<? THEN 1 ELSE 0 END) AS overdue FROM rfqs WHERE workspace_id=? AND event_id IN (${scope}) GROUP BY 1`,
      )
      .bind(now, ...workspaceScope)
      .all(),
    db
      .prepare(
        `SELECT COUNT(DISTINCT q.rfq_id) AS total FROM quotations q JOIN rfqs r ON r.id=q.rfq_id AND r.workspace_id=q.workspace_id WHERE q.workspace_id=? AND r.event_id IN (${scope})`,
      )
      .bind(...workspaceScope)
      .all(),
    db
      .prepare(
        `SELECT status,COUNT(*) AS total,SUM(amount) AS value,SUM(CASE WHEN status IN ('approved','sent') AND valid_until IS NOT NULL AND unixepoch(valid_until || ' 23:59:59')*1000<? THEN 1 ELSE 0 END) AS pastValidity FROM quotations WHERE workspace_id=? AND event_id IN (${scope}) GROUP BY 1`,
      )
      .bind(now, ...workspaceScope)
      .all(),
    db
      .prepare(
        `SELECT status,COUNT(*) AS total,SUM(CASE WHEN starts_at>=? THEN 1 ELSE 0 END) AS upcoming FROM meetings WHERE workspace_id=? AND event_id IN (${scope}) GROUP BY 1`,
      )
      .bind(now, ...workspaceScope)
      .all(),
    // Same rule /api/reports applies when it raises a hot lead as a next best
    // action: a lead is covered when it has any open task.
    db
      .prepare(
        `SELECT COUNT(*) AS scopedLeads,SUM(CASE WHEN ot.leadId IS NOT NULL THEN 1 ELSE 0 END) AS withOpenTask,SUM(CASE WHEN l.qualification_state='hot' THEN 1 ELSE 0 END) AS hotLeads,SUM(CASE WHEN l.qualification_state='hot' AND ot.leadId IS NULL THEN 1 ELSE 0 END) AS hotWithoutOpenTask FROM leads l LEFT JOIN (SELECT DISTINCT lead_id AS leadId FROM tasks WHERE workspace_id=? AND status='open') ot ON ot.leadId=l.id WHERE l.workspace_id=? AND l.review_status!='merged' AND l.event_id IN (${scope})`,
      )
      .bind(context.workspace.id, ...workspaceScope)
      .all(),
  ]);

  const eventById = new Map(events.results.map((item) => [item.id, item]));
  const attributed = opportunityRows.results.filter((item) => {
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

  const stageTotals = new Map<
    string,
    { count: number; value: number; weighted: number; probability: number }
  >();
  for (const item of attributed) {
    const key = String(item.stage);
    const current = stageTotals.get(key) || {
      count: 0,
      value: 0,
      weighted: 0,
      probability: 0,
    };
    current.count += 1;
    current.value += Number(item.value || 0);
    current.weighted += weightedOpportunityValue(
      Number(item.value),
      Number(item.probability),
    );
    current.probability += Math.max(0, Number(item.probability || 0));
    stageTotals.set(key, current);
  }
  const stageEntry = (stage: string) => {
    const totals = stageTotals.get(stage);
    return {
      stage,
      count: totals?.count || 0,
      value: totals?.value || 0,
      weightedValue: totals?.weighted || 0,
      averageProbability: totals?.count
        ? totals.probability / totals.count
        : null,
    };
  };

  const leadsByEvent = new Map<string, { total: number; confirmed: number }>();
  const qualificationMix = new Map<string, number>();
  const reviewMix = new Map<string, number>();
  for (const row of leadGroups.results as Array<Record<string, unknown>>) {
    const eventId = String(row.eventId);
    const total = Number(row.total || 0);
    const current = leadsByEvent.get(eventId) || { total: 0, confirmed: 0 };
    current.total += total;
    if (row.reviewStatus === 'confirmed') current.confirmed += total;
    leadsByEvent.set(eventId, current);
    const state = String(row.qualificationState);
    qualificationMix.set(state, (qualificationMix.get(state) || 0) + total);
    const review = String(row.reviewStatus);
    reviewMix.set(review, (reviewMix.get(review) || 0) + total);
  }

  const costsByEvent = new Map<string, { planned: number; actual: number }>();
  const costsByCategory = new Map<
    string,
    { planned: number; actual: number; lines: number }
  >();
  for (const row of costGroups.results as Array<Record<string, unknown>>) {
    const amount = Number(row.amount || 0);
    const planned = row.status === 'planned';
    const eventTotals = costsByEvent.get(String(row.eventId)) || {
      planned: 0,
      actual: 0,
    };
    if (planned) eventTotals.planned += amount;
    else eventTotals.actual += amount;
    costsByEvent.set(String(row.eventId), eventTotals);
    const category = String(row.category);
    const categoryTotals = costsByCategory.get(category) || {
      planned: 0,
      actual: 0,
      lines: 0,
    };
    if (planned) categoryTotals.planned += amount;
    else categoryTotals.actual += amount;
    categoryTotals.lines += Number(row.lines || 0);
    costsByCategory.set(category, categoryTotals);
  }

  const eventBreakdown = events.results.map((event) => {
    const leads = leadsByEvent.get(event.id) || { total: 0, confirmed: 0 };
    const costs = costsByEvent.get(event.id) || { planned: 0, actual: 0 };
    const own = attributed.filter((item) => item.eventId === event.id);
    const open = own.filter((item) => !['won', 'lost'].includes(item.stage));
    const won = own.filter((item) => item.stage === 'won');
    const closedRevenue = won.reduce(
      (total, item) => total + Number(item.value || 0),
      0,
    );
    const { basis, source } = investmentBasisOf({
      actualCostLines: costs.actual,
      plannedCostLines: costs.planned,
      plannedBudget: Number(event.budget || 0),
    });
    const grossProfit = won.reduce(
      (total, item) =>
        total +
        grossProfitOf(Number(item.value), Number(event.grossMarginBps)),
      0,
    );
    return {
      id: event.id,
      name: event.name,
      status: event.status,
      startsOn: event.startsOn,
      endsOn: event.endsOn,
      dailyLeadTarget: Number(event.dailyLeadTarget || 0),
      attributionWindowDays: Number(event.attributionWindowDays || 0),
      totalLeads: leads.total,
      qualifiedLeads: leads.confirmed,
      openOpportunities: open.length,
      pipelineValue: open.reduce(
        (total, item) => total + Number(item.value || 0),
        0,
      ),
      weightedPipelineValue: open.reduce(
        (total, item) =>
          total +
          weightedOpportunityValue(Number(item.value), Number(item.probability)),
        0,
      ),
      wonOpportunities: won.length,
      closedRevenue,
      plannedBudget: Number(event.budget || 0),
      plannedCostLines: costs.planned,
      actualInvestment: costs.actual,
      investmentBasis: basis,
      investmentBasisSource: source,
      grossProfit,
      revenueRoiPercent: roiPercent(closedRevenue, basis),
      profitRoiPercent: roiPercent(grossProfit, basis),
    };
  });

  const coverage = (coverageRow.results[0] || {}) as Record<string, unknown>;
  const scopedLeads = Number(coverage.scopedLeads || 0);
  const confirmedLeads = reviewMix.get('confirmed') || 0;
  const leadsWithOpportunity = new Set(
    attributed.map((item) => item.leadId).filter(Boolean),
  ).size;

  return Response.json({
    currency: context.workspace.currency,
    scope: {
      eventId: requestedEventId || null,
      eventCount: eventIds.length,
    },
    events: eventBreakdown,
    leadTimeline: leadTimeline.results,
    captureSources: captureSources.results,
    leadOwners: leadOwners.results,
    qualificationMix: [...qualificationMix].map(([state, count]) => ({
      state,
      count,
    })),
    reviewMix: [...reviewMix].map(([status, count]) => ({ status, count })),
    pipelineStages: OPEN_STAGES.map(stageEntry),
    closedStages: ['won', 'lost'].map(stageEntry),
    costCategories: [...costsByCategory]
      .map(([category, totals]) => ({ category, ...totals }))
      .sort((left, right) => right.actual + right.planned - (left.actual + left.planned)),
    rfqStatuses: rfqGroups.results,
    rfqsWithQuotation: Number(
      (rfqQuoted.results[0] as Record<string, unknown> | undefined)?.total || 0,
    ),
    rfqTotal: sum(rfqGroups.results as Array<Record<string, unknown>>, 'total'),
    quotationStatuses: quotationGroups.results,
    meetingStatuses: meetingGroups.results,
    coverage: {
      scopedLeads,
      confirmedLeads,
      leadsWithOpenTask: Number(coverage.withOpenTask || 0),
      hotLeads: Number(coverage.hotLeads || 0),
      hotWithoutOpenTask: Number(coverage.hotWithoutOpenTask || 0),
    },
    conversion: {
      captured: scopedLeads,
      confirmed: confirmedLeads,
      leadsWithOpportunity,
      attributedOpportunities: attributed.length,
      wonOpportunities: attributed.filter((item) => item.stage === 'won').length,
    },
  });
}
