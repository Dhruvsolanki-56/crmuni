import { database, requireWorkspace } from '@/lib/db';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

// This endpoint intentionally reads across workspace boundaries: it is the
// visitor-facing directory. Every column selected here is something the
// owning exhibitor has explicitly published (directory_visibility='published'
// on an active event); leads, team, pipeline and every other exhibitor-private
// table are never touched.
export async function GET(request: Request) {
  await requireWorkspace(request);
  const url = new URL(request.url);
  const query = clean(url.searchParams.get('query'), 120).toLowerCase();
  const db = database();
  const rows = await db
    .prepare(
      `SELECT e.id AS eventId, e.name AS eventName, e.venue, e.hall, e.booth, e.starts_on AS startsOn, e.ends_on AS endsOn, e.qr_campaign_code AS qrCampaignCode,
        cp.legal_name AS companyName, cp.description AS companyDescription,
        (SELECT GROUP_CONCAT(p.name, ', ') FROM products p WHERE p.workspace_id=e.workspace_id AND p.status='active') AS products
       FROM events e
       LEFT JOIN company_profiles cp ON cp.workspace_id = e.workspace_id
       WHERE e.directory_visibility='published' AND e.status='active'
       ORDER BY e.starts_on ASC
       LIMIT 100`,
    )
    .all<{
      eventId: string;
      eventName: string;
      venue: string | null;
      hall: string | null;
      booth: string | null;
      startsOn: string;
      endsOn: string;
      qrCampaignCode: string | null;
      companyName: string | null;
      companyDescription: string | null;
      products: string | null;
    }>();
  const entries = rows.results.map((row) => ({
    eventId: row.eventId,
    eventName: row.eventName,
    venue: row.venue,
    hall: row.hall,
    booth: row.booth,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    code: row.qrCampaignCode,
    companyName: row.companyName || row.eventName,
    companyDescription: row.companyDescription || '',
    products: row.products ? row.products.split(', ') : [],
  }));
  const matches = query
    ? entries
        .map((entry) => {
          const haystack = [
            entry.eventName,
            entry.companyName,
            entry.companyDescription,
            ...entry.products,
          ]
            .join(' ')
            .toLowerCase();
          const score = haystack.includes(query) ? 1 : 0;
          return { entry, score };
        })
        .filter((item) => item.score > 0)
        .map((item) => item.entry)
    : entries;
  return Response.json({ entries: matches, total: entries.length });
}
