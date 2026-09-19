import type { ConversationAnalysis } from '@/lib/analysis-schema';
import { auditStatement, database, requireLeadAccess, requireRole, requireWorkspace } from '@/lib/db';
import { qualificationStateForScore } from '@/lib/qualification';

export async function POST(request: Request) {
  const context = await requireWorkspace(request);
  requireRole(context, ['owner', 'admin', 'manager', 'salesperson']);
  const body = await request.json().catch(() => null) as { extractionId?: unknown; commitments?: unknown } | null;
  const extractionId = typeof body?.extractionId === 'string' ? body.extractionId : '';
  if (!extractionId) return Response.json({ error: 'Extraction ID is required.' }, { status: 400 });

  const extraction = await database().prepare(`
    SELECT a.id, a.lead_id AS leadId, a.interaction_id AS interactionId, a.status, a.result_json AS resultJson
    FROM ai_extractions a JOIN leads l ON l.id = a.lead_id
    WHERE a.id = ? AND a.workspace_id = ?
  `).bind(extractionId, context.workspace.id).first<{ id: string; leadId: string; interactionId: string; status: string; resultJson: string | null }>();
  if (!extraction || !extraction.resultJson) return Response.json({ error: 'Completed analysis not found.' }, { status: 404 });
  await requireLeadAccess(context,extraction.leadId);
  if (extraction.status === 'confirmed') return Response.json({ status: 'confirmed', tasksCreated: 0 });

  const analysis = JSON.parse(extraction.resultJson) as ConversationAnalysis & { ruleResults?: unknown[] };
  if (Array.isArray(body?.commitments)) {
    const edits = body.commitments as Array<{ title?: unknown; due_date?: unknown; evidence?: unknown }>;
    analysis.commitments = analysis.commitments.map((stored, index) => { const edit = edits[index]; if (!edit || edit.title !== stored.title || edit.evidence !== stored.evidence) return stored; const due = typeof edit.due_date === 'string' ? edit.due_date : null; return { ...stored, due_date: due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null }; });
  }
  if (analysis.commitments.some((item) => !item.due_date)) return Response.json({ error: 'Confirm a date for every commitment before creating tasks.' }, { status: 409 });
  const now = Date.now();
  const qualificationState=qualificationStateForScore(analysis.score.value);
  const statements = [
    database().prepare(`UPDATE ai_extractions SET status = 'confirmed', confirmed_at = ?, confirmed_by = ? WHERE id = ? AND workspace_id = ?`).bind(now, context.user.id, extractionId, context.workspace.id),
    database().prepare(`INSERT OR IGNORE INTO lead_qualification_history (id,workspace_id,lead_id,state,score,reason,source,previous_state,changed_by,created_at) SELECT ?,?,?,?,?,?,'ai_confirmed',qualification_state,?,? FROM leads WHERE id=? AND workspace_id=?`).bind(`${extractionId}:qualification`,context.workspace.id,extraction.leadId,qualificationState,analysis.score.value,analysis.score.rationale.slice(0,2000),context.user.id,now,extraction.leadId,context.workspace.id),
    database().prepare(`UPDATE leads SET review_status='confirmed',qualification_state=?,qualification_reason=?,qualification_updated_by=?,qualification_updated_at=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(qualificationState,analysis.score.rationale.slice(0,2000),context.user.id,now,now,extraction.leadId,context.workspace.id),
  ];
  for (const field of analysis.fields) {
    if (!field.value || !field.evidence) continue;
    statements.push(database().prepare(`INSERT OR IGNORE INTO lead_facts (id, workspace_id, lead_id, extraction_id, field_key, label, value, confidence_basis_points, evidence, confirmed_by, confirmed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(`${extractionId}:fact:${field.key.slice(0,80)}`, context.workspace.id, extraction.leadId, extractionId, field.key.slice(0, 80), field.label.slice(0, 120), field.value.slice(0, 2000), Math.round(field.confidence * 10000), field.evidence.slice(0, 1000), context.user.id, now));
  }
  statements.push(database().prepare(`INSERT OR IGNORE INTO qualification_scores (id, workspace_id, lead_id, extraction_id, score, rationale, rule_results_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(`${extractionId}:score`, context.workspace.id, extraction.leadId, extractionId, analysis.score.value, analysis.score.rationale.slice(0, 2000), JSON.stringify(analysis.ruleResults || []).slice(0, 8000), now));
  for (const [index,commitment] of analysis.commitments.entries()) {
    const taskId=`${extractionId}:task:${index}`;const commitmentKey=String(index);
    statements.push(database().prepare(`
      INSERT OR IGNORE INTO tasks (id,workspace_id,lead_id,owner_id,title,due_date,status,source_interaction_id,source_extraction_id,source_commitment_key,created_at,updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?)
    `).bind(taskId,context.workspace.id,extraction.leadId,context.user.id,commitment.title.slice(0,240),commitment.due_date,extraction.interactionId,extractionId,commitmentKey,now,now));
    statements.push(database().prepare(`INSERT OR IGNORE INTO task_history (id,workspace_id,task_id,action,from_status,to_status,version,actor_id,created_at) VALUES (?,?,?,'created','open','open',1,?,?)`).bind(`${taskId}:created`,context.workspace.id,taskId,context.user.id,now));
  }
  statements.push(auditStatement(context, 'analysis.confirmed', 'ai_extraction', extractionId));
  await database().batch(statements);
  return Response.json({ status: 'confirmed', tasksCreated: analysis.commitments.length });
}
