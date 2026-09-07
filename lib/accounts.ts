export function normalizeCompany(company: string) {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export async function accountIdentity(workspaceId: string, company: string) {
  const normalized = normalizeCompany(company);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${workspaceId}:${normalized}`));
  const hash = Array.from(new Uint8Array(bytes)).slice(0, 12).map((value) => value.toString(16).padStart(2, '0')).join('');
  return { id: `acct_${hash}`, normalized };
}
