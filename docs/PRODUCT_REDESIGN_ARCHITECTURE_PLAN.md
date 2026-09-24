# Revenue OS Product Redesign Architecture Plan

## 1. Product decision

Revenue OS should launch as an exhibitor revenue workspace, not as a general CRM and not as a separate visitor application. Its job is simple: help a booth team remember the right conversation and complete the next promised action.

The product promise is:

> Capture the conversation once. Keep the follow-through visible until it produces an outcome.

The reference engineering plan is useful for its flow discipline: setup, capture, review, qualification, next action, collaboration, conversion, and measurement. It should not be copied as a giant form specification. The current product already contains much of the underlying security, event, task, opportunity, quote, RFQ, reporting, and audit capability. The redesign should simplify what a normal salesperson sees while preserving those controls behind the scenes.

### Explicit scope decisions

| Decision | Direction | Reason |
| --- | --- | --- |
| First paying customer | Exhibitors with B2B sales teams | A clear buyer, repeatable event workflow, and measurable ROI |
| Primary daily user | Booth representative | The capture flow must work in seconds, one-handed, and under pressure |
| Secondary users | Sales manager and workspace owner | They need follow-through, ownership, pipeline, and ROI, not capture complexity |
| Visitor marketplace app | Do not build in this release | It doubles identity, privacy, discovery, and support scope without proving exhibitor demand |
| Full CRM replacement | Do not claim this | Start as an event revenue layer with a lightweight built-in pipeline and optional later sync |
| Automatic sending or booking | Do not allow by default | A human must approve messages, meetings, ownership changes, commercial terms, and deal outcomes |

## 2. Experience principles

1. One job per screen. A representative should never face setup, reporting, and CRM fields while standing at a booth.
2. Capture first, enrich later. Store the image and conversation even when data is incomplete.
3. Ask only for information that changes the next action. Do not collect fields because a CRM usually has them.
4. AI suggests; a person confirms. Never mark a guessed fact, deadline, permission, price, or deal as true.
5. Advanced capability is progressive disclosure. RFQs, quotes, stakeholder maps, integrations, and reporting appear only when a lead needs them.
6. Event context should be automatic. If one active event exists, select it. If several exist, ask once in plain language. Never leave a completed capture blocked by a hidden event requirement.
7. Offline must fail safely. The user sees Saved on this device, Syncing, Synced, or Needs attention. Nothing silently disappears.
8. Compliance must be clear, not obstructive. Permission is requested only before drafting or handing off a message; it must not block saving a conversation or setting a task.

## 3. Target user journeys

### 3.1 First-use setup

The owner should reach Capture lead in under five minutes.

1. Create workspace
   - Required: company name.
   - Optional now: website or one brochure. The user can skip and add it later.
2. Describe the business
   - Required: one sentence explaining what the company sells.
   - Optional: up to three products or services, target customer type, and one useful proof point.
   - AI may turn supplied material into a draft summary, but the owner reviews it before it is used for messages.
3. Create event
   - Required: event name.
   - Optional: date, booth, venue, event goal, and team.
   - If no dates are known, allow a private event record rather than blocking setup.
4. Invite team later
   - Do not force invitations, detailed routing rules, qualification schemas, or ten readiness fields before the first capture.
5. Ready to capture
   - Show a short checklist only when it protects a real outcome: an active event, at least one owner, and a basic business description before AI communication drafting.

### 3.2 Booth capture

The capture screen is the product's most important surface.

#### First screen

Show only four actions:

- Scan card
- Scan badge or QR
- Add manually
- Add conversation note

The active event appears quietly at the top. With one active event it is selected automatically. With several, show a compact event selector before capture, keeping any already-scanned values intact.

#### Immediate extraction and review

When an image is selected:

1. Save a local capture draft immediately.
2. Run local QR and OCR reading.
3. Prefill editable fields.
4. Show a single confidence-free sentence such as: `We found 4 details. Please check them before saving.`
5. Do not make the user wait for a server, an API key, a CRM, or an AI workflow.

#### Capture form: minimum fields

| Field | Requirement | Why it exists |
| --- | --- | --- |
| Full name | Optional if company is known | Identifies a person |
| Company | Optional if full name is known | Gives useful account context |
| Phone or email | Optional | Needed only when a contact method is available |
| What did you discuss | Optional but prominent | Preserves conversation context |
| Next step | Optional | Creates practical follow-through |
| When | Optional; only if a next step exists | Makes the task actionable |

At least one of name or company is required only when the user presses Save. If neither is available, save the image as `Unidentified visitor` and let the user identify it later. Do not discard a real booth conversation because a card was unreadable.

#### Fields that must not appear in the default capture form

- lead score
- qualification reason
- buying role
- budget amount
- number of machines
- existing technology
- product catalogue selection
- industry, location, region, tags, source campaign, account owner
- complex consent wording
- RFQ, quotation, opportunity, or CRM fields

These are inferred or requested later only when relevant.

#### Save result

After saving, show one clear result with up to three choices:

- Add a note or correct contact
- Set next action
- Back to capture

Do not force a manual review screen when the salesperson already reviewed the prefilled values. Do not show a false `delivered`, `sent`, or `qualified` status.

### 3.3 Lead follow-through

The person detail page should answer four questions immediately:

1. Who is this and which company are they from?
2. What did they need?
3. What did we promise, and by when?
4. Who owns the next action?

Use a short lead summary at the top, then a timeline. Reveal sections only if data exists:

- Conversation and source image
- Next action
- Contact details and permission
- Related people at the same company
- Opportunity
- Files, RFQ, quotation, and message history

The default actions are `Complete task`, `Send follow-up`, `Add note`, `Assign`, and `Create opportunity`. A manager should not need to understand pipeline terms to keep a promise visible.

### 3.4 Qualification and ownership

Qualification belongs after capture, not inside it.

The review action uses four choices only:

- High potential
- Worth following up
- Low priority
- Not a fit

Each choice can be changed later. The system may recommend one and explain its evidence, but it must show `Not enough information` rather than invent a score. Require a reason only for `Not a fit` and `Lost`.

Every active lead has one accountable owner and one next action. The system can recommend an owner based on event team or round-robin configuration, but assignment is visible and reversible.

### 3.5 Communication and meetings

Message flow:

1. The representative chooses Email or WhatsApp.
2. The product checks that a usable contact method and follow-up permission exist.
3. It drafts a short message from confirmed conversation facts and approved company information.
4. The representative reviews and edits it.
5. The product opens the chosen mail or WhatsApp client, or copies the text.
6. Status is `Handed off`, not `Sent` or `Delivered`.

Meeting flow: propose details, confirm with the user, create a task and calendar file. Do not pretend a meeting was booked without a connected calendar or explicit confirmation.

### 3.6 Sales outcome and ROI

When a lead becomes commercial, show a lightweight opportunity panel:

- Stage: Exploring, Proposal, Negotiation, Won, Lost
- Expected value: optional
- Expected close date: optional
- One or more contacts: optional

RFQ and quotation workflows remain available behind `More sales work`; they should not be visible to every lead. The event report separates captured people, actionable leads, open pipeline, won revenue, and event cost. It never combines pipeline with revenue or implies ROI when costs are absent.

## 4. Navigation redesign

The main navigation should use language a sales team understands:

1. Today - today's overdue and upcoming actions
2. Capture - always reachable as the primary button
3. Leads - people and companies from events
4. Pipeline - opportunities, RFQs, and quotations when needed
5. Events - event setup, team, costs, and results
6. Settings - company, team, integrations, billing, privacy

Remove knowledge-management, operations, support controls, and deep configuration from daily navigation. Keep them under Settings with role-based access. Present only `Today`, `Capture`, and `Leads` to representatives by default.

## 5. Minimal domain architecture

### 5.1 Core records

The database should model the business outcome, not the UI form.

| Domain record | Purpose | Minimum contents |
| --- | --- | --- |
| Workspace | Tenant boundary | id, company name, locale, plan |
| Member | User access | workspace, role, status |
| Business profile | Approved sales context | one-line offering, products, approved claims, version |
| Event | Context for captures and ROI | name, state, optional dates and booth |
| Contact | Person identity within a workspace | name, company, phone, email, normalization state |
| Account | Company grouping | display name, normalized name |
| Event lead | The event-specific relationship | event, contact or account, owner, priority, next-action state |
| Interaction | What happened in a conversation | text, occurred time, captured by, original source |
| Capture asset | Card, badge, QR, or audio evidence | object key, processing state, extraction suggestion, review attribution |
| Task | A promised action | title, due time, owner, status, linked lead |
| Opportunity | Commercial outcome | stage, optional value and close date |
| Message draft | Reviewed communication | channel, text version, permission evidence, handoff state |
| Audit event | Security and recovery trail | actor, action, record, timestamp |

### 5.2 Records that are not core capture fields

RFQs, quotation revisions, stakeholder roles, ICP rules, company sources, lead facts, score histories, cost lines, CRM mappings, and operations jobs remain valid supporting records. They should be created only after a user chooses the related workflow, or by a reviewed automation. They must not become default form fields.

### 5.3 Keep and simplify the current backend

The existing tables for workspaces, memberships, events, leads, interactions, tasks, capture assets, accounts, opportunities, RFQs, quotations, messages, audit records, consent, outbox jobs, and reporting can remain. Do not rewrite the database from scratch.

Introduce a service boundary over the current schema:

```text
Capture session
  -> contact/account resolution
  -> event lead
  -> interaction and source asset
  -> optional task
  -> optional opportunity
```

The UI talks to this workflow API, not directly to every specialist record. This makes it possible to keep database integrity while presenting one simple action to the user.

## 6. Backend changes required

### 6.1 Capture session API

Replace the many-step front-end capture contract with one idempotent `capture session` command.

Input fields:

- `client_capture_id`
- `event_id` when known
- source file or source type
- reviewed contact values when available
- note
- next action and optional due time

Server behavior:

1. Validate tenant and event access.
2. Persist the original file or offline payload before enrichment.
3. Resolve an existing contact only through normalized email or phone; name alone creates a duplicate suggestion, never an automatic merge.
4. Create or update the event lead and append an interaction.
5. Create one task only when the user supplied a next action.
6. Return a small result: saved lead, task status, duplicate suggestion, sync state.
7. Queue optional OCR, transcription, analysis, CRM export, and draft-generation work separately.

### 6.2 Event selection and readiness

The current event gate is necessary for attribution and access, but its behavior must change:

- Auto-restore the previously valid active event.
- Auto-select if exactly one event is active.
- Show an inline event picker if several are active.
- Preserve the local capture draft while the user selects an event.
- If no event is active, show one action: `Set up event`, with a plain explanation.
- Split readiness into required-for-capture and helpful-later checks. Do not block capture for brochure upload, detailed ICP rules, cost entries, or team configuration.

### 6.3 AI and OCR boundaries

OCR runs locally and returns editable candidates. QR/vCard data is preferred over OCR when available. The server stores the original image and the exact reviewed fields.

Conversation analysis, document processing, and message drafting are asynchronous suggestions. Each suggestion must retain source IDs, confidence or warning information, model/prompt version when applicable, and a human confirmation state. A background-job failure must never make the saved lead fail.

### 6.4 Permissions, privacy, and integration boundaries

- Every record remains scoped by workspace and, where relevant, event.
- Consent is a separate purpose-and-channel record. It never blocks lead saving or task creation.
- Message drafting and external handoff recheck permission and suppression.
- CRM synchronization is outbound-only first: CSV export, then one connector chosen by pilot demand. Never build multiple connectors before a customer validates one.
- Message providers and calendar OAuth remain Phase 2. No status claim exceeds available provider evidence.

## 7. Design system and interaction rules

### Layout

- Mobile: one primary action per screen, sticky bottom save action, 44px minimum touch targets.
- Desktop: capture stays in a focused modal or dedicated page; lead details use a single readable column with an optional right action panel.
- Use plain labels: `Next step`, not `commitment disposition`; `Company`, not `account entity`.
- Show why a button is unavailable and provide the exact next action in the same place. Never leave a grey button as the only explanation.

### Form rules

- Start collapsed. Reveal advanced fields through `Add details`.
- Preserve typed values across upload retries, event changes, and offline reconnect.
- Save on-device draft state immediately after a file selection or note change.
- Validate at the moment a user asks the product to act, not while they are talking to a visitor.
- Default dates to empty. Never invent a deadline.
- Default lead priority to `Unreviewed`, not `Cold`.

### Status vocabulary

Use these consistent user-facing terms:

| Area | Allowed statuses |
| --- | --- |
| Capture | Saved on device, Syncing, Saved, Needs attention |
| Lead | New, Follow up, High potential, Low priority, Not a fit |
| Task | Due today, Upcoming, Done, Cancelled |
| Message | Draft, Ready to review, Handed off |
| Opportunity | Exploring, Proposal, Negotiation, Won, Lost |

Do not expose internal statuses such as `stored_pending_extraction`, `queued_offline`, `background_job_retrying`, or database version numbers to normal users.

## 8. Delivery phases

### Phase A - Stabilize the happy path

Goal: a salesperson can complete capture to next action in under one minute.

- Fix event selection restore, auto-selection, and inline selection.
- Replace default capture form with the minimum fields.
- Preserve local drafts, OCR values, and scanned images through every error path.
- Simplify save confirmation and show the immediate next action.
- Add a normal-user test script covering card scan, poor scan, manual lead, no network, multiple events, no active event, and duplicate suggestion.

Exit criteria: A test user can scan a card, edit one value, save, create a task, and begin another capture without assistance.

### Phase B - Make follow-through obvious

Goal: no important promise is lost after the event.

- Redesign Today around overdue and next-up tasks.
- Redesign lead detail around summary, timeline, owner, and next action.
- Add simple qualification and owner selection after save.
- Keep draft messages reviewable and permission-aware.
- Hide advanced revenue objects until invoked.

Exit criteria: A manager can identify every unowned lead and every overdue next action in one screen.

### Phase C - Connect outcomes

Goal: show commercial value without becoming a CRM clone.

- Introduce lightweight opportunities from selected leads.
- Surface RFQ and quotation workflows only from an opportunity or explicit action.
- Make pipeline and won revenue visibly distinct.
- Add event cost entry and reconciled ROI summary.
- Deliver audited CSV export.

Exit criteria: One event can show captured leads, actionable leads, pipeline, won revenue, costs, and an honest ROI state.

### Phase D - Pilot hardening

Goal: survive a real exhibition.

- Test Android and iPhone camera flows, weak network, interrupted uploads, browser restart, and concurrent booth users.
- Establish supported card, QR, and badge formats with a named pilot organizer.
- Test authorization, deletion, export, restore, and job recovery.
- Measure OCR accuracy by field and image quality; publish a practical capture guide.
- Assign support owner, incident process, and event-day fallback procedure.

Exit criteria: The pilot can continue manually when OCR, AI, or a provider fails, without data loss.

### Phase E - Only after pilot evidence

- One CRM connector selected by paying-customer demand.
- Provider-backed email or WhatsApp sending with explicit eligibility and webhook reconciliation.
- Calendar connection after meeting behavior is validated.
- Multilingual OCR after testing target languages and cards.
- Billing and self-service subscription after pricing, tax, support, and entitlement decisions.

## 9. What not to build yet

- A visitor discovery product or attendee social network.
- A generic configurable CRM form builder.
- Automatic WhatsApp sending, automatic meeting booking, or automatic deal closing.
- Multiple CRM and messaging integrations in parallel.
- Global contact matching across customers.
- Predictive lead scores without a measured pilot dataset.
- Venue routing, map optimization, or badge-provider promises without reliable organizer data.
- A requirement that every company upload a complete catalogue, website, ICP, or sales playbook before its first capture.

## 10. Architecture acceptance checks

Before declaring the redesign complete, verify these scenarios end to end:

1. One active event is restored automatically after reload; capture is never blocked by a hidden event setting.
2. With multiple active events, selecting an event inside capture retains the image, OCR values, and typed note.
3. A poor or unreadable card can still become an `Unidentified visitor` capture with the original source image.
4. OCR creates editable suggestions only; it does not overwrite manually typed values or invent contact details.
5. A repeated offline submission creates one capture, one interaction, and at most one task.
6. No contact permission still allows the lead, note, task, and opportunity to be saved; it blocks message handoff only.
7. A duplicate suggestion never silently merges people and a reversal preserves all interactions.
8. A background AI failure leaves the lead and task usable.
9. A member from another workspace cannot read, modify, export, or sync the record.
10. Reports count a contact once per event lead, do not call pipeline revenue, and show ROI as unavailable when costs are missing.

## 11. First implementation backlog

1. Implement the capture-session API facade over current lead, interaction, asset, task, and duplicate records.
2. Replace the existing capture dialog with the minimal capture form and progressive `Add details` area.
3. Make event auto-selection and the inline event picker a tested shared component.
4. Redesign Today and lead detail before adding more sales modules.
5. Move technical and advanced configuration out of daily navigation.
6. Add scenario-based browser tests for the acceptance checks above.
7. Run the real pilot before deciding the first CRM, messaging provider, and subscription packaging.

This plan deliberately favors a smaller, dependable product over a broad feature inventory. The correct benchmark is not whether every CRM field exists; it is whether a booth representative can preserve a meaningful conversation and the business can prove what happened next.
