# Local OpenEMR 8.x profile

The normal ClinicOS development loop starts only MongoDB and Redis. OpenEMR is intentionally opt-in because its image, MariaDB, and first-run setup are substantially heavier.

Start the pinned OpenEMR 8.3 profile:

```bash
docker compose --profile openemr up -d openemr-db openemr
```

Open `http://localhost:8300` and immediately replace the local-only administrator password. The service binds only to `127.0.0.1`; it is not exposed through the ClinicOS Caddy ingress.

Before setting `OPENEMR_ENABLED=true`, create a confidential OAuth client in OpenEMR, add its credentials to `apps/api/.env`, and complete every operation in `docs/openemr-validation.md`. ClinicOS must use REST/FHIR APIs and must never write directly to this profile's MariaDB volume.
