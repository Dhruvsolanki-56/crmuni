import type { ConversationAnalysis } from '@/lib/analysis-schema';
import { auditStatement, database, requireWorkspace } from '@/lib/db';

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  const body = await request.json().catch(() => null) as { extractionId?: unknown } | null;
  const extractionId = typeof body?.extractionId === 'string' ? body.extractionId : '';
  if (!extractionId) return Response.json({ error: 'Extraction ID is required.' }, { status: 400 });

  const extraction = await database().prepare(`
    SELECT a.id, a.lead_id AS leadId, a.interaction_id AS interactionId, a.status, a.result_json AS resultJson
    FROM ai_extractions a JOIN leads l ON l.id = a.lead_id
    WHERE a.id = ? AND a.workspace_id = ?
  `).bind(extractionId, context.workspace.id).first<{ id: string; leadId: string; interactionId: string; status: string; resultJson: string | null }>();
  if (!extraction || !extraction.resultJson) return Response.json({ error: 'Completed analysis not found.' }, { status: 404 });
  if (extraction.status === 'confirmed') return Response.json({ status: 'confirmed', tasksCreated: 0 });

  const analysis = JSON.parse(extraction.resultJson) as ConversationAnalysis;
  const now = Date.now();
  const statements = [
    database().prepare(`UPDATE ai_extractions SET status = 'confirmed', confirmed_at = ?, confirmed_by = ? WHERE id = ? AND workspace_id = ?`).bind(now, context.user.id, extractionId, context.workspace.id),
    database().prepare(`UPDATE leads SET review_status = 'confirmed', updated_at = ? WHERE id = ? AND workspace_id = ?`).bind(now, extraction.leadId, context.workspace.id),
  ];
  for (const commitment of analysis.commitments) {
    statements.push(database().prepare(`
      INSERT INTO tasks (id, workspace_id, lead_id, owner_id, title, due_date, status, source_interaction_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
    `).bind(crypto.randomUUID(), context.workspace.id, extraction.leadId, context.user.id, commitment.title.slice(0, 240), commitment.due_date, extraction.interactionId, now, now));
  }
  statements.push(auditStatement(context, 'analysis.confirmed', 'ai_extraction', extractionId));
  await database().batch(statements);
  return Response.json({ status: 'confirmed', tasksCreated: analysis.commitments.length });
}
