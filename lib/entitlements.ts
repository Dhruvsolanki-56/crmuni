export type PlanEntitlements = {
  plan: 'trial' | 'starter' | 'growth' | 'scale';
  activeMembers: number;
  storageBytes: number;
  aiRequestsPerMinute: number;
};

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

export const PLAN_ENTITLEMENTS: Record<PlanEntitlements['plan'], PlanEntitlements> = {
  trial: {
    plan: 'trial',
    activeMembers: 3,
    storageBytes: 100 * MIB,
    aiRequestsPerMinute: 20,
  },
  starter: {
    plan: 'starter',
    activeMembers: 10,
    storageBytes: 5 * GIB,
    aiRequestsPerMinute: 40,
  },
  growth: {
    plan: 'growth',
    activeMembers: 30,
    storageBytes: 25 * GIB,
    aiRequestsPerMinute: 100,
  },
  scale: {
    plan: 'scale',
    activeMembers: 100,
    storageBytes: 100 * GIB,
    aiRequestsPerMinute: 300,
  },
};

export function entitlementsFor(plan: string): PlanEntitlements {
  return PLAN_ENTITLEMENTS[plan as PlanEntitlements['plan']] || PLAN_ENTITLEMENTS.trial;
}

export async function storageUsage(db: D1Database, workspaceId: string) {
  const row = await db.prepare(`SELECT
    (SELECT COALESCE(SUM(size_bytes),0) FROM knowledge_sources WHERE workspace_id=?) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM lead_capture_assets WHERE workspace_id=?) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM rfq_documents WHERE workspace_id=?) +
    (SELECT COALESCE(SUM(size_bytes),0) FROM quotations WHERE workspace_id=?) AS bytes`)
    .bind(workspaceId, workspaceId, workspaceId, workspaceId)
    .first<{ bytes: number }>();
  return Number(row?.bytes || 0);
}

export async function enforceStorageEntitlement(
  db: D1Database,
  workspaceId: string,
  plan: string,
  incomingBytes: number,
) {
  const entitlement = entitlementsFor(plan);
  const usedBytes = await storageUsage(db, workspaceId);
  if (incomingBytes < 0 || usedBytes + incomingBytes > entitlement.storageBytes)
    throw new Response(
      `This upload exceeds the ${entitlement.plan} plan storage limit. Remove stored files or upgrade the workspace plan.`,
      { status: 402 },
    );
  return { usedBytes, limitBytes: entitlement.storageBytes };
}

export function isEntitlementConstraint(error: unknown, code: string) {
  return error instanceof Error && error.message.includes(code);
}

export function storageLimitResponse(plan: string) {
  const entitlement = entitlementsFor(plan);
  return new Response(
    `This upload exceeds the ${entitlement.plan} plan storage limit. Remove stored files or upgrade the workspace plan.`,
    { status: 402 },
  );
}
