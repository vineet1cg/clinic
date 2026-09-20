# ClinicOS: what to implement next

Updated: 2026-09-18. A short proposed roadmap, not a list of completed features. See the [architecture reference](architecture.md) for technical details.

## 1. Before real-patient launch

- **Validate OpenEMR integration:** prove patient and clinical-record synchronization with generated records, including duplicate prevention and recovery after interrupted requests.
- **Make payments reliably recoverable:** use MongoDB transactions or durable reconciliation so invoices, queue release, and audit records cannot silently diverge. Test concurrent payments and retries.
- **Add refunds and voids:** define clinic approval rules, reasons, audit history, and how cancelled visits affect collected fees.
- **Finish deployment and recovery:** configure HTTPS, production secrets, restricted database access, monitoring, encrypted backups, and a tested restore procedure.
- **Run clinic acceptance tests:** verify registration → payment → doctor queue → consultation → receipt on actual staff hardware and printers, including permission and failure cases.

## 2. Next clinic improvements

- **Daily cash closing:** reconcile cash, UPI, and card entries; show outstanding balances and cashier totals. Current UPI/card entries are staff-recorded, not settlement-verified.
- **Appointment reminders:** connect a real notification provider with patient consent, delivery tracking, and retry-safe jobs. The current worker does not deliver messages.
- **Complete pharmacy/lab handoffs:** extend the existing modules with prescription-linked dispensing, stock-expiry alerts, and clearer pending-result tracking.

## 3. Later, after the pilot

- **Payment-provider integration:** verify settlements and safely handle duplicate callbacks and refunds.
- **Vercel frontend deployment:** establish a secure API network path and test cookie/CSRF behavior; keep the API, worker, databases, and OpenEMR separately hosted.
- **Patient self-service:** consider appointment requests and receipt access only after staff workflows and patient identity/access controls are proven.

**Suggested order:** integration proof and payment reliability first; then recovery/deployment and clinic acceptance; then operational improvements. Registration, payment-before-queue, basic clinic modules, and the global theme already exist—extend and harden them rather than rebuild them.
