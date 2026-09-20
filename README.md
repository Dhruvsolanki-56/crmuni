# Revenue OS for Exhibitors

Revenue OS turns exhibition conversations into reviewable sales records, commitments, follow-ups, opportunities, RFQs, and measurable event revenue. It is a multi-tenant, mobile-first SaaS application built for teams with or without an existing CRM.

## MVP workflow

1. Configure the company, products, ideal customers, qualification rules, team, and event.
2. Capture a visitor manually or from a card, badge, QR image, or voice recording—even during a connection failure.
3. Read card and badge images locally with bundled OCR and QR decoding; keep all machine suggestions editable and separate from verified facts.
4. Review the conversation, confirm facts, score the lead, and turn commitments into dated tasks.
5. Draft a personalized email or WhatsApp message from confirmed evidence, approve it, then open the chosen channel.
6. Group contacts into accounts and classify buyer, evaluator, champion, decision-maker, influencer, or user roles.
7. Convert qualified conversations into opportunities and move them through requirement, sample, RFQ, quotation, meeting, negotiation, won, or lost.
8. Receive RFQs with original documents, structured line items, owners, deadlines, and response status.
9. Measure event investment, attributed pipeline, closed revenue, and realized ROI.

## Reliability and safety

- D1 is the authoritative store for tenant-scoped records; R2 stores original uploads.
- Offline captures use a device outbox, stable capture IDs, server-side idempotency, bounded automatic retry for transient failures, and a visible manual-review state for rejected captures instead of retrying them forever.
- Events cannot capture leads until ten readiness checks pass and an owner, admin, or manager activates that exact configuration version. The activated snapshot is SHA-256 verified before it is cached on the device for offline use.
- Workspace membership and role checks are enforced in API routes.
- Customer support access is read-only, owner-granted to a named authenticated identity, time-limited, audited, and immediately revocable.
- Trial, Starter, Growth, and Scale limits for active members, aggregate file storage, and AI request rate are enforced in API code and by database concurrency guards. Unknown plans fail closed to Trial limits.
- Uploaded file signatures are checked instead of trusting the browser-provided MIME type.
- Knowledge files and normalized URL references are fingerprinted for duplicate detection, stored with provenance, and require attributed human approval before use. Plain text and CSV content is extracted locally; arbitrary URLs are not fetched server-side.
- AI output is untrusted until a salesperson confirms it; source evidence remains retained.
- Conversation analysis is runtime-validated, unsupported facts and commitments are removed unless their exact evidence appears in the source note, and grounding is rechecked immediately before confirmation.
- Card, badge, and QR images are read in the browser with bundled English Tesseract data and QR/vCard decoding, so identity capture needs no OCR API key. Suggested fields stay editable, and the audit trail records exactly which values the salesperson reviewed. Audio transcripts become conversation evidence only through separate explicit acceptance.
- Company profile changes are versioned, evidence sources require review, and sales claims remain draft until an owner/admin approves them; only approved claims are supplied to AI follow-up generation.
- Follow-up approval does not silently send a message.
- Important changes are written to the workspace audit trail.
- Due reminders use durable jobs with stale-lock recovery, exponential retry, dead-letter alerts, and an owner/admin operations console.
- Contact erasure immediately masks direct identifiers, durably retries file/database cleanup, verifies personal derivatives are gone, and records completion before reporting success.
- Revenue reporting separates open and weighted pipeline, revenue ROI, profit ROI, and conservative cost reconciliation.

## Local development

Requirements: Node.js 22.13 or newer and npm.

```bash
npm ci
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Local preview uses a development identity; deployed Sites use authenticated user headers.

Card, badge, and QR OCR does not require an API key, paid OCR service, or runtime CDN. The worker, WebAssembly core, and English recognition model are bundled under `public/tesseract*` and run on the user's device. Optional audio transcription, conversation analysis, document extraction, and follow-up drafting still require `OPENAI_API_KEY`; their model defaults can be overridden with `OPENAI_MODEL`, `OPENAI_VISION_MODEL`, and `OPENAI_TRANSCRIBE_MODEL`.

Production background processing also requires a long random `AUTOMATION_SECRET` and an approved scheduler that calls the protected worker endpoint every minute. See `docs/OPERATIONS_RUNBOOK.md`.

## Validation

```bash
npm run check
npm run verify:migrations
npm run load:smoke
```

This runs TypeScript, strict lint over the application and runtime code, and the production build. GitHub Actions runs the same gate for every push and pull request.

`verify:migrations` rebuilds an empty SQLite database from the complete migration history and checks integrity and foreign keys. `load:smoke` exercises the local read APIs; it is not a production capacity certification.

## Deployment

The project is configured for OpenAI Sites with logical D1 (`DB`) and R2 (`FILES`) bindings. Generated migrations in `drizzle/` are the production schema history and must remain immutable after deployment.

Configure secrets through the hosted runtime; never commit `.env.local`, API keys, local D1/R2 state, or generated deployment output.

## Honest MVP boundaries

- Email and WhatsApp open in the salesperson's approved client; provider-side delivery tracking is not included yet.
- Zoho, Salesforce, and HubSpot synchronization require a later connector phase and customer credentials.
- Subscription checkout and invoicing require approved pricing, tax/legal terms, and a selected billing provider before public self-service sales. Product entitlements are already enforced independently of billing.
- Free local OCR accuracy depends on focus, lighting, card layout, font, and language. It is not guaranteed to be perfect, so every prefilled value remains visible and editable before Save.
- Card, badge, and QR reading starts immediately after image selection and prefills the capture form before Save. The original image and the reviewed fields are then stored together. The bundled sample exercises the same local path. Audio and other AI-assisted extraction remain separate optional features.
