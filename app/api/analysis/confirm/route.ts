import type { ConversationAnalysis } from '@/lib/analysis-schema';
import { database, DEFAULT_WORKSPACE, requestUser } from '@/lib/db';

export async function POST(request: Request) {
  const user = requestUser(request);
  const body = await request.json().catch(() => null) as { extractionId?: unknown } | null;
  const extractionId = typeof body?.extractionId === 'string' ? body.extractionId : '';
  if (!extractionId) return Response.json({ error: 'Extraction ID is required.' }, { status: 400 });

  const extraction = await database().prepare(`
    SELECT a.id, a.lead_id AS leadId, a.interaction_id AS interactionId, a.status, a.result_json AS resultJson
    FROM ai_extractions a JOIN leads l ON l.id = a.lead_id
    WHERE a.id = ? AND a.workspace_id = ? AND l.owner_id = ?
  `).bind(extractionId, DEFAULT_WORKSPACE, user.id).first<{ id: string; leadId: string; interactionId: string; status: string; resultJson: string | null }>();
  if (!extraction || !extraction.resultJson) return Response.json({ error: 'Completed analysis not found.' }, { status: 404 });
  if (extraction.status === 'confirmed') return Response.json({ status: 'confirmed', tasksCreated: 0 });

  const analysis = JSON.parse(extraction.resultJson) as ConversationAnalysis;
  const now = Date.now();
  const statements = [
    database().prepare(`UPDATE ai_extractions SET status = 'confirmed', confirmed_at = ?, confirmed_by = ? WHERE id = ? AND workspace_id = ?`).bind(now, user.id, extractionId, DEFAULT_WORKSPACE),
    database().prepare(`UPDATE leads SET review_status = 'confirmed', updated_at = ? WHERE id = ? AND workspace_id = ? AND owner_id = ?`).bind(now, extraction.leadId, DEFAULT_WORKSPACE, user.id),
  ];
  for (const commitment of analysis.commitments) {
    statements.push(database().prepare(`
      INSERT INTO tasks (id, workspace_id, lead_id, owner_id, title, due_date, status, source_interaction_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
    `).bind(crypto.randomUUID(), DEFAULT_WORKSPACE, extraction.leadId, user.id, commitment.title.slice(0, 240), commitment.due_date, extraction.interactionId, now, now));
  }
  await database().batch(statements);
  return Response.json({ status: 'confirmed', tasksCreated: analysis.commitments.length });
}
