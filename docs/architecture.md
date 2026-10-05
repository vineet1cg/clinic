# ClinicOS architecture reference

Last reviewed: **2026-09-18**. This describes the repository implementation, not a claim of production readiness.

This is the canonical technical reference for onboarding and future changes. The [original specification](../clinicos_end_to_end_spec.md) describes the broader product; this document distinguishes implemented behavior from target architecture. JavaScript and MongoDB are intentional project choices, superseding the original PostgreSQL recommendation.

## 1. System overview

ClinicOS is a modular monolith with a separately deployed worker and a static browser application, not independently deployed domain microservices.

```text
Doctor / reception / nurse / billing browser
                  |
                  v
           Caddy ingress
             /        \
     page/assets       /api/*
          |                |
          v                v
    Nginx -> React    Express API
                           |
              +------------+----------------+
              |            |                |
              v            v                v
           MongoDB       Redis       OpenEMR REST/FHIR
           records       BullMQ      optional integration
                           |                |
                           v                v
                     Node worker      MariaDB + documents
```

This is the Compose topology. OpenEMR is disabled by default. Caddy currently listens on HTTP for local development; production TLS requires separate configuration. ClinicOS never directly queries OpenEMR's MariaDB tables.

| Component            | Implementation                    | Responsibility                                                                 |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------ |
| Browser              | React, JavaScript, Vite, Tailwind | Workflows, navigation, forms, printing, appearance                             |
| API                  | Node.js, Express, Mongoose        | Auth, permissions, validation, business rules, persistence, audit, integration |
| Operational database | MongoDB                           | Accounts, visits, billing, operations, and current local clinical test records |
| Job broker           | Redis + BullMQ                    | Retryable job storage; not the primary clinical database                       |
| Worker               | Separate Node.js process          | Notification job handling; delivery provider remains a stub                    |
| Clinical integration | OpenEMR REST/FHIR adapter         | Intended clinical system of record after validation                            |
| Shared contracts     | JavaScript + Zod                  | Runtime schemas, roles, permissions, statuses, queue transitions               |

## 2. Repository boundaries

```text
apps/web/
  public/theme-init.js       Theme selection before React starts
  src/app/                  Router and application entry
  src/pages/                Route-level workflow screens
  src/components/           Layout, forms, feedback, reusable UI
  src/contexts/             Authentication and theme providers
  src/hooks/                Provider access and browser helpers
  src/services/             HTTP client and endpoint functions
  src/styles/               Tailwind and semantic theme tokens
  src/utils/                Formatting and theme helpers
apps/api/src/
  app.js, server.js         Express setup, startup, shutdown
  routes/                   /api/v1 module registration
  modules/                  Domain routes, controllers, services
  models/                   Mongoose schemas and indexes
  middleware/               Auth, permissions, CSRF, validation, errors
  integrations/openemr/     OAuth and REST/FHIR boundary
  queues/                   Redis connections and queue producer
  common/                   Clinic context, time, privacy, errors
  config/, scripts/         Environment, logs, admin seed, indexes
apps/worker/src/            Worker lifecycle, configuration, handlers
packages/contracts/src/    Shared runtime contracts
infra/                     Caddy, Mongo provisioning, OpenEMR notes
scripts/                   Compose helpers and workflow smoke test
docs/                      Architecture, deployment, security, plans
graphify-out/              Generated graph and review memory
```

npm workspaces share the root lockfile; install with `npm ci` at the root. Browser code can import `@clinicos/contracts`, never API models, server configuration, or integration secrets. The API owns all persistent business decisions: browser state cannot authorize a payment or queue transition.

## 3. Frontend architecture

The provider hierarchy is:

```text
StrictMode
  ThemeProvider
    ErrorBoundary
      QueryClientProvider
        AuthProvider
          App -> Router -> ProtectedRoute -> AppShell -> page
```

- React Router lazy-loads pages. Main route families are `/login`, `/change-password`, `/app/*`, and `/display/:doctorId`.
- `ProtectedRoute` handles authentication and mandatory password rotation. `PermissionBoundary` prevents restricted pages from mounting; the sidebar filters links too. These are UX boundaries, not replacements for API authorization.
- TanStack Query manages server-state caching and invalidation. Default stale time is 30 seconds; queries retry non-4xx failures a limited number of times. Mutations do not automatically retry.
- React Hook Form and shared Zod schemas validate forms. The server independently validates input.
- `services/http.js` uses credentialed Axios requests, a 12-second timeout, and CSRF headers for mutations. Domain services return resource-shaped JSON.
- A timeout or render failure does not prove a write failed. Check saved records before resubmitting; reuse the same idempotency key when retrying the same supported operation.
- There is no offline-write queue or service-worker clinical datastore. Local hosting still requires a working API and database.

### Appearance and printing

`ThemeProvider` supports Light, Dark, and System. System follows OS changes. `clinicos.theme` in localStorage stores only the browser preference, not credentials or patient information. Tabs synchronize through storage events; blocked storage permits an in-memory choice until reload.

`public/theme-init.js` applies the preference before React loads using an external CSP-compatible script. Semantic colors live in `src/styles/index.css`. Use `clinic-surface`, `clinic-text`, and matching status foreground/background tokens. Keep solid `clinic-action` button fills separate from `clinic-primary` text colors. Dark overrides are screen-only; print CSS keeps documents light and hides `.no-print` controls and the navigation gutter.

## 4. API architecture and conventions

The Express bootstrap installs request IDs, structured logging, Helmet, CORS allowlisting, rate limiting, bounded body parsing, cookies, and Mongo-operator rejection before `/api/v1`. Module routes add authentication, permissions, CSRF, and Zod validation as appropriate. Controllers coordinate HTTP and services/models. Some domains still keep business logic in controllers; a service layer is not uniformly extracted.

Success bodies are resource-specific: `{ user }`, `{ patients }`, `{ invoice }`, etc. Errors use `{ error: { code, message, requestId, details? } }`. `X-Request-Id` correlates responses with logs. Do not expose stack traces, credentials, clinical notes, or upstream response bodies in errors/logs.

All prefixes below are relative to `/api/v1`. Route files are authoritative for methods and permissions; a constant or advertised resource is not proof of an implemented endpoint.

| Prefix          | Responsibility                                           | Source directory       |
| --------------- | -------------------------------------------------------- | ---------------------- |
| `/auth`         | Login, logout, current user, password rotation           | `modules/auth`         |
| `/patients`     | Registration, duplicate detection, search, summary       | `modules/patients`     |
| `/appointments` | Booking, doctors, cancellation, check-in                 | `modules/appointments` |
| `/queue`        | Walk-ins, states, invoice recovery, public token display | `modules/queue`        |
| `/encounters`   | Consultation, vitals, notes, prescriptions, completion   | `modules/encounters`   |
| `/billing`      | Invoices and payment collection                          | `modules/billing`      |
| `/inventory`    | Stock items and transactions                             | `modules/inventory`    |
| `/lab`          | Orders and results                                       | `modules/lab`          |
| `/reports`      | Dashboard and permission-filtered summaries              | `modules/reports`      |
| `/staff`        | Staff accounts and role information                      | `modules/staff`        |
| `/settings`     | Clinic configuration and default consultation fee        | `modules/settings`     |
| `/audit`        | Authorized audit inspection                              | `modules/audit`        |

Vitals and prescriptions belong to the encounter module, not separate mounted top-level routers. The public queue display is intentionally unauthenticated and must retain its restricted, non-clinical response shape.

## 5. Authentication, authorization, and privacy

1. Login checks bcrypt password hashes, account status, failed attempts, and lockout. Auth routes have rate limits.
2. The API creates an HS256 JWT with issuer, audience, expiry, user subject, session version, and random CSRF value. The session cookie is HttpOnly; the CSRF cookie is readable by the browser.
3. Authenticated requests verify the JWT and reload the user from MongoDB. Account status and `sessionVersion` can invalidate existing sessions.
4. `verifyCsrf` compares the `X-CSRF-Token` header, cookie, and signed session value on protected mutations.
5. Effective permissions combine role permissions and additional grants, minus denials. Password-reset-required accounts receive no ordinary workflow permissions until rotation.
6. Logout increments the user's session version, invalidating existing sessions across devices, not only the current tab. Password changes also rotate it.

Cookies currently use `SameSite=Lax`, host-only scope, and a configurable Secure flag. Production validation requires HTTPS origins and secure cookies. JWT expiry and cookie lifetime are separate settings; keep them aligned deliberately. Bearer-token support in authentication does not bypass route-level CSRF requirements or establish a separate machine-to-machine auth design.

Role constants include administrator, clinic owner, desk manager, receptionist, doctor, nurse, billing, pharmacy, laboratory, and patient. This does not imply a complete patient portal or implementation of every permission. See [permissions](permissions.md) and `packages/contracts/src/constants.js`.

Clinic-scoped queries must derive `clinicId` from authenticated context and validate related records belong to that clinic. An ID alone is not authorization. Default-clinic provisioning and clinic fields are not proof of a fully audited multi-tenant SaaS architecture.

Audit records contain actor, action, resource, time, and bounded allowlisted metadata. HTTP logs omit bodies and query strings and redact credentials. Audit writes are separate MongoDB operations, not an immutable external ledger or transactionally guaranteed companions to every business update. Never place clinical free text in audit metadata.

## 6. Persistence and ownership

**Today:** MongoDB persists ClinicOS data, including patients and encounters in local workflows. With `OPENEMR_ENABLED=false`, patients are marked `CLINICOS_LOCAL`. This mode is for local test records, not approved real-patient clinical use.

**Target:** OpenEMR owns clinical truth; ClinicOS owns operational state and necessary external references/projections. The patient adapter can attempt remote FHIR creation when enabled, but appointment/encounter synchronization is not established end to end. Local clinical documents are not an already synchronized OpenEMR cache.

| Mongoose model   | Contents / relationships                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------- |
| `User`           | Staff identity, roles, permission overrides, password/session state, doctor fee          |
| `Patient`        | Demographics, search fields, patient number, optional OpenEMR ID                         |
| `Appointment`    | Patient/doctor booking and check-in linkage                                              |
| `QueueEntry`     | Patient, doctor, optional appointment, daily token, state history, fee snapshot, invoice |
| `Encounter`      | Visit-linked consultation, vitals, diagnoses/prescriptions in the local workflow         |
| `Invoice`        | Patient/visit linkage, purpose, line items, totals, embedded payments/replay keys        |
| `InventoryItem`  | Stock information and transaction history                                                |
| `LabOrder`       | Patient-linked order and result workflow                                                 |
| `ClinicSettings` | Clinic configuration, timezone, document preferences, default fee                        |
| `AuditLog`       | Security and operational event history                                                   |
| `Counter`        | Sequence allocation for identifiers and daily tokens                                     |

Payments are embedded in invoices, not stored in a separate payment collection. MongoDB references are not foreign-key constraints; services must check relationships. Shared schema options add timestamps, serialization filtering, and optimistic concurrency for document saves. That does not make multi-document work transactional or protect every raw update.

Important indexes enforce invoice numbers, payment replay keys across invoices, one consultation invoice per visit, one queue entry per appointment, walk-in registration keys, and daily clinic token uniqueness. Optional-key uniqueness uses partial indexes. Run `npm run db:indexes` as a controlled release step; investigate duplicates rather than deleting live records to force index creation.

## 7. Payment-before-doctor workflow

The confirmed rule is payment at booked-patient check-in or walk-in visit registration, before admission to the doctor queue. Creating a patient demographic record alone does not create a charge.

```text
Patient selected/created
          |
Appointment check-in OR walk-in visit registration
          |
Resolve positive doctor fee, otherwise clinic default; snapshot onto visit
          |
PAYMENT_PENDING + consultation invoice
          |
Collect payment -> persist invoice and payment replay key
          |
          +-- balance > 0: remain PAYMENT_PENDING
          |
          +-- paid in full: release to WAITING
                                  |
                       permitted vitals/doctor transitions
                                  |
                              consultation
                                  |
                     CONSULTATION_COMPLETE
                        (awaiting reception)
                          /               \
             no extra charges       prepare final invoice
                    |                       |
               COMPLETED             BILLING_PENDING
                                            |
                                      payment -> PAID
                                            |
                                       COMPLETED
```

`modules/billing/consultation.service.js` coordinates fee resolution, invoice creation/recovery, payment checks, and release. A missing/non-positive effective fee blocks new registration. Reception can see payment-pending visits; allocating a token does not admit the patient to the doctor workflow. The API enforces payment, not merely the UI.

Key operations, relative to `/api/v1`:

- `POST /queue`: walk-in registration with a stable `Idempotency-Key`.
- `POST /appointments/:id/check-in`: appointment-linked visit registration.
- `POST /queue/:id/consultation-invoice`: recover/reuse an applicable consultation invoice after interruption.
- `POST /billing/invoices/:id/payments`: collection requiring an `Idempotency-Key`.
- `PATCH /queue/:id/state`: transitions guarded by the shared state machine and payment checks.

Matching payment retries return the saved result; reuse with different details is rejected. A replay can retry release of a paid consultation visit. Full payment moves it to `WAITING` and sets payment-cleared/check-in timestamps. Legacy visits without `paymentRequired` are not retroactively charged.

The doctor completes the encounter but does not perform reception or billing transitions. Completion
locks the clinical record, records an audited reception handoff, and moves the queue entry to
`CONSULTATION_COMPLETE` (**Awaiting reception**). A receptionist can close a visit with no extra
charges, or create a final general invoice for post-consultation services. Returning to a
`BILLING_PENDING` visit recovers its existing general invoice instead of presenting a fresh bill.

The flow spans multiple documents without a transaction. A payment can persist before queue release or audit writing fails. Recovery and replay reduce duplicate work but do not provide exactly-once execution or full financial atomicity. Replica-set transactions or durable outbox/reconciliation remain release work. UPI/card payments currently record staff attestation and a reference, not verified provider settlement.

## 8. OpenEMR boundary

`integrations/openemr` owns OAuth token acquisition, authenticated HTTP, timeouts, one authentication retry on 401, safe errors, and patient mapping. Credentials stay server-side.

The current patient path creates the remote record before inserting the local document. A local failure after remote success can cause a duplicate on retry. Remote mutation idempotency and reconciliation require validation before real use. A responding health endpoint does not prove correct scopes, mappings, permissions, or synchronization.

Use generated records with the [OpenEMR validation guide](openemr-validation.md). The optional Compose profile owns MariaDB and document volumes too: MongoDB backup alone cannot restore the integrated system.

## 9. Background jobs and reliability

The API initializes a BullMQ notification queue. Jobs have five attempts, exponential backoff starting at two seconds, and bounded completion/failure retention. A separate worker uses configurable concurrency and shutdown handling.

The handler validates supported names and required fields. `development-log` returns `delivered: false`; `disabled` fails the job. No real SMS/WhatsApp/email provider is implemented. Queue plumbing does not prove workflow notifications are delivered. Future jobs must use minimal payloads and retry-safe handlers.

API startup waits for MongoDB and Redis before listening. `/health/live` indicates the process is serving. `/health/ready` checks MongoDB, Redis, and optional OpenEMR reachability; an OpenEMR 401 counts as reachable, not authenticated. Production readiness responses omit dependency details.

On termination, the API stops HTTP acceptance and closes connections with a forced shutdown deadline; the worker closes independently. These mechanisms do not implement backup scheduling, external alerts, or a failed-job operations dashboard.

## 10. Deployment and configuration

### Development

`npm run dev` starts Vite, API, and worker using their development scripts. Vite serves port 5173 and proxies `/api` and `/health` to port 4000. MongoDB/Redis must already be reachable. Follow [README](../README.md) for templates and provisioning. Never put secrets in `VITE_*`: those are public build-time values.

### Docker Compose

Caddy routes `/api/*` and `/health/live` to Express; other requests go to the Nginx static frontend. `/health/ready` is checked inside the API container, not exposed by Caddy's backend matcher. MongoDB and Redis publish loopback-only ports for development and persist to named volumes. The worker has no public HTTP port. The `openemr` profile adds its database/documents.

The internal `app` network isolates services; external integration providers may need a deliberately configured egress path. Do not assume cloud OpenEMR/notification endpoints are reachable from every container. Supplied HTTP/development defaults, sample secrets, and a single MongoDB node are not a production rollout configuration.

### Future Vercel frontend

The root `vercel.json` builds `apps/web/dist` and supplies SPA rewrites/security headers. It does not deploy the API, worker, databases, or OpenEMR, and does not configure an API proxy rewrite.

Current authentication assumes the browser can read the CSRF cookie. Changing `VITE_API_URL` to an unrelated domain is insufficient: host-only cookies, `SameSite=Lax`, readable CSRF scope, credentialed CORS, and network reachability need a coherent design. Prefer a verified same-origin gateway/proxy, or explicitly redesign/test cross-origin session handling. A public frontend cannot assume access to a private clinic LAN API. See [deployment guidance](deployment.md); split-origin deployment is not completed by the template.

## 11. Testing and extension workflow

CI runs locked dependency installation, ESLint, Prettier, workspace tests, production build, Compose configuration validation, and production dependency audit. It is a quality pipeline, not automatic production deployment.

```bash
npm run lint
npm run format:check
npm test
npm run build
npm run compose:config
npm run smoke:workflow
```

The workflow smoke script requires a configured running environment and uses disposable fake records. Unit tests and builds do not prove live OpenEMR behavior, financial concurrency, backups, or production proxy configuration. The [theme review](graphify-review-2026-09-18.md) records isolated browser checks and their limits.

For a new feature:

1. Confirm data ownership, permission, and clinic boundary before adding fields.
2. Add shared schemas/constants where browser and server genuinely share a contract.
3. Add models/indexes and a safe existing-data rollout plan.
4. Implement validated/authorized routes and domain logic, including recovery and audit.
5. Add frontend services, query invalidation, route permissions, and semantic theme styles.
6. Test invalid input, denied access, cross-clinic references, replay, partial failure, and relevant printing/browser behavior.
7. Update architecture and decision/deployment notes when boundaries change. Refresh Graphify when appropriate; its map aids navigation but does not replace source verification.

## 12. Remaining release decisions

- Prove OpenEMR patient, appointment, encounter, observation, and prescription behavior; settle clinical ownership and migration.
- Make money/stock updates recoverable with transactions or durable reconciliation; define refunds, voids, and settlement.
- Implement real notification delivery if required for the pilot.
- Validate TLS, secrets, least privilege, deployment egress, actual security headers, and frontend/API origin topology.
- Implement encrypted backups and prove restores across MongoDB, MariaDB, and documents; define recovery objectives and monitoring.
- Validate actual clinic hardware, printers, keyboard access, and operational acceptance before real-patient use.

Related references: [decisions](decisions.md), [permissions](permissions.md), [deployment](deployment.md), [security audit](security-audit-2026-09-15.md), [previsit fee plan](superpowers/plans/2026-09-17-previsit-consultation-fee.md), and [original specification](../clinicos_end_to_end_spec.md).
