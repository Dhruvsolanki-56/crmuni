import { auditStatement, database, requireEventAccess, requireWorkspace } from '@/lib/db';

const clean = (value: unknown, max: number) =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const eventId = clean(new URL(request.url).searchParams.get('eventId'), 80);
  if (!eventId)
    return Response.json({ error: 'Event ID is required.' }, { status: 400 });
  await requireEventAccess(context, eventId);
  const db = database();
  const items = await db
    .prepare(
      `SELECT id,title,kind,starts_at AS startsAt,notes,status,visited_at AS visitedAt,created_at AS createdAt FROM visitor_itinerary_items WHERE workspace_id=? AND event_id=? ORDER BY (starts_at IS NULL), starts_at ASC, created_at ASC`,
    )
    .bind(context.workspace.id, eventId)
    .all();
  return Response.json({ items: items.results });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const action = clean(body.action, 30);
  const db = database();
  const now = Date.now();

  if (action === 'add') {
    const eventId = clean(body.eventId, 80);
    const title = clean(body.title, 200);
    if (!eventId || !title)
      return Response.json(
        { error: 'An event and a title are required.' },
        { status: 400 },
      );
    await requireEventAccess(context, eventId);
    const startsAtRaw = clean(body.startsAt, 40);
    const startsAt = startsAtRaw ? Date.parse(startsAtRaw) : NaN;
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO visitor_itinerary_items (id,workspace_id,event_id,title,kind,starts_at,notes,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,'planned',?,?,?)`,
        )
        .bind(
          id,
          context.workspace.id,
          eventId,
          title,
          clean(body.kind, 20) || 'manual',
          Number.isNaN(startsAt) ? null : startsAt,
          clean(body.notes, 2000) || null,
          context.user.id,
          now,
          now,
        ),
      auditStatement(context, 'itinerary.added', 'visitor_itinerary_item', id),
    ]);
    return Response.json({ id }, { status: 201 });
  }

  if (action === 'update_status') {
    const id = clean(body.id, 80);
    const status = clean(body.status, 20);
    if (
      !id ||
      !['planned', 'in_progress', 'visited', 'skipped', 'cancelled'].includes(
        status,
      )
    )
      return Response.json(
        { error: 'A valid item and status are required.' },
        { status: 400 },
      );
    const result = await db
      .prepare(
        `UPDATE visitor_itinerary_items SET status=?,visited_at=CASE WHEN ?='visited' THEN ? ELSE visited_at END,updated_at=? WHERE id=? AND workspace_id=?`,
      )
      .bind(status, status, now, now, id, context.workspace.id)
      .run();
    if (!result.meta.changes)
      return Response.json({ error: 'Itinerary item not found.' }, { status: 404 });
    await auditStatement(context, 'itinerary.status_changed', 'visitor_itinerary_item', id, {
      status,
    }).run();
    return Response.json({ ok: true, status });
  }

  return Response.json({ error: 'Unknown action.' }, { status: 400 });
}
