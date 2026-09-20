# Maitri hospital branding

Updated 2026-09-20. The clinic identity comes from the supplied `logo.jpeg` and `branding.jpeg` (both JPEGs). Correction: `branding.jpeg` contains patient-file stationery, not a brochure.

- Original root files are unchanged. The logo's byte-for-byte serving copy lives in `apps/web/public/branding/`; the mistakenly published whole patient-file image has been removed.
- `apps/web/src/constants/branding.js` centralizes the hospital name and asset paths.
- `ClinicBrand` displays the mother-and-child emblem with the Maitri name on login, sidebar, password change, and waiting-room screens. A white logo surface preserves the original JPEG in both themes; no tinting, stretching, or background removal is applied.
- The patient-file cover and instruction pages are not displayed or linked on login. Only the lower-left investigations sheet is transcribed in [the OCR reference](investigations-ocr.md), with a standalone blank printable template. This does not add clinical data entry or storage.
- `InvoiceLetterhead` retains the stationery's cyan identity with the original logo and real invoice/patient/doctor details. Only paid invoices are titled “Payment receipt.” Navigation, queue notices, and collection controls are excluded from printing; item rows, totals, and payment history remain.
- Print CSS uses a full-width document, repeated table headings, wrapping item text, and light backgrounds regardless of the app theme. Use the browser's paper-size/margin settings; this is not a thermal-receipt template.

UI/UX skill guidance informed accessible text, preserved image proportions, fixed image dimensions, and responsive layout. The existing app palette remains intact. No image-generation or new image dependency was needed.

## Before using bills with patients

Confirm the hospital's exact legal billing name, address, phone, and any required registration/tax details. These have not been guessed from the low-resolution artwork. Current branding is deployment-level, not an invoice-time clinic-identity snapshot; preserve immutable issuer details on invoices if historical reprints must remain unchanged after future branding edits.

## Verification and search notes

Graphify vocabulary: `invoice print settings clinic login sidebar display`. Traversal located `Sidebar`, `QueueDisplayPage`, `clinic.service.js`, and billing/settings source paths; current code was inspected before edits. The graph is a baseline and was not rebuilt.

Frontend component tests cover live identity, the original logo path, paid/unpaid titles, and optional doctor information. Production build and browser checks use fabricated invoice data only. A physical printer test remains necessary.

No GitHub remote, commit, or push was created in this task. Provide the repository URL for the publishing step; review ignored secrets and the intended visibility before the first push.
