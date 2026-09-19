# CRMUNI implementation matrix

Last verified: 2026-09-19

Status meanings: **COMPLETE** is backed by implementation and repeatable verification; **PARTIAL** has a usable path but misses an acceptance condition; **MISSING** has no usable implementation; **BROKEN** violates a release gate; **NOT YET APPLICABLE** depends on a real pilot or external provider decision.

## Phase 0 — Commercial MVP

| Requirement                                   | Status             | Evidence / gap                                                                                                                                                      |
| --------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exhibitor-only first paid release             | COMPLETE           | README and product UI are exhibitor-focused; visitor modules are absent.                                                                                            |
| No false delivery/read claims                 | COMPLETE           | Follow-ups remain drafts/approved and open external compose only.                                                                                                   |
| Supported devices, browsers and badge formats | PARTIAL            | Paid-pilot browser/device/capture matrix and event-day test protocol are documented; named hardware and proprietary badge providers still require pilot validation. |
| Named pilot, event load and support owner     | NOT YET APPLICABLE | Requires a real customer and business decision.                                                                                                                     |
| Initial pricing and manual invoicing          | NOT YET APPLICABLE | Billing provider and commercial terms are not selected.                                                                                                             |

## Phase 1 — Tenant security and SaaS foundation

| Requirement                          | Status   | Evidence / gap                                                                                                                                                            |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace isolation                  | PARTIAL  | API queries constrain `workspace_id`; database tests now reject cross-workspace event/member and quotation/event links, but full route-level tenant tests remain.         |
| Event-level access                   | PARTIAL  | Explicit `event_memberships` now gate event, lead, task, opportunity, RFQ, quotation, AI and follow-up routes; end-to-end role fixtures remain before COMPLETE.           |
| Server-side role enforcement         | PARTIAL  | Mutations use `requireRole`; settings reads now hide member emails, invitations, audit and usage from non-admin roles. A complete role/action integration matrix remains. |
| Invitation acceptance and revocation | COMPLETE | Acceptance is explicit, email-bound, idempotent and transactional; revocation and expiry exist, while database triggers prevent concurrent acceptance or reactivation from exceeding the plan member limit. |
| Audit records                        | PARTIAL  | Important mutations are audited; reads, access denials, support access and many lifecycle changes are not.                                                                |
| Rate limits and entitlements         | COMPLETE | Central Trial/Starter/Growth/Scale policy controls active members, aggregate stored-file bytes and AI request rates; API checks provide clear errors and database triggers close concurrent member/upload and unsafe downgrade races. |
| Support access                       | COMPLETE | Owners can grant a named authenticated support identity read-only access for one to 72 hours with reason/ticket, hourly access audit, automatic expiry and immediate irreversible revocation. |
| Export                               | COMPLETE | Owner/admin full JSON export and event-scoped summary, lead, opportunity, cost and action CSV exports exist; exports are audited, role-gated and formula-injection-safe.  |
| Contact erasure                      | PARTIAL  | Personal rows and capture files are removed; failure/retry state and derivative verification need coverage.                                                               |
| Tenant deletion and retention        | PARTIAL  | Owners can schedule, cancel and execute full database/R2 deletion after a seven-day recovery period; automated due-job execution and configurable retention remain.       |
| Automated authorization tests        | PARTIAL  | `npm test` verifies role policy, unsafe SQL-expression rejection, migration backfill and cross-tenant trigger failures; route-level fixtures remain.                      |

## Phase 2 — Company intelligence and readiness

| Requirement                      | Status  | Evidence / gap                                                                                          |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| Company, products, ICP and rules | PARTIAL | CRUD paths exist; approved claims and profile version history are missing.                              |
| Knowledge files and URLs         | PARTIAL | Uploads and source records exist; ingestion, provenance, review and processing recovery are incomplete. |
| Event setup and readiness        | PARTIAL | Event configuration exists; readiness state and verified cached device configuration are missing.       |

## Phase 3 — Lead capture

| Requirement                              | Status  | Evidence / gap                                                                                                                                                                    |
| ---------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual/card/badge/QR/audio capture       | PARTIAL | Capture and upload paths exist; provider accuracy and badge compatibility require external validation.                                                                            |
| Offline outbox and stable capture ID     | PARTIAL | IndexedDB outbox and server idempotency exist; automated reopen/retry/partial-upload tests are missing.                                                                           |
| OCR confidence and correction            | PARTIAL | Extraction confidence and editable lead fields exist; explicit per-field review UI is limited.                                                                                    |
| Duplicate detection and reversible merge | PARTIAL | Same-event email/phone/name-account suggestions, reviewed merge provenance and an undo path exist; fuzzy matching and broader integration tests remain.                           |
| Consent and withdrawal                   | PARTIAL | Per-channel follow-up permission, withdrawal, hashed suppression, audit and draft/open enforcement exist; jurisdiction-specific lawful-basis policy and route-level tests remain. |

## Phase 4 — Conversation intelligence and qualification

| Requirement                             | Status  | Evidence / gap                                                                                                                                                                         |
| --------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evidence-grounded structured extraction | PARTIAL | Exact-span checks and human confirmation exist; evaluation and malformed-output tests are missing.                                                                                     |
| Explicit qualification state            | PARTIAL | Hot/Warm/Cold/Unqualified thresholds, reason, AI-confirmed history and manual override history exist; cohort calibration with pilot data remains.                                      |
| Lead ownership                          | PARTIAL | Capture ownership, event-team reassignment, reason and immutable history exist; round-robin and workload routing remain.                                                               |
| Account stakeholders                    | PARTIAL | Buying roles and same-account, same-event multi-contact opportunity associations now exist and survive reversible lead merges; influence controls and duplicate-account review remain. |

## Phase 5 — Follow-up, commitments and meetings

| Requirement                    | Status   | Evidence / gap                                                                                                                                                                                                                                    |
| ------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Confirmed commitments to tasks | PARTIAL  | AI confirmation creates idempotent dated tasks; lifecycle history and durable scheduled in-app reminder delivery are implemented. External email/SMS escalation still requires a selected provider.                                               |
| Editable communication drafts  | COMPLETE | Subject/body editing, version checks, approval invalidation, reapproval and audit are enforced server-side; approval never sends.                                                                                                                 |
| Consent/suppression check      | PARTIAL  | Draft generation and external-client opening both recheck active permission and hashed suppression; provider-side send enforcement awaits a real connector.                                                                                       |
| Meetings and calendar export   | COMPLETE | Event-scoped meetings, participants, scheduled/completed/cancelled/reopened states, optimistic version checks, history and escaped `.ics` export are implemented and covered by database/calendar regression tests. Export never claims delivery. |

## Phase 6 — Revenue workflow

| Requirement                        | Status   | Evidence / gap                                                                                                                                                                                                                                                                                        |
| ---------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opportunity lifecycle              | COMPLETE | Version-safe stage and value changes, required loss/reopen reasons, closed-state timestamps, immutable history, tenant/event/account constraints and multi-contact links are implemented with migration regression coverage.                                                                          |
| RFQ intake and reviewed extraction | COMPLETE | Original files, editable human-confirmed extraction, creator ownership, event-configured owner SLA, version-safe status changes, clarification/loss reasons, immutable history and numbered submission records are implemented with database regression coverage.                                     |
| Quotations                         | COMPLETE | Numbered commercial revisions, optimistic version checks, manager/admin/owner approval, enforced draft→approved→sent→accepted/rejected transitions, approval invalidation on revision, immutable history and database-level workspace/event/account linkage are implemented with regression coverage. |

## Phase 7 — Reporting and export

| Requirement                         | Status   | Evidence / gap                                                                                                                                                                                |
| ----------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Event lead/pipeline/revenue metrics | COMPLETE | Event-origin attribution uses a configurable post-event window and explicit 100% weight; open, weighted and won values are separated and quotation/opportunity mismatches are surfaced.       |
| Revenue ROI vs profit ROI           | COMPLETE | Planned budget, auditable planned/actual cost lines, conservative highest-evidence investment basis, gross-margin estimate, revenue ROI and profit ROI are separately calculated and labeled. |
| Next-best-action dashboard          | COMPLETE | Tasks, RFQs, quotations and hot leads share deterministic overdue, 24-hour, three-day and qualification priority rules covered by regression tests.                                           |
| Selected CSV export                 | COMPLETE | Summary, leads, opportunities, cost lines and ranked actions export as role-gated, audited, event-scoped CSV with spreadsheet-formula neutralization.                                         |

## Phase 8 — Production reliability and security

| Requirement                             | Status                               | Evidence / gap                                                                                                                                                                                                                  |
| --------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production AI configuration             | READY — EXTERNAL VALIDATION REQUIRED | Manual fallbacks exist; hosted provider credential and evaluation are external.                                                                                                                                                 |
| Outbox/background workers/dead letters  | PARTIAL                              | Durable reminder/deletion-due jobs, stale-lock recovery, exponential retry, dead letters, manual retry and in-app delivery exist. Production scheduler configuration and destructive deletion automation remain external gates. |
| Observability and alerts                | PARTIAL                              | Owner/admin Operations health shows job state, last run, critical alerts and dead jobs. External log retention, uptime monitor and pager integration remain.                                                                    |
| Backup restore, load and recovery tests | PARTIAL                              | The full 34-migration chain, integrity and foreign keys are repeatably verified; an operations runbook and load smoke exist. A hosted D1/R2 backup restore drill remains required.                                              |
| CI build gate                           | COMPLETE                             | GitHub Actions runs `npm ci` and `npm run check`.                                                                                                                                                                               |

## Later phases

| Requirement                       | Status             | Evidence / gap                                                                            |
| --------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| Paid pilot outcome                | NOT YET APPLICABLE | Must be established with real exhibitors and real event usage.                            |
| Self-service subscription         | NOT YET APPLICABLE | Requires pricing, tax/legal terms and a billing-provider decision after pilot validation. |
| CRM/messaging/calendar connectors | NOT YET APPLICABLE | Requires a selected first provider and customer sandbox credentials.                      |
| Visitor product                   | NOT YET APPLICABLE | Explicitly outside the exhibitor MVP.                                                     |

## Current execution order

1. Fix Phase 1 event authorization, read-scope exposure, explicit invitations and automated policy tests.
2. Add duplicate and consent architecture.
3. Add qualification states and ownership history.
4. Add editable drafts, messaging eligibility and meetings.
5. Correct opportunity, RFQ and quotation integrity.
6. Add CSV/report reconciliation.
7. Add operational reliability and runbooks.

No row moves to **COMPLETE** until its implementation, database behavior, authorization, validation, failure handling and repeatable verification satisfy the phase release gate.
