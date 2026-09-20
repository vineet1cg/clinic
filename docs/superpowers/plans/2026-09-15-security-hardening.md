# ClinicOS Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close verified authentication, authorization, tenant-isolation, auditability, and deployment-default weaknesses found in the 2026-09-15 repository audit.

**Architecture:** Keep the existing cookie JWT plus double-submit CSRF design, but bind every JWT to a server-side user session version and prevent password-reset-required accounts from receiving application permissions. Enforce sensitive permissions in controllers where the requested state determines authorization, validate cross-document references inside the authenticated clinic, expose append-only audit records through a paginated permission-gated API, and make production configuration fail closed.

**Tech Stack:** Node.js 22, Express 5, JavaScript, Zod, Mongoose/MongoDB, React 19, React Router, React Hook Form, Tailwind CSS, Vitest/Supertest, Docker Compose.

## Global Constraints

- Use JavaScript, not TypeScript.
- MongoDB is the application database; Redis/BullMQ remains the job queue.
- OpenEMR is accessed only through supported REST/FHIR APIs.
- Browser sessions remain in HTTP-only cookies with CSRF protection; never use localStorage for tokens.
- Every database query containing clinic data must be scoped with the authenticated `clinicId`.
- Do not place patient clinical content, passwords, cookies, bearer tokens, or OpenEMR response bodies in logs.
- Preserve the existing ClinicOS visual system, visible labels, 44px controls, inline errors, and keyboard focus.

---

### Task 1: Session revocation and forced password change

**Files:**

- Modify: `packages/contracts/src/schemas.js`
- Modify: `packages/contracts/src/contracts.test.js`
- Modify: `apps/api/src/models/user.model.js`
- Modify: `apps/api/src/modules/auth/auth.service.js`
- Modify: `apps/api/src/modules/auth/auth.controller.js`
- Modify: `apps/api/src/modules/auth/auth.routes.js`
- Modify: `apps/api/src/middleware/authenticate.js`
- Modify: `apps/api/src/middleware/authorize.js`
- Modify: `apps/api/src/scripts/seed-admin.js`
- Create: `apps/web/src/pages/ChangePasswordPage.jsx`
- Modify: `apps/web/src/services/auth.service.js`
- Modify: `apps/web/src/contexts/AuthProvider.jsx`
- Modify: `apps/web/src/components/layout/ProtectedRoute.jsx`
- Modify: `apps/web/src/app/router.jsx`

**Interfaces:**

- Produces: `changePasswordSchema`, `changePassword(credentials)`, `POST /api/v1/auth/change-password`.
- Produces: JWT claim `sessionVersion`; every authenticated request compares it with `User.sessionVersion`.

- [ ] **Step 1: Add failing contract and middleware tests**

```js
expect(
  changePasswordSchema.safeParse({
    currentPassword: 'ChangeMe123!',
    newPassword: 'A-Different-Strong9!',
    confirmPassword: 'A-Different-Strong9!',
  }).success,
).toBe(true);
expect(
  changePasswordSchema.safeParse({
    currentPassword: 'ChangeMe123!',
    newPassword: 'weak-password',
    confirmPassword: 'weak-password',
  }).success,
).toBe(false);
```

- [ ] **Step 2: Run the tests and verify they fail before implementation**

Run: `npm test --workspace @clinicos/contracts`

Expected: FAIL because `changePasswordSchema` is not exported.

- [ ] **Step 3: Implement strong password validation and session binding**

```js
const strongPassword = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/\d/, 'Include a number')
  .regex(/[^A-Za-z0-9]/, 'Include a symbol');

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
```

Add `sessionVersion: { type: Number, default: 0, min: 0 }` to users, sign it into JWTs, compare it during authentication, and increment it after logout or password changes. Return no application permissions while status is `PASSWORD_RESET_REQUIRED` and make `authorize`/`authorizeAny` return `PASSWORD_CHANGE_REQUIRED`.

- [ ] **Step 4: Add the password-change endpoint and accessible page**

The endpoint must require authentication and CSRF, verify the current bcrypt hash, save the new bcrypt hash, set status to `ACTIVE`, increment `sessionVersion`, record `passwordChangedAt`, write `auth.password_changed`, and rotate both session and CSRF cookies. The page must use visible labels, show/hide buttons, inline validation, a password-requirements list, disabled/loading submit state, and redirect to `/app/dashboard` only after success.

- [ ] **Step 5: Run focused tests**

Run: `npm test --workspace @clinicos/contracts && npm test --workspace @clinicos/api && npm test --workspace @clinicos/web`

Expected: all contract, API, and web tests pass.

### Task 2: Close RBAC and tenant-isolation gaps

**Files:**

- Modify: `apps/api/src/modules/patients/patient.controller.js`
- Modify: `apps/api/src/modules/appointments/appointment.controller.js`
- Modify: `apps/api/src/modules/queue/queue.service.js`
- Modify: `apps/api/src/modules/encounters/encounter.controller.js`
- Modify: `apps/api/src/modules/billing/billing.controller.js`
- Modify: `apps/api/src/modules/lab/lab.controller.js`
- Modify: `apps/api/src/modules/staff/staff.controller.js`
- Modify: `apps/api/src/modules/reports/report.controller.js`
- Modify: `apps/api/src/modules/reports/report.routes.js`
- Modify: `apps/api/src/common/clinic-context.js`
- Modify: `apps/api/src/models/user.model.js`

**Interfaces:**

- Consumes: `resolvePermissions(user)` and `PERMISSIONS`.
- Produces: permission-filtered patient/report responses and clinic-validated document references.

- [ ] **Step 1: Add authorization tests for each verified leak**

Test that patient demographic access does not automatically include encounters or invoices, operational-only report users receive no financial values, `LAB_RESULT_CREATE` cannot verify results without `LAB_RESULT_VERIFY`, and reset-required users cannot call resource endpoints.

- [ ] **Step 2: Enforce field-level patient and report permissions**

```js
const permissions = resolvePermissions(req.user);
const canViewEncounters = permissions.includes(PERMISSIONS.ENCOUNTER_VIEW);
const canViewBilling = permissions.includes(PERMISSIONS.BILLING_VIEW);
```

Only execute and return those sensitive queries when their dedicated permission is present. Return operational and financial report sections independently according to `REPORT_OPERATIONAL` and `REPORT_FINANCIAL`.

- [ ] **Step 3: Validate ownership and cross-document references**

Require active users with a doctor role for appointment/queue assignment. Require `doctorId`, `queueEntryId`, and `encounterId` referenced during billing or lab creation to belong to the same clinic and patient. Scope encounter queue updates by both `_id` and `clinicId`. Restrict encounter creation/update/completion to the assigned doctor unless the actor holds `QUEUE_OVERRIDE`.

- [ ] **Step 4: Enforce state-dependent sensitive permissions**

Require `LAB_RESULT_VERIFY` when the requested lab status is `VERIFIED`, reject vitals changes after encounter completion, require `STAFF_DEACTIVATE` for deactivation, prevent non-super-admins from creating or modifying privileged administrator accounts, and protect the last active super administrator.

- [ ] **Step 5: Add missing appointment audits**

Write `appointment.cancel` after cancellation and `appointment.check_in` after queue creation. Include only state/reason metadata, never patient or clinical content.

### Task 3: Make audit records reviewable and bounded

**Files:**

- Modify: `packages/contracts/src/schemas.js`
- Create: `apps/api/src/modules/audit/audit.controller.js`
- Create: `apps/api/src/modules/audit/audit.routes.js`
- Modify: `apps/api/src/modules/audit/audit.service.js`
- Modify: `apps/api/src/models/audit-log.model.js`
- Modify: `apps/api/src/routes/index.js`
- Create: `apps/api/src/modules/audit/audit.service.test.js`

**Interfaces:**

- Produces: `GET /api/v1/audit?cursor=<id>&limit=50&action=<value>` guarded by `AUDIT_VIEW`.
- Produces: `{ auditLogs, nextCursor }`; actor population is limited to `name email`.

- [ ] **Step 1: Add query-contract tests**

Validate `limit` between 1 and 100, optional ISO date bounds, bounded action/resource strings, and a 24-character MongoDB cursor.

- [ ] **Step 2: Implement tenant-scoped cursor pagination**

```js
const filter = { clinicId: getClinicId(req.user) };
if (cursor) filter._id = { $lt: cursor };
const rows = await AuditLog.find(filter)
  .sort({ _id: -1 })
  .limit(limit + 1);
```

Never expose metadata fields outside an explicit allowlist. Bound `action`, `resourceType`, `resourceId`, IP, and user-agent lengths in the schema and service before persistence.

- [ ] **Step 3: Mount and test the route**

Run: `npm test --workspace @clinicos/api`

Expected: unauthorized users receive 401, users without `AUDIT_VIEW` receive 403, and authorized results contain only their clinic's records.

### Task 4: Fail closed in production and reduce exposed artifacts

**Files:**

- Modify: `apps/api/src/config/env.js`
- Modify: `apps/api/src/server.js`
- Modify: `apps/api/src/middleware/request-id.js`
- Modify: `apps/api/src/middleware/error-handler.js`
- Modify: `apps/api/src/integrations/openemr/errors.js`
- Modify: `apps/api/src/integrations/openemr/auth.js`
- Modify: `apps/api/src/integrations/openemr/client.js`
- Modify: `apps/web/vite.config.js`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `apps/api/.env.example`
- Modify: `docs/deployment.md`

**Interfaces:**

- Produces: `HOST` with local default `127.0.0.1`; Compose explicitly uses `0.0.0.0` internally.
- Produces: production validation that requires HTTPS, secure cookies, and a non-example 64-character JWT secret.

- [ ] **Step 1: Add environment validation tests**

Extract environment parsing into an exported function and verify production rejects `COOKIE_SECURE=false`, HTTP application origins, and example/short JWT secrets.

- [ ] **Step 2: Harden network and error behavior**

Bind standalone development API to loopback, accept only safe request-ID characters, never return raw exception messages in API responses, and ensure OpenEMR errors store/log only status and operation—not upstream response bodies.

- [ ] **Step 3: Remove production source maps and align Compose mode**

Set Vite `build.sourcemap` to `false`. Keep the supplied Compose stack explicitly local-development mode unless secure production environment variables are provided; document that public deployment requires TLS and secret-manager values.

- [ ] **Step 4: Restrict local secret-file permissions**

Run: `chmod 600 .env apps/api/.env apps/web/.env apps/worker/.env`

Expected: `stat -c '%a'` prints `600` for every local environment file.

### Task 5: Full regression and security verification

**Files:**

- Modify: `scripts/workflow-smoke.js`
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: all prior API contracts.
- Produces: a smoke path that handles first-login password rotation before clinic workflows.

- [ ] **Step 1: Extend the smoke test**

When the seeded admin has `passwordResetRequired`, call `/auth/change-password`, capture the rotated cookies/CSRF token, then execute patient → appointment → queue → encounter → billing → inventory → lab → report → audit.

- [ ] **Step 2: Run all static and dependency checks**

Run: `npm audit --omit=dev --audit-level=high && npm run lint && npm run format:check`

Expected: zero known production vulnerabilities and no lint/format failures.

- [ ] **Step 3: Run all automated and runtime checks**

Run: `npm test && npm run build && npm run smoke:workflow`

Expected: every test passes, the production frontend builds without source maps, and the full workflow including audit retrieval passes.

- [ ] **Step 4: Verify runtime boundaries**

Run: `curl -fsS http://127.0.0.1:4000/health/ready` and inspect Mongo/Redis bindings with `ss -ltn`.

Expected: readiness is healthy; MongoDB and Redis listen only on `127.0.0.1`; the direct development API listens only on `127.0.0.1`.

## Self-Review

- Spec coverage: authentication, RBAC, tenant boundaries, audit logs, secrets, cookies, TLS prerequisites, dependency scanning, clinical logging, and workflow regression are covered.
- Placeholder scan: the plan contains no deferred implementation markers.
- Interface consistency: `changePasswordSchema`, `sessionVersion`, `resolvePermissions`, `AUDIT_VIEW`, and cursor pagination names match across producer and consumer tasks.
