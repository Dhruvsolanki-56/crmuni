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
