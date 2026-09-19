# Revenue OS operations runbook

## Release gate

Do not publish a release unless all of these are true:

1. `npm ci`, `npm run verify:migrations`, and `npm run check` pass from a clean checkout.
2. The target environment has D1 `DB`, R2 `FILES`, authentication headers, and a long random `AUTOMATION_SECRET` configured.
3. Every unapplied SQL file in `drizzle/` is applied once, in filename order, before application traffic is moved to the new release.
4. A pre-migration D1 export and R2 inventory are retained outside the application account according to the customer retention policy.
5. A browser smoke test covers sign-in, event selection, offline capture, lead review, task creation, opportunity, RFQ, quotation, report export, and workspace isolation.
6. The Operations health panel has no unexplained critical alerts or dead jobs.

Never edit a migration that has reached a shared environment. Add a new forward migration.

## Worker schedule

Call `POST /api/operations` with JSON `{ "action": "run_all" }` and `Authorization: Bearer <AUTOMATION_SECRET>` every minute from the approved scheduler. The endpoint processes at most 25 due jobs per invocation, uses a ten-minute stale-lock recovery window, applies exponential retry, and opens a critical alert after the configured attempt limit.

The worker currently performs in-app task reminders and raises a protected deletion-due alert. It does not send email/WhatsApp and does not automatically erase a tenant. Final tenant erasure still requires the owner to type the exact workspace name after the recovery period; this is intentional until a production backup/restore drill proves the automated destructive path.

## Daily operator checks

1. Open Workspace settings → Operations health.
2. Check `dead`, `failed`, and `running` counts. A running job older than ten minutes is reclaimed automatically on the next run.
3. Inspect critical alerts before retrying. Correct configuration or data first; blind retry can repeat the same failure.
4. Verify the latest job run occurred within two scheduler intervals.
5. Review storage and active-member usage for unexpected growth.
6. Treat dead `lead_contact_erasure` jobs as privacy incidents: retry after correcting R2/D1 access, confirm the erasure request reaches `completed`, and retain the alert acknowledgement trail.

## Incident response

1. Stop the scheduler if jobs cause repeated harmful mutations.
2. Preserve request IDs, job IDs, timestamps, workspace ID, deployment version, and audit rows. Do not copy lead content into a public ticket.
3. Classify impact: tenant isolation, data loss, missed reminder, delayed processing, or degraded AI only.
4. For suspected tenant leakage, disable the affected route or deployment immediately, rotate exposed credentials, preserve logs, and notify the responsible privacy/security owner.
5. For a dead job, resolve the cause, use Retry in Operations health, run due jobs, and verify the resulting notification/audit row.
6. Record root cause, affected tenants, recovery evidence, and a regression test before closing the incident.

## Backup and restore rehearsal

Before every schema release, export the production D1 database using the hosting provider's authenticated D1 export flow and capture an R2 object inventory with key, size, and checksum where available. Store both in the approved encrypted backup location; never commit them.

Quarterly, restore the D1 export into an isolated non-production database, point an isolated R2 bucket at a copied sample, apply pending migrations, then run:

```bash
npm ci
npm run verify:migrations
npm run check
```

Validate row counts for workspaces, memberships, leads, tasks, opportunities, RFQs, quotations, cost lines, background jobs, notifications, and audit events. Download a sample of each stored document type and verify its checksum. Record recovery-point time, recovery duration, tester, exceptions, and deletion of rehearsal data.

Do not claim backup readiness until a real hosted export and restore has been completed and signed off. The repository check proves that the migration chain creates an internally consistent empty database; it is not evidence that provider backups or R2 recovery work.

## Load smoke

With the local server running, execute `npm run load:smoke`. Defaults are 60 authenticated local read requests at concurrency six across workspace, event, and report routes. Any HTTP failure fails the command. Save p50, p95, maximum latency, machine details, and data volume with the release record. This is a smoke test, not a production capacity certification.
