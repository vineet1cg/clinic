# ClinicOS security audit — 2026-09-15

## Scope

This review covered the React application, Express API, worker, shared contracts, MongoDB models and indexes, Redis/BullMQ configuration, Docker Compose, Caddy, Nginx, Vercel configuration, local environment handling, dependency manifests, automated tests, and persisted audit records.

The review combined source inspection, secret and risky-pattern searches, npm advisory checks, linting, tests, production builds, proxy configuration validation, database role/index inspection, negative authentication requests, and a live fake-patient workflow. It is an engineering security review, not a formal penetration test or regulatory certification.

## Resolved findings

- Removed temporary administrator credentials from the Vite/browser environment and login UI.
- Added forced first-login password rotation with strong validation, session-version binding, session revocation, CSRF verification, and no application permissions before rotation.
- Reduced username enumeration by verifying passwords before revealing valid-account state; unknown-account attempts are now tenant-scoped audit events.
- Closed role, permission, assigned-doctor, state-transition, cross-patient, cross-clinic, and sensitive report-field authorization gaps.
- Added granular response filtering for appointment context, vitals, diagnoses, prescriptions, integration identifiers, tenant identifiers, and internal actor fields.
- Added bounded request validation and rejection of Mongo operators, dotted keys, and prototype-pollution keys.
- Added a permission-gated, clinic-scoped, cursor-paginated audit API and bounded audit metadata allowlist.
- Removed patient search terms and record identifiers from application/proxy logs. Caddy query and path redaction follows its supported filter encoders: <https://caddyserver.com/docs/caddyfile/directives/log>.
- Made production API startup fail closed unless HTTPS origins, secure cookies, and a non-example JWT secret of at least 64 characters are configured.
- Disabled production browser source maps and added CSP/security headers to Nginx and Vercel responses.
- Replaced API use of the MongoDB root account with a database-local `readWrite` account. Fresh-volume initialization uses the official image's `/docker-entrypoint-initdb.d` mechanism: <https://github.com/docker-library/docs/blob/master/mongo/content.md>.
- Replaced incorrect compound sparse indexes with typed partial unique indexes. The old indexes allowed only one local patient and one appointment-free queue entry per clinic.
- Added persisted payment idempotency uniqueness, replay behavior, concurrency recovery, and a guarded index migration.
- Added clinic-timezone date handling, safe error contracts, bounded request IDs, and OpenEMR error redaction.
- Restricted local environment files to mode `600`, added a repeatable security-check script, and added formatting to CI.

## Audit-log review

At the end of the review, the local database held 74 audit events. All events were assigned to a clinic, all had required action/resource/timestamp fields, and no password, token, cookie, search query, or patient-name metadata fields were present.

Three failed logins were present: two historical password mismatches from IPv6 loopback and one intentional unknown-account security probe from IPv4 loopback. Every recorded source address was loopback (`127.0.0.1`, `::1`, or the IPv4-mapped loopback address). No remote-source burst or other suspicious pattern was found. Six historical unscoped records were preserved and assigned to the configured default clinic during migration.

## Verification evidence

- `npm audit --audit-level=high`: zero known vulnerabilities across production and development dependencies.
- `npm run security:check`: passed formatting, lint, and all 36 tests.
- `npm run build`: production Vite build passed; no source-map files were emitted.
- `npm run smoke:workflow`: passed password rotation, patient, appointment, queue, encounter, invoice, payment plus replay, inventory, lab, reports, audit retrieval, and cleanup.
- `npm run db:indexes`: all model indexes verified and legacy indexes migrated.
- `npm run compose:config`: passed.
- Caddy and Nginx native configuration validation: passed.
- MongoDB application identity: exactly `readWrite` on `clinicos`; administrative database reads were denied.
- API readiness: MongoDB and Redis reported ready; the OpenEMR check was skipped because integration was disabled.

## Required before real patient use

- Terminate real HTTPS at Caddy or another approved ingress, rotate every example credential, and store secrets outside the repository/Compose file.
- Implement administrator MFA; it is not present in this scaffold.
- Implement encrypted MongoDB/OpenEMR/document backups and complete an isolated restore drill.
- Add centralized monitoring and alerts for login failures, audit anomalies, service health, disk capacity, failed jobs, and backup age.
- Complete the OpenEMR 8.x OAuth/FHIR proof with generated patients before enabling the integration.
- Decide retention, access-review, incident-response, and data-export procedures with the clinic and applicable legal/compliance advisers.
- Pin accepted container images by immutable digest and run a container-image vulnerability scan in the release pipeline.
- Before introducing multi-document financial or inventory operations, deploy MongoDB as a transaction-capable replica set and wrap those operations in transactions or implement a tested reconciliation process.
