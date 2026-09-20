# Previsit consultation fee implementation

Status: implemented and verified against the local API/MongoDB workflow on 2026-09-17. Financial transactions, refunds, and external payment verification remain separate go-live work.

## Goal

Collect the doctor consultation fee at visit registration. A booked patient pays at check-in; a walk-in pays when registered. The doctor queue opens only after the consultation invoice is fully paid. Patient demographic registration remains separate so returning patients can be billed for each visit.

## Design

- Use the clinic default consultation fee, with an optional per-doctor override. Reject visit registration when neither supplies a positive fee, so a missing configuration cannot silently waive payment.
- Register visits into `PAYMENT_PENDING`. Create exactly one `CONSULTATION` invoice per queue entry, with the fee copied onto the invoice at registration time. Do not recalculate historical invoices if settings later change.
- Reuse the existing payment endpoint and idempotency keys. A fully paid consultation invoice moves the visit into `WAITING`; partial payment leaves it pending. Follow-up billable services can still be invoiced after consultation.
- Prevent manual queue transitions or encounter creation from bypassing an unpaid consultation charge. The public waiting display excludes pending visits.
- Use the appointment ID or a required walk-in idempotency key to retry registration without duplicate queue entries or invoices. Keep the old queue records usable as legacy visits.
- Send reception staff to the invoice immediately after registration. Show the configured fee before check-in, highlight outstanding charges in the queue, and provide a receipt/payment page with a return-to-queue action.

## Verification

1. Test contracts and queue transitions for the new pending state.
2. Test fee resolution, registration idempotency, partial/full payment, and permission checks with fake data.
3. Update the workflow smoke test to prove unpaid visits are blocked, payment clears the queue, and replay does not double charge.
4. Run format, lint, all tests, production build, database index creation, and the live smoke path.
