# ClinicOS Production Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a runnable JavaScript MERN monorepo that proves ClinicOS's application shell, authentication boundary, health checks, queue infrastructure, shared contracts, OpenEMR adapter boundary, and production-style container topology.

**Architecture:** React/Vite is a role-aware SPA under `apps/web`; Express is the `/api/v1` backend under `apps/api`; a separate BullMQ worker runs under `apps/worker`. MongoDB stores ClinicOS operational records only, Redis carries durable jobs, and every clinical-data operation is isolated behind an OpenEMR 8.x REST/FHIR adapter so ClinicOS never writes to OpenEMR's MariaDB.

**Tech Stack:** npm workspaces, JavaScript ESM, React, Vite, Tailwind CSS, TanStack Query, React Router, Express, Mongoose, Redis, BullMQ, Zod, JWT in HTTP-only cookies, Vitest, Supertest, Docker Compose, Caddy.

## Global Constraints

- Use JavaScript, not TypeScript, throughout application and test code.
- Use MongoDB for ClinicOS operational data; OpenEMR remains the source of truth for canonical clinical data.
- Use `/api/v1` for versioned application APIs.
- Do not directly read from or write to OpenEMR's MariaDB.
- Keep authentication credentials out of `localStorage`; use an HTTP-only cookie and CSRF header/cookie pairing.
- Target the Phase 1 clinic workflow first: registration, search, walk-in, queue, vitals, consultation, prescription, billing, printing, follow-up, reports, audit, and backup.
- Optimize the UI for keyboard navigation, 44px minimum touch targets, clear focus states, reduced motion, small bundles, and low-powered clinic hardware.
- Keep MongoDB, Redis, and OpenEMR's MariaDB off public host ports in the production topology.
- Never use real patient data in development, staging, fixtures, or automated tests.

---

## Planned File Structure

```text
.
├── apps
│   ├── api              # Express API, Mongoose models, auth, OpenEMR adapter
│   ├── web              # React/Vite/Tailwind role-aware clinic UI
│   └── worker           # Long-running BullMQ notification worker
├── packages
│   └── contracts        # Shared roles, permissions, states, and Zod schemas
├── infra
│   ├── caddy            # Reverse proxy routing
│   └── openemr          # Optional local OpenEMR environment documentation
├── design-system        # Persisted ClinicOS visual tokens and UX rules
├── docs                 # Architecture, permissions, deployment, onboarding
├── .github/workflows    # Deterministic lint/test/build CI
├── docker-compose.yml   # Full local production-like topology
├── eslint.config.js     # Shared browser/Node lint policy
└── package.json         # npm workspace orchestration
```

### Task 1: Workspace and Shared Contracts

**Files:**

- Create: `package.json`
- Create: `package-lock.json`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/constants.js`
- Create: `packages/contracts/src/schemas.js`
- Create: `packages/contracts/src/index.js`
- Test: `packages/contracts/src/contracts.test.js`

**Interfaces:**

- Consumes: role and permission names from specification sections 6–8; queue states from section 10; appointment fields from section 11.
- Produces: `USER_ROLES`, `PERMISSIONS`, `ROLE_PERMISSIONS`, `QUEUE_STATES`, `QUEUE_TRANSITIONS`, `APPOINTMENT_TYPES`, `loginSchema`, `patientCreateSchema`, `appointmentCreateSchema`, and `queueTransitionSchema`.

- [ ] **Step 1: Write schema and state-machine tests**

```js
expect(patientCreateSchema.safeParse(validPatient).success).toBe(true);
expect(patientCreateSchema.safeParse({ fullName: '', mobile: '12' }).success).toBe(false);
expect(QUEUE_TRANSITIONS.WAITING).toContain('VITALS_PENDING');
expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain(PERMISSIONS.ENCOUNTER_UPDATE);
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `npm test --workspace @clinicos/contracts`

Expected: FAIL because the package and exports do not exist yet.

- [ ] **Step 3: Implement frozen constants and Zod contracts**

```js
export const USER_ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  CLINIC_OWNER: 'CLINIC_OWNER',
  DESK_MANAGER: 'DESK_MANAGER',
  RECEPTIONIST: 'RECEPTIONIST',
  DOCTOR: 'DOCTOR',
  NURSE: 'NURSE',
  BILLING_STAFF: 'BILLING_STAFF',
  PHARMACIST: 'PHARMACIST',
  LAB_STAFF: 'LAB_STAFF',
  PATIENT: 'PATIENT',
});
```

Add npm workspace scripts for `dev`, `build`, `lint`, `test`, `format`, dependency services, seeding, and complete Compose startup. Add a flat ESLint config with separate browser, Node, and test globals.

- [ ] **Step 4: Install and verify contracts**

Run: `npm install && npm test --workspace @clinicos/contracts`

Expected: dependency lockfile is created and contract tests PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json eslint.config.js .prettierrc.json .gitignore .env.example packages/contracts
git commit -m "chore: initialize ClinicOS workspaces and contracts"
```

### Task 2: Express API Security and Error Foundation

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/.env.example`
- Create: `apps/api/src/app.js`
- Create: `apps/api/src/server.js`
- Create: `apps/api/src/config/env.js`
- Create: `apps/api/src/config/logger.js`
- Create: `apps/api/src/db/mongoose.js`
- Create: `apps/api/src/middleware/request-id.js`
- Create: `apps/api/src/middleware/validate.js`
- Create: `apps/api/src/middleware/not-found.js`
- Create: `apps/api/src/middleware/error-handler.js`
- Create: `apps/api/src/common/app-error.js`
- Create: `apps/api/src/routes/index.js`
- Test: `apps/api/src/app.test.js`

**Interfaces:**

- Consumes: `loginSchema` and API constants from `@clinicos/contracts`.
- Produces: `createApp()`, `connectMongo()`, `disconnectMongo()`, `validate(schema)`, `AppError`, and the standard `{ error: { code, message, requestId, details? } }` response.

- [ ] **Step 1: Write HTTP contract tests**

```js
const response = await request(createApp()).get('/health/live');
expect(response.status).toBe(200);
expect(response.body).toMatchObject({ status: 'ok', service: 'clinicos-api' });

const missing = await request(createApp()).get('/api/v1/missing');
expect(missing.status).toBe(404);
expect(missing.body.error.code).toBe('ROUTE_NOT_FOUND');
expect(missing.body.error.requestId).toBeTruthy();
```

- [ ] **Step 2: Run the API test and verify red**

Run: `npm test --workspace @clinicos/api`

Expected: FAIL because `createApp()` does not exist.

- [ ] **Step 3: Implement the middleware pipeline**

Create an Express app with trust-proxy configuration, request IDs, pino structured logging, Helmet, explicit CORS origins, JSON/body size limits, cookie parsing, Mongo operator sanitization, rate limits, `/health/live`, `/health/ready`, `/api/v1`, 404 conversion, and centralized error handling. Production errors must never include stack traces.

- [ ] **Step 4: Verify the API contract**

Run: `npm test --workspace @clinicos/api`

Expected: health, not-found, request ID, and validation tests PASS without requiring a database connection.

- [ ] **Step 5: Commit**

```bash
git add apps/api
git commit -m "feat(api): add secure Express application foundation"
```

### Task 3: Authentication, RBAC, Audit, and Queue Models

**Files:**

- Create: `apps/api/src/models/user.model.js`
- Create: `apps/api/src/models/audit-log.model.js`
- Create: `apps/api/src/models/queue-entry.model.js`
- Create: `apps/api/src/modules/auth/auth.service.js`
- Create: `apps/api/src/modules/auth/auth.controller.js`
- Create: `apps/api/src/modules/auth/auth.routes.js`
- Create: `apps/api/src/middleware/authenticate.js`
- Create: `apps/api/src/middleware/authorize.js`
- Create: `apps/api/src/middleware/csrf.js`
- Create: `apps/api/src/modules/audit/audit.service.js`
- Create: `apps/api/src/modules/queue/queue-state.service.js`
- Create: `apps/api/src/scripts/seed-admin.js`
- Test: `apps/api/src/modules/queue/queue-state.service.test.js`
- Test: `apps/api/src/modules/auth/auth.routes.test.js`

**Interfaces:**

- Consumes: role/permission constants and `QUEUE_TRANSITIONS` from `@clinicos/contracts`.
- Produces: `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `authenticate`, `authorize(permission)`, `verifyCsrf`, `writeAuditEntry()`, and `assertQueueTransition(from, to)`.

- [ ] **Step 1: Write queue transition and auth validation tests**

```js
expect(() => assertQueueTransition('WAITING', 'VITALS_PENDING')).not.toThrow();
expect(() => assertQueueTransition('WAITING', 'PAID')).toThrowError(/transition/i);

const response = await request(createApp())
  .post('/api/v1/auth/login')
  .send({ email: 'bad', password: '' });
expect(response.status).toBe(422);
expect(response.body.error.code).toBe('VALIDATION_ERROR');
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm test --workspace @clinicos/api`

Expected: FAIL because auth routing and queue transition enforcement are absent.

- [ ] **Step 3: Implement secure authentication scaffold**

Hash passwords with bcrypt, lock accounts after repeated failures, sign short-lived JWT sessions into an HTTP-only cookie, issue a separate CSRF token cookie, require the matching `X-CSRF-Token` header for authenticated mutations, resolve granular permissions from roles, and record login/logout/failure audit events without copying secrets.

- [ ] **Step 4: Verify auth and queue policy**

Run: `npm test --workspace @clinicos/api`

Expected: validation and queue tests PASS; database-backed login logic is isolated so HTTP contract tests remain deterministic.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src
git commit -m "feat(api): scaffold authentication rbac audit and queue state"
```

### Task 4: Redis, BullMQ Worker, and OpenEMR Adapter

**Files:**

- Create: `apps/api/src/queues/redis.js`
- Create: `apps/api/src/queues/notification.queue.js`
- Create: `apps/api/src/integrations/openemr/client.js`
- Create: `apps/api/src/integrations/openemr/auth.js`
- Create: `apps/api/src/integrations/openemr/patients.js`
- Create: `apps/api/src/integrations/openemr/errors.js`
- Create: `apps/api/src/integrations/openemr/index.js`
- Create: `apps/worker/package.json`
- Create: `apps/worker/.env.example`
- Create: `apps/worker/src/config.js`
- Create: `apps/worker/src/handlers/notification.handler.js`
- Create: `apps/worker/src/index.js`
- Test: `apps/worker/src/handlers/notification.handler.test.js`

**Interfaces:**

- Consumes: `QUEUE_NAMES` and `NOTIFICATION_JOB_TYPES` from shared contracts plus explicit OpenEMR base/token URL credentials.
- Produces: `notificationQueue`, `closeQueues()`, `OpenEmrClient.request(path, options)`, `findPatientByMobile(phone)`, `createPatient(input)`, and `processNotificationJob(job)`.

- [ ] **Step 1: Write a deterministic worker handler test**

```js
const result = await processNotificationJob({
  id: 'job-1',
  name: 'APPOINTMENT_REMINDER',
  data: { recipient: '+919999999999', templateCode: 'appointment_reminder' },
});
expect(result).toMatchObject({ delivered: false, provider: 'development-log' });
```

- [ ] **Step 2: Run the worker test and verify red**

Run: `npm test --workspace @clinicos/worker`

Expected: FAIL because the handler does not exist.

- [ ] **Step 3: Implement queue and integration boundaries**

Initialize Redis with bounded retries and BullMQ with exponential retry/backoff and removal policies. Implement a worker with graceful shutdown. Implement OpenEMR token caching, timeouts, JSON error normalization, and FHIR patient search/create behind named adapter functions; never expose raw calls from controllers.

- [ ] **Step 4: Verify worker and adapter imports**

Run: `npm test --workspace @clinicos/worker && npm run lint`

Expected: worker test PASS and all integration modules lint without unresolved imports.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/queues apps/api/src/integrations apps/worker
git commit -m "feat: add BullMQ worker and OpenEMR adapter boundary"
```

### Task 5: Accessible React Clinic Shell

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/.env.example`
- Create: `apps/web/index.html`
- Create: `apps/web/vite.config.js`
- Create: `apps/web/tailwind.config.js`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/src/main.jsx`
- Create: `apps/web/src/app/App.jsx`
- Create: `apps/web/src/app/router.jsx`
- Create: `apps/web/src/styles/index.css`
- Create: `apps/web/src/contexts/AuthContext.jsx`
- Create: `apps/web/src/services/http.js`
- Create: `apps/web/src/services/auth.service.js`
- Create: `apps/web/src/components/layout/AppShell.jsx`
- Create: `apps/web/src/components/layout/Sidebar.jsx`
- Create: `apps/web/src/components/layout/Topbar.jsx`
- Create: `apps/web/src/components/ui/StatusBadge.jsx`
- Create: `apps/web/src/components/ui/StatCard.jsx`
- Create: `apps/web/src/components/feedback/LoadingScreen.jsx`
- Create: `apps/web/src/components/feedback/EmptyState.jsx`
- Create: `apps/web/src/components/feedback/ErrorBoundary.jsx`
- Create: `apps/web/src/pages/LoginPage.jsx`
- Create: `apps/web/src/pages/DashboardPage.jsx`
- Create: `apps/web/src/pages/PatientsPage.jsx`
- Create: `apps/web/src/pages/QueuePage.jsx`
- Create: `apps/web/src/pages/QueueDisplayPage.jsx`
- Create: `apps/web/src/pages/ModulePage.jsx`
- Create: `apps/web/src/pages/NotFoundPage.jsx`
- Test: `apps/web/src/components/ui/StatusBadge.test.jsx`

**Interfaces:**

- Consumes: role, permission, and queue-state constants plus `/api/v1/auth/*`.
- Produces: public `/login` and `/display/:doctorId`, protected `/app/*` routes from specification section 28, role-filtered navigation, authentication context, and a responsive dashboard.

- [ ] **Step 1: Write a component accessibility test**

```jsx
render(<StatusBadge status="WAITING" />);
expect(screen.getByText('Waiting')).toBeInTheDocument();
expect(screen.getByText('Waiting')).toHaveAttribute('data-status', 'WAITING');
```

- [ ] **Step 2: Run the web test and verify red**

Run: `npm test --workspace @clinicos/web`

Expected: FAIL because the component and test environment are absent.

- [ ] **Step 3: Implement the UI system and routes**

Apply the persisted ClinicOS design system using semantic Tailwind tokens: calm cyan primary, health green CTA, warm neutral surfaces, Figtree/Noto Sans fallbacks, consistent borders and shadows, no decorative gradients, no emoji icons, 44px controls, visible 3px focus rings, a skip link, reduced-motion handling, and mobile-first navigation. Use route-level lazy loading and TanStack Query so the initial shell remains light on clinic hardware.

- [ ] **Step 4: Verify UI quality gates**

Run: `npm test --workspace @clinicos/web && npm run build --workspace @clinicos/web`

Expected: component test PASS and Vite emits a successful production build with no unresolved routes or imports.

- [ ] **Step 5: Commit**

```bash
git add apps/web design-system
git commit -m "feat(web): add accessible role-aware ClinicOS shell"
```

### Task 6: Docker, Reverse Proxy, and Vercel-Compatible SPA Build

**Files:**

- Create: `apps/api/Dockerfile`
- Create: `apps/worker/Dockerfile`
- Create: `apps/web/Dockerfile`
- Create: `apps/web/nginx.conf`
- Create: `apps/web/vercel.json`
- Create: `docker-compose.yml`
- Create: `infra/caddy/Caddyfile`
- Create: `infra/openemr/README.md`
- Create: `.dockerignore`

**Interfaces:**

- Consumes: `MONGODB_URI`, `REDIS_URL`, cookie/origin settings, and optional OpenEMR credentials.
- Produces: localhost Caddy ingress, web/api/worker services, internal MongoDB and Redis, persisted volumes, health checks, and an optional OpenEMR 8.x profile isolated behind `/openemr-admin`.

- [ ] **Step 1: Add a Compose configuration gate**

```bash
docker compose config --quiet
```

Expected before implementation: FAIL because `docker-compose.yml` is absent.

- [ ] **Step 2: Implement multi-stage images and service topology**

Build immutable production images, run Node processes as the unprivileged `node` user, keep database services on an internal network, declare health checks, persist MongoDB/Redis data, and terminate ingress at Caddy. Keep the Vercel configuration limited to the static SPA; the API, worker, Redis, MongoDB, and OpenEMR require long-running infrastructure.

- [ ] **Step 3: Validate Compose**

Run: `docker compose config --quiet`

Expected: exit code 0.

- [ ] **Step 4: Build containers**

Run: `docker compose build web api worker`

Expected: all three images build from the npm lockfile and workspace packages.

- [ ] **Step 5: Commit**

```bash
git add .dockerignore docker-compose.yml infra apps/api/Dockerfile apps/worker/Dockerfile apps/web/Dockerfile apps/web/nginx.conf apps/web/vercel.json
git commit -m "chore: add production-like container topology"
```

### Task 7: CI, Documentation, and End-to-End Verification

**Files:**

- Create: `.github/workflows/ci.yml`
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/permissions.md`
- Create: `docs/deployment.md`
- Create: `docs/openemr-validation.md`
- Modify: `docs/superpowers/plans/2026-09-14-clinicos-foundation.md`

**Interfaces:**

- Consumes: every root workspace command and Compose service.
- Produces: a no-guesswork onboarding path, architecture decision record, OpenEMR proof checklist, deployment split guidance, and CI checks for install, lint, tests, build, audit, and Compose syntax.

- [ ] **Step 1: Implement deterministic CI**

```yaml
- run: npm ci
- run: npm run lint
- run: npm test
- run: npm run build
- run: docker compose config --quiet
```

Use Node 22 and cache npm data from `package-lock.json`. Run `npm audit --audit-level=high --omit=dev` as a separate non-secret-dependent check.

- [ ] **Step 2: Write onboarding and architecture docs**

Document exact commands for host hot reload, production-like Compose, admin seeding, fake-data rules, environment values, health endpoints, OpenEMR OAuth/FHIR proof operations, backups, and the Vercel frontend-only deployment constraint.

- [ ] **Step 3: Run all static and automated checks**

Run: `npm run lint && npm test && npm run build && docker compose config --quiet`

Expected: every command exits 0.

- [ ] **Step 4: Run the production-like stack smoke test**

Run: `docker compose up -d --build mongo redis api worker web caddy && curl --fail http://localhost/health/live && curl --fail http://localhost/api/v1`

Expected: both HTTP calls return JSON successfully through Caddy.

- [ ] **Step 5: Mark this execution record complete and commit**

```bash
git add .github README.md docs
git commit -m "docs: add ClinicOS onboarding deployment and delivery gates"
```

## Post-Foundation Delivery Plans

The specification contains several independently reviewable systems and should be implemented as separate plans after this foundation:

1. OpenEMR patient/appointment proof and front-desk workflow.
2. Queue, walk-ins, live SSE updates, and nurse vitals.
3. Doctor consultation, autosaved drafts, diagnosis, prescription, and printing.
4. Billing, idempotent payments, receipt printing, and daily closure.
5. Backups, restore drills, monitoring, security review, and clinic pilot.
6. Phase 2 pharmacy, laboratory, notifications, localization, and queue display enhancements.

## Self-Review Record

- Specification coverage: this foundation covers milestones 1–2 and the adapter boundary required before milestone 3; later clinical/business capabilities are explicitly separated above.
- Placeholder scan: every foundation step has concrete files, commands, expected outcomes, and interface names.
- Type consistency: this is JavaScript; shared runtime Zod contracts define field consistency across web/API boundaries.
- User corrections: every TypeScript/PostgreSQL recommendation in the source specification is adapted to JavaScript/MongoDB without changing the OpenEMR ownership boundary.
