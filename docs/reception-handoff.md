# Consultation-to-reception workflow

Updated: 2026-09-21.

## Responsibility boundary

- **Doctor:** reviews the patient, records the complaint, examination, assessment/conditions,
  plan, prescription, and follow-up date; then completes the consultation.
- **Receptionist:** registers visits, collects the consultation fee before the doctor queue, and
  handles any post-consultation charges after the doctor is finished.
- **Billing staff:** can perform the same financial work when the clinic assigns that role.

The default doctor role has encounter permissions but no queue-management, invoice-creation, or
payment-collection permissions. The API remains the authority even if a restricted button is
accidentally rendered by a client.

## State flow

```text
Appointment check-in / walk-in
        |
PAYMENT_PENDING -- full doctor-fee payment --> WAITING
        |
vitals / ready for doctor / consultation
        |
doctor completes and locks encounter
        |
CONSULTATION_COMPLETE (Awaiting reception)
        |
        +-- no extra charges --> COMPLETED
        |
        +-- additional services --> create final invoice --> BILLING_PENDING
                                                        |
                                                 full payment --> PAID
                                                        |
                                              reception closes visit
                                                        |
                                                    COMPLETED
```

The consultation invoice and final invoice are separate: the first is the doctor fee paid before
the queue; the second is only for post-consultation services. Reopening a billing-pending handoff
looks up the existing final invoice for that queue entry, preventing a normal UI retry from creating
another invoice.

## Operating notes

- All user-facing dates use `dd/mm/yyyy`; API and MongoDB date-only values remain ISO
  `yyyy-mm-dd` so filtering and ordering stay reliable.
- Registration and walk-in timestamps are generated automatically from clinic time. The API remains
  authoritative for persisted timestamps.
- Age is calculated from date of birth in completed years in both the UI and API. If the birth date
  is unknown, staff may enter age only.
- Card/UPI entries are staff attestations until a payment provider is integrated; they are not bank
  settlement verification.
