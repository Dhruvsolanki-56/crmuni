import { auditStatement, database, requireLeadAccess, requireRole, requireWorkspace } from '@/lib/db';

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const leadId = clean(new URL(request.url).searchParams.get('leadId'), 80);
  if (!leadId) return Response.json({ error: 'Lead ID is required.' }, { status: 400 });
  await requireLeadAccess(context, leadId);
  const db = database();
  const comments = await db
    .prepare(
      `SELECT c.id,c.body,c.author_id AS authorId,COALESCE(m.display_name,m.email,'Former member') AS authorName,c.mentioned_user_ids_json AS mentionedUserIdsJson,c.created_at AS createdAt FROM lead_comments c LEFT JOIN memberships m ON m.workspace_id=c.workspace_id AND m.user_id=c.author_id WHERE c.workspace_id=? AND c.lead_id=? ORDER BY c.created_at ASC`,
    )
    .bind(context.workspace.id, leadId)
    .all<{ id: string; body: string; authorId: string; authorName: string; mentionedUserIdsJson: string; createdAt: number }>();
  return Response.json({
    comments: comments.results.map((row) => ({
      id: row.id,
      body: row.body,
      authorId: row.authorId,
      authorName: row.authorName,
      mentionedUserIds: JSON.parse(row.mentionedUserIdsJson || '[]') as string[],
      createdAt: row.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Invalid request body.' }, { status: 400 });
  const leadId = clean(body.leadId, 80);
  const text = clean(body.body, 2000);
  const mentions = Array.isArray(body.mentions)
    ? [...new Set(body.mentions.filter((item): item is string => typeof item === 'string'))].slice(0, 20)
    : [];
  if (!leadId || !text) return Response.json({ error: 'A lead and comment text are required.' }, { status: 400 });
  const lead = await requireLeadAccess(context, leadId);
  const db = database();
  let validMentions: Array<{ userId: string; email: string; displayName: string | null }> = [];
  if (mentions.length) {
    const placeholders = mentions.map(() => '?').join(',');
    const rows = await db
      .prepare(
        `SELECT user_id AS userId, email, display_name AS displayName FROM memberships WHERE workspace_id=? AND status='active' AND user_id IN (${placeholders})`,
      )
      .bind(context.workspace.id, ...mentions)
      .all<{ userId: string; email: string; displayName: string | null }>();
    validMentions = rows.results;
  }
  const id = crypto.randomUUID();
  const now = Date.now();
  const mentionedUserIds = validMentions.map((item) => item.userId);
  const statements = [
    db
      .prepare(
        `INSERT INTO lead_comments (id,workspace_id,lead_id,author_id,body,mentioned_user_ids_json,created_at) VALUES (?,?,?,?,?,?,?)`,
      )
      .bind(id, context.workspace.id, leadId, context.user.id, text, JSON.stringify(mentionedUserIds), now),
    ...mentionedUserIds
      .filter((userId) => userId !== context.user.id)
      .map((userId) =>
        db
          .prepare(
            `INSERT INTO in_app_notifications (id,workspace_id,recipient_user_id,kind,title,body,entity_type,entity_id,dedupe_key,created_at) VALUES (?,?,?,'lead_mention',?,?,'lead',?,?,?) ON CONFLICT (workspace_id,dedupe_key) DO NOTHING`,
          )
          .bind(
            crypto.randomUUID(),
            context.workspace.id,
            userId,
            'You were mentioned on a lead',
            text.slice(0, 200),
            leadId,
            `lead_mention:${id}:${userId}`,
            now,
          ),
      ),
    auditStatement(context, 'lead.comment_added', 'lead', leadId, {
      commentId: id,
      mentionedUserIds,
      eventId: lead.eventId,
    }),
  ];
  await db.batch(statements);
  return Response.json(
    {
      comment: {
        id,
        body: text,
        authorId: context.user.id,
        authorName: 'You',
        mentionedUserIds,
        createdAt: now,
      },
    },
    { status: 201 },
  );
}
