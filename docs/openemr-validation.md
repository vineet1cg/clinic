# OpenEMR 8.x integration proof

Complete this proof with generated fake patients before implementing the production front-desk and doctor modules. Record the tested OpenEMR image tag, enabled scopes, endpoint paths, and response mappings because OpenEMR configuration can vary by installation.

## Setup

1. Start the optional profile with `docker compose --profile openemr up -d openemr-db openemr`.
2. Sign in at `http://127.0.0.1:8300` and replace the example administrator password.
3. Enable the REST/FHIR APIs and register a confidential OAuth client using the OpenEMR administration interface.
4. Grant only the scopes needed for the proof, beginning with patient read/write and adding appointment, encounter, observation, medication, and provider scopes one operation at a time.
5. Copy the client ID and secret to `apps/api/.env`; confirm that file remains ignored by Git.
6. Set the exact installation URLs in `OPENEMR_BASE_URL` and `OPENEMR_TOKEN_URL`.

## Required proof sequence

- Obtain and refresh a client-credentials access token.
- Search a generated fake patient by exact mobile number.
- Create a generated fake patient and capture the OpenEMR/FHIR identifier.
- Repeat create with the same ClinicOS idempotency key and prove no duplicate appears.
- Create and list an appointment for that patient.
- Create an encounter and read it back.
- Record fake blood pressure and temperature observations.
- Create a test prescription with a non-clinical demonstration medicine record.
- Simulate expired credentials, a timeout, a 4xx validation response, and OpenEMR downtime.
- Confirm logs contain request IDs and operation names but no access token or full clinical content.

## Acceptance evidence

For every operation, save a sanitized request/response mapping in a test fixture, add an adapter unit test, and document the supported OpenEMR endpoint. The proof passes only when repeated against the pinned local image without direct MariaDB access. Keep native OpenEMR available at a restricted administrator path as the fallback for workflows ClinicOS has not wrapped.
