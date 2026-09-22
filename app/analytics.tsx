'use client';

/**
 * Revenue analytics.
 *
 * Every number rendered here arrives from /api/reports (the authoritative
 * business figures) or /api/analytics (read-only aggregation of the same
 * records). Nothing is estimated, extrapolated or compared against a period the
 * backend does not hold. Where a figure cannot be derived it is stated as
 * unavailable rather than shown as zero.
 *
 * The visualizations are hand-built SVG and CSS geometry rather than a charting
 * library: each one encodes a relationship specific to exhibition revenue
 * (shared-scale value ladder, probability-weighted stage bands, conversion
 * spine, capture density) that a generic cartesian chart would not express, and
 * the bars animate through a single CSS custom property so a filter change
 * morphs existing geometry instead of remounting a chart.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, ArrowRight, Download, Info } from 'lucide-react';

/* ── contracts ───────────────────────────────────────────────────────────── */

export type AnalyticsEvent = {
  id: string;
  name: string;
  status: string;
  startsOn: string;
  endsOn: string;
  dailyLeadTarget: number;
  attributionWindowDays: number;
  totalLeads: number;
  qualifiedLeads: number;
  openOpportunities: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  wonOpportunities: number;
  closedRevenue: number;
  plannedBudget: number;
  plannedCostLines: number;
  actualInvestment: number;
  investmentBasis: number;
  investmentBasisSource: string;
  grossProfit: number;
  revenueRoiPercent: number | null;
  profitRoiPercent: number | null;
};

export type AnalyticsPayload = {
  currency: string;
  scope: { eventId: string | null; eventCount: number };
  events: AnalyticsEvent[];
  leadTimeline: Array<{ day: string; captured: number; confirmed: number }>;
  captureSources: Array<{ source: string; total: number; confirmed: number }>;
  leadOwners: Array<{
    ownerId: string;
    ownerName: string | null;
    total: number;
    confirmed: number;
  }>;
  qualificationMix: Array<{ state: string; count: number }>;
  reviewMix: Array<{ status: string; count: number }>;
  qualificationByReview: Array<{
    reviewStatus: string;
    qualificationState: string;
    count: number;
  }>;
  pipelineStages: Array<{
    stage: string;
    count: number;
    value: number;
    weightedValue: number;
    averageProbability: number | null;
  }>;
  closedStages: Array<{
    stage: string;
    count: number;
    value: number;
    weightedValue: number;
    averageProbability: number | null;
  }>;
  costCategories: Array<{
    category: string;
    planned: number;
    actual: number;
    lines: number;
  }>;
  rfqStatuses: Array<{ status: string; total: number; overdue: number }>;
  rfqsWithQuotation: number;
  rfqTotal: number;
  quotationStatuses: Array<{
    status: string;
    total: number;
    value: number;
    pastValidity: number;
  }>;
  meetingStatuses: Array<{
    status: string;
    total: number;
    upcoming: number;
  }>;
  coverage: {
    scopedLeads: number;
    confirmedLeads: number;
    leadsWithOpenTask: number;
    hotLeads: number;
    hotWithoutOpenTask: number;
  } | null;
  conversion: {
    captured: number;
    confirmed: number;
    leadsWithOpportunity: number;
    attributedOpportunities: number;
    wonOpportunities: number;
  } | null;
};

export type AnalyticsReport = {
  attributionModel: string;
  attributionWindowDays: number | null;
  totalLeads: number;
  qualifiedLeads: number;
  openOpportunities: number;
  pipelineValue: number;
  weightedPipelineValue: number;
  wonOpportunities: number;
  closedRevenue: number;
  plannedInvestment: number;
  plannedCostLines: number;
  actualInvestment: number;
  investmentBasis: number;
  investmentBasisSource: string;
  grossProfit: number;
  revenueRoiPercent: number | null;
  profitRoiPercent: number | null;
  reconciliation: {
    acceptedQuotationValue: number;
    wonWithoutAcceptedQuotation: number;
    acceptedQuotationWithoutWonOpportunity: number;
    excludedOutsideAttributionWindow: number;
  };
};

export type AnalyticsCost = {
  id: string;
  eventId: string;
  category: string;
  description: string;
  vendor?: string;
  amount: number;
  status: string;
  incurredOn?: string;
  version: number;
};

export type AnalyticsAction = {
  id: string;
  kind: string;
  title: string;
  subject: string;
  priority: number;
  reason: string;
  dueAt?: number;
};

export type AnalyticsScopeEvent = {
  id: string;
  name: string;
  status: string;
  startsOn: string;
  endsOn: string;
};

type Props = {
  report: AnalyticsReport | null;
  analytics: AnalyticsPayload | null;
  scopeEvents: AnalyticsScopeEvent[];
  costs: AnalyticsCost[];
  actions: AnalyticsAction[];
  currency: string;
  scopeEventId: string;
  onScopeChange: (eventId: string) => void;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  canExport: boolean;
  onExport: (kind: string) => void;
  onOpenStage: (stage: string) => void;
  onOpenAction: (action: AnalyticsAction) => void;
  costEntry: ReactNode;
};

/* ── formatting ──────────────────────────────────────────────────────────── */

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${Math.round(value).toLocaleString()}`;
  }
}

function compactMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return money(value, currency);
  }
}

const count = (value: number) => Math.round(value).toLocaleString();
const percent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;
const share = (part: number, whole: number) =>
  whole > 0 ? `${((part / whole) * 100).toFixed(part / whole < 0.1 ? 1 : 0)}%` : '—';
const titleCase = (value: string) =>
  value.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase());

/** Capture sources are stored lowercase; two of them are initialisms. */
const SOURCE_LABELS: Record<string, string> = {
  qr: 'QR code',
  card: 'Business card',
  badge: 'Badge scan',
  manual: 'Typed manually',
};

/** Meetings read as a lifecycle, not alphabetically as SQL groups them. */
const MEETING_ORDER = ['scheduled', 'complete', 'cancelled'];

function dateRange(startsOn: string, endsOn: string) {
  const start = new Date(`${startsOn}T00:00:00`);
  const end = new Date(`${endsOn}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
    return `${startsOn} - ${endsOn}`;
  const month = (value: Date) =>
    value.toLocaleDateString(undefined, { month: 'short' });
  return startsOn.slice(0, 7) === endsOn.slice(0, 7)
    ? `${month(start)} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`
    : `${month(start)} ${start.getDate()} → ${month(end)} ${end.getDate()}, ${end.getFullYear()}`;
}

function shortDate(day: string) {
  const parsed = new Date(`${day}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? day
    : parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dueLabel(dueAt: number | undefined, now: number) {
  if (dueAt == null) return null;
  const diff = dueAt - now;
  const days = Math.round(Math.abs(diff) / 86_400_000);
  if (diff < 0) return days <= 1 ? 'Overdue today' : `Overdue by ${days} days`;
  if (days === 0) return 'Due today';
  return days === 1 ? 'Due tomorrow' : `Due in ${days} days`;
}

/* ── motion ──────────────────────────────────────────────────────────────── */

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Adds `is-entered` to the root one frame after mount. Every bar's geometry is
 * `scaleX(calc(var(--fill) * var(--enter)))`, so a single class flip grows all of
 * them through their CSS transition without React re-rendering anything, and a
 * later data change animates from the current geometry to the new one.
 */
function useEnterFlag() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const frame = requestAnimationFrame(() => node.classList.add('is-entered'));
    return () => cancelAnimationFrame(frame);
  }, []);
  return ref;
}

/**
 * Interpolates from whatever is currently on screen to the new value, so a
 * scope change continues from the previous figure instead of restarting at nil.
 */
function useCountUp(value: number) {
  const [display, setDisplay] = useState(() =>
    prefersReducedMotion() ? value : 0,
  );
  const fromRef = useRef(prefersReducedMotion() ? value : 0);
  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    let frame = 0;
    if (prefersReducedMotion()) {
      frame = requestAnimationFrame(() => {
        fromRef.current = value;
        setDisplay(value);
      });
      return () => cancelAnimationFrame(frame);
    }
    const started = performance.now();
    const duration = 620;
    const step = (now: number) => {
      const progress = Math.min(1, (now - started) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (value - from) * eased;
      fromRef.current = progress < 1 ? next : value;
      setDisplay(fromRef.current);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return display;
}

function CountMoney({
  value,
  currency,
  compact,
}: {
  value: number;
  currency: string;
  compact?: boolean;
}) {
  const shown = useCountUp(value);
  return (
    <span className="an-num">
      {compact ? compactMoney(shown, currency) : money(shown, currency)}
    </span>
  );
}

function CountNumber({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <span className="an-num">{count(shown)}</span>;
}

/** Bars read their proportion from one custom property; CSS does the rest. */
const fill = (ratio: number) =>
  ({ '--fill': Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0 }) as React.CSSProperties;

/* ── small building blocks ───────────────────────────────────────────────── */

/**
 * Every chapter's label, title and explanation sit in a fixed narrow column to
 * the left of its visualization. That gives the page one alignment line to
 * scan down, keeps explanatory text at a readable measure instead of running
 * the full width, and lets the charts start at a consistent edge.
 */
function SectionHead({
  eyebrow,
  title,
  note,
  aside,
}: {
  eyebrow: string;
  title: string;
  note?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="an-head">
      <p className="an-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {note ? <p className="an-note">{note}</p> : null}
      {aside ? <div className="an-head-aside">{aside}</div> : null}
    </div>
  );
}

function Unavailable({ children }: { children: ReactNode }) {
  return (
    <p className="an-unavailable">
      <Info aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/* ── the value ladder ────────────────────────────────────────────────────── */

/**
 * Five money figures on one shared linear scale, with the investment basis drawn
 * across every bar as a reference line. Whether the event returned value is
 * answered by whether the revenue bar reaches past that line — which a set of
 * separate KPI cards cannot show at all.
 */
function ValueLadder({
  report,
  currency,
}: {
  report: AnalyticsReport;
  currency: string;
}) {
  const rows = [
    {
      key: 'investment',
      label: 'Investment',
      value: report.investmentBasis,
      hint:
        report.investmentBasisSource === 'actual_cost_lines'
          ? 'Actual cost lines'
          : report.investmentBasisSource === 'planned_cost_lines'
            ? 'Planned cost lines'
            : 'Planned event budget',
      tone: 'cost',
      pending: false,
    },
    {
      key: 'pipeline',
      label: 'Open pipeline',
      value: report.pipelineValue,
      hint: report.openOpportunities
        ? `${count(report.openOpportunities)} open opportunities`
        : 'No opportunities created yet',
      tone: 'quiet',
      pending: !report.openOpportunities,
    },
    {
      key: 'weighted',
      label: 'Weighted pipeline',
      value: report.weightedPipelineValue,
      hint: report.openOpportunities
        ? 'Value × probability'
        : 'Follows open pipeline',
      tone: 'mid',
      pending: !report.openOpportunities,
    },
    {
      key: 'revenue',
      label: 'Closed revenue',
      value: report.closedRevenue,
      hint: report.wonOpportunities
        ? `${count(report.wonOpportunities)} won opportunities`
        : 'Nothing has closed won yet',
      tone: 'signal',
      pending: !report.wonOpportunities,
    },
    {
      key: 'profit',
      label: 'Gross profit',
      value: report.grossProfit,
      hint: report.wonOpportunities
        ? "At each event's configured margin"
        : 'Follows closed revenue',
      tone: 'strong',
      pending: !report.wonOpportunities,
    },
  ];
  const max = Math.max(...rows.map((row) => row.value), 1);
  const basisRatio = report.investmentBasis / max;
  return (
    <div className="an-ladder">
      {/* The reference line has to share the rows' containing block, or it
          drifts out of the track column it is meant to cut across. */}
      <div className="an-ladder-rows">
        {report.investmentBasis > 0 && basisRatio < 0.97 ? (
          <div className="an-ladder-marks" aria-hidden="true">
            <span>
              <i
                className="an-ladder-mark"
                style={{ left: `${Math.min(100, basisRatio * 100)}%` }}
              >
                <b>Invested</b>
              </i>
            </span>
          </div>
        ) : null}
        {rows.map((row) => (
        <div className={`an-ladder-row an-tone-${row.tone}`} key={row.key}>
          {/* The hint moved to the row's tooltip: five sub-labels under five
              labels doubled the reading for no extra meaning. */}
          <span className="an-ladder-label" title={row.hint}>
            {row.label}
          </span>
          <span className="an-ladder-track">
            <i style={fill(row.value / max)} />
          </span>
          <strong className="an-ladder-value">
            {/* A row that has genuinely not happened yet reads as "not yet"
                rather than as a hard zero, which would look like a measured
                result. */}
            {row.pending ? (
              <span className="an-pending">Not yet</span>
            ) : (
              <CountMoney value={row.value} currency={currency} />
            )}
          </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── the conversion spine ────────────────────────────────────────────────── */

/**
 * Captured → confirmed → became an opportunity → won, as connected columns whose
 * heights are proportional to the captured population. The ribbon between each
 * pair carries the conversion rate, so the drop-off is the visual subject rather
 * than four unrelated counts.
 */
function ConversionSpine({
  conversion,
}: {
  conversion: NonNullable<AnalyticsPayload['conversion']>;
}) {
  const steps = [
    {
      key: 'captured',
      label: 'Captured',
      value: conversion.captured,
      note: 'Conversations recorded on the floor',
    },
    {
      key: 'confirmed',
      label: 'Confirmed',
      value: conversion.confirmed,
      note: 'A salesperson verified the facts',
    },
    {
      key: 'opportunity',
      label: 'Became an opportunity',
      value: conversion.leadsWithOpportunity,
      // An opportunity can be raised without a captured lead behind it, and
      // those cannot appear in a lead funnel. Say so rather than letting the
      // step look wrong next to the stage counts further down.
      note:
        conversion.attributedOpportunities > conversion.leadsWithOpportunity
          ? `Distinct leads with an attributed opportunity. ${count(conversion.attributedOpportunities - conversion.leadsWithOpportunity)} of ${count(conversion.attributedOpportunities)} opportunities are not linked to a captured lead`
          : 'Distinct leads with an attributed opportunity',
    },
    {
      key: 'won',
      label: 'Won',
      value: conversion.wonOpportunities,
      note: 'Attributed opportunities closed won',
    },
  ];
  const max = Math.max(steps[0].value, 1);
  return (
    <ol className="an-spine">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1] : null;
        const rate = previous && previous.value > 0
          ? (step.value / previous.value) * 100
          : null;
        const ratio = step.value / max;
        return (
          <li className="an-spine-step" key={step.key}>
            {previous ? (
              <span className="an-spine-link" aria-hidden="true">
                <b>{rate == null ? '—' : `${rate.toFixed(0)}%`}</b>
              </span>
            ) : null}
            <div className="an-spine-body">
              <span className="an-spine-bar" aria-hidden="true">
                <i style={fill(Math.max(ratio, 0.012))} />
              </span>
              <strong>
                <CountNumber value={step.value} />
              </strong>
              <span className="an-spine-label">{step.label}</span>
              <small>
                {step.note}
                {rate != null
                  ? ` · ${rate.toFixed(0)}% of ${previous?.label.toLowerCase()}`
                  : ''}
              </small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── pipeline stage bands ────────────────────────────────────────────────── */

const STAGE_LABELS: Record<string, string> = {
  qualified: 'Qualified',
  requirement: 'Requirement',
  sample: 'Sample',
  rfq: 'RFQ',
  quotation: 'Quotation',
  meeting: 'Meeting',
  negotiation: 'Negotiation',
  won: 'Won',
  lost: 'Lost',
};

/**
 * The open pipeline as one continuous band rather than a stack of bars.
 *
 * Each stage's width is its share of open opportunity value and its height is
 * the average probability at that stage, so the filled area of a stage is
 * literally its probability-weighted value. The pale block behind it, drawn at
 * full height, is the same money unweighted — the gap between the two is the
 * discount probability applies. Reading left to right also walks the pipeline
 * in stage order, which a set of independent bars cannot express.
 */
function PipelineFlow({
  stages,
  closed,
  currency,
  onOpenStage,
}: {
  stages: AnalyticsPayload['pipelineStages'];
  closed: AnalyticsPayload['closedStages'];
  currency: string;
  onOpenStage: (stage: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const present = stages.filter((item) => item.count > 0);
  const totalValue = present.reduce((total, item) => total + item.value, 0);
  const closedCount = closed.reduce((total, item) => total + item.count, 0);
  const closedValue = closed.reduce((total, item) => total + item.value, 0);
  const hovered = present.find((item) => item.stage === active) || null;

  if (!present.length) return null;

  // Every stage keeps a readable minimum width even when its value is tiny, so
  // a small stage never becomes an unclickable sliver.
  const MIN_SHARE = 0.055;
  const raw = present.map((item) =>
    totalValue > 0 ? item.value / totalValue : 1 / present.length,
  );
  const lifted = raw.map((value) => Math.max(value, MIN_SHARE));
  const liftedTotal = lifted.reduce((total, value) => total + value, 0);
  const widths = lifted.map((value) => value / liftedTotal);

  return (
    <div className="an-flow">
      <div
        className="an-flow-track"
        onMouseLeave={() => setActive(null)}
        style={{ '--stages': present.length } as React.CSSProperties}
      >
        {present.map((item, index) => {
          const probability = Math.max(
            0.06,
            Math.min(1, (item.averageProbability ?? 0) / 100),
          );
          return (
            <button
              type="button"
              key={item.stage}
              className={`an-flow-stage${active === item.stage ? ' is-active' : ''}${active && active !== item.stage ? ' is-dimmed' : ''}`}
              style={
                {
                  '--w': widths[index],
                  '--p': probability,
                } as React.CSSProperties
              }
              onMouseEnter={() => setActive(item.stage)}
              onFocus={() => setActive(item.stage)}
              onBlur={() => setActive(null)}
              onClick={() => onOpenStage(item.stage)}
              aria-label={`${STAGE_LABELS[item.stage] || item.stage}: ${count(item.count)} opportunities, ${money(item.value, currency)} of value, ${money(item.weightedValue, currency)} probability-weighted at ${item.averageProbability?.toFixed(0) ?? 0}% average probability. Opens the opportunity list filtered to this stage.`}
            >
              <span className="an-flow-col">
                <i className="an-flow-raw" />
                <i className="an-flow-weighted" />
              </span>
              <span className="an-flow-label">
                <b>{STAGE_LABELS[item.stage] || titleCase(item.stage)}</b>
                <small>{compactMoney(item.value, currency)}</small>
              </span>
            </button>
          );
        })}
      </div>

      {/* One readout under the band rather than a repeated caption per stage. */}
      <div className="an-flow-readout" aria-live="polite">
        {hovered ? (
          <>
            <b>{STAGE_LABELS[hovered.stage] || titleCase(hovered.stage)}</b>
            <span>
              {count(hovered.count)}{' '}
              {hovered.count === 1 ? 'opportunity' : 'opportunities'}
            </span>
            <span>{money(hovered.value, currency)} of value</span>
            <span>
              {money(hovered.weightedValue, currency)} weighted at{' '}
              {hovered.averageProbability?.toFixed(0) ?? 0}% average probability
            </span>
            <span className="an-flow-share">
              {share(hovered.value, totalValue)} of open pipeline
            </span>
          </>
        ) : (
          <span className="an-flow-hint">
            Select a stage to open those opportunities.
          </span>
        )}
      </div>

      {/* Won and Lost are outcomes, not pipeline, so they sit apart and are
          described against each other rather than against open value. */}
      <div className="an-outcomes">
        {closed.map((item) => (
          <button
            type="button"
            key={item.stage}
            className={`an-outcome is-${item.stage}`}
            onClick={() => item.count && onOpenStage(item.stage)}
            disabled={!item.count}
            aria-label={`${STAGE_LABELS[item.stage]}: ${count(item.count)} opportunities worth ${money(item.value, currency)}`}
          >
            <span className="an-outcome-head">
              <i aria-hidden="true" />
              {STAGE_LABELS[item.stage]}
            </span>
            <strong>{compactMoney(item.value, currency)}</strong>
            <small>
              {closedCount
                ? `${count(item.count)} of ${count(closedCount)} closed · ${share(item.value, closedValue)} of closed value`
                : 'Nothing closed yet'}
            </small>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── lead quality ────────────────────────────────────────────────────────── */

const QUALIFICATION_ORDER = ['hot', 'warm', 'cold', 'unqualified'];
const QUALIFICATION_LABELS: Record<string, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
  unqualified: 'Unqualified',
};
const REVIEW_ORDER = ['confirmed', 'needs_review', 'erased'];
const REVIEW_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  needs_review: 'Awaiting review',
  erased: 'Data erased',
};

/**
 * Qualification against review status as a cross-tab rather than as two separate
 * distributions.
 *
 * Both are real lead attributes, and they are kept as distinct axes rather than
 * merged into one score — but crossing them answers something neither total can
 * on its own: how much of the hot pipeline a salesperson has not confirmed yet.
 * Cell shading carries magnitude and every cell also prints its count, so the
 * grid never depends on colour alone.
 */
function QualityMatrix({
  cells,
  total,
}: {
  cells: AnalyticsPayload['qualificationByReview'];
  total: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const lookup = new Map(
    cells.map((cell) => [
      `${cell.reviewStatus}::${cell.qualificationState}`,
      cell.count,
    ]),
  );
  const reviews = REVIEW_ORDER.filter((status) =>
    cells.some((cell) => cell.reviewStatus === status && cell.count > 0),
  );
  const qualifications = QUALIFICATION_ORDER.filter((state) =>
    cells.some((cell) => cell.qualificationState === state && cell.count > 0),
  );
  if (!reviews.length || !qualifications.length) return null;
  const peak = Math.max(...cells.map((cell) => cell.count), 1);
  const columnTotal = (state: string) =>
    cells
      .filter((cell) => cell.qualificationState === state)
      .reduce((sum, cell) => sum + cell.count, 0);
  const rowTotal = (status: string) =>
    cells
      .filter((cell) => cell.reviewStatus === status)
      .reduce((sum, cell) => sum + cell.count, 0);
  const hovered = active ? lookup.get(active) ?? 0 : null;
  const [hoveredReview, hoveredState] = active ? active.split('::') : [];

  return (
    <div className="an-matrix">
      <div
        className="an-matrix-grid"
        style={{ '--cols': qualifications.length } as React.CSSProperties}
        onMouseLeave={() => setActive(null)}
      >
        <span className="an-matrix-corner" aria-hidden="true" />
        {qualifications.map((state) => (
          <span className="an-matrix-col-head" key={state}>
            {QUALIFICATION_LABELS[state] || titleCase(state)}
            <b>{count(columnTotal(state))}</b>
          </span>
        ))}
        {reviews.map((status) => (
          <Fragment key={status}>
            <span className="an-matrix-row-head">
              {REVIEW_LABELS[status] || titleCase(status)}
              <b>{count(rowTotal(status))}</b>
            </span>
            {qualifications.map((state) => {
              const key = `${status}::${state}`;
              const value = lookup.get(key) ?? 0;
              const weight = value / peak;
              return (
                <span
                  className={`an-matrix-cell${active === key ? ' is-active' : ''}${value ? '' : ' is-empty'}`}
                  key={key}
                  style={{ '--weight': weight } as React.CSSProperties}
                  onMouseEnter={() => setActive(key)}
                  title={`${REVIEW_LABELS[status] || status} · ${QUALIFICATION_LABELS[state] || state}: ${count(value)} leads (${share(value, total)})`}
                >
                  {count(value)}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
      <p className="an-matrix-readout" aria-live="polite">
        {hovered != null ? (
          <>
            <b>{count(hovered)}</b>
            <span>
              {(QUALIFICATION_LABELS[hoveredState] || hoveredState).toLowerCase()}{' '}
              {hovered === 1 ? 'lead is' : 'leads are'}{' '}
              {(REVIEW_LABELS[hoveredReview] || hoveredReview).toLowerCase()} ·{' '}
              {share(hovered, total)} of this scope
            </span>
          </>
        ) : (
          <span className="an-flow-hint">
            {count(total)} leads by qualification and review state
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * A qualification mix reads better as one continuous strip than as a pie: the
 * segments share a baseline so relative size is judged by length, not angle, and
 * every segment is also written out below as text — so the meaning never depends
 * on colour alone.
 */
function DensityStrip({
  title,
  note,
  segments,
  total,
}: {
  title: string;
  note?: string;
  segments: Array<{ key: string; label: string; value: number; tone: string }>;
  total: number;
}) {
  if (!total) return null;
  const present = segments.filter((item) => item.value > 0);
  // Segments are laid out by transform, not by flex sizing, so a data change
  // slides and rescales the existing strip instead of reflowing it.
  const placed = present.reduce<
    Array<(typeof present)[number] & { start: number; ratio: number }>
  >((all, item) => {
    const previous = all[all.length - 1];
    const start = previous ? previous.start + previous.ratio : 0;
    all.push({ ...item, start, ratio: item.value / total });
    return all;
  }, []);
  return (
    <div className="an-strip">
      <div className="an-strip-head">
        <h3>{title}</h3>
        {note ? <small>{note}</small> : null}
      </div>
      <div className="an-strip-track" aria-hidden="true">
        {placed.map((item) => (
          <span
            className={`an-strip-seg an-seg-${item.tone}`}
            key={item.key}
            style={
              { ...fill(item.ratio), '--offset': item.start } as React.CSSProperties
            }
            title={`${item.label}: ${count(item.value)} (${share(item.value, total)})`}
          />
        ))}
      </div>
      <ul className="an-strip-legend">
        {present.map((item) => (
          <li key={item.key}>
            <i className={`an-seg-${item.tone}`} aria-hidden="true" />
            <span>{item.label}</span>
            <b>{count(item.value)}</b>
            <small>{share(item.value, total)}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── capture momentum ────────────────────────────────────────────────────── */

/**
 * Daily capture volume for the events in scope. Only the days the workspace
 * actually recorded a capture are plotted; no interpolation and no zero-filling
 * across gaps between separate events.
 */
function CaptureTimeline({
  timeline,
  target,
}: {
  timeline: AnalyticsPayload['leadTimeline'];
  target: number | null;
}) {
  const [active, setActive] = useState<number | null>(null);
  const width = 1000;
  const height = 220;
  const padding = { top: 18, right: 8, bottom: 26, left: 8 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const peak = Math.max(
    ...timeline.map((point) => point.captured),
    target || 0,
    1,
  );
  const stepX =
    timeline.length > 1 ? plotWidth / (timeline.length - 1) : plotWidth;
  const pointAt = (index: number, value: number) => ({
    x: padding.left + (timeline.length > 1 ? index * stepX : plotWidth / 2),
    y: padding.top + plotHeight - (value / peak) * plotHeight,
  });
  const line = (key: 'captured' | 'confirmed') =>
    timeline
      .map((point, index) => {
        const { x, y } = pointAt(index, point[key]);
        return `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  const area = `${line('captured')} L${(padding.left + (timeline.length > 1 ? (timeline.length - 1) * stepX : plotWidth / 2)).toFixed(1)} ${(padding.top + plotHeight).toFixed(1)} L${padding.left} ${(padding.top + plotHeight).toFixed(1)} Z`;
  const targetY = target
    ? padding.top + plotHeight - (target / peak) * plotHeight
    : null;
  const activePoint = active == null ? null : timeline[active];
  const drawKey = `${timeline.length}-${timeline[0]?.day}-${timeline[timeline.length - 1]?.day}`;
  return (
    <div className="an-timeline">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="an-capture-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-500)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--brand-500)" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((fraction) => (
          <line
            key={fraction}
            className="an-grid"
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight - fraction * plotHeight}
            y2={padding.top + plotHeight - fraction * plotHeight}
          />
        ))}
        {targetY != null ? (
          <line
            className="an-timeline-target"
            x1={padding.left}
            x2={width - padding.right}
            y1={targetY}
            y2={targetY}
          />
        ) : null}
        {/* Keying on the series itself restarts the stroke-dash draw whenever
            the scope changes, so the line redraws rather than jumping. The
            point count differs between scopes, so interpolating one path into
            the other would have to invent geometry. */}
        <path
          className="an-timeline-area"
          key={`area-${drawKey}`}
          d={area}
          fill="url(#an-capture-fill)"
        />
        <path
          className="an-timeline-line"
          key={`captured-${drawKey}`}
          d={line('captured')}
        />
        <path
          className="an-timeline-line an-timeline-confirmed"
          key={`confirmed-${drawKey}`}
          d={line('confirmed')}
        />
        {active != null
          ? (() => {
              const spot = pointAt(active, timeline[active].captured);
              return (
                <g>
                  <line
                    className="an-timeline-cursor"
                    x1={spot.x}
                    x2={spot.x}
                    y1={padding.top}
                    y2={padding.top + plotHeight}
                  />
                  <circle
                    className="an-timeline-dot"
                    cx={spot.x}
                    cy={spot.y}
                    r="5"
                  />
                </g>
              );
            })()
          : null}
      </svg>
      {/* Hit targets are real buttons layered over the drawing, so the same
          per-day readout is reachable by keyboard as well as by pointer. */}
      <div className="an-timeline-hits" onMouseLeave={() => setActive(null)}>
        {timeline.map((point, index) => (
          <button
            type="button"
            key={point.day}
            className={active === index ? 'is-active' : ''}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
            aria-label={`${shortDate(point.day)}: ${count(point.captured)} captured, ${count(point.confirmed)} confirmed`}
          />
        ))}
      </div>
      <div className="an-timeline-axis" aria-hidden="true">
        <span>{shortDate(timeline[0].day)}</span>
        {timeline.length > 2 ? (
          <span>{shortDate(timeline[Math.floor(timeline.length / 2)].day)}</span>
        ) : null}
        <span>{shortDate(timeline[timeline.length - 1].day)}</span>
      </div>
      <p className="an-timeline-readout" aria-live="polite">
        {activePoint ? (
          <>
            <b>{shortDate(activePoint.day)}</b>
            <span>
              {count(activePoint.captured)} captured ·{' '}
              {count(activePoint.confirmed)} confirmed
              {activePoint.captured
                ? ` · ${share(activePoint.confirmed, activePoint.captured)} of that day confirmed`
                : ''}
              {target ? ` · daily target ${count(target)}` : ''}
            </span>
          </>
        ) : (
          <span className="an-timeline-hint">
            {count(timeline.length)} days with recorded captures · peak{' '}
            {count(Math.max(...timeline.map((point) => point.captured)))} in one
            day
            {target ? ` · daily target ${count(target)}` : ''}
          </span>
        )}
      </p>
    </div>
  );
}

/* ── commercial lifecycles ───────────────────────────────────────────────── */

/**
 * RFQs as a stepped process track.
 *
 * An RFQ carries no money of its own, so the only honest quantity is how many
 * sit at each step. The track reads left to right as the request actually
 * travels, each step is a chevron whose fill level is its share of the busiest
 * step, and the two terminal outcomes branch off the end instead of pretending
 * to be a sixth and seventh stage of the same queue.
 */
function RfqTrack({
  progression,
  terminal,
  rows,
  total,
  quoted,
}: {
  progression: string[];
  terminal: string[];
  rows: Record<string, { total: number; flag?: number }>;
  total: number;
  quoted: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const peak = Math.max(
    ...progression.map((key) => rows[key]?.total || 0),
    ...terminal.map((key) => rows[key]?.total || 0),
    1,
  );
  const open = progression.reduce(
    (sum, key) => sum + (rows[key]?.total || 0),
    0,
  );
  const overdue = progression.reduce(
    (sum, key) => sum + (rows[key]?.flag || 0),
    0,
  );
  const hovered = active ? rows[active] : null;
  return (
    <div className="an-track">
      <div className="an-track-head">
        <h3>RFQ lifecycle</h3>
      </div>
      <div className="an-track-steps" onMouseLeave={() => setActive(null)}>
        {progression.map((key) => {
          const row = rows[key] || { total: 0 };
          return (
            <div
              className={`an-track-step${row.total ? '' : ' is-empty'}${active === key ? ' is-active' : ''}`}
              key={key}
              style={
                { '--level': (row.total || 0) / peak } as React.CSSProperties
              }
              onMouseEnter={() => setActive(key)}
            >
              <span className="an-track-fill" aria-hidden="true" />
              <b>{count(row.total || 0)}</b>
              <small>{titleCase(key)}</small>
              {row.flag ? <em title={`${row.flag} past due`} /> : null}
            </div>
          );
        })}
      </div>
      <div className="an-track-outcomes">
        {terminal.map((key) => {
          const row = rows[key] || { total: 0 };
          return (
            <span className={`an-track-outcome is-${key}`} key={key}>
              <i aria-hidden="true" />
              {titleCase(key)}
              <b>{count(row.total || 0)}</b>
            </span>
          );
        })}
      </div>
      <p className="an-track-readout" aria-live="polite">
        {hovered ? (
          <>
            <b>{count(hovered.total)}</b>
            <span>
              {hovered.total === 1 ? 'RFQ is' : 'RFQs are'} at{' '}
              {titleCase(active || '').toLowerCase()}
              {hovered.flag ? ` · ${count(hovered.flag)} past its due date` : ''}
            </span>
          </>
        ) : (
          <span className="an-flow-hint">
            {count(open)} of {count(total)} still open ·{' '}
            {count(quoted)} have a quotation raised
            {overdue ? ` · ${count(overdue)} past due` : ''}
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * Quotations as a value ledger rather than a second process track.
 *
 * A quotation does carry money, so each status is sized by the value sitting in
 * it, stacked into one column that totals the quoted book. Rejected and expired
 * value is drawn separately below the line — it left the book rather than
 * progressing through it, and stacking it with the live states would overstate
 * what is still in play.
 */
function QuotationLedger({
  progression,
  terminal,
  rows,
  currency,
}: {
  progression: string[];
  terminal: string[];
  rows: Record<string, { total: number; value?: number; flag?: number }>;
  currency: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const live = progression.filter((key) => (rows[key]?.total || 0) > 0);
  const lost = terminal.filter((key) => (rows[key]?.total || 0) > 0);
  const liveValue = live.reduce((sum, key) => sum + (rows[key]?.value || 0), 0);
  const lostValue = lost.reduce((sum, key) => sum + (rows[key]?.value || 0), 0);
  const scale = Math.max(liveValue, lostValue, 1);
  const hovered = active ? rows[active] : null;
  const accepted = rows.accepted?.value || 0;
  const block = (key: string, isTerminal: boolean) => {
    const row = rows[key] || { total: 0, value: 0 };
    return (
      <div
        className={`an-ledger-block${isTerminal ? ' is-terminal' : ''}${active === key ? ' is-active' : ''}`}
        key={key}
        style={{ '--h': (row.value || 0) / scale } as React.CSSProperties}
        onMouseEnter={() => setActive(key)}
        title={`${titleCase(key)}: ${count(row.total)} quotations worth ${money(row.value || 0, currency)}`}
      >
        <span className="an-ledger-bar" aria-hidden="true" />
        <span className="an-ledger-meta">
          <b>{titleCase(key)}</b>
          <small>
            {count(row.total)} · {compactMoney(row.value || 0, currency)}
          </small>
        </span>
      </div>
    );
  };
  return (
    <div className="an-quotes">
      <div className="an-track-head">
        <h3>Quotation lifecycle</h3>
        {/* Short, but the distinction matters: these are not RFQ stages. */}
        <small>Separate from the RFQ stages</small>
      </div>
      <div className="an-quote-stack" onMouseLeave={() => setActive(null)}>
        <div className="an-quote-column">
          <span className="an-quote-caption">In play</span>
          {live.length ? (
            live.map((key) => block(key, false))
          ) : (
            <p className="an-quote-none">No live quotations</p>
          )}
        </div>
        {lost.length ? (
          <div className="an-quote-column is-lost">
            <span className="an-quote-caption">Left the book</span>
            {lost.map((key) => block(key, true))}
          </div>
        ) : null}
      </div>
      <p className="an-track-readout" aria-live="polite">
        {hovered ? (
          <>
            <b>{money(hovered.value || 0, currency)}</b>
            <span>
              across {count(hovered.total)}{' '}
              {hovered.total === 1 ? 'quotation' : 'quotations'}{' '}
              {titleCase(active || '').toLowerCase()}
              {hovered.flag
                ? ` · ${count(hovered.flag)} past its validity date`
                : ''}
            </span>
          </>
        ) : (
          <span className="an-flow-hint">
            {money(liveValue, currency)} still in play ·{' '}
            {money(accepted, currency)} accepted
            {lostValue ? ` · ${money(lostValue, currency)} rejected or expired` : ''}
          </span>
        )}
      </p>
    </div>
  );
}

/* ── cost composition ────────────────────────────────────────────────────── */

function CostComposition({
  report,
  categories,
  costs,
  currency,
}: {
  report: AnalyticsReport;
  categories: AnalyticsPayload['costCategories'];
  costs: AnalyticsCost[];
  currency: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(
    ...categories.map((item) => item.planned + item.actual),
    1,
  );
  const lines = open
    ? costs.filter((cost) => cost.category === open && cost.status !== 'void')
    : [];
  return (
    <div className="an-costs">
      <dl className="an-cost-basis">
        <div>
          <dt>Planned event budget</dt>
          <dd>{money(report.plannedInvestment, currency)}</dd>
        </div>
        <div>
          <dt>Planned cost lines</dt>
          <dd>{money(report.plannedCostLines, currency)}</dd>
        </div>
        <div>
          <dt>Actual cost lines</dt>
          <dd>{money(report.actualInvestment, currency)}</dd>
        </div>
        {/* Why this number is the one ROI divides by lives on the row itself,
            rather than as a sentence underneath the whole table. */}
        <div
          className="is-basis"
          title="The highest of the three, so a partial set of invoices cannot overstate ROI."
        >
          <dt>
            Investment basis
            <small>
              {report.investmentBasisSource === 'actual_cost_lines'
                ? 'Actual cost lines'
                : report.investmentBasisSource === 'planned_cost_lines'
                  ? 'Planned cost lines'
                  : 'Planned event budget'}
            </small>
          </dt>
          <dd>{money(report.investmentBasis, currency)}</dd>
        </div>
      </dl>
      {categories.length ? (
        <>
          <ul className="an-cost-list">
            {categories.map((item) => {
              const total = item.planned + item.actual;
              const isOpen = open === item.category;
              return (
                <li key={item.category}>
                  <button
                    type="button"
                    className={`an-cost-row${isOpen ? ' is-open' : ''}`}
                    onClick={() => setOpen(isOpen ? null : item.category)}
                    aria-expanded={isOpen}
                    aria-label={`${titleCase(item.category)}: ${money(item.actual, currency)} actual, ${money(item.planned, currency)} planned across ${count(item.lines)} cost lines`}
                  >
                    <span className="an-cost-name">
                      {titleCase(item.category)}
                      <small>
                        {count(item.lines)}{' '}
                        {item.lines === 1 ? 'line' : 'lines'}
                      </small>
                    </span>
                    <span className="an-cost-track">
                      <i
                        className="an-cost-actual"
                        style={fill(item.actual / max)}
                      />
                      <i
                        className="an-cost-planned"
                        style={
                          {
                            ...fill(item.planned / max),
                            '--offset': item.actual / max,
                          } as React.CSSProperties
                        }
                      />
                    </span>
                    <span className="an-cost-amount">
                      {compactMoney(total, currency)}
                    </span>
                  </button>
                  {isOpen ? (
                    <ul className="an-cost-lines">
                      {lines.length ? (
                        lines.map((cost) => (
                          <li key={cost.id}>
                            <span>
                              <b>{cost.description}</b>
                              <small>
                                {cost.status}
                                {cost.vendor ? ` · ${cost.vendor}` : ''}
                                {cost.incurredOn ? ` · ${cost.incurredOn}` : ''}
                              </small>
                            </span>
                            <b>{money(cost.amount, currency)}</b>
                          </li>
                        ))
                      ) : (
                        <li className="an-cost-none">
                          No cost lines in this category for the selected scope.
                        </li>
                      )}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <p className="an-bands-key">
            <span className="an-key an-key-actual" /> Actual
            <span className="an-key an-key-planned" /> Planned
          </p>
        </>
      ) : (
        <Unavailable>
          No cost lines recorded for this scope. The investment basis falls back
          to the planned event budget.
        </Unavailable>
      )}
    </div>
  );
}

/* ── revenue evidence ────────────────────────────────────────────────────── */

function RevenueEvidence({
  report,
  currency,
}: {
  report: AnalyticsReport;
  currency: string;
}) {
  const reconciliation = report.reconciliation;
  const needsReview =
    reconciliation.wonWithoutAcceptedQuotation +
    reconciliation.acceptedQuotationWithoutWonOpportunity;
  // "Everything reconciles" is only meaningful once there is something to
  // reconcile; with no wins and no accepted quotations it is vacuously true.
  const nothingToReconcile =
    !needsReview &&
    !report.wonOpportunities &&
    !reconciliation.acceptedQuotationValue;
  // Four labelled figures rather than four paragraphs. The reasoning behind
  // each one is real and worth keeping, so it moves to the row's tooltip
  // instead of being printed under every line.
  const rows = [
    {
      key: 'documented',
      label: 'Accepted quotation value',
      value: reconciliation.acceptedQuotationValue
        ? money(reconciliation.acceptedQuotationValue, currency)
        : null,
      empty: 'None yet',
      tone: 'plain',
      help: 'Closed revenue is counted from won opportunities, so this is independent evidence of the same outcome.',
    },
    {
      key: 'won-unquoted',
      label: 'Won without an accepted quotation',
      value: nothingToReconcile
        ? null
        : count(reconciliation.wonWithoutAcceptedQuotation),
      empty: 'Nothing to reconcile',
      tone: reconciliation.wonWithoutAcceptedQuotation ? 'flag' : 'plain',
      help: 'Opportunities marked won that have no accepted quotation linked to them.',
    },
    {
      key: 'quoted-unwon',
      label: 'Accepted quotation without a win',
      value: nothingToReconcile
        ? null
        : count(reconciliation.acceptedQuotationWithoutWonOpportunity),
      empty: 'Nothing to reconcile',
      tone: reconciliation.acceptedQuotationWithoutWonOpportunity
        ? 'flag'
        : 'plain',
      help: 'Quotations the customer accepted that are not linked to a won opportunity.',
    },
    {
      key: 'excluded',
      label: 'Outside the attribution window',
      value: count(reconciliation.excludedOutsideAttributionWindow),
      empty: '',
      tone: 'plain',
      help:
        report.attributionWindowDays != null
          ? `Every opportunity is attributed to the event it originated at, within ${count(report.attributionWindowDays)} days of that event ending. These fall outside and are excluded from every figure above.`
          : 'Every opportunity is attributed to the event it originated at, within that event’s own attribution window. These fall outside and are excluded from every figure above.',
    },
  ];
  return (
    <dl className="an-evidence">
      {rows.map((row) => (
        <div key={row.key} title={row.help}>
          <dt>{row.label}</dt>
          <dd className={row.value == null ? 'an-pending' : `is-${row.tone}`}>
            {row.value ?? row.empty}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* ── event comparison ────────────────────────────────────────────────────── */

/**
 * A comparative matrix: one row per event, one column per measure, each cell
 * carrying a readable figure over a hairline bar scaled against the strongest
 * event in that column. The bars make the column scannable at a glance while
 * the numbers stay at full size, which the previous compressed row of micro
 * captions did not manage. No event is ranked or crowned.
 */
function EventMatrix({
  events,
  currency,
  onScopeChange,
}: {
  events: AnalyticsEvent[];
  currency: string;
  onScopeChange: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const peak = (pick: (event: AnalyticsEvent) => number) =>
    Math.max(...events.map(pick), 1);
  const peaks = {
    leads: peak((event) => event.totalLeads),
    pipeline: peak((event) => event.pipelineValue),
    revenue: peak((event) => event.closedRevenue),
    investment: peak((event) => event.investmentBasis),
  };
  const columns: Array<{
    key: string;
    label: string;
    tone: string;
    read: (event: AnalyticsEvent) => {
      main: string;
      sub: string;
      ratio: number;
    };
  }> = [
    {
      key: 'leads',
      label: 'Leads captured',
      tone: 'quiet',
      read: (event) => ({
        main: count(event.totalLeads),
        sub: `${count(event.qualifiedLeads)} confirmed · ${share(event.qualifiedLeads, event.totalLeads)}`,
        ratio: event.totalLeads / peaks.leads,
      }),
    },
    {
      key: 'pipeline',
      label: 'Open pipeline',
      tone: 'mid',
      read: (event) => ({
        main: compactMoney(event.pipelineValue, currency),
        sub: `${compactMoney(event.weightedPipelineValue, currency)} weighted`,
        ratio: event.pipelineValue / peaks.pipeline,
      }),
    },
    {
      key: 'revenue',
      label: 'Closed revenue',
      tone: 'signal',
      read: (event) => ({
        main: compactMoney(event.closedRevenue, currency),
        sub: `${count(event.wonOpportunities)} won`,
        ratio: event.closedRevenue / peaks.revenue,
      }),
    },
    {
      key: 'investment',
      label: 'Investment',
      tone: 'cost',
      read: (event) => ({
        main: compactMoney(event.investmentBasis, currency),
        sub:
          event.investmentBasisSource === 'actual_cost_lines'
            ? 'Actual costs'
            : event.investmentBasisSource === 'planned_cost_lines'
              ? 'Planned costs'
              : 'Event budget',
        ratio: event.investmentBasis / peaks.investment,
      }),
    },
  ];
  return (
    <div className="an-matrix-events" onMouseLeave={() => setHovered(null)}>
      <div className="an-em-head" aria-hidden="true">
        <span>Event</span>
        {columns.map((column) => (
          <span key={column.key}>{column.label}</span>
        ))}
        <span className="an-em-roi-head">Revenue ROI</span>
      </div>
      {events.map((event) => (
        <button
          type="button"
          className={`an-em-row${hovered && hovered !== event.id ? ' is-dimmed' : ''}`}
          key={event.id}
          onMouseEnter={() => setHovered(event.id)}
          onFocus={() => setHovered(event.id)}
          onBlur={() => setHovered(null)}
          onClick={() => onScopeChange(event.id)}
          aria-label={`${event.name}: ${count(event.totalLeads)} leads, ${money(event.pipelineValue, currency)} open pipeline, ${money(event.closedRevenue, currency)} closed revenue, ${money(event.investmentBasis, currency)} invested, ${event.revenueRoiPercent == null ? 'revenue ROI unavailable' : `${percent(event.revenueRoiPercent)} revenue ROI`}. Scopes analytics to this event.`}
        >
          <span className="an-em-name">
            <b>{event.name}</b>
            <small>
              {dateRange(event.startsOn, event.endsOn)} ·{' '}
              {titleCase(event.status)}
            </small>
          </span>
          {columns.map((column) => {
            const cell = column.read(event);
            return (
              <span
                className="an-em-cell"
                key={column.key}
                data-label={column.label}
              >
                <b>{cell.main}</b>
                <i
                  className={`an-tone-${column.tone}`}
                  style={fill(cell.ratio)}
                  aria-hidden="true"
                />
                <small>{cell.sub}</small>
              </span>
            );
          })}
          <span className="an-em-roi">
            <b
              className={
                event.revenueRoiPercent == null
                  ? ''
                  : event.revenueRoiPercent < 0
                    ? 'is-negative'
                    : 'is-positive'
              }
            >
              {event.revenueRoiPercent == null
                ? 'n/a'
                : percent(event.revenueRoiPercent, 0)}
            </b>
            <small>
              {event.profitRoiPercent == null
                ? 'profit n/a'
                : `${percent(event.profitRoiPercent, 0)} profit`}
            </small>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── export menu ─────────────────────────────────────────────────────────── */

const EXPORTS = [
  { kind: 'summary', label: 'Summary figures' },
  { kind: 'leads', label: 'Leads' },
  { kind: 'opportunities', label: 'Opportunities' },
  { kind: 'costs', label: 'Cost lines' },
  { kind: 'actions', label: 'Next best actions' },
];

function ExportMenu({ onExport }: { onExport: (kind: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div className="an-export" ref={ref}>
      <button
        type="button"
        className="an-export-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Download aria-hidden="true" /> Export
      </button>
      {open ? (
        <div className="an-export-menu" role="menu">
          <p>CSV for the current scope</p>
          {EXPORTS.map((item) => (
            <button
              type="button"
              role="menuitem"
              key={item.kind}
              onClick={() => {
                setOpen(false);
                onExport(item.kind);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── chapter navigator ───────────────────────────────────────────────────── */

/**
 * A slim rail pinned beside the content. The page runs several screens, so this
 * exists to answer "where am I and what else is there" without adding a second
 * navigation bar: labels are small, the current chapter is marked from the
 * scroll position, and a chapter that has no data is simply not listed.
 */
function ChapterRail({
  chapters,
  note,
}: {
  chapters: Array<{ id: string; label: string }>;
  note?: string;
}) {
  const [current, setCurrent] = useState(chapters[0]?.id || '');
  useEffect(() => {
    const nodes = chapters
      .map((chapter) => document.getElementById(chapter.id))
      .filter((node): node is HTMLElement => Boolean(node));
    if (!nodes.length) return;
    // The app scrolls inside a container rather than the document, which makes
    // an IntersectionObserver root fiddly to get right. Measuring viewport
    // position directly is deterministic: the current chapter is the last one
    // whose heading has passed a line near the top of the screen.
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.28;
      let found = nodes[0].id;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top <= line) found = node.id;
        else break;
      }
      setCurrent(found);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // Scroll events do not bubble, and this page scrolls inside a container, so
    // the listener goes on every scrollable ancestor rather than only window.
    const targets: Array<EventTarget> = [window];
    for (
      let node: HTMLElement | null = nodes[0].parentElement;
      node;
      node = node.parentElement
    ) {
      const style = window.getComputedStyle(node);
      if (
        /auto|scroll|overlay/.test(style.overflowY + style.overflow) &&
        node.scrollHeight > node.clientHeight + 4
      )
        targets.push(node);
    }
    measure();
    for (const target of targets)
      target.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      for (const target of targets)
        target.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [chapters]);
  if (chapters.length < 3) return null;
  return (
    <nav className="an-rail-nav" aria-label="Analytics chapters">
      {chapters.map((chapter) => (
        <button
          type="button"
          key={chapter.id}
          className={current === chapter.id ? 'is-current' : ''}
          aria-current={current === chapter.id ? 'true' : undefined}
          onClick={() =>
            document.getElementById(chapter.id)?.scrollIntoView({
              behavior: prefersReducedMotion() ? 'auto' : 'smooth',
              block: 'start',
            })
          }
        >
          <i aria-hidden="true" />
          <span>{chapter.label}</span>
        </button>
      ))}
      {/* Exclusions stay stated, but in the strip's spare space rather than
          as another line of text above the headline figure. */}
      {note ? <span className="an-rail-note">{note}</span> : null}
    </nav>
  );
}

/* ── skeleton ────────────────────────────────────────────────────────────── */

function Skeleton() {
  return (
    <div className="an-skeleton" aria-hidden="true">
      <div className="an-sk an-sk-hero" />
      <div className="an-sk an-sk-wide" />
      <div className="an-sk-row">
        <div className="an-sk an-sk-tall" />
        <div className="an-sk an-sk-tall an-sk-narrow" />
      </div>
      <div className="an-sk an-sk-wide" />
    </div>
  );
}

/* ── the page ────────────────────────────────────────────────────────────── */

export default function Analytics({
  report,
  analytics,
  scopeEvents,
  costs,
  actions,
  currency,
  scopeEventId,
  onScopeChange,
  loading,
  failed,
  onRetry,
  canExport,
  onExport,
  onOpenStage,
  onOpenAction,
  costEntry,
}: Props) {
  const rootRef = useEnterFlag();
  const [now, setNow] = useState(() => Date.now());
  const [actionsExpanded, setActionsExpanded] = useState(false);
  const [ownersExpanded, setOwnersExpanded] = useState(false);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectable = useMemo(
    () => scopeEvents.filter((item) => item.status !== 'archived'),
    [scopeEvents],
  );
  const selected = selectable.find((item) => item.id === scopeEventId) || null;
  // Reporting deliberately excludes archived events. Saying so is better than
  // leaving someone to wonder why an old event's revenue is not counted.
  const archivedCount = scopeEvents.length - selectable.length;
  const archivedNote = archivedCount
    ? `${count(archivedCount)} archived ${archivedCount === 1 ? 'event' : 'events'} excluded`
    : undefined;

  const captureSegments = useMemo(
    () =>
      (analytics?.captureSources || []).map((item, index) => ({
        key: item.source,
        label: SOURCE_LABELS[item.source] || titleCase(item.source),
        value: item.total,
        tone: ['hot', 'mid', 'cold', 'none'][index % 4],
      })),
    [analytics],
  );

  const rfqRows = useMemo(() => {
    const rows: Record<string, { total: number; flag?: number }> = {};
    for (const item of analytics?.rfqStatuses || [])
      rows[item.status] = { total: item.total, flag: item.overdue };
    return rows;
  }, [analytics]);

  const quotationRows = useMemo(() => {
    const rows: Record<string, { total: number; value: number; flag?: number }> =
      {};
    for (const item of analytics?.quotationStatuses || [])
      rows[item.status] = {
        total: item.total,
        value: item.value,
        flag: item.pastValidity,
      };
    return rows;
  }, [analytics]);

  const handleScope = useCallback(
    (id: string) => {
      if (id !== scopeEventId) onScopeChange(id);
    },
    [scopeEventId, onScopeChange],
  );

  /* ---- gates: only render what the data can actually support ---- */
  const hasEvents = Boolean(analytics?.events.length);
  const conversion = analytics?.conversion || null;
  const hasLeads = (conversion?.captured || 0) > 0;
  const hasOpportunities = (conversion?.attributedOpportunities || 0) > 0;
  const hasWins = (report?.wonOpportunities || 0) > 0;
  const hasTimeline = (analytics?.leadTimeline.length || 0) >= 3;
  const hasRfqs = (analytics?.rfqTotal || 0) > 0;
  const hasQuotations = (analytics?.quotationStatuses.length || 0) > 0;
  const hasMeetings = (analytics?.meetingStatuses.length || 0) > 0;
  const comparable =
    !scopeEventId && (analytics?.events.length || 0) > 1
      ? analytics!.events
      : null;

  const scopeBar = (
    <header className="an-scope">
      <fieldset className="an-scope-events">
        <legend>Analytics scope</legend>
        <button
          type="button"
          className={`an-chip${scopeEventId ? '' : ' is-current'}`}
          aria-pressed={!scopeEventId}
          onClick={() => handleScope('')}
        >
          All events
          {selectable.length ? <b>{selectable.length}</b> : null}
        </button>
        {selectable.map((item) => (
          <button
            type="button"
            className={`an-chip${scopeEventId === item.id ? ' is-current' : ''}`}
            aria-pressed={scopeEventId === item.id}
            key={item.id}
            onClick={() => handleScope(item.id)}
            title={`${item.name} · ${titleCase(item.status)}`}
          >
            {/* A status dot rather than a word: five chips with spelled-out
                statuses wrapped onto a second line and made the header ragged. */}
            <i className={`an-chip-dot is-${item.status}`} aria-hidden="true" />
            <span>{item.name}</span>
            <em>{titleCase(item.status)}</em>
          </button>
        ))}
      </fieldset>
      {canExport ? <ExportMenu onExport={onExport} /> : null}
    </header>
  );

  if (failed) {
    return (
      <div className="an" ref={rootRef}>
        {scopeBar}
        <article className="panel empty-state large">
          <AlertTriangle />
          <h2>Could not load analytics</h2>
          <p>The request to the workspace failed.</p>
          <button type="button" className="an-primary" onClick={onRetry}>
            Retry
          </button>
        </article>
      </div>
    );
  }

  if (loading && !report) {
    return (
      <div className="an" ref={rootRef}>
        {scopeBar}
        <Skeleton />
      </div>
    );
  }

  if (!report || !hasEvents) {
    return (
      <div className="an" ref={rootRef}>
        {scopeBar}
        <article className="panel an-onboard">
          <p className="an-eyebrow">Analytics</p>
          <h2>Analytics begin with an event</h2>
          <p>
            Revenue OS attributes every lead, opportunity and cost to the event
            it came from. Create an event in Events, record its budget, and this
            page fills in as captures and opportunities arrive.
          </p>
        </article>
      </div>
    );
  }

  const scopeLabel = selected ? selected.name : 'all accessible events';
  const roiTone =
    report.revenueRoiPercent == null
      ? ''
      : report.revenueRoiPercent < 0
        ? ' is-negative'
        : ' is-positive';

  // Only chapters that actually rendered are offered for navigation.
  const chapters = [
    { id: 'an-revenue', label: 'Revenue', when: true },
    { id: 'an-funnel', label: 'Conversion', when: hasLeads && Boolean(conversion) },
    { id: 'an-pipeline', label: 'Pipeline', when: hasOpportunities && Boolean(analytics) },
    { id: 'an-quality', label: 'Lead quality', when: hasLeads && Boolean(analytics) },
    { id: 'an-momentum', label: 'Momentum', when: hasTimeline && Boolean(analytics) },
    { id: 'an-commercial', label: 'Commercial', when: hasRfqs || hasQuotations },
    { id: 'an-investment', label: 'Investment', when: true },
    { id: 'an-events', label: 'Events', when: Boolean(comparable) },
    {
      id: 'an-attention',
      label: 'Attention',
      when: actions.length > 0 || (analytics?.leadOwners.length || 0) > 1,
    },
  ]
    .filter((chapter) => chapter.when)
    .map(({ id, label }) => ({ id, label }));

  return (
    <div className="an" ref={rootRef}>
      {scopeBar}
      <ChapterRail chapters={chapters} note={archivedNote} />

      {/* ── the ledger ──────────────────────────────────────────────────── */}
      <section className="an-ledger" id="an-revenue">
        <div className="an-ledger-head">
          {/* The selected event is already named in the chips above; repeating
              it, its dates and the archived count here made a two-line label
              sit on top of the number it was labelling. */}
          <p className="an-eyebrow">
            {hasWins
              ? 'Closed revenue'
              : hasOpportunities
                ? 'Open pipeline'
                : 'Committed investment'}
          </p>
          {/* The headline is whichever figure this scope has actually reached.
              Leading with a zero revenue figure would make the emptiest number
              on the page the largest thing on it. */}
          <h1 className="an-headline">
            <CountMoney
              value={
                hasWins
                  ? report.closedRevenue
                  : hasOpportunities
                    ? report.pipelineValue
                    : report.investmentBasis
              }
              currency={currency}
            />
          </h1>
          {/* Figures rather than a paragraph: the same facts read faster as a
              row of labelled numbers than as a sentence to be parsed. */}
          {hasWins ? (
            <dl className="an-facts">
              <div>
                <dt>Won</dt>
                <dd>{count(report.wonOpportunities)}</dd>
              </div>
              <div>
                <dt>Invested</dt>
                <dd>{money(report.investmentBasis, currency)}</dd>
              </div>
              <div>
                <dt>Revenue ROI</dt>
                <dd className={`an-roi${roiTone}`}>
                  {report.revenueRoiPercent == null
                    ? 'n/a'
                    : percent(report.revenueRoiPercent, 0)}
                </dd>
              </div>
              <div>
                <dt>Profit ROI</dt>
                <dd
                  className={`an-roi${report.profitRoiPercent == null ? '' : report.profitRoiPercent < 0 ? ' is-negative' : ' is-positive'}`}
                >
                  {report.profitRoiPercent == null
                    ? 'n/a'
                    : percent(report.profitRoiPercent, 0)}
                </dd>
              </div>
            </dl>
          ) : hasOpportunities ? (
            <dl className="an-facts">
              <div>
                <dt>Open</dt>
                <dd>{count(report.openOpportunities)}</dd>
              </div>
              <div>
                <dt>Weighted</dt>
                <dd>{money(report.weightedPipelineValue, currency)}</dd>
              </div>
              <div>
                <dt>Invested</dt>
                <dd>{money(report.investmentBasis, currency)}</dd>
              </div>
              <div>
                <dt>Revenue ROI</dt>
                <dd className="an-pending">Nothing won yet</dd>
              </div>
            </dl>
          ) : (
            <p className="an-sentence">
              {report.totalLeads
                ? `${count(report.totalLeads)} captured, none converted to an opportunity yet.`
                : 'No conversations captured for this scope yet.'}
            </p>
          )}
        </div>
        {hasOpportunities || report.investmentBasis > 0 ? (
          <ValueLadder
            report={report}
            currency={currency}
          />
        ) : null}
      </section>

      {/* ── conversion spine ────────────────────────────────────────────── */}
      {hasLeads && conversion ? (
        <section className="an-block" id="an-funnel">
          <SectionHead
            eyebrow="Conversion"
            title="From the floor to the ledger"
            note={
              hasOpportunities
                ? undefined
                : 'Nothing has become an opportunity yet.'
            }
          />
          <div className="an-body">
            <ConversionSpine conversion={conversion} />
          </div>
        </section>
      ) : hasEvents ? (
        <section className="an-block">
          <SectionHead
            eyebrow="Capture"
            title="No conversations captured yet"
            note={`${money(report.investmentBasis, currency)} is committed to ${scopeLabel}. Lead analytics appear as soon as the first capture is saved.`}
          />
        </section>
      ) : null}

      {/* ── pipeline ────────────────────────────────────────────────────── */}
      {hasOpportunities && analytics ? (
        <section className="an-block" id="an-pipeline">
          {/* The encoding is explained once, in the chart's own readout. */}
          <SectionHead
            eyebrow="Pipeline"
            title="Where the value is sitting"
            note="Width = share of value. Height = probability."
          />
          <div className="an-body">
            <PipelineFlow
              stages={analytics.pipelineStages}
              closed={analytics.closedStages}
              currency={currency}
              onOpenStage={onOpenStage}
            />
          </div>
        </section>
      ) : null}

      {/* ── lead quality ────────────────────────────────────────────────── */}
      {hasLeads && analytics ? (
        <section className="an-block" id="an-quality">
          <SectionHead
            eyebrow="Lead quality"
            title="Who is in the pipeline"
            note={
              hasOpportunities
                ? undefined
                : 'Pipeline appears once a conversation becomes an opportunity.'
            }
          />
          <div className="an-body an-body-split">
            <QualityMatrix
              cells={analytics.qualificationByReview}
              total={analytics.coverage?.scopedLeads || 0}
            />
            <div className="an-quality-side">
              {captureSegments.length ? (
                <DensityStrip
                  title="How they were captured"
                  segments={captureSegments}
                  total={captureSegments.reduce(
                    (sum, item) => sum + item.value,
                    0,
                  )}
                />
              ) : null}
              {/* The same two facts, as figures rather than a sentence. */}
              {analytics.coverage ? (
                <dl className="an-coverage">
                  <div>
                    <dt>Hot leads with no commitment</dt>
                    <dd
                      className={
                        analytics.coverage.hotWithoutOpenTask ? 'is-flag' : ''
                      }
                    >
                      {count(analytics.coverage.hotWithoutOpenTask)}
                      <small>of {count(analytics.coverage.hotLeads)}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Leads with an open commitment</dt>
                    <dd>
                      {count(analytics.coverage.leadsWithOpenTask)}
                      <small>of {count(analytics.coverage.scopedLeads)}</small>
                    </dd>
                  </div>
                </dl>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── momentum ────────────────────────────────────────────────────── */}
      {hasTimeline && analytics ? (
        <section className="an-block" id="an-momentum">
          <SectionHead
            eyebrow="Momentum"
            title="Capture volume by day"
            note={
              selected ? "Dashed line is this event's daily target." : undefined
            }
            aside={
              hasMeetings && analytics ? (
                <ul className="an-head-stats">
                  {[...analytics.meetingStatuses]
                    .sort(
                      (left, right) =>
                        MEETING_ORDER.indexOf(left.status) -
                        MEETING_ORDER.indexOf(right.status),
                    )
                    .map((item) => (
                      <li key={item.status}>
                        <b>{count(item.total)}</b>
                        <span>{titleCase(item.status)} meetings</span>
                      </li>
                    ))}
                </ul>
              ) : null
            }
          />
          <div className="an-body">
            <CaptureTimeline
              timeline={analytics.leadTimeline}
              target={
                selected
                  ? analytics.events.find((item) => item.id === selected.id)
                      ?.dailyLeadTarget || null
                  : null
              }
            />
          </div>
        </section>
      ) : null}

      {/* ── commercial lifecycles ───────────────────────────────────────── */}
      {hasRfqs || hasQuotations ? (
        <section className="an-block" id="an-commercial">
          <SectionHead
            eyebrow="Commercial"
            title="How quotes are moving"
          />
          <div className="an-body an-body-even">
            {hasRfqs && analytics ? (
              <RfqTrack
                progression={[
                  'received',
                  'reviewing',
                  'clarification',
                  'ready_to_quote',
                  'quoted',
                ]}
                terminal={['won', 'lost']}
                rows={rfqRows}
                total={analytics.rfqTotal}
                quoted={analytics.rfqsWithQuotation}
              />
            ) : null}
            {hasQuotations ? (
              <QuotationLedger
                progression={['draft', 'approved', 'sent', 'accepted']}
                terminal={['rejected', 'expired']}
                rows={quotationRows}
                currency={currency}
              />
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── cost ────────────────────────────────────────────────────────── */}
      <section className="an-block" id="an-investment">
        <SectionHead
          eyebrow="Investment"
          title="What the scope cost"
        />
        <div className="an-body an-body-split">
          <CostComposition
            report={report}
            categories={analytics?.costCategories || []}
            costs={costs}
            currency={currency}
          />
          <RevenueEvidence report={report} currency={currency} />
        </div>
      </section>

      {/* ── event comparison ────────────────────────────────────────────── */}
      {comparable ? (
        <section className="an-block" id="an-events">
          <SectionHead
            eyebrow="Comparison"
            title="Event by event"
            note="ROI is per event and will not sum to the totals above."
          />
          <div className="an-body">
            <EventMatrix
              events={comparable}
              currency={currency}
              onScopeChange={handleScope}
            />
          </div>
        </section>
      ) : null}

      {/* ── attention ───────────────────────────────────────────────────── */}
      {actions.length ? (
        <section className="an-block" id="an-attention">
          <SectionHead
            eyebrow="Attention"
            title="What the backlog is waiting on"
          />
          <div className="an-body">
            <ul className="an-actions">
              {actions
                .slice(0, actionsExpanded ? actions.length : 5)
                .map((action) => {
                  const due = dueLabel(action.dueAt, now);
                  const overdue = action.dueAt != null && action.dueAt < now;
                  return (
                    <li key={`${action.kind}-${action.id}`}>
                      <button type="button" onClick={() => onOpenAction(action)}>
                        <span className={`an-action-kind is-${action.kind}`}>
                          {action.kind}
                        </span>
                        <span className="an-action-copy">
                          <b>{action.title}</b>
                          <small>{action.subject}</small>
                        </span>
                        <span
                          className={`an-action-due${overdue ? ' is-overdue' : ''}`}
                        >
                          {due || action.reason}
                        </span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
            </ul>
            {/* The ranking is the backend's; expanding only reveals more of it. */}
            {actions.length > 5 ? (
              <button
                type="button"
                className="an-more"
                onClick={() => setActionsExpanded((value) => !value)}
                aria-expanded={actionsExpanded}
              >
                {actionsExpanded
                  ? 'Show the top 5'
                  : `View all ${count(actions.length)} ranked actions`}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── owners ──────────────────────────────────────────────────────── */}
      {(analytics?.leadOwners.length || 0) > 1 && analytics ? (
        <section className="an-block" id="an-team">
          <SectionHead
            eyebrow="Team"
            title="Who captured the conversations"
          />
          <div className="an-body">
            <ul className="an-owners">
              {analytics.leadOwners
                .slice(0, ownersExpanded ? analytics.leadOwners.length : 5)
                .map((owner) => {
                  const max = Math.max(
                    ...analytics.leadOwners.map((item) => item.total),
                    1,
                  );
                  return (
                    <li key={owner.ownerId}>
                      <span className="an-owner-name">
                        {owner.ownerName || owner.ownerId}
                      </span>
                      <span className="an-owner-track">
                        <i style={fill(owner.total / max)} />
                      </span>
                      <span className="an-owner-value">
                        <b>{count(owner.total)}</b>
                        <small>{count(owner.confirmed)} confirmed</small>
                      </span>
                    </li>
                  );
                })}
            </ul>
            {analytics.leadOwners.length > 5 ? (
              <button
                type="button"
                className="an-more"
                onClick={() => setOwnersExpanded((value) => !value)}
                aria-expanded={ownersExpanded}
              >
                {ownersExpanded
                  ? 'Show the top 5'
                  : `Show all ${count(analytics.leadOwners.length)} owners`}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── secondary: cost entry ───────────────────────────────────────── */}
      <details className="an-secondary">
        <summary>Record or void a cost line</summary>
        {costEntry}
      </details>
    </div>
  );
}
