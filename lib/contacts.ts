// Contact resolution: decides which durable person identity a newly
// captured lead belongs to, so the same human met at three different events
// becomes one contact with three event relationships, not three unrelated
// people. See db/schema.ts `contacts` for the identity model this serves,
// and drizzle/0046_contacts_domain_foundation.sql for the one-time backfill
// that resolved every pre-existing lead the same way.
//
// Three confidence tiers, in order, mirroring the evidence rules this
// product already trusts at the lead level (app/api/leads/route.ts's
// existing event-scoped duplicate check used the same three signals) but
// now searched across the whole workspace, not one event - that scope
// widening is what actually fixes "met again at a different event."
//
//   1. Exact email match           -> auto-attach. Unambiguous.
//   2. Exact phone match           -> auto-attach. Unambiguous.
//   3. Same account + exact name   -> never auto-attach. Two employees can
//      share a name. A new contact is created, and the match is recorded as
//      a suggestion for a human to confirm or dismiss, the same shape
//      lead_duplicate_suggestions already uses for the equivalent lead-level
//      decision.
//
// Deliberately NOT fuzzy: no similarity scoring, no abbreviation handling,
// no partial-name matching. Uncertain evidence produces a suggestion, never
// a silent merge.
export type ContactResolution = {
  contactId: string;
  isNew: boolean;
  matchedOn: 'email' | 'phone' | null;
  suggestedContactId: string | null;
  suggestedReason: 'account_and_name' | null;
};

export async function resolveContact(
  db: D1Database,
  workspaceId: string,
  input: {
    fullName: string;
    email?: string | null;
    phone?: string | null;
    accountId?: string | null;
  },
): Promise<ContactResolution> {
  const email = input.email?.trim() || null;
  const phone = input.phone?.trim() || null;
  const accountId = input.accountId || null;

  if (email) {
    const match = await db
      .prepare(
        `SELECT id FROM contacts WHERE workspace_id=? AND email=? AND merged_into_id IS NULL ORDER BY created_at ASC LIMIT 1`,
      )
      .bind(workspaceId, email)
      .first<{ id: string }>();
    if (match)
      return {
        contactId: match.id,
        isNew: false,
        matchedOn: 'email',
        suggestedContactId: null,
        suggestedReason: null,
      };
  }

  if (phone) {
    const match = await db
      .prepare(
        `SELECT id FROM contacts WHERE workspace_id=? AND phone=? AND merged_into_id IS NULL ORDER BY created_at ASC LIMIT 1`,
      )
      .bind(workspaceId, phone)
      .first<{ id: string }>();
    if (match)
      return {
        contactId: match.id,
        isNew: false,
        matchedOn: 'phone',
        suggestedContactId: null,
        suggestedReason: null,
      };
  }

  let suggestedContactId: string | null = null;
  let suggestedReason: 'account_and_name' | null = null;
  if (accountId) {
    const match = await db
      .prepare(
        `SELECT id FROM contacts WHERE workspace_id=? AND primary_account_id=? AND lower(trim(full_name))=lower(trim(?)) AND merged_into_id IS NULL ORDER BY created_at ASC LIMIT 1`,
      )
      .bind(workspaceId, accountId, input.fullName)
      .first<{ id: string }>();
    if (match) {
      suggestedContactId = match.id;
      suggestedReason = 'account_and_name';
    }
  }

  return {
    contactId: crypto.randomUUID(),
    isNew: true,
    matchedOn: null,
    suggestedContactId,
    suggestedReason,
  };
}
