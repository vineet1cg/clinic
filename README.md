# ClinicOS

ClinicOS is a JavaScript MERN clinic-management application with a fast React interface and a strict OpenEMR 8.x integration boundary. This repository is the production foundation: authentication, RBAC contracts, validation, structured errors, MongoDB, Redis/BullMQ, an OpenEMR FHIR adapter, an accessible dashboard shell, Docker Compose, Caddy, tests, and CI all run from one npm workspace.

## Architecture decisions

- OpenEMR is the canonical system of record for patients, encounters, diagnoses, vitals, prescriptions, and other clinical records.
- MongoDB stores ClinicOS operational data such as staff access, audit events, queue state, notification jobs, UI settings, and integration mappings.
- ClinicOS never writes directly to OpenEMR's MariaDB. All clinical access goes through `apps/api/src/integrations/openemr`.
- Browser authentication uses a signed JWT in an HTTP-only cookie. A separate CSRF cookie/header pair protects authenticated mutations. Tokens are not stored in `localStorage`.
- The BullMQ worker is a separate long-running process. It is not bundled into the API or a serverless frontend function.

## Prerequisites

- Node.js 22.13 or newer
- npm 10 or newer
- Docker Engine with Docker Compose

## Fast local setup with hot reload

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env
npm ci
npm run services:up
npm run mongo:provision
npm run db:indexes
npm run seed:admin
npm run dev
```

Open `http://localhost:5173`. Sign in with the values in `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` from `apps/api/.env`, then set a new password when prompted. The temporary password is never embedded in the browser bundle. These example credentials are only for generated local data; replace them before any live clinic pilot.

`mongo:provision` creates the restricted `readWrite` application account used by the API. It is safe to run again and is required when upgrading an existing local MongoDB volume that previously used the root account. `db:indexes` verifies required uniqueness and query indexes, including the payment idempotency constraint.

Before checking in a patient, set a positive default consultation fee in **Clinic settings → Documents and fees**, or set a doctor-specific override on **Staff**. A booked patient's fee is invoiced at check-in; a walk-in's fee is invoiced when the visit is registered. Reception records payment on that invoice. The visit stays at **Fee due** and is hidden from the doctor queue and waiting-room display until the invoice is fully paid. Demographic registration itself does not charge the patient; returning patients are billed for each visit.

The hot-reload processes are:

- web: `http://localhost:5173`
- API: `http://localhost:4000/api/v1`
- liveness: `http://localhost:4000/health/live`
- readiness: `http://localhost:4000/health/ready`
- worker: BullMQ consumer connected to local Redis

Stop dependency services with `npm run services:down`.

`services:up`, `services:status`, and `services:down` use Docker when its daemon is available. On Linux, they automatically fall back to the current user's rootless Podman socket when Docker permissions are unavailable. This avoids requiring root access merely to run MongoDB and Redis.

## Production-like local stack

```bash
cp .env.example .env
docker compose up -d mongo redis
npm run mongo:provision
docker compose up -d --build
docker compose exec api npm run seed:admin --workspace @clinicos/api
```

Open `http://localhost`. Caddy is the only public ingress; MongoDB and Redis are bound to loopback for local development and also live on an internal Docker network.

To include the heavier OpenEMR environment:

```bash
docker compose --profile openemr up -d openemr-db openemr
```

OpenEMR is then available only on `http://127.0.0.1:8300`. Follow [the OpenEMR validation guide](docs/openemr-validation.md) before enabling the integration.

## Common commands

```bash
npm run lint
npm test
npm run build
npm run format:check
npm run security:check
npm run smoke:workflow
docker compose config --quiet
```

## Workspace map

```text
apps/web          React, Vite, Tailwind, routing, auth context, clinic UI
apps/api          Express, Mongoose, security middleware, modules, OpenEMR adapter
apps/worker       BullMQ notification worker
packages/contracts Shared runtime schemas, roles, permissions, queue states
infra/caddy       Same-origin reverse proxy
infra/mongo       Fresh-volume least-privilege user initialization
infra/openemr     Optional local OpenEMR profile notes
docs              Architecture, deployment, permissions, integration proof, plans
```

## Data safety

Never use real patient information in development, automated tests, screenshots, or staging. The included UI starts with zero-value operational metrics and contains no fabricated medical charts. Production secrets belong in a secret manager or protected deployment environment, never in Git.

## Appearance

Use the **Light / Dark / System** selector in the app header or on the login screen. System is the default and follows operating-system changes. The choice is saved locally to this browser and synchronized across its tabs; it is not saved to a staff account or MongoDB. If browser storage is blocked, the choice still works until the tab reloads.

The same palette covers forms, tables, status badges, password changes, and the public waiting-room display. Receipts and other printed pages always use the light palette and hide navigation and action controls. An external bootstrap script applies the preference before React loads without weakening the production Content Security Policy.

Theme tokens live in `apps/web/src/styles/index.css`. Use semantic `clinic-*` colors for new screens rather than hard-coded white backgrounds. Keep `clinic-action` button fills separate from `clinic-primary` text colors so white button labels remain readable in both modes. See [the Graphify review and verification notes](docs/graphify-review-2026-09-18.md).

## Current implementation status

The local workflow includes forced first-login password rotation, role and permission boundaries, patient registration/search, appointments, previsit consultation invoices, payment-gated queue/check-in, encounters, additional-service billing and idempotent payment collection, inventory, lab orders/results, reports, and reviewable audit records. `npm run smoke:workflow` uses a disposable fake-patient account and cleans up its records without resetting the clinic administrator's password.

This is still a pilot foundation, not approval for real-patient production use. The remaining release gates are a real OpenEMR 8.x OAuth/FHIR proof with generated patients; reliable multi-document financial updates (MongoDB replica-set transactions or a reconciliation/outbox design); a formal refund/void policy and payment reconciliation; encrypted backup/restore drills; and clinic-hardware/security acceptance testing. Recording UPI/card payment currently records staff attestation and a reference—it does not verify settlement with a payment provider. See [the previsit fee plan](docs/superpowers/plans/2026-09-17-previsit-consultation-fee.md), [security hardening plan](docs/superpowers/plans/2026-09-15-security-hardening.md), and [OpenEMR validation guide](docs/openemr-validation.md).

With `OPENEMR_ENABLED=false`, patient and encounter data used in local development are ClinicOS-local test records. Appointment and encounter writes are not yet proven to synchronize to OpenEMR; do not use this mode as a live clinical record system.

## More documentation

- [Maitri branding and invoice printing](docs/branding.md)
- [Investigations sheet transcription and blank print template](docs/investigations-ocr.md)
- [Short implementation roadmap](docs/implementation-roadmap.md)
- [Architecture reference — system boundaries, data flows, authentication, payments, deployment, and extension guide](docs/architecture.md)
- [Permissions](docs/permissions.md)
- [Deployment and Vercel](docs/deployment.md)
- [OpenEMR validation](docs/openemr-validation.md)
- [Security audit (2026-09-15)](docs/security-audit-2026-09-15.md)
