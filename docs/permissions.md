# Roles and permissions

Permissions are granular strings from `packages/contracts/src/constants.js`. Roles are default permission bundles, not hard-coded controller checks. The API must use `authenticate`, `verifyCsrf` for mutations, and `authorize(permission)` on protected routes.

| Role          | Primary scope                                  | Explicit boundary                               |
| ------------- | ---------------------------------------------- | ----------------------------------------------- |
| Super admin   | System, integration, staff, backups            | Use only for administration                     |
| Clinic owner  | Operations, financial reports, staff oversight | Medical notes are not automatic owner access    |
| Desk manager  | Patients, schedules, queue, front desk         | No clinical editing                             |
| Receptionist  | Search/register, appointments, walk-ins, queue | No diagnosis, prescription, or clinical history |
| Doctor        | Assigned clinical workflow and own queue       | No staff or financial administration by default |
| Nurse         | Vitals, intake, queue                          | No final diagnosis or prescribing               |
| Billing staff | Invoices, payment, financial reports           | No detailed clinical notes                      |
| Pharmacist    | Prescriptions and medicine inventory           | No encounter editing                            |
| Lab staff     | Orders, samples, results, verification         | No unrelated chart editing                      |
| Patient       | Future portal self-service                     | No staff application access in V1               |

Role bundles are intentionally conservative. Clinic-specific additions go into `additionalPermissions`; explicit removals go into `deniedPermissions`. Every role or permission change must create an audit event and invalidate or re-evaluate active sessions.

When adding a protected endpoint, follow this order:

```js
router.post(
  '/',
  authenticate,
  verifyCsrf,
  authorize(PERMISSIONS.PATIENT_CREATE),
  validate(patientCreateSchema),
  createPatientController,
);
```

Frontend navigation is filtered with the same shared permissions, but API enforcement remains authoritative.
