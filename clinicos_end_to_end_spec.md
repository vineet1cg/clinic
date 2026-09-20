# ClinicOS — End-to-End Product & Technical Specification

**Version:** 1.0  
**Status:** Implementation-ready specification  
**Primary deployment:** Single local clinic, extensible to multi-clinic  
**Frontend:** React + TypeScript + Vite  
**Backend / BFF:** Node.js + TypeScript + Express or NestJS  
**Medical system of record:** OpenEMR 8.x  
**App database:** PostgreSQL  
**Queue / jobs:** Redis + BullMQ  
**OpenEMR database:** MariaDB, owned and managed by OpenEMR  
**Deployment:** Docker Compose behind Caddy or Nginx  
**Primary users:** Clinic Owner/Admin, Desk Manager, Receptionist, Doctor, Nurse/Assistant, Billing Staff, Pharmacist, Lab Staff, Patient  

---

# 1. Product Vision

ClinicOS is a modern clinic-management web application designed for day-to-day use by a real outpatient clinic.

The system provides a clean role-based interface for clinic staff while using OpenEMR as the medical system of record.

The core design principle is:

> **ClinicOS owns workflow, usability, permissions, queueing, notifications, UI-specific configuration, and clinic operations. OpenEMR owns canonical medical data.**

ClinicOS must not reimplement the entire EHR domain from scratch.

The application should make the most common clinic workflows fast enough that staff can use them continuously during busy outpatient hours.

---

# 2. Product Goals

## 2.1 Primary Goals

1. Provide a clean modern interface for:
   - Reception
   - Doctors
   - Nurses
   - Billing staff
   - Clinic managers
   - Pharmacy staff
   - Lab staff
   - Administrators

2. Support the complete outpatient workflow:

```text
Patient arrival
    ↓
Search / Registration
    ↓
Appointment or Walk-in
    ↓
Token generation
    ↓
Waiting queue
    ↓
Vitals / nurse intake
    ↓
Doctor consultation
    ↓
Diagnosis / notes
    ↓
Prescription
    ↓
Lab / investigation request
    ↓
Billing
    ↓
Payment
    ↓
Prescription / invoice print
    ↓
Follow-up
    ↓
Reminder
```

3. Use OpenEMR APIs rather than direct database manipulation wherever possible.

4. Be deployable on-premise at a clinic or on a secure VPS.

5. Support offline-tolerant operational behavior where practical.

6. Provide strong role-based access control and auditability.

7. Be simple enough for non-technical clinic staff.

8. Be extensible later to:
   - Multiple doctors
   - Multiple branches
   - Patient portal
   - ABHA / ABDM integrations
   - Pharmacy
   - Laboratory
   - Telemedicine
   - Analytics

---

# 3. Non-Goals for V1

The first production version does **not** need to include:

- Full hospital IPD management
- ICU management
- OT scheduling
- Insurance claim processing
- Bed management
- Payroll
- Complex accounting
- Medical imaging PACS
- Advanced AI diagnosis
- Multi-tenant SaaS billing
- Complex ERP features
- Full mobile applications

These may be added later if the clinic grows into a larger medical center.

---

# 4. High-Level Architecture

```text
                         ┌─────────────────────┐
                         │      ClinicOS       │
                         │ React + TypeScript  │
                         │   PWA-ready Web UI  │
                         └──────────┬──────────┘
                                    │
                                    │ HTTPS
                                    ▼
                         ┌─────────────────────┐
                         │   ClinicOS Backend  │
                         │ Node.js / TypeScript│
                         │ Express / NestJS    │
                         └───────┬─────┬───────┘
                                 │     │
                  ┌──────────────┘     └──────────────┐
                  ▼                                   ▼
         ┌─────────────────┐                 ┌────────────────┐
         │   OpenEMR API   │                 │   PostgreSQL   │
         │ REST + FHIR     │                 │ ClinicOS Data  │
         └────────┬────────┘                 └────────┬───────┘
                  │                                   │
                  ▼                                   │
         ┌─────────────────┐                         │
         │ OpenEMR MariaDB │                         │
         │ Medical Records │                         │
         └─────────────────┘                         │
                                                    │
                                           ┌────────▼────────┐
                                           │ Redis + BullMQ  │
                                           │ Jobs / Events   │
                                           └─────────────────┘
```

---

# 5. System Ownership Boundaries

## 5.1 OpenEMR Owns

OpenEMR should remain the source of truth for medical and clinical data, including:

- Patient medical identity
- Encounters
- Clinical notes
- Diagnoses
- Medical history
- Allergies
- Medications
- Prescriptions
- Vitals where supported
- Clinical documents
- Provider information
- Appointments where appropriate
- Lab orders/results where integrated
- Structured clinical observations

## 5.2 ClinicOS Owns

ClinicOS should own data that is operational or UI-specific:

- Clinic configuration
- UI preferences
- Staff role mappings
- Feature flags
- Queue/token state
- Waiting-room display configuration
- Notification jobs
- WhatsApp/SMS jobs
- Printer preferences
- Payment metadata not suitable for OpenEMR
- Audit metadata for ClinicOS-specific actions
- Dashboard preferences
- Branch settings
- Internal workflow flags
- App-specific integration state
- Report cache / materialized metrics
- Sync state and API mapping IDs

## 5.3 Forbidden Integration Pattern

Do **not** directly write to OpenEMR's MariaDB tables from ClinicOS.

Allowed:

```text
ClinicOS Backend
    ↓
OpenEMR REST/FHIR API
    ↓
OpenEMR internal logic
    ↓
OpenEMR MariaDB
```

Forbidden:

```text
ClinicOS Backend
    ↓
Direct SQL INSERT/UPDATE
    ↓
OpenEMR MariaDB
```

Direct reads should also be avoided unless an API limitation makes it unavoidable and the risk is explicitly documented.

---

# 6. User Roles

## 6.1 Super Admin

Use case:
- Technical administrator
- Full system access
- Usually clinic owner or trusted operator

Capabilities:
- Manage clinic
- Manage staff
- Manage permissions
- Configure integrations
- View logs
- Trigger backups
- Restore backups
- Configure printers
- Configure notifications
- View all reports
- Manage OpenEMR integration
- Enable/disable features

---

## 6.2 Clinic Owner

Capabilities:
- View clinic dashboard
- View financial reports
- View doctor performance
- View patient volume
- View operational reports
- Manage staff
- Manage doctor schedules
- View billing
- View stock summaries
- View audit logs
- Access business reports

Owner should not automatically get access to every medical note unless the clinic explicitly decides this is appropriate.

---

## 6.3 Desk Manager

Capabilities:
- Manage reception
- Manage appointments
- Manage walk-ins
- Manage queues
- Manage doctor schedules
- Create and update patients
- Review billing status
- Generate daily reports
- Manage front-desk staff
- Configure desk workflow

---

## 6.4 Receptionist

Capabilities:
- Search patients
- Register patients
- Update demographic information
- Create appointments
- Create walk-ins
- Generate tokens
- Check patients in
- Move patients through queue states
- Create basic invoices if permitted
- Receive payments if permitted
- Print appointment slips
- Print token slips
- View appointment calendar

Restricted from:
- Clinical notes
- Diagnoses
- Prescriptions
- Sensitive medical history
- System administration

---

## 6.5 Doctor

Capabilities:
- View assigned patient queue
- Open patient profile
- View relevant medical history
- View current and previous encounters
- View vitals
- Record consultation notes
- Record diagnosis
- Add prescriptions
- Add investigations
- Create follow-up
- Complete consultation
- Print prescription
- View own schedule
- View own basic analytics

Restricted from:
- Staff administration
- System configuration
- Financial administration unless explicitly allowed

---

## 6.6 Nurse / Clinical Assistant

Capabilities:
- View waiting patients
- Record vitals
- Record chief complaint
- Record preliminary observations
- Update queue state
- Assist with procedure workflow
- View doctor instructions where needed

Restricted from:
- Prescribing
- Final diagnosis
- Financial reports
- Staff administration

---

## 6.7 Billing Staff / Accountant

Capabilities:
- View billable items
- Generate invoices
- Receive payments
- Record payment method
- Process approved refunds
- View outstanding balances
- Run financial reports
- Close daily cash register

Restricted from:
- Detailed medical notes
- Prescribing
- Clinical editing

---

## 6.8 Pharmacist

Capabilities:
- View prescriptions
- Dispense medications
- Update dispensing status
- Manage inventory
- View stock alerts
- Record purchase entries
- Manage medicine master
- Handle expiry tracking
- Print pharmacy bill

---

## 6.9 Lab Staff

Capabilities:
- View investigation orders
- Update sample status
- Enter test results
- Upload result documents
- Mark result as verified
- Notify doctor when results are ready

---

## 6.10 Patient

Patient portal is optional for V1.

Later capabilities:
- View appointments
- Book appointment
- View prescriptions
- View invoices
- Download reports
- View lab results
- View follow-up schedule
- Manage family profiles
- Receive notifications

---

# 7. Permission Model

Use granular permissions rather than hard-coded role checks.

Examples:

```text
patient.create
patient.view
patient.update
patient.merge

appointment.create
appointment.view
appointment.update
appointment.cancel

queue.view
queue.manage
queue.override

encounter.view
encounter.create
encounter.update
encounter.complete

vitals.view
vitals.create
vitals.update

diagnosis.view
diagnosis.create
diagnosis.update

prescription.view
prescription.create
prescription.update
prescription.print

billing.view
billing.create
billing.update
billing.refund

payment.view
payment.collect
payment.refund

inventory.view
inventory.update
inventory.adjust

lab.order
lab.view
lab.result.create
lab.result.verify

staff.view
staff.create
staff.update
staff.deactivate

report.operational
report.financial
report.clinical

settings.view
settings.update

audit.view

backup.run
backup.restore
```

---

# 8. Role Permission Matrix

| Permission | Reception | Doctor | Nurse | Billing | Manager | Admin |
|---|---:|---:|---:|---:|---:|---:|
| Patient Search | Yes | Yes | Yes | Limited | Yes | Yes |
| Patient Create | Yes | Optional | Optional | No | Yes | Yes |
| Clinical History | No | Yes | Limited | No | Limited | Yes |
| Vitals | View | View | Create/Edit | No | No | Yes |
| Diagnosis | No | Create/Edit | No | No | No | Yes |
| Prescription | No | Create/Edit | View | No | No | Yes |
| Appointment | Create/Edit | View | View | View | Full | Full |
| Queue | Manage | Manage own | Manage | View | Full | Full |
| Billing | Limited | View | No | Full | Full | Full |
| Refund | No | No | No | Optional | Yes | Yes |
| Staff Management | No | No | No | No | Limited | Full |
| Financial Reports | No | No | No | Yes | Yes | Yes |
| Audit Logs | No | No | No | No | Limited | Yes |
| Backups | No | No | No | No | No | Yes |

---

# 9. Primary Clinic Workflow

## 9.1 Patient Arrival

1. Reception searches by:
   - Mobile number
   - Patient ID
   - Name
   - QR code
   - Date of birth

2. If patient exists:
   - Open patient summary
   - Confirm basic details
   - Select appointment or walk-in

3. If patient does not exist:
   - Create patient record
   - Capture:
     - Name
     - Mobile
     - Gender
     - Date of birth / age
     - Address
     - Emergency contact
     - Optional email
     - Optional ID details

4. Create visit.

5. Assign doctor.

6. Generate token.

7. Add to queue.

---

# 10. Queue State Machine

Recommended states:

```text
REGISTERED
    ↓
WAITING
    ↓
VITALS_PENDING
    ↓
VITALS_COMPLETE
    ↓
READY_FOR_DOCTOR
    ↓
IN_CONSULTATION
    ↓
CONSULTATION_COMPLETE
    ↓
BILLING_PENDING
    ↓
PAID
    ↓
COMPLETED
```

Additional states:

```text
NO_SHOW
CANCELLED
ON_HOLD
REFERRED
LAB_PENDING
PHARMACY_PENDING
```

Every state change should be logged with:

- Patient
- Visit
- Previous state
- New state
- Actor
- Timestamp
- Optional reason

---

# 11. Front Desk Module

## 11.1 Dashboard

Display:

- Today's appointments
- Walk-ins
- Number waiting
- Number completed
- Number cancelled
- Doctors currently available
- Delayed appointments
- Unpaid visits
- Quick patient registration
- Quick token issue
- Search

---

## 11.2 Patient Search

Search priority:

1. Mobile number exact
2. Patient ID exact
3. QR code
4. Name fuzzy match
5. Date of birth
6. Address

Show duplicate warning when multiple near-identical records are found.

---

## 11.3 Patient Registration

Required fields:

- Full name
- Mobile number
- Gender
- DOB or age

Optional fields:

- Email
- Address
- City
- State
- PIN
- Emergency contact
- Blood group
- Preferred language
- Government ID
- ABHA ID when supported

---

## 11.4 Appointment Creation

Fields:

- Patient
- Doctor
- Date
- Time slot
- Reason
- Visit type
- Notes
- Referral source
- Reminder preference

Appointment types:

- New consultation
- Follow-up
- Procedure
- Review
- Lab-only
- Vaccination
- Custom

---

## 11.5 Walk-In Creation

Required:

- Patient
- Doctor
- Visit reason
- Priority

System generates:
- Token number
- Queue entry
- Encounter placeholder if required

---

# 12. Doctor Module

## 12.1 Doctor Dashboard

Display:

- Today's queue
- Current patient
- Next patients
- Appointments
- Follow-ups
- Pending lab results
- Recently seen patients
- Quick patient search

---

## 12.2 Consultation Screen

Single-screen or tabbed workflow:

### Header
- Patient name
- Patient ID
- Age
- Gender
- Allergies warning
- Chronic conditions
- Last visit
- Token
- Visit type

### Left Panel
- Previous encounters
- Current medications
- Allergies
- Medical history
- Recent vitals
- Recent lab results

### Main Panel
- Chief complaint
- HPI
- Examination
- Diagnosis
- Assessment
- Plan

### Prescription Panel
- Medicine
- Dose
- Route
- Frequency
- Duration
- Instructions
- Before/after food
- Quantity

### Actions
- Save draft
- Order investigation
- Add procedure
- Add follow-up
- Print prescription
- Complete consultation

---

# 13. Prescription System

## 13.1 Prescription Features

Support:

- Medicine autocomplete
- Doctor favorites
- Clinic favorites
- Recently used medicines
- Generic name
- Brand name
- Strength
- Dosage form
- Dose
- Frequency
- Duration
- Quantity
- Instructions
- Before/after food
- SOS
- Start date
- Stop date

---

## 13.2 Prescription Templates

Examples:

- Fever
- URI
- Gastritis
- Hypertension follow-up
- Diabetes follow-up
- Routine dressing

Templates are convenience tools only.

Doctor must review before finalizing.

---

# 14. Vitals Module

Capture:

- Height
- Weight
- BMI
- Temperature
- Pulse
- Respiratory rate
- Blood pressure
- SpO2
- Blood glucose
- Pain score
- Custom vitals

Show abnormal values clearly.

Track trend over time.

---

# 15. Billing Module

## 15.1 Billable Items

Examples:

- Consultation
- Follow-up
- Procedure
- Injection
- Dressing
- Lab test
- Pharmacy
- Certificate
- Custom service

---

## 15.2 Invoice

Fields:

- Invoice ID
- Visit
- Patient
- Doctor
- Items
- Quantity
- Rate
- Discount
- Tax if applicable
- Total
- Paid amount
- Balance
- Payment method
- Payment status

Statuses:

```text
DRAFT
UNPAID
PARTIAL
PAID
CANCELLED
REFUNDED
```

---

## 15.3 Payment Methods

Support:

- Cash
- UPI
- Card
- Bank transfer
- Other

Store:
- Amount
- Method
- Reference
- Collected by
- Timestamp

---

# 16. Pharmacy Module

Optional for initial release.

Features:

- Medicine catalog
- Batch tracking
- Expiry tracking
- Purchase stock
- Sale stock
- Adjustment
- Low-stock alerts
- Expiry alerts
- Prescription-based dispensing
- Supplier management
- Purchase invoices

Inventory quantities should be transaction-based rather than directly overwritten.

---

# 17. Laboratory Module

Optional for initial release.

Workflow:

```text
Doctor orders test
    ↓
Lab queue
    ↓
Sample collected
    ↓
Processing
    ↓
Result entered
    ↓
Verified
    ↓
Doctor notified
```

Statuses:

```text
ORDERED
SAMPLE_PENDING
SAMPLE_COLLECTED
PROCESSING
RESULT_READY
VERIFIED
CANCELLED
```

---

# 18. Reports

## 18.1 Operational Reports

- Daily patient count
- Appointment vs walk-in
- Doctor-wise volume
- Average wait time
- No-show rate
- Queue duration
- Visit duration

---

## 18.2 Financial Reports

- Daily revenue
- Revenue by doctor
- Revenue by service
- Payment method split
- Outstanding balance
- Refund report
- Cash closing report
- Date-range revenue

---

## 18.3 Clinical Reports

Only for authorized users.

Examples:
- Diagnosis frequency
- Follow-up rate
- Prescription frequency
- Chronic disease population
- Lab utilization

---

# 19. Queue Display

Public waiting-room display.

Example:

```text
          DR. SHAH

      NOW CONSULTING
            #27

        PLEASE WAIT
       #28  #29  #30
```

Requirements:

- No sensitive patient information by default
- Token-based display
- Full-screen browser mode
- Auto-refresh using WebSocket/SSE
- Configurable doctor
- Configurable language
- Optional audio announcement later

---

# 20. Printing

Support:

## 20.1 A4 / A5
- Prescription
- Medical certificate
- Lab request
- Detailed invoice
- Patient summary

## 20.2 Thermal
- Token
- Payment receipt
- Simple invoice

Use browser print initially.

Later:
- Local print agent
- ESC/POS integration

---

# 21. Authentication

Recommended flow:

```text
Username / Email / Staff ID
          +
Password
          ↓
Backend session
          ↓
HTTP-only secure cookie
```

Avoid storing auth tokens in localStorage.

Requirements:

- Password hashing using Argon2id or bcrypt with strong parameters
- Account lockout
- Session expiration
- Device/session listing
- Logout all sessions
- Forced password reset
- 2FA for admins
- Optional 2FA for doctors

---

# 22. Authorization

Authorization must be enforced:

1. In frontend for UX
2. In ClinicOS backend for actual security
3. Through appropriate OpenEMR credentials/permissions

Frontend checks alone are never sufficient.

---

# 23. Audit Logging

Audit actions such as:

- Login
- Logout
- Failed login
- Patient created
- Patient demographic updated
- Encounter opened
- Encounter edited
- Prescription created
- Prescription modified
- Invoice created
- Payment collected
- Refund
- Role changed
- Permission changed
- Staff disabled
- Backup triggered
- Settings changed

Audit entry:

```json
{
  "actorId": "staff_uuid",
  "action": "patient.update",
  "resourceType": "patient",
  "resourceId": "openemr_patient_id",
  "timestamp": "ISO-8601",
  "ipAddress": "x.x.x.x",
  "device": "browser summary",
  "metadata": {}
}
```

Sensitive values should not be unnecessarily copied into logs.

---

# 24. ClinicOS PostgreSQL Data Model

Suggested schema.

## 24.1 clinics

```text
id UUID PK
name
slug
phone
email
address
timezone
currency
default_language
created_at
updated_at
```

---

## 24.2 staff

```text
id UUID PK
clinic_id FK
openemr_user_id nullable
name
email
phone
username
password_hash
status
last_login_at
created_at
updated_at
```

---

## 24.3 roles

```text
id UUID PK
clinic_id FK nullable
name
description
system_role boolean
created_at
```

---

## 24.4 permissions

```text
id UUID PK
code unique
description
```

---

## 24.5 role_permissions

```text
role_id FK
permission_id FK
PRIMARY KEY(role_id, permission_id)
```

---

## 24.6 staff_roles

```text
staff_id FK
role_id FK
PRIMARY KEY(staff_id, role_id)
```

---

## 24.7 queue_entries

```text
id UUID PK
clinic_id FK
patient_openemr_id
encounter_openemr_id nullable
appointment_openemr_id nullable
doctor_openemr_id
token_number
queue_date
state
priority
check_in_at
vitals_started_at
vitals_completed_at
consultation_started_at
consultation_completed_at
billing_completed_at
completed_at
created_by
created_at
updated_at
```

---

## 24.8 invoices

If billing is implemented outside OpenEMR.

```text
id UUID PK
clinic_id FK
patient_openemr_id
encounter_openemr_id
invoice_number
subtotal
discount
tax
total
status
created_by
created_at
updated_at
```

Prefer using OpenEMR billing if it fully satisfies the clinic.

---

## 24.9 invoice_items

```text
id UUID PK
invoice_id FK
service_code
description
quantity
unit_price
discount
tax
total
```

---

## 24.10 payments

```text
id UUID PK
invoice_id FK
amount
method
reference
received_by
received_at
status
```

---

## 24.11 notifications

```text
id UUID PK
clinic_id FK
patient_openemr_id nullable
channel
recipient
template_code
payload_json
scheduled_at
sent_at
status
failure_reason
created_at
```

---

## 24.12 audit_logs

```text
id UUID PK
clinic_id FK
actor_id
action
resource_type
resource_id
metadata_json
ip_address
user_agent
created_at
```

---

## 24.13 openemr_mappings

Useful for sync and references.

```text
id UUID PK
clinic_id FK
local_type
local_id
openemr_type
openemr_id
created_at
updated_at
```

---

# 25. OpenEMR Integration Layer

Create a dedicated module:

```text
src/
  integrations/
    openemr/
      client.ts
      auth.ts
      patients.ts
      appointments.ts
      encounters.ts
      observations.ts
      prescriptions.ts
      providers.ts
      documents.ts
      labs.ts
      billing.ts
      types.ts
      errors.ts
```

Do not scatter raw OpenEMR API calls throughout controllers.

---

# 26. OpenEMR API Adapter

Expose business-friendly internal functions:

```ts
findPatientByMobile(phone)
createPatient(input)
updatePatient(id, input)

listAppointments(filters)
createAppointment(input)
cancelAppointment(id)

createEncounter(input)
getEncounter(id)
updateEncounter(id, input)

recordVitals(encounterId, input)

createPrescription(encounterId, input)

getPatientClinicalSummary(patientId)
```

This isolates OpenEMR API changes from the rest of ClinicOS.

---

# 27. Backend API Design

Suggested `/api/v1`.

## Auth

```text
POST   /auth/login
POST   /auth/logout
GET    /auth/me
POST   /auth/change-password
POST   /auth/forgot-password
POST   /auth/reset-password
```

## Staff

```text
GET    /staff
POST   /staff
GET    /staff/:id
PATCH  /staff/:id
POST   /staff/:id/deactivate
POST   /staff/:id/roles
```

## Patients

```text
GET    /patients/search
POST   /patients
GET    /patients/:id
PATCH  /patients/:id
GET    /patients/:id/history
GET    /patients/:id/visits
```

## Appointments

```text
GET    /appointments
POST   /appointments
GET    /appointments/:id
PATCH  /appointments/:id
POST   /appointments/:id/cancel
POST   /appointments/:id/check-in
```

## Queue

```text
GET    /queue/today
POST   /queue
GET    /queue/:id
PATCH  /queue/:id/state
POST   /queue/:id/call
POST   /queue/:id/hold
POST   /queue/:id/complete
```

## Encounters

```text
POST   /encounters
GET    /encounters/:id
PATCH  /encounters/:id
POST   /encounters/:id/complete
```

## Vitals

```text
POST   /encounters/:id/vitals
GET    /patients/:id/vitals
```

## Prescriptions

```text
POST   /encounters/:id/prescriptions
GET    /patients/:id/prescriptions
GET    /prescriptions/:id
POST   /prescriptions/:id/print
```

## Billing

```text
POST   /invoices
GET    /invoices/:id
POST   /invoices/:id/payments
POST   /invoices/:id/refund
GET    /billing/daily-summary
```

## Reports

```text
GET    /reports/operations
GET    /reports/revenue
GET    /reports/doctors
```

---

# 28. Frontend Route Structure

```text
/login

/app
  /dashboard

  /patients
  /patients/new
  /patients/:id

  /appointments
  /calendar

  /queue

  /consultation/:queueId

  /billing
  /billing/:invoiceId

  /pharmacy
  /inventory

  /lab

  /reports

  /staff
  /roles

  /settings

/display/:doctorId
```

---

# 29. Frontend Folder Structure

```text
src/
  app/
  components/
  features/
    auth/
    patients/
    appointments/
    queue/
    encounters/
    vitals/
    prescriptions/
    billing/
    pharmacy/
    labs/
    staff/
    reports/
    settings/
  hooks/
  lib/
  services/
  stores/
  types/
```

Prefer feature-based organization.

---

# 30. Frontend Technology

Recommended:

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- TailwindCSS
- shadcn/ui
- date-fns
- Zustand only where necessary
- WebSocket or SSE for live queue updates

Avoid excessive global state.

Use TanStack Query for server-state management.

---

# 31. UX Requirements

The UI must optimize for clinic speed.

Rules:

- Critical tasks should require minimal clicks.
- Forms should work well using keyboard only.
- Tab order must be correct.
- Enter should submit appropriate fields.
- Search should be available globally.
- Loading states must be obvious.
- Destructive actions need confirmation.
- Medical warnings must be visually prominent.
- Do not overuse animations.
- Do not hide critical data behind fancy UI.
- Large touch-friendly controls where appropriate.

---

# 32. Localization

Initial languages:

- English
- Gujarati
- Hindi

Architecture:

```text
i18n/
  en.json
  gu.json
  hi.json
```

Allow per-user language preference.

Clinical values should remain standardized internally.

---

# 33. Notifications

Channels:

- SMS
- WhatsApp
- Email later

Use cases:

- Appointment reminder
- Follow-up reminder
- Appointment confirmation
- Appointment cancellation
- Lab result ready
- Prescription ready
- Payment receipt

Use BullMQ for reliable job processing.

---

# 34. WhatsApp Integration

Do not automate through unofficial WhatsApp Web hacks for production.

Use an approved WhatsApp Business provider/API.

Maintain:

- Template ID
- Recipient
- Variables
- Delivery status
- Failure reason
- Retry count

No medical details should be included unnecessarily in notification text.

---

# 35. Security Requirements

## Mandatory

- HTTPS everywhere
- HTTP-only secure cookies
- CSRF protection if cookie-based sessions are used
- Strong password hashing
- Rate limiting
- RBAC
- Server-side authorization
- Input validation
- Zod or equivalent schemas
- SQL parameterization / ORM
- Content Security Policy
- Secure headers
- Audit logs
- Session expiration
- Dependency vulnerability scanning
- Database backups
- Backup encryption
- Secrets outside source control

---

# 36. Security Threats to Consider

- Shared clinic accounts
- Stolen receptionist credentials
- Unlocked reception PC
- Unauthorized chart viewing
- SQL injection
- XSS
- CSRF
- IDOR
- Broken access control
- Exposed backup files
- Misconfigured reverse proxy
- Malware on clinic machine
- Insider access
- Weak Wi-Fi
- Lost laptop
- Printer leakage
- Notification leakage

---

# 37. Privacy Principles

Implement:

- Least privilege
- Data minimization
- Purpose limitation
- Access logs
- User-specific accounts
- Session timeout
- Data export capability
- Retention policies
- Backup retention policies
- Incident handling process

Do not use real clinic patient data in staging or development.

---

# 38. Infrastructure

Recommended Docker Compose services:

```text
reverse-proxy
frontend
backend
worker
postgres
redis
openemr
openemr-mariadb
backup
monitoring
```

---

# 39. Example Docker Network Layout

```text
Internet / LAN
     │
     ▼
Caddy / Nginx
     │
     ├── /          → frontend
     ├── /api       → backend
     └── /openemr   → OpenEMR
```

Internal-only:

```text
backend → postgres
backend → redis
backend → openemr
openemr → mariadb
worker  → redis
worker  → postgres
```

Postgres, Redis, and MariaDB must not be exposed publicly.

---

# 40. Deployment Models

## Option A — Clinic Local Server

Good when internet is unreliable.

Hardware:
- Small mini PC
- UPS
- Local network
- Daily encrypted offsite backup

Advantages:
- Works on LAN
- Fast
- Patient data stays local

Challenges:
- Hardware failure
- Power outages
- Remote support
- Offsite backup required

---

## Option B — Secure VPS

Advantages:
- Easier remote access
- Easier backups
- Better uptime

Challenges:
- Internet dependency
- Cloud security
- Hosting cost

---

# 41. Recommended Hybrid Model

For a small clinic:

```text
Primary:
Local clinic server

Backup:
Encrypted daily cloud backup

Optional:
VPN-only remote administration
```

Do not expose administrative interfaces directly to the public internet unless necessary.

---

# 42. Backup Strategy

Backup:

- PostgreSQL
- OpenEMR MariaDB
- OpenEMR documents/files
- Clinic configuration
- Encryption keys where appropriate

Recommended schedule:

```text
Every 6 hours → local DB backup
Daily         → encrypted offsite backup
Weekly        → full snapshot
Monthly       → long-term archive
```

Retention example:

```text
Hourly/6-hour: 2 days
Daily:         30 days
Weekly:        12 weeks
Monthly:       12 months
```

---

# 43. Restore Testing

Backups are not trusted until restored successfully.

Run scheduled restore drills.

Document:

- Recovery Point Objective
- Recovery Time Objective
- Restore command
- Credentials required
- File locations
- Verification steps

---

# 44. Monitoring

Monitor:

- Frontend availability
- Backend availability
- OpenEMR availability
- PostgreSQL
- MariaDB
- Redis
- Worker heartbeat
- Disk usage
- CPU
- RAM
- Backup age
- Failed jobs
- HTTP error rate
- Login failures

---

# 45. Logging

Use structured logs.

Include:

- Request ID
- Actor ID
- Route
- Status
- Duration
- Error code

Never log:

- Passwords
- Session secrets
- Access tokens
- Full medical notes
- Full prescription contents unless required
- Sensitive identifiers unnecessarily

---

# 46. Error Handling

Standard API error:

```json
{
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "Patient could not be found.",
    "requestId": "req_123"
  }
}
```

Do not expose stack traces to users.

---

# 47. Reliability Requirements

For core clinic workflows:

- No duplicate patient creation on accidental double-click.
- No duplicate payment on retries.
- Queue state changes must be idempotent.
- Background jobs must support retry.
- OpenEMR failures must be surfaced clearly.
- User should not lose draft consultation notes due to a temporary UI issue.

---

# 48. Idempotency

Use idempotency keys for:

- Patient creation
- Appointment creation
- Payment creation
- Encounter completion
- Notification sending

---

# 49. Offline / Poor Internet Behavior

For on-premise deployments, normal LAN access solves most issues.

For browser resilience:

- Cache static assets
- Preserve unsaved draft form data locally where safe
- Show network status
- Prevent ambiguous duplicate submits
- Retry read requests automatically
- Do not blindly retry payments

---

# 50. Testing Strategy

## Unit Tests

Test:
- Permission checks
- Queue transitions
- Invoice calculations
- Validation
- Mapping logic
- OpenEMR adapters

---

## Integration Tests

Test:
- Backend ↔ PostgreSQL
- Backend ↔ Redis
- Backend ↔ OpenEMR
- Login/session
- Appointment creation
- Encounter creation
- Prescription flow
- Billing flow

---

## End-to-End Tests

Use Playwright.

Critical E2E scenarios:

1. Reception registers patient.
2. Reception creates walk-in.
3. Token appears in queue.
4. Nurse records vitals.
5. Doctor opens patient.
6. Doctor records diagnosis.
7. Doctor creates prescription.
8. Doctor completes consultation.
9. Billing creates invoice.
10. Payment is collected.
11. Receipt prints.
12. Visit becomes completed.

---

# 51. Mandatory E2E Acceptance Scenario

The system is not production-ready until this scenario works repeatedly:

```text
New patient walks in
→ Reception registers patient
→ Token generated
→ Nurse records BP/temp
→ Doctor opens consultation
→ Doctor reviews history
→ Doctor records diagnosis
→ Doctor creates prescription
→ Consultation completed
→ Billing generated
→ Patient pays via UPI
→ Receipt printed
→ Prescription printed
→ Follow-up scheduled
→ Reminder job queued
```

Run this against:
- Chrome
- Chromium
- A normal clinic workstation
- A low-powered machine

---

# 52. Performance Targets

Target:

- App shell load: < 2 seconds on LAN
- Patient search: < 1 second typical
- Queue update propagation: < 1 second
- Patient profile: < 2 seconds
- Save consultation: < 2 seconds typical
- API p95: < 500 ms for local DB operations

External OpenEMR operations may be slower.

---

# 53. Accessibility

Requirements:

- Keyboard navigation
- Visible focus states
- Proper labels
- Color is not the only indicator
- Sufficient contrast
- Screen-reader-friendly controls where practical

---

# 54. Audit and Compliance Checklist

Before production:

- [ ] Every staff member has an individual account
- [ ] Shared admin password removed
- [ ] Admin 2FA enabled
- [ ] HTTPS enabled
- [ ] Audit logs enabled
- [ ] Automatic lock/session timeout configured
- [ ] Backups encrypted
- [ ] Restore tested
- [ ] Development data separated from real data
- [ ] Production secrets rotated
- [ ] DB ports not public
- [ ] OpenEMR admin access restricted
- [ ] User permissions reviewed
- [ ] Incident contact documented
- [ ] Data export procedure tested

---

# 55. Development Environments

Use:

```text
development
staging
production
```

Never use production patient data locally.

Use generated fake patient data for development.

---

# 56. Environment Variables

Example:

```env
NODE_ENV=production
PORT=4000

DATABASE_URL=
REDIS_URL=

SESSION_SECRET=

OPENEMR_BASE_URL=
OPENEMR_CLIENT_ID=
OPENEMR_CLIENT_SECRET=

APP_BASE_URL=

SMTP_URL=
WHATSAPP_PROVIDER=
WHATSAPP_API_KEY=

BACKUP_ENCRYPTION_KEY=
```

Secrets must never be committed.

---

# 57. Repository Structure

Recommended monorepo:

```text
clinicos/
  apps/
    web/
    api/
    worker/

  packages/
    ui/
    validation/
    types/
    config/
    openemr-client/

  infra/
    docker/
    caddy/
    backup/
    monitoring/

  docs/
    architecture.md
    deployment.md
    permissions.md
    disaster-recovery.md

  docker-compose.yml
  pnpm-workspace.yaml
```

---

# 58. Suggested Backend Structure

```text
apps/api/src/
  modules/
    auth/
    staff/
    patients/
    appointments/
    queue/
    encounters/
    vitals/
    prescriptions/
    billing/
    inventory/
    labs/
    reports/
    notifications/
    audit/
    settings/

  integrations/
    openemr/

  middleware/
  common/
  db/
  config/
```

---

# 59. Event Model

Use internal events:

```text
patient.created
appointment.created
appointment.checked_in
queue.patient_called
vitals.completed
consultation.started
consultation.completed
prescription.created
invoice.created
payment.received
followup.scheduled
lab.result.ready
```

Events may trigger:

- Notifications
- Audit entries
- Dashboard refresh
- WebSocket updates
- Reports
- Background jobs

---

# 60. WebSocket / SSE Events

Examples:

```text
queue.updated
queue.token.called
appointment.updated
payment.received
lab.result.ready
```

Do not send sensitive medical contents over public waiting-room channels.

---

# 61. Clinic Settings

Configurable:

- Clinic name
- Logo
- Address
- Phone
- Prescription footer
- Invoice footer
- Default consultation fee
- Currency
- Timezone
- Token prefix
- Queue reset behavior
- Language
- Receipt format
- Doctor working hours
- Reminder timing
- Session timeout

---

# 62. Doctor Settings

Per doctor:

- Name
- Qualifications
- Registration number
- Specialty
- Consultation fee
- Follow-up fee
- Working hours
- Slot duration
- Prescription signature
- Prescription header/footer
- Default follow-up interval

---

# 63. Duplicate Patient Prevention

Before creating patient:

Match on:

- Exact mobile
- Same name + DOB
- Same name + mobile suffix
- Same address + DOB where available

If suspicious duplicate:

```text
Possible existing patient found

Rahul Patel
42 years
98765xxxxx

[Open Existing] [Create Anyway]
```

Creating anyway should require a reason.

---

# 64. Patient Merge

Admin-only.

Rules:

- Preserve original IDs in audit
- Select surviving patient
- Re-associate ClinicOS references safely
- OpenEMR merge must follow supported workflow
- Generate merge audit event
- Never permanently erase history silently

---

# 65. Data Export

Authorized user should be able to export:

- Patient demographic data
- Visit summary
- Prescription history
- Lab reports
- Billing history

Formats:
- PDF
- CSV where appropriate

---

# 66. Printing Prescription Layout

Include:

- Clinic logo
- Clinic name
- Address
- Doctor name
- Qualifications
- Registration number
- Patient details
- Date
- Vitals if desired
- Diagnosis optionally
- Medicine list
- Instructions
- Follow-up
- Doctor signature
- QR code optionally

---

# 67. Dashboard Metrics

Manager dashboard:

```text
Patients Today
Waiting
Completed
Cancelled
Revenue Today
Outstanding
Average Wait Time
Doctors Active
```

Doctor dashboard:

```text
Waiting for me
Completed today
Follow-ups
Pending lab results
Average consultation time
```

---

# 68. Phase 1 — MVP

Must include:

- Login
- RBAC
- Staff accounts
- Patient search
- Patient registration
- Appointment
- Walk-in
- Queue
- Token system
- Nurse vitals
- Doctor consultation
- Diagnosis
- Prescription
- Consultation completion
- Basic billing
- Payment collection
- Prescription print
- Receipt print
- Daily summary
- Audit logs
- Backups

---

# 69. Phase 1 Exit Criteria

MVP is complete when:

- Clinic can operate a full day without using paper for core workflow.
- Reception can manage both appointments and walk-ins.
- Doctor can complete consultation and print prescription.
- Payment is recorded and receipt generated.
- Queue is live.
- Backups run automatically.
- Restore has been tested.
- Permission separation has been verified.

---

# 70. Phase 2

Add:

- Pharmacy
- Inventory
- Lab
- WhatsApp reminders
- Doctor templates
- Reports
- Patient documents
- Advanced audit view
- Multi-language
- Queue TV display
- QR patient card

---

# 71. Phase 3

Add:

- Patient portal
- Online appointments
- Telemedicine
- ABDM / ABHA integration
- Multi-branch
- Advanced analytics
- Accounting integration
- Mobile/PWA enhancements
- Automated stock purchasing suggestions

---

# 72. Future AI Features

AI must not make autonomous clinical decisions.

Safe future ideas:

- Dictation transcription
- Note formatting
- Visit summary drafting
- Patient history summarization
- Search across previous notes
- Billing anomaly detection
- Appointment no-show prediction

Doctor must remain responsible for clinical decisions.

---

# 73. Production Rollout Strategy

Do not switch the clinic in one day without testing.

Recommended rollout:

### Week 1
- Install staging
- Configure doctors
- Configure services
- Add staff
- Train owner/manager

### Week 2
- Reception testing with fake patients
- Doctor testing
- Printing calibration
- Queue testing

### Week 3
- Limited live pilot
- One doctor / limited hours
- Keep paper backup

### Week 4
- Full rollout
- Monitor daily
- Fix operational issues

---

# 74. Staff Training

Create role-specific quick guides:

- Reception: 1 page
- Doctor: 1 page
- Billing: 1 page
- Admin: 2 pages

Train using real workflows, not feature tours.

---

# 75. Disaster Recovery

Document recovery for:

- Server failure
- Database corruption
- Accidental deletion
- Ransomware
- Lost admin credentials
- Internet outage
- Router failure
- Power failure

Emergency paper workflow should still exist.

---

# 76. OpenEMR Fallback

Keep native OpenEMR available for:

- Advanced functionality
- Rare workflows
- Administrative recovery
- Features ClinicOS has not wrapped yet

Prefer access under:

```text
/openemr-admin
```

Restrict to trusted roles.

---

# 77. Definition of Done for Every Feature

A feature is complete only when:

- UI implemented
- Server-side authorization added
- Validation added
- Audit behavior considered
- Error handling added
- Unit tests added where applicable
- Integration tests added
- E2E updated if critical
- Loading state exists
- Empty state exists
- Permission behavior verified
- Mobile/tablet behavior considered
- Documentation updated

---

# 78. Coding Standards

- TypeScript strict mode
- No `any` unless justified
- Shared schemas using Zod where possible
- Consistent error codes
- ESLint
- Prettier
- Conventional commits
- Database migrations required
- No manual production schema edits
- API request IDs
- Feature flags for risky releases

---

# 79. Database Migration Policy

Use Prisma, Drizzle, or another migration-aware SQL tool.

Rules:

- Migrations committed
- Migrations immutable after deployment
- Production migration backed up first
- Destructive changes require explicit review

---

# 80. API Versioning

Use:

```text
/api/v1
```

Do not break existing clients without version change or compatibility layer.

---

# 81. Health Endpoints

Expose internally:

```text
GET /health/live
GET /health/ready
```

Ready checks:

- PostgreSQL
- Redis
- OpenEMR API
- Worker heartbeat where appropriate

Do not leak secrets or infrastructure details.

---

# 82. Suggested First Development Milestones

## Milestone 1
- Monorepo
- Docker Compose
- PostgreSQL
- Redis
- OpenEMR
- Reverse proxy
- Health checks

## Milestone 2
- Auth
- Staff
- Roles
- Permissions
- Audit foundation

## Milestone 3
- OpenEMR client
- Patient search
- Patient create
- Patient profile

## Milestone 4
- Appointments
- Walk-ins
- Queue
- Live queue updates

## Milestone 5
- Vitals
- Consultation
- Diagnosis
- Prescription

## Milestone 6
- Billing
- Payments
- Printing

## Milestone 7
- Reports
- Backups
- Security review
- E2E tests

## Milestone 8
- Clinic pilot
- Staff feedback
- Production hardening

---

# 83. Final Recommended V1 Scope

For the actual local clinic, prioritize:

```text
1. Patient Registration
2. Search
3. Appointments
4. Walk-ins
5. Queue
6. Vitals
7. Doctor Consultation
8. Prescription
9. Billing
10. Printing
11. Follow-up
12. Reports
13. Audit
14. Backup
```

Do not delay production because pharmacy, lab, AI, mobile apps, or advanced analytics are unfinished.

---

# 84. Product Principle

The system succeeds if:

> Reception can use it during rush hour without confusion, doctors can complete a consultation faster than on paper, managers can trust the reports, and the clinic can recover from a failed machine without losing patient history.

That should remain the standard against which every new feature is judged.

---

# 85. Recommended Tech Stack Summary

```text
Frontend
  React
  TypeScript
  Vite
  Tailwind
  shadcn/ui
  TanStack Query
  React Hook Form
  Zod

Backend
  Node.js
  TypeScript
  Express or NestJS
  PostgreSQL
  Redis
  BullMQ

Medical System
  OpenEMR 8.x
  REST API
  FHIR API
  MariaDB

Infrastructure
  Docker Compose
  Caddy / Nginx
  HTTPS
  Encrypted backups
  Monitoring

Testing
  Vitest
  Supertest
  Playwright
```

---

# 86. Final Architecture Decision

**Recommended architecture:**

```text
Custom React / TypeScript ClinicOS frontend
                ↓
Node.js / TypeScript ClinicOS backend
         ↓                ↓
OpenEMR APIs         PostgreSQL
     ↓                    ↓
Clinical Data       Operational Data
```

This provides the best balance between:

- Medical-system maturity
- Modern UX
- Safety
- Developer control
- Open-source foundations
- Clinic-specific customization
- Future scalability

---

# 87. Immediate Next Step

Before writing large amounts of UI code:

1. Deploy OpenEMR locally with Docker.
2. Enable API access.
3. Prove these operations:
   - Create patient
   - Search patient
   - Create appointment
   - Create encounter
   - Read encounter
   - Record vitals
   - Create prescription
4. Build a minimal ClinicOS API adapter around those operations.
5. Only then build the production front-desk and doctor interfaces.

This validates the most important architectural assumption before major implementation begins.

---

**End of Specification**
