# CRMUNI implementation matrix

Last verified: 2026-09-19

Status meanings: **COMPLETE** is backed by implementation and repeatable verification; **PARTIAL** has a usable path but misses an acceptance condition; **MISSING** has no usable implementation; **BROKEN** violates a release gate; **NOT YET APPLICABLE** depends on a real pilot or external provider decision.

## Phase 0 — Commercial MVP

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Exhibitor-only first paid release | COMPLETE | README and product UI are exhibitor-focused; visitor modules are absent. |
| No false delivery/read claims | COMPLETE | Follow-ups remain drafts/approved and open external compose only. |
| Supported devices, browsers and badge formats | PARTIAL | Browser capture exists; supported-device and badge-provider matrix is not documented or validated. |
| Named pilot, event load and support owner | NOT YET APPLICABLE | Requires a real customer and business decision. |
| Initial pricing and manual invoicing | NOT YET APPLICABLE | Billing provider and commercial terms are not selected. |

## Phase 1 — Tenant security and SaaS foundation

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Workspace isolation | PARTIAL | API queries constrain `workspace_id`; database tests now reject cross-workspace event/member and quotation/event links, but full route-level tenant tests remain. |
| Event-level access | PARTIAL | Explicit `event_memberships` now gate event, lead, task, opportunity, RFQ, quotation, AI and follow-up routes; end-to-end role fixtures remain before COMPLETE. |
| Server-side role enforcement | PARTIAL | Mutations use `requireRole`; settings reads now hide member emails, invitations, audit and usage from non-admin roles. A complete role/action integration matrix remains. |
| Invitation acceptance and revocation | PARTIAL | Acceptance is now explicit, email-bound and idempotent; revocation and expiry exist. Concurrent trial-capacity coverage remains. |
| Audit records | PARTIAL | Important mutations are audited; reads, access denials, support access and many lifecycle changes are not. |
| Rate limits and entitlements | PARTIAL | D1-backed per-user mutation and AI limits exist; storage quotas and full plan entitlement policy remain. |
| Support access | MISSING | No time-limited, explicitly granted support role/session. |
| Export | PARTIAL | Owner/admin full JSON export exists; selected CSV export and reconciliation tests are missing. |
| Contact erasure | PARTIAL | Personal rows and capture files are removed; failure/retry state and derivative verification need coverage. |
| Tenant deletion and retention | PARTIAL | Owners can schedule, cancel and execute full database/R2 deletion after a seven-day recovery period; automated due-job execution and configurable retention remain. |
| Automated authorization tests | PARTIAL | `npm test` verifies role policy, unsafe SQL-expression rejection, migration backfill and cross-tenant trigger failures; route-level fixtures remain. |

## Phase 2 — Company intelligence and readiness

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Company, products, ICP and rules | PARTIAL | CRUD paths exist; approved claims and profile version history are missing. |
| Knowledge files and URLs | PARTIAL | Uploads and source records exist; ingestion, provenance, review and processing recovery are incomplete. |
| Event setup and readiness | PARTIAL | Event configuration exists; readiness state and verified cached device configuration are missing. |

## Phase 3 — Lead capture

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Manual/card/badge/QR/audio capture | PARTIAL | Capture and upload paths exist; provider accuracy and badge compatibility require external validation. |
| Offline outbox and stable capture ID | PARTIAL | IndexedDB outbox and server idempotency exist; automated reopen/retry/partial-upload tests are missing. |
| OCR confidence and correction | PARTIAL | Extraction confidence and editable lead fields exist; explicit per-field review UI is limited. |
| Duplicate detection and reversible merge | PARTIAL | Same-event email/phone/name-account suggestions, reviewed merge provenance and an undo path exist; fuzzy matching and broader integration tests remain. |
| Consent and withdrawal | PARTIAL | Per-channel follow-up permission, withdrawal, hashed suppression, audit and draft/open enforcement exist; jurisdiction-specific lawful-basis policy and route-level tests remain. |

## Phase 4 — Conversation intelligence and qualification

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Evidence-grounded structured extraction | PARTIAL | Exact-span checks and human confirmation exist; evaluation and malformed-output tests are missing. |
| Explicit qualification state | PARTIAL | Hot/Warm/Cold/Unqualified thresholds, reason, AI-confirmed history and manual override history exist; cohort calibration with pilot data remains. |
| Lead ownership | PARTIAL | Capture ownership, event-team reassignment, reason and immutable history exist; round-robin and workload routing remain. |
| Account stakeholders | PARTIAL | Buying roles exist; influence, duplicate account review and multi-contact opportunity association are incomplete. |

## Phase 5 — Follow-up, commitments and meetings

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Confirmed commitments to tasks | PARTIAL | Confirmation creates dated tasks; cancel/reopen/reminders and concurrency handling are missing. |
| Editable communication drafts | COMPLETE | Subject/body editing, version checks, approval invalidation, reapproval and audit are enforced server-side; approval never sends. |
| Consent/suppression check | PARTIAL | Draft generation and external-client opening both recheck active permission and hashed suppression; provider-side send enforcement awaits a real connector. |
| Meetings and calendar export | MISSING | No meeting model, states or `.ics` export. |

## Phase 6 — Revenue workflow

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Opportunity lifecycle | PARTIAL | Stages/value/probability exist; loss reason, reopen history, amount history and multi-contact links are missing. |
| RFQ intake and reviewed extraction | PARTIAL | Original files and editable extraction confirmation exist; owner SLA, clarification history and submission versions are missing. |
| Quotations | PARTIAL | Files, amounts and status exist; versioning, approval policy and account/event integrity are incomplete. |

## Phase 7 — Reporting and export

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Event lead/pipeline/revenue metrics | PARTIAL | Basic metrics exist; attribution window/weight and source reconciliation are missing. |
| Revenue ROI vs profit ROI | PARTIAL | Revenue return is shown; profit ROI and cost-line reconciliation are missing. |
| Next-best-action dashboard | PARTIAL | Due work is visible; priority ranking lacks explicit, testable rules. |
| Selected CSV export | MISSING | Only full JSON export exists. |

## Phase 8 — Production reliability and security

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Production AI configuration | READY — EXTERNAL VALIDATION REQUIRED | Manual fallbacks exist; hosted provider credential and evaluation are external. |
| Outbox/background workers/dead letters | MISSING | Device outbox exists; server jobs, retry records and dead-letter visibility do not. |
| Observability and alerts | MISSING | Audit events are not operational monitoring. |
| Backup restore, load and recovery tests | MISSING | No evidenced runbooks or repeatable tests. |
| CI build gate | COMPLETE | GitHub Actions runs `npm ci` and `npm run check`. |

## Later phases

| Requirement | Status | Evidence / gap |
| --- | --- | --- |
| Paid pilot outcome | NOT YET APPLICABLE | Must be established with real exhibitors and real event usage. |
| Self-service subscription | NOT YET APPLICABLE | Requires pricing, tax/legal terms and a billing-provider decision after pilot validation. |
| CRM/messaging/calendar connectors | NOT YET APPLICABLE | Requires a selected first provider and customer sandbox credentials. |
| Visitor product | NOT YET APPLICABLE | Explicitly outside the exhibitor MVP. |

## Current execution order

1. Fix Phase 1 event authorization, read-scope exposure, explicit invitations and automated policy tests.
2. Add duplicate and consent architecture.
3. Add qualification states and ownership history.
4. Add editable drafts, messaging eligibility and meetings.
5. Correct opportunity, RFQ and quotation integrity.
6. Add CSV/report reconciliation.
7. Add operational reliability and runbooks.

No row moves to **COMPLETE** until its implementation, database behavior, authorization, validation, failure handling and repeatable verification satisfy the phase release gate.
