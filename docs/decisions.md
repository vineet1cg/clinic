# Recommendations and corrections

1. **Deploy the first clinic locally before Vercel.** Same-origin LAN hosting is faster, works during internet outages, and simplifies secure cookies. Use Vercel later for the SPA only when the API has a deliberate secure network path.
2. **Prove OpenEMR before building clinical screens.** Patient, appointment, encounter, observation, and prescription API behavior is the largest architecture risk.
3. **Keep MongoDB operational.** Do not mirror entire OpenEMR patient charts. Use references, validation, indexes, transactions, and idempotency records.
4. **Do not launch every module together.** Pilot reception/search, previsit consultation-fee collection, and the payment-gated queue first; then validate vitals/consultation and additional-service billing/printing. Prescription-linked pharmacy dispensing and full lab workflows remain Phase 2.
5. **Design around recovery.** A clinic can tolerate fewer visual features more easily than lost notes, duplicate payments, broken printing, or an untested restore.
6. **Measure the actual clinic hardware.** Validate shell load, patient search, printing, keyboard-only operation, 375px layouts, and reduced motion on the reception and doctor machines before rollout.
