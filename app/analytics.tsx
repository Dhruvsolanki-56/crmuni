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
      <div>
        <p className="an-eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        {note ? <p className="an-note">{note}</p> : null}
      </div>
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
          <span className="an-ladder-label">
            {row.label}
            <small>{row.hint}</small>
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

function StageBands({
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
  const max = Math.max(
    ...stages.map((item) => item.value),
    ...closed.map((item) => item.value),
    1,
  );
  // Won and Lost are outcomes, not pipeline, so they are described against each
  // other rather than as a share of open value, which would mean nothing.
  const closedCount = closed.reduce((total, item) => total + item.count, 0);
  const closedValue = closed.reduce((total, item) => total + item.value, 0);
  const band = (
    item: AnalyticsPayload['pipelineStages'][number],
    isClosed: boolean,
  ) => (
    <button
      type="button"
      className={`an-band${isClosed ? ' an-band-closed' : ''}${item.count ? '' : ' an-band-empty'}`}
      key={item.stage}
      onClick={() => item.count && onOpenStage(item.stage)}
      disabled={!item.count}
      aria-label={`${STAGE_LABELS[item.stage] || item.stage}: ${count(item.count)} opportunities worth ${money(item.value, currency)}${item.count ? '. Opens the opportunity list filtered to this stage.' : ''}`}
    >
      <span className="an-band-head">
        <b>{STAGE_LABELS[item.stage] || titleCase(item.stage)}</b>
        <span className="an-band-count">{count(item.count)}</span>
      </span>
      <span className="an-band-track">
        <i className="an-band-value" style={fill(item.value / max)} />
        {!isClosed ? (
          <i
            className="an-band-weighted"
            style={fill(item.weightedValue / max)}
          />
        ) : null}
      </span>
      <span className="an-band-foot">
        <span>{compactMoney(item.value, currency)}</span>
        {!isClosed ? (
          <small>
            {item.averageProbability == null
              ? 'No probability recorded'
              : `${compactMoney(item.weightedValue, currency)} weighted · ${item.averageProbability.toFixed(0)}% avg probability`}
          </small>
        ) : (
          <small>
            {closedCount
              ? `${count(item.count)} of ${count(closedCount)} closed · ${share(item.value, closedValue)} of closed value`
              : 'Nothing closed yet'}
          </small>
        )}
      </span>
    </button>
  );
  return (
    <div className="an-bands">
      <div className="an-bands-list">{stages.map((item) => band(item, false))}</div>
      <p className="an-bands-key">
        <span className="an-key an-key-value" /> Opportunity value
        <span className="an-key an-key-weighted" /> Probability-weighted
      </p>
      <div className="an-bands-closed">
        {closed.map((item) => band(item, true))}
      </div>
    </div>
  );
}

/* ── lead quality strips ─────────────────────────────────────────────────── */

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
        <path className="an-timeline-area" d={area} fill="url(#an-capture-fill)" />
        <path className="an-timeline-line" d={line('captured')} />
        <path
          className="an-timeline-line an-timeline-confirmed"
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

/* ── commercial lifecycle rails ──────────────────────────────────────────── */

function LifecycleRail({
  title,
  note,
  progression,
  terminal,
  rows,
  currency,
  showValue,
  footer,
}: {
  title: string;
  note: string;
  progression: string[];
  terminal: string[];
  rows: Record<string, { total: number; value?: number; flag?: number }>;
  currency: string;
  showValue: boolean;
  footer?: ReactNode;
}) {
  const all = [...progression, ...terminal];
  const max = Math.max(...all.map((key) => rows[key]?.total || 0), 1);
  const stage = (key: string, isTerminal: boolean) => {
    const row = rows[key] || { total: 0 };
    return (
      <li
        className={`an-rail-step${isTerminal ? ' is-terminal' : ''}${row.total ? '' : ' is-empty'}`}
        key={key}
      >
        <span className="an-rail-label">{titleCase(key)}</span>
        <span className="an-rail-track">
          <i style={fill((row.total || 0) / max)} />
        </span>
        <span className="an-rail-value">
          <b>{count(row.total || 0)}</b>
          {showValue && row.value ? (
            <small>{compactMoney(row.value, currency)}</small>
          ) : null}
          {row.flag ? <em>{count(row.flag)} past due</em> : null}
        </span>
      </li>
    );
  };
  return (
    <div className="an-rail">
      <div className="an-rail-head">
        <h3>{title}</h3>
        <small>{note}</small>
      </div>
      <ol className="an-rail-list">
        {progression.map((key) => stage(key, false))}
      </ol>
      <ol className="an-rail-list an-rail-terminal">
        {terminal.map((key) => stage(key, true))}
      </ol>
      {footer ? <p className="an-rail-foot">{footer}</p> : null}
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
        <div className="is-basis">
          <dt>Investment basis</dt>
          <dd>{money(report.investmentBasis, currency)}</dd>
        </div>
      </dl>
      <p className="an-note">
        The basis is the highest of the three, so a partial set of invoices
        cannot overstate ROI. Currently taken from{' '}
        <strong>
          {report.investmentBasisSource === 'actual_cost_lines'
            ? 'actual cost lines'
            : report.investmentBasisSource === 'planned_cost_lines'
              ? 'planned cost lines'
              : 'the planned event budget'}
        </strong>
        .
      </p>
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
  return (
    <div className="an-evidence">
      <div className="an-evidence-block">
        <p className="an-evidence-title">Documented revenue</p>
        {reconciliation.acceptedQuotationValue ? (
          <strong>
            {money(reconciliation.acceptedQuotationValue, currency)}
          </strong>
        ) : (
          <strong className="an-pending">No accepted quotations yet</strong>
        )}
        <small>
          Total value of quotations the customer accepted. Closed revenue is
          counted from won opportunities, so these two figures are independent
          evidence of the same commercial outcome.
        </small>
      </div>
      <div className="an-evidence-block">
        <p className="an-evidence-title">
          Unmatched records
          {needsReview || nothingToReconcile ? '' : ' — none'}
        </p>
        {nothingToReconcile ? (
          <small>
            Nothing to reconcile yet: this scope has no won opportunities and no
            accepted quotations.
          </small>
        ) : needsReview ? (
          <ul className="an-evidence-list">
            {reconciliation.wonWithoutAcceptedQuotation ? (
              <li>
                <b>{count(reconciliation.wonWithoutAcceptedQuotation)}</b>
                <span>
                  won{' '}
                  {reconciliation.wonWithoutAcceptedQuotation === 1
                    ? 'opportunity has'
                    : 'opportunities have'}{' '}
                  no accepted quotation linked to them
                </span>
              </li>
            ) : null}
            {reconciliation.acceptedQuotationWithoutWonOpportunity ? (
              <li>
                <b>
                  {count(
                    reconciliation.acceptedQuotationWithoutWonOpportunity,
                  )}
                </b>
                <span>
                  accepted{' '}
                  {reconciliation.acceptedQuotationWithoutWonOpportunity === 1
                    ? 'quotation is'
                    : 'quotations are'}{' '}
                  not linked to a won opportunity
                </span>
              </li>
            ) : null}
          </ul>
        ) : (
          <small>
            Every won opportunity has an accepted quotation and every accepted
            quotation has a won opportunity.
          </small>
        )}
      </div>
      <div className="an-evidence-block">
        <p className="an-evidence-title">Attribution</p>
        <small>
          {report.attributionModel === 'event_origin_100_percent'
            ? '100% of an opportunity is attributed to the event it originated at'
            : report.attributionModel}
          {report.attributionWindowDays != null
            ? `, within ${count(report.attributionWindowDays)} days of the event ending.`
            : '. Each event applies its own attribution window.'}
        </small>
        <p className="an-evidence-excluded">
          <b>{count(reconciliation.excludedOutsideAttributionWindow)}</b>{' '}
          {reconciliation.excludedOutsideAttributionWindow === 1
            ? 'opportunity was'
            : 'opportunities were'}{' '}
          created outside that window and are excluded from every figure above.
        </p>
      </div>
    </div>
  );
}

/* ── event comparison ────────────────────────────────────────────────────── */

function EventComparison({
  events,
  currency,
  onScopeChange,
}: {
  events: AnalyticsEvent[];
  currency: string;
  onScopeChange: (id: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const maxLeads = Math.max(...events.map((item) => item.totalLeads), 1);
  const maxPipeline = Math.max(...events.map((item) => item.pipelineValue), 1);
  const maxRevenue = Math.max(...events.map((item) => item.closedRevenue), 1);
  const maxInvestment = Math.max(
    ...events.map((item) => item.investmentBasis),
    1,
  );
  const metric = (
    value: number,
    max: number,
    tone: string,
    label: string,
  ) => (
    <span className="an-compare-metric">
      <small>{label}</small>
      <span className="an-compare-track">
        <i className={`an-tone-${tone}`} style={fill(value / max)} />
      </span>
    </span>
  );
  return (
    <div className="an-compare">
      {events.map((event) => (
        <button
          type="button"
          className={`an-compare-row${hovered && hovered !== event.id ? ' is-dimmed' : ''}`}
          key={event.id}
          onMouseEnter={() => setHovered(event.id)}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => setHovered(event.id)}
          onBlur={() => setHovered(null)}
          onClick={() => onScopeChange(event.id)}
          aria-label={`${event.name}: ${count(event.totalLeads)} leads, ${money(event.pipelineValue, currency)} open pipeline, ${money(event.closedRevenue, currency)} closed revenue, ${event.revenueRoiPercent == null ? 'revenue ROI unavailable' : `${percent(event.revenueRoiPercent)} revenue ROI`}. Scopes analytics to this event.`}
        >
          <span className="an-compare-name">
            <b>{event.name}</b>
            <small>
              {dateRange(event.startsOn, event.endsOn)} ·{' '}
              {titleCase(event.status)}
            </small>
          </span>
          <span className="an-compare-metrics">
            {metric(event.totalLeads, maxLeads, 'quiet', `${count(event.totalLeads)} leads · ${count(event.qualifiedLeads)} confirmed`)}
            {metric(event.pipelineValue, maxPipeline, 'mid', `${compactMoney(event.pipelineValue, currency)} pipeline · ${compactMoney(event.weightedPipelineValue, currency)} weighted`)}
            {metric(event.closedRevenue, maxRevenue, 'signal', `${compactMoney(event.closedRevenue, currency)} revenue · ${count(event.wonOpportunities)} won`)}
            {metric(event.investmentBasis, maxInvestment, 'cost', `${compactMoney(event.investmentBasis, currency)} invested`)}
          </span>
          <span className="an-compare-roi">
            <small>Revenue ROI</small>
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
                : percent(event.revenueRoiPercent)}
            </b>
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

  const qualification = useMemo(() => {
    const byState = new Map(
      (analytics?.qualificationMix || []).map((item) => [item.state, item.count]),
    );
    return [
      { key: 'hot', label: 'Hot', value: byState.get('hot') || 0, tone: 'hot' },
      { key: 'warm', label: 'Warm', value: byState.get('warm') || 0, tone: 'warm' },
      { key: 'cold', label: 'Cold', value: byState.get('cold') || 0, tone: 'cold' },
      {
        key: 'unqualified',
        label: 'Unqualified',
        value: byState.get('unqualified') || 0,
        tone: 'none',
      },
    ];
  }, [analytics]);

  const reviewSegments = useMemo(() => {
    const byStatus = new Map(
      (analytics?.reviewMix || []).map((item) => [item.status, item.count]),
    );
    return [
      {
        key: 'confirmed',
        label: 'Confirmed',
        value: byStatus.get('confirmed') || 0,
        tone: 'hot',
      },
      {
        key: 'needs_review',
        label: 'Awaiting review',
        value: byStatus.get('needs_review') || 0,
        tone: 'warm',
      },
      {
        key: 'erased',
        label: 'Personal data erased',
        value: byStatus.get('erased') || 0,
        tone: 'none',
      },
    ];
  }, [analytics]);

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
          >
            {item.name}
            <b className={`an-chip-status is-${item.status}`}>{item.status}</b>
          </button>
        ))}
      </fieldset>
      <div className="an-scope-actions">
        {archivedCount ? (
          <span className="an-scope-note">
            {count(archivedCount)} archived{' '}
            {archivedCount === 1 ? 'event is' : 'events are'} excluded
          </span>
        ) : null}
        {canExport ? <ExportMenu onExport={onExport} /> : null}
      </div>
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

  return (
    <div className="an" ref={rootRef}>
      {scopeBar}

      {/* ── the ledger ──────────────────────────────────────────────────── */}
      <section className="an-ledger">
        <div className="an-ledger-head">
          <p className="an-eyebrow">
            {hasWins
              ? 'Closed revenue'
              : hasOpportunities
                ? 'Open pipeline'
                : 'Committed investment'}{' '}
            · {scopeLabel}
            {selected
              ? ` · ${dateRange(selected.startsOn, selected.endsOn)}`
              : ''}
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
          {hasWins ? (
            <p className="an-sentence">
              From <strong>{count(report.wonOpportunities)}</strong> won{' '}
              {report.wonOpportunities === 1 ? 'opportunity' : 'opportunities'}{' '}
              against <strong>{money(report.investmentBasis, currency)}</strong>{' '}
              invested
              {report.revenueRoiPercent == null ? (
                <>
                  {' '}
                  — <span className="an-flat">revenue ROI unavailable</span>{' '}
                  until an investment basis exists.
                </>
              ) : (
                <>
                  {' '}
                  — <b className={`an-roi${roiTone}`}>
                    {percent(report.revenueRoiPercent)}
                  </b>{' '}
                  revenue ROI and{' '}
                  <b className={`an-roi${report.profitRoiPercent == null ? '' : report.profitRoiPercent < 0 ? ' is-negative' : ' is-positive'}`}>
                    {report.profitRoiPercent == null
                      ? 'n/a'
                      : percent(report.profitRoiPercent)}
                  </b>{' '}
                  profit ROI.
                </>
              )}
            </p>
          ) : hasOpportunities ? (
            <p className="an-sentence">
              <strong>{count(report.openOpportunities)}</strong> open{' '}
              {report.openOpportunities === 1
                ? 'opportunity carries'
                : 'opportunities carry'}{' '}
              <strong>
                {money(report.weightedPipelineValue, currency)}
              </strong>{' '}
              of probability-weighted value. Nothing has closed won yet, so
              revenue and ROI are not reported for this scope.
            </p>
          ) : (
            <p className="an-sentence">
              {report.totalLeads
                ? `${count(report.totalLeads)} conversations have been captured, but none has become an opportunity yet. `
                : 'No conversations have been captured for this scope yet. '}
              Pipeline, revenue and ROI begin once a captured conversation
              becomes an opportunity.
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
        <section className="an-block">
          <SectionHead
            eyebrow="Conversion"
            title="From the floor to the ledger"
            note={
              hasOpportunities
                ? 'Each step counts distinct records, not estimates. Opportunities are limited to those inside the attribution window.'
                : 'Captures are being confirmed. No conversation has become an opportunity yet, so the last two steps stay at zero.'
            }
          />
          <ConversionSpine
            conversion={conversion}
          />
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

      {/* ── pipeline + lead quality ─────────────────────────────────────── */}
      {hasOpportunities && analytics ? (
        <section className="an-block an-split">
          <div className="an-sub">
            <SectionHead
              eyebrow="Pipeline"
              title="Where the value is sitting"
              note="Each band shows total opportunity value with the probability-weighted portion inset. Select a stage to open those opportunities."
            />
            <StageBands
              stages={analytics.pipelineStages}
              closed={analytics.closedStages}
              currency={currency}
              onOpenStage={onOpenStage}
            />
          </div>
          <div className="an-sub">
            <SectionHead eyebrow="Lead quality" title="Who is in the pipeline" />
            <DensityStrip
              title="Qualification"
              note="Salesperson-assigned state"
              segments={qualification}
              total={qualification.reduce((sum, item) => sum + item.value, 0)}
            />
            <DensityStrip
              title="Review status"
              segments={reviewSegments}
              total={reviewSegments.reduce((sum, item) => sum + item.value, 0)}
            />
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
            {analytics.coverage ? (
              <p className="an-coverage">
                <b>{count(analytics.coverage.hotWithoutOpenTask)}</b> of{' '}
                {count(analytics.coverage.hotLeads)} hot leads have no open
                follow-up commitment.{' '}
                {count(analytics.coverage.leadsWithOpenTask)} of{' '}
                {count(analytics.coverage.scopedLeads)} leads in scope do.
              </p>
            ) : null}
          </div>
        </section>
      ) : hasLeads && analytics ? (
        <section className="an-block an-split">
          <div className="an-sub">
            <SectionHead
              eyebrow="Lead quality"
              title="Who is in the pipeline"
              note="Pipeline analytics appear once a confirmed conversation is converted into an opportunity."
            />
            <DensityStrip
              title="Qualification"
              note="Salesperson-assigned state"
              segments={qualification}
              total={qualification.reduce((sum, item) => sum + item.value, 0)}
            />
            <DensityStrip
              title="Review status"
              segments={reviewSegments}
              total={reviewSegments.reduce((sum, item) => sum + item.value, 0)}
            />
          </div>
          <div className="an-sub">
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
          </div>
        </section>
      ) : null}

      {/* ── momentum ────────────────────────────────────────────────────── */}
      {hasTimeline && analytics ? (
        <section className="an-block">
          <SectionHead
            eyebrow="Momentum"
            title="Capture volume by day"
            note={
              selected
                ? `Only days with a recorded capture are plotted. The dashed line is this event's daily lead target.`
                : 'Only days with a recorded capture are plotted, so gaps between separate events are not filled in.'
            }
          />
          <CaptureTimeline
            timeline={analytics.leadTimeline}
            target={
              selected
                ? analytics.events.find((item) => item.id === selected.id)
                    ?.dailyLeadTarget || null
                : null
            }
          />
        </section>
      ) : null}

      {/* ── commercial lifecycles ───────────────────────────────────────── */}
      {hasRfqs || hasQuotations ? (
        <section className="an-block an-split-even">
          {hasRfqs && analytics ? (
            <LifecycleRail
              title="RFQ lifecycle"
              note="Requests for quotation received against this scope"
              progression={[
                'received',
                'reviewing',
                'clarification',
                'ready_to_quote',
                'quoted',
              ]}
              terminal={['won', 'lost']}
              rows={rfqRows}
              currency={currency}
              showValue={false}
              footer={
                <>
                  <b>{count(analytics.rfqsWithQuotation)}</b> of{' '}
                  {count(analytics.rfqTotal)} RFQs have at least one quotation
                  raised against them.
                </>
              }
            />
          ) : null}
          {hasQuotations ? (
            <LifecycleRail
              title="Quotation lifecycle"
              note="A separate document lifecycle — not a continuation of the RFQ stages"
              progression={['draft', 'approved', 'sent', 'accepted']}
              terminal={['rejected', 'expired']}
              rows={quotationRows}
              currency={currency}
              showValue
            />
          ) : null}
        </section>
      ) : null}

      {/* ── cost + evidence ─────────────────────────────────────────────── */}
      <section className="an-block an-split">
        <div className="an-sub">
          <SectionHead
            eyebrow="Investment"
            title="What the scope cost"
            note="Select a category to read its recorded cost lines."
          />
          <CostComposition
            report={report}
            categories={analytics?.costCategories || []}
            costs={costs}
            currency={currency}
          />
        </div>
        <div className="an-sub">
          <SectionHead
            eyebrow="Data trust"
            title="Evidence behind the revenue"
            note="Concrete reconciliation facts, not a score."
          />
          <RevenueEvidence report={report} currency={currency} />
        </div>
      </section>

      {/* ── meetings ────────────────────────────────────────────────────── */}
      {hasMeetings && analytics ? (
        <section className="an-block an-meetings">
          <SectionHead eyebrow="Activity" title="Meetings booked from this scope" />
          <ul className="an-meeting-list">
            {[...analytics.meetingStatuses]
              .sort(
                (left, right) =>
                  MEETING_ORDER.indexOf(left.status) -
                  MEETING_ORDER.indexOf(right.status),
              )
              .map((item) => (
                <li key={item.status}>
                  <b>{count(item.total)}</b>
                  <span>{titleCase(item.status)}</span>
                  {item.status === 'scheduled' && item.upcoming ? (
                    <small>{count(item.upcoming)} still ahead</small>
                  ) : null}
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {/* ── event comparison ────────────────────────────────────────────── */}
      {comparable ? (
        <section className="an-block">
          <SectionHead
            eyebrow="Comparison"
            title="Event by event"
            note="Each bar is scaled against the strongest event for that measure. Investment basis and ROI are calculated per event, so they will not sum to the totals above. Select an event to scope this page to it."
          />
          <EventComparison
            events={comparable}
            currency={currency}
            onScopeChange={handleScope}
          />
        </section>
      ) : null}

      {/* ── attention ───────────────────────────────────────────────────── */}
      {actions.length ? (
        <section className="an-block">
          <SectionHead
            eyebrow="Attention"
            title="What the backlog is waiting on"
            note="Ranked by the workspace's own urgency rules. Select one to open the record."
            aside={<span className="an-count">{actions.length} ranked</span>}
          />
          <ul className="an-actions">
            {actions.slice(0, 8).map((action) => {
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
        </section>
      ) : null}

      {/* ── owners ──────────────────────────────────────────────────────── */}
      {(analytics?.leadOwners.length || 0) > 1 && analytics ? (
        <section className="an-block">
          <SectionHead
            eyebrow="Team"
            title="Who captured the conversations"
            note="Leads in scope by their assigned owner."
          />
          <ul className="an-owners">
            {analytics.leadOwners.map((owner) => {
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
