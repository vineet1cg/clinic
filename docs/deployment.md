# Deployment guidance

## Recommended first-clinic deployment

Use a small clinic-local server with a UPS for the API, worker, MongoDB, Redis, and OpenEMR. Keep an encrypted offsite backup and restrict remote administration to a VPN. This preserves LAN performance when internet service is poor and keeps the clinic operational during WAN outages.

Before live use:

1. Replace every example password and secret with randomly generated values.
2. Generate a non-example `JWT_SECRET` of at least 64 random characters.
3. Enable HTTPS, set `COOKIE_SECURE=true`, and use only HTTPS values for `APP_BASE_URL` and `CORS_ORIGINS`.
4. Give the API only the database-local `readWrite` MongoDB account; reserve the root account for provisioning and administration.
5. Run `npm run db:indexes` as a controlled release step and stop deployment if it reports duplicate idempotency keys.
6. Restrict MongoDB, Redis, OpenEMR administration, and backup storage from public networks.
7. Pin container images by immutable digest after the clinic acceptance build is approved.
8. Add encrypted MongoDB, MariaDB, and OpenEMR-document backups.
9. Restore those backups into an isolated environment and record recovery time.
10. Enable monitoring for API/OpenEMR availability, disk, memory, failed jobs, backup age, and login failures.
11. Run the full fake-patient acceptance workflow on the clinic's actual workstation and printers.

The supplied Compose file is a local-development and production-like baseline. It deliberately defaults to HTTP and `NODE_ENV=development`; do not expose it to the internet as supplied. The API fails startup in production mode unless secure cookies, HTTPS origins, and a strong JWT secret are configured. The stack does not provide production TLS, secret management, backup automation, or monitoring without clinic-specific infrastructure decisions.

## Vercel correction

Vercel is a good target for the static Vite frontend, and the root `vercel.json` builds that workspace with SPA rewrites. It is not the correct home for OpenEMR, Redis, MongoDB, or the long-running BullMQ worker. Deploy those services on the clinic server or a secure VPS.

Set `VITE_API_URL` to the HTTPS API origin for a separate frontend deployment. That creates a cross-origin cookie boundary, so configure `CORS_ORIGINS`, secure cookie behavior, CSRF, and the cookie domain deliberately. A public Vercel frontend cannot directly reach a private clinic LAN API; use a secure VPN/gateway or keep the frontend on the same local origin. For the first clinic, same-origin Caddy hosting is the lowest-risk choice.

## Backups

The production milestone should add automated encrypted backups with this starting schedule:

- every 6 hours: local MongoDB and MariaDB dump
- daily: encrypted offsite copy
- weekly: full OpenEMR site/document snapshot
- monthly: long-term archive

A backup is not accepted until an isolated restore drill verifies staff accounts, queue/audit data, OpenEMR records, and documents. Never place unencrypted patient backups in a Vercel artifact, source repository, or ordinary cloud drive.
