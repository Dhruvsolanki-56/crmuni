export function normalizeCompany(company: string) {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Pass `db` from any code that goes on to write: accounts created before ids
// were derived from the name (the demo seed, older tenants) keep their original
// id, and a lead/contact pointed at the derived id instead would break the
// foreign key. Without `db` this stays purely computational.
export async function accountIdentity(
  workspaceId: string,
  company: string,
  db?: D1Database,
) {
  const normalized = normalizeCompany(company);
  if (db) {
    const existing = await db
      .prepare(`SELECT id FROM accounts WHERE workspace_id=? AND normalized_name=?`)
      .bind(workspaceId, normalized)
      .first<{ id: string }>();
    if (existing) return { id: existing.id, normalized };
  }
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${workspaceId}:${normalized}`));
  const hash = Array.from(new Uint8Array(bytes)).slice(0, 12).map((value) => value.toString(16).padStart(2, '0')).join('');
  return { id: `acct_${hash}`, normalized };
}

// Suggestion-only key: drops legal-form words so "Acme Pvt Ltd", "ACME Private
// Limited" and "Acme" compare equal. Never used for identity or merging -
// account identity stays the strict normalizeCompany() hash, so a wrong guess
// here can only produce a hint the user dismisses, never a silent merge.
const LEGAL_FORM_WORDS = new Set([
  'pvt', 'private', 'ltd', 'limited', 'llp', 'llc', 'inc', 'incorporated',
  'corp', 'corporation', 'co', 'company', 'plc', 'gmbh', 'ag', 'sa', 'the',
]);

export function companyMatchKey(company: string) {
  const words = normalizeCompany(company)
    .split(' ')
    .filter((word) => word && !LEGAL_FORM_WORDS.has(word));
  return words.join(' ');
}
