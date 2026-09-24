import {
  database,
  filesAvailable,
  requireLeadAccess,
  requireWorkspace,
  revenueEnv,
  storageUnavailableResponse,
} from '@/lib/db';

const clean = (value: string | null, max: number) =>
  value?.trim().slice(0, max) || '';

export async function GET(request: Request) {
  const context = await requireWorkspace(request);
  const url = new URL(request.url);
  const assetId = clean(url.searchParams.get('assetId'), 80);
  const leadId = clean(url.searchParams.get('leadId'), 80);
  const db = database();

  if (assetId) {
    const asset = await db
      .prepare(
        `SELECT lead_id AS leadId,original_name AS originalName,storage_key AS storageKey,content_type AS contentType FROM lead_capture_assets WHERE id=? AND workspace_id=?`,
      )
      .bind(assetId, context.workspace.id)
      .first<{
        leadId: string;
        originalName: string;
        storageKey: string | null;
        contentType: string | null;
      }>();
    if (!asset)
      return Response.json({ error: 'Conversation file not found.' }, { status: 404 });
    await requireLeadAccess(context, asset.leadId);
    if (!asset.storageKey || !filesAvailable())
      return storageUnavailableResponse('Conversation file download');
    const object = await revenueEnv().FILES.get(asset.storageKey);
    if (!object)
      return Response.json(
        { error: 'The stored conversation file could not be found.' },
        { status: 404 },
      );
    const safeName = asset.originalName.replace(/["\\\r\n]/g, '-') || 'conversation-file';
    return new Response(object.body, {
      headers: {
        'content-type': asset.contentType || 'application/octet-stream',
        'content-disposition': `attachment; filename="${safeName}"`,
        'cache-control': 'private, no-store',
      },
    });
  }

  if (!leadId)
    return Response.json(
      { error: 'Lead or conversation file is required.' },
      { status: 400 },
    );
  await requireLeadAccess(context, leadId);
  const assets = await db
    .prepare(
      `SELECT id,lead_id AS leadId,kind,original_name AS originalName,content_type AS contentType,size_bytes AS sizeBytes,processing_status AS processingStatus,created_at AS createdAt FROM lead_capture_assets WHERE workspace_id=? AND lead_id=? ORDER BY created_at DESC`,
    )
    .bind(context.workspace.id, leadId)
    .all();
  return Response.json({ assets: assets.results });
}
