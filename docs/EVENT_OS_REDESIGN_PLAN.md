# Event OS redesign plan

Last written: 2026-09-22. Source: `Event_OS_Engineering_Plan.docx` (provided by the product owner). This document adopts that plan's **flow** — the journeys, module IDs, state rules and release order — and explicitly **replaces its field lists**. The source plan's field lists are a logical/engineering reference, not a form spec; several existing crmuni forms already violate the same principle this document enforces, and this plan is also the fix for those.

## Operating rule for every module below

> Copy the flow. Do not copy the fields.

For every module, ask two questions before adding or keeping a field:
1. Can this be extracted from something the user already gave us (a scanned card, an existing record, a prior answer) instead of typed?
2. Does the product break today, right now, without this field — or could it be asked for later, only when it's actually needed?

If the answer to (1) is yes, extract it and show it as editable, not as a blank box. If the answer to (2) is "it can wait," it goes behind progressive disclosure or is dropped entirely. This is the same rule already recorded in standing memory ([[product-design-principles]]) — this plan is that rule applied module-by-module against a concrete spec, not a new rule.

A module is "done" when its flow matches the plan's user action → system action → AI behavior → state sequence, using the minimal field set below — not when every field the source plan lists exists as a column.

## Current status legend

- **BUILT** — exists in the running app today, verified against `db/schema.ts` / `app/api/*` / `app/page.tsx`, not just claimed.
- **PARTIAL** — the flow exists but doesn't yet match the plan's module boundary or state rules exactly.
- **MISSING** — no implementation.

Status here is deliberately more conservative than `docs/IMPLEMENTATION_MATRIX.md`, which is stale on the visitor side (it says visitor is "NOT YET APPLICABLE"; the visitor views already exist in `app/page.tsx`). Treat this file as the current source of truth for the Event OS flow; treat `IMPLEMENTATION_MATRIX.md` as the source of truth for security/reliability phases, which this plan doesn't re-litigate.

---

## Exhibitor journey

### E01 — Create workspace and event — BUILT
Plan asks for: `workspace_id, event_id, name, venue, dates, timezone, booth, currency, goals`.

**Minimal fields to actually show:** event name, start/end dates. Everything else already has a sane default or belongs later: timezone can default from the browser and be corrected once, venue/booth/currency/goals are not needed to create a draft event — they're needed before *activating capture*, which is a separate, later gate (readiness, already built via `eventReadinessSnapshots`). Don't front-load them into event creation.

No backend change needed — `events` already allows a draft with most fields null; the fix (if any) is on the client: confirm the creation form doesn't ask for more than name + dates up front.

### E02 — Company products and ICP — BUILT
Plan asks for a large profile: `company_name, website, product_ids, use_cases, industries, roles, regions, ICP, tone, asset_ids`.

**Minimal fields:** company name + one thing you sell. Everything else (differentiators, tone, regions, approved claims) is already progressive-disclosure in the Knowledge Base per standing memory, and AI-summarizes uploaded brochures instead of asking the user to restate them (already built — `companyProfileVersions`, `approvedClaims`, `knowledgeSources`). No new backend work; this module is already aligned with the minimal-fields rule.

### E03 — Prepare team and booth — BUILT
Plan asks for `field_schema` (custom lead fields) as something the admin configures per event.

**Minimal fields:** invite by email + role. Custom lead field schema is real and already exists (`events.lead_field_schema_json`) — keep it opt-in and empty by default; an event with zero custom fields must work identically to one with ten. Don't require configuring this before capture works.

### E04 — Capture contacts — BUILT
Plan's field list (`capture_id, event_id, captured_by, source_type, image_id, captured_at, extracted_fields`) is already exactly how `leadCaptureAssets` works — this is metadata the system fills in, not user input. Nothing to trim; the user-facing surface is already just "scan" or "type."

### E05 — Review and remember conversation — BUILT, trim one thing
Plan's field list includes `name, company, email, phone, notes, product_interest, next_step, permission` as if all were required at once.

**Minimal fields to require:** name. Email OR phone (not both) only if follow-up is intended — the app should let a card be saved with neither and surface "no way to follow up" as a visible warning, not a blocked save. `product_interest` should never be a required typed field — it's either inferred from the conversation note (already how `qualificationScores`/`leadFacts` AI summarization works) or skipped.

**Backend check:** confirm no column in `leads`/`account_stakeholders` is `NOT NULL` beyond `full_name` and identity columns. If email/phone are enforced not-null anywhere in validation (not just schema), relax that — a captured lead with a name and a note is a valid save, matching the plan's own stated branch: "No network: save locally... Missing contact permission: allow saving... blocking in-app marketing delivery [only]."

### E06 — Qualify and assign — BUILT
Already matches the plan closely: qualification state, reason, owner, AI recommendation with override (`qualificationScores`, `leadQualificationHistory`, `leadAssignmentHistory`). No field trimming needed — this module was never form-heavy; it's a chip/select, not a form.

### E07 — Personalized WhatsApp and email — BUILT
Already matches: draft → approve → handoff, never claims "delivered" (`communicationDrafts`). No changes.

### E08 — Follow up and meetings — BUILT
Plan's field list (`due_at, response_note, meeting_id, start_at, duration, timezone, location, outcome`) matches `tasks`/`meetings` already. No changes — this module is inherently low-field (a date picker and a text box), already minimal.

### E09 — Team collaboration and handoff — BUILT
Matches `leadComments`, `leadAssignmentHistory`. No changes.

### E10 — CRM export and sync — PARTIAL (MVP scope only, by design)
Plan scopes this to CSV export for MVP, provider sync in Phase 2. crmuni already has role-gated, audited CSV export (`IMPLEMENTATION_MATRIX.md` Phase 7). Provider sync (`connection_id, field_map, sync_direction`) is correctly Phase 2 — do not build it now; no field to trim because nothing user-facing exists yet.

### E11 — Proposal and conversion — BUILT, but broader than the plan
crmuni's `opportunities`/`rfqs`/`quotations` implement E11 and then go further (RFQ intake, multi-revision quotations) than the plan describes, because crmuni serves a B2B quoting workflow the plan's `deal_id, amount, stage, close_date, loss_reason` shorthand doesn't fully capture. Keep the extra depth — it's load-bearing for this product's actual buyers — but audit RFQ/quotation creation forms specifically for fields that could be deferred (e.g. currency, payment terms) behind "more details" the same way product/ICP forms already do it.

### E12 — Event results and ROI — BUILT
Matches `eventCostLines`, ROI/profit-ROI split, "unavailable" instead of zero when cost is missing — this was Release-era work in this same engagement and already follows the plan's own acceptance rule verbatim. No changes.

---

## Visitor journey

### V01 — Profile event and goals — BUILT
Plan asks for `goals, interests, target_roles, availability, visibility, language` at join time.

**Minimal fields:** which event to join. Goals/interests should be optional and promptable later ("what are you hoping to find here?" shown once, skippable, not a gate before the visitor can do anything). Availability and language are not needed to join an event — cut them from onboarding; availability belongs on the itinerary screen (V04) where it's actually used, language should follow the browser/account setting, not a form field.

### V02 — Discover exhibitors and people — BUILT (`directoryVisibility`, directory search)
No field trimming needed — this is a search/filter UI, not a form.

### V03 — AI recommendations — PARTIAL
Plan wants ranked candidates with an explanation and save/dismiss. Confirm this exists as a first-class surface (not just directory search) before calling it done; if it's currently just directory search with no ranking, that's a real gap — but it is a **display/ranking** gap, not a fields gap, so it does not belong in a "trim the form" pass. Flag as a candidate for a future Release if the user wants it prioritized; not scoped by this document.

### V04 — Itinerary and visits — BUILT (`visitorItineraryItems`)
No field trimming needed.

### V05 — Scan and save contacts — BUILT, reuses E04/E05 rules
Apply the same E05 minimal-field rule: name required, one contact channel only if follow-up matters, no forced product-interest typing.

### V06 — Conversation notes and commitments — BUILT
Matches `interactions`, task-suggestion-from-commitment. No changes.

### V07 — Personal event memory — PARTIAL
Plan wants search over the visitor's own contacts/notes/tags now, AI Q&A in Phase 2. Confirm `visitor-memory` is real search over `interactions`/`leads` scoped to the visitor, not a placeholder screen, before marking BUILT. No field concerns either way — this is a query surface.

### V08 — Personal follow-ups — BUILT, same rule as E07
No changes beyond confirming it reuses `communicationDrafts` rather than a parallel implementation (this project's established pattern — see Release B's identity-preview reusing `resolveContact()` rather than writing a second matcher).

### V09 — Post event relationships — PARTIAL
Plan wants one cross-event timeline per contact with archive/reopen. This is the visitor-side mirror of exhibitor Release C (`app/page.tsx` contact grouping, "met N times", cross-event encounter history) done in this same engagement on 2026-09-22. Confirm the visitor side got the same treatment — if `visitor-contacts`/`visitor-memory` still group by lead/interaction row rather than by `contact_id`, that's the same bug Release C just fixed on the exhibitor side, unfixed here. **This is the single most concrete, high-value next step**, because the fix pattern is already proven and tested on the exhibitor side today.

---

## Architecture and data model

The plan's proposed architecture (modular app, shared API, background workers, outbox pattern, AI boundary with provenance, provider adapters) is **already crmuni's actual architecture** — `backgroundJobs`/`jobRuns` (outbox/workers), `aiExtractions`/`leadFacts` (AI boundary with stored provenance), `leadDuplicateSuggestions`/`contactDuplicateSuggestions` (never-merge-on-name-alone dedup). No redesign needed here; this section of the plan describes what's already running.

The plan's data-model rule "Exhibitor lead key is workspace + event + contact" is exactly Release A of this engagement (`contacts` separated from `leads`, `resolveContact()`). The plan's rule "Visitor relationship spans their own events... do not share private person records globally" needs the same V09 audit above — confirm visitor-side contact identity doesn't leak across visitor workspaces or get shared with exhibitor workspaces by accident.

## What this plan does NOT ask for

- No new tables for anything marked BUILT above.
- No Phase-2 items (provider messaging send, CRM two-way sync, calendar OAuth, voice transcription, venue maps) — the plan itself defers these, and nothing in the "minimal fields" complaint changes that.
- No rewrite of RFQ/quotation depth — it's real product requirement beyond the plan's generic "deal," not bloat.

## Suggested next release

Continuing this engagement's lettered-release convention (A: contact identity, B: capture UX, C: exhibitor relationship UX):

**Release D — visitor relationship parity.** Apply Release C's exact fix (group by `contact_id`, not by lead/interaction row; surface cross-event encounter history) to the visitor side (V09, and V07 if it turns out to be lead-scoped rather than contact-scoped). Audit V01's join-an-event form and any other visitor form for fields that can be deferred, using the E05 rule above. Gate: a visitor who meets the same exhibitor rep at two different booths, or the same event twice, sees one relationship, not two — the visitor-side mirror of Release C's own gate.

This is a proposal, not started — matches this engagement's standing pattern of only starting a Release on explicit instruction.
