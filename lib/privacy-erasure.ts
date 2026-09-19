import { database, revenueEnv } from '@/lib/db';

type ErasureRequest = {
  id: string;
  leadId: string;
  status: string;
  assetKeysJson: string;
};

function assetKeys(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.slice(0, 1000))
      .slice(0, 1000);
  } catch {
    return [];
  }
}

export async function processLeadErasure(
  workspaceId: string,
  requestId: string,
  now = Date.now(),
) {
  const db = database();
  const request = await db.prepare(`SELECT id,lead_id AS leadId,status,asset_keys_json AS assetKeysJson FROM lead_erasure_requests WHERE id=? AND workspace_id=?`)
    .bind(requestId, workspaceId)
    .first<ErasureRequest>();
  if (!request || request.status === 'completed') return;
  await db.prepare(`UPDATE lead_erasure_requests SET status='processing',attempts=attempts+1,last_error=NULL,updated_at=? WHERE id=? AND workspace_id=? AND status IN ('queued','failed','processing')`)
    .bind(now, requestId, workspaceId)
    .run();
  try {
    for (const key of assetKeys(request.assetKeysJson))
      await revenueEnv().FILES.delete(key);

    await db.batch([
      db.prepare(`DELETE FROM lead_facts WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`DELETE FROM qualification_scores WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`DELETE FROM lead_qualification_history WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`DELETE FROM communication_drafts WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`DELETE FROM lead_consents WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`UPDATE suppression_entries SET source_lead_id=NULL,updated_at=? WHERE source_lead_id=? AND workspace_id=?`).bind(now, request.leadId, workspaceId),
      db.prepare(`UPDATE lead_duplicate_suggestions SET status='dismissed',resolved_by='privacy-worker',resolved_at=?,updated_at=? WHERE workspace_id=? AND (source_lead_id=? OR target_lead_id=?) AND status='pending'`).bind(now, now, workspaceId, request.leadId, request.leadId),
      db.prepare(`DELETE FROM lead_merge_events WHERE workspace_id=? AND (source_lead_id=? OR target_lead_id=?)`).bind(workspaceId, request.leadId, request.leadId),
      db.prepare(`DELETE FROM ai_extractions WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`DELETE FROM meeting_participants WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`DELETE FROM opportunity_contacts WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`UPDATE meetings SET lead_id=NULL,updated_at=? WHERE lead_id=? AND workspace_id=?`).bind(now, request.leadId, workspaceId),
      db.prepare(`DELETE FROM task_history WHERE workspace_id=? AND task_id IN (SELECT id FROM tasks WHERE workspace_id=? AND lead_id=?)`).bind(workspaceId, workspaceId, request.leadId),
      db.prepare(`DELETE FROM tasks WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`DELETE FROM interactions WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`DELETE FROM account_stakeholders WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`DELETE FROM lead_capture_assets WHERE lead_id=? AND workspace_id=?`).bind(request.leadId, workspaceId),
      db.prepare(`UPDATE rfqs SET lead_id=NULL,updated_at=? WHERE lead_id=? AND workspace_id=?`).bind(now, request.leadId, workspaceId),
      db.prepare(`UPDATE opportunities SET lead_id=NULL,updated_at=? WHERE lead_id=? AND workspace_id=?`).bind(now, request.leadId, workspaceId),
      db.prepare(`UPDATE leads SET full_name='Deleted contact',role=NULL,email=NULL,phone=NULL,source='privacy_erasure',review_status='erased',qualification_state='unqualified',qualification_reason=NULL,qualification_updated_by=NULL,qualification_updated_at=NULL,updated_at=? WHERE id=? AND workspace_id=?`).bind(now, request.leadId, workspaceId),
    ]);

    const verification = await db.prepare(`SELECT
      (SELECT COUNT(*) FROM lead_facts WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM qualification_scores WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM lead_qualification_history WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM communication_drafts WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM lead_consents WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM ai_extractions WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM interactions WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM tasks WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM lead_capture_assets WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM meeting_participants WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM opportunity_contacts WHERE lead_id=? AND workspace_id=?) +
      (SELECT COUNT(*) FROM lead_merge_events WHERE workspace_id=? AND (source_lead_id=? OR target_lead_id=?)) AS derivativeCount`)
      .bind(
        request.leadId, workspaceId, request.leadId, workspaceId,
        request.leadId, workspaceId, request.leadId, workspaceId,
        request.leadId, workspaceId, request.leadId, workspaceId,
        request.leadId, workspaceId, request.leadId, workspaceId,
        request.leadId, workspaceId, request.leadId, workspaceId,
        request.leadId, workspaceId, workspaceId, request.leadId, request.leadId,
      )
      .first<{ derivativeCount: number }>();
    const lead = await db.prepare(`SELECT full_name AS fullName,email,phone,review_status AS reviewStatus FROM leads WHERE id=? AND workspace_id=?`)
      .bind(request.leadId, workspaceId)
      .first<{ fullName: string; email: string | null; phone: string | null; reviewStatus: string }>();
    if (Number(verification?.derivativeCount || 0) !== 0 || !lead || lead.fullName !== 'Deleted contact' || lead.email || lead.phone || lead.reviewStatus !== 'erased')
      throw new Error('Lead erasure verification failed.');

    await db.batch([
      db.prepare(`UPDATE lead_erasure_requests SET status='completed',asset_keys_json='[]',last_error=NULL,completed_at=?,updated_at=? WHERE id=? AND workspace_id=?`).bind(now, now, requestId, workspaceId),
      db.prepare(`INSERT INTO audit_events (id,workspace_id,actor_id,action,entity_type,entity_id,detail_json,created_at) VALUES (?,?,'privacy-worker','lead.erased','lead',?,'{"derivativesVerified":true}',?)`).bind(crypto.randomUUID(), workspaceId, request.leadId, now),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown erasure failure';
    await db.prepare(`UPDATE lead_erasure_requests SET status='failed',last_error=?,updated_at=? WHERE id=? AND workspace_id=? AND status!='completed'`)
      .bind(message, now, requestId, workspaceId)
      .run();
    throw error;
  }
}
