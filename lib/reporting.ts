export type PriorityCandidate = {
  id: string;
  kind: 'task' | 'rfq' | 'quotation' | 'lead';
  title: string;
  subject: string;
  dueAt?: number | null;
  qualificationState?: string | null;
  createdAt?: number | null;
};

export type RankedAction = PriorityCandidate & {
  priority: number;
  reason: string;
};

const DAY = 86_400_000;

export function rankNextActions(
  candidates: PriorityCandidate[],
  now: number,
): RankedAction[] {
  return candidates
    .map((item) => {
      const dueIn = item.dueAt == null ? null : item.dueAt - now;
      if (dueIn != null && dueIn < 0) {
        return {
          ...item,
          priority: item.kind === 'rfq' ? 100 : 98,
          reason: 'Overdue commitment',
        };
      }
      if (dueIn != null && dueIn <= DAY) {
        return {
          ...item,
          priority: item.kind === 'rfq' ? 96 : 94,
          reason: 'Due within 24 hours',
        };
      }
      if (dueIn != null && dueIn <= 3 * DAY) {
        return {
          ...item,
          priority: item.kind === 'quotation' ? 90 : 88,
          reason: 'Due within three days',
        };
      }
      if (item.kind === 'lead' && item.qualificationState === 'hot') {
        return {
          ...item,
          priority: 84,
          reason: 'Hot lead without an open commitment',
        };
      }
      return { ...item, priority: 50, reason: 'Open follow-up work' };
    })
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        (left.dueAt ?? Number.MAX_SAFE_INTEGER) -
          (right.dueAt ?? Number.MAX_SAFE_INTEGER) ||
        (left.createdAt ?? 0) - (right.createdAt ?? 0) ||
        left.id.localeCompare(right.id),
    );
}

export function attributedWithinWindow(
  createdAt: number,
  eventEndsOn: string,
  windowDays: number,
) {
  const end = Date.parse(`${eventEndsOn}T23:59:59.999Z`);
  return (
    Number.isFinite(end) && createdAt <= end + Math.max(0, windowDays) * DAY
  );
}

export type InvestmentBasisSource =
  | 'actual_cost_lines'
  | 'planned_cost_lines'
  | 'event_budget';

/**
 * Until a separate accounting close is available, the highest evidenced cost
 * total is used so a partial set of invoices cannot overstate ROI. This is the
 * single definition; /api/reports and /api/analytics both call it so an event
 * breakdown can never disagree with the headline figure.
 */
export function investmentBasisOf(input: {
  actualCostLines: number;
  plannedCostLines: number;
  plannedBudget: number;
}): { basis: number; source: InvestmentBasisSource } {
  const basis = Math.max(
    input.actualCostLines,
    input.plannedCostLines,
    input.plannedBudget,
  );
  return {
    basis,
    source:
      basis > 0 && basis === input.actualCostLines
        ? 'actual_cost_lines'
        : basis > 0 && basis === input.plannedCostLines
          ? 'planned_cost_lines'
          : 'event_budget',
  };
}

/** Return less investment, divided by investment. Null without an investment basis. */
export function roiPercent(returned: number, investmentBasis: number) {
  return investmentBasis ? ((returned - investmentBasis) / investmentBasis) * 100 : null;
}

/** Probability-weighted value of one opportunity. Negative probability is floored at zero. */
export function weightedOpportunityValue(value: number, probability: number) {
  return (Number(value || 0) * Math.max(0, Number(probability || 0))) / 100;
}

/** Gross profit contributed by one won opportunity at its event's configured margin. */
export function grossProfitOf(value: number, grossMarginBps: number) {
  return (Number(value || 0) * Number(grossMarginBps || 0)) / 10_000;
}

export function safeCsvCell(value: unknown) {
  let text = '';
  if (typeof value === 'string') text = value;
  else if (typeof value === 'number') text = value.toString();
  else if (typeof value === 'bigint') text = value.toString();
  else if (typeof value === 'boolean') text = value ? 'true' : 'false';
  else if (value != null) text = JSON.stringify(value) ?? '';
  const safe =
    typeof value === 'number' || typeof value === 'bigint'
      ? text
      : /^[=+\-@\t\r]/.test(text)
        ? `'${text}`
        : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function toCsv(headers: string[], rows: unknown[][]) {
  return [headers, ...rows]
    .map((row) => row.map(safeCsvCell).join(','))
    .join('\r\n');
}
