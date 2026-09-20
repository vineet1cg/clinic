# Graphify review and global appearance

## Scope and evidence

Used the existing `graphify-out/graph.json` as a navigation aid: 853 nodes, 2,330 edges, and no reported import cycles. The report's 240 weak-symbol nodes include package/configuration fields; they are not evidence of 240 missing features. Graph findings were checked against current source before changes.

Expanded query vocabulary: `app shell color palette provider status print recovery billing permissions`. Queries led to `main.jsx`, `AuthProvider`, `AppShell`, `Topbar`, `Sidebar`, `lazyElement`, `StatusBadge`, the design system, and billing/queue recovery paths. This was a targeted integration/UI review, not a comprehensive security audit or proof of deployment readiness. The existing graph was preserved; the review is saved through Graphify's feedback mechanism for a future graph update.

## Changes completed

- Added global Light, Dark, and System preferences through `ThemeProvider`, `useTheme`, and `ThemeSelect`. The default follows the OS, explicit choices override it, and storage events synchronize tabs. Invalid or inaccessible storage falls back safely.
- Added the external `public/theme-init.js` bootstrap before React for first-paint consistency under the existing CSP. No authentication data or patient data is stored with this preference.
- Replaced solid white surfaces with semantic colors throughout the frontend. Added dark text, surface, border, and status palettes; retained darker button fills for white-label contrast. Dark overrides are screen-only so paper stays light.
- Added theme controls to the application header, login, password change, not-found page, and public queue display. Kept the existing lightweight React/Tailwind stack and typography. UI/UX skill guidance informed contrast, visible focus, touch target sizing, and reduced-motion support.
- Added route-level permission boundaries. Previously, sidebar links were filtered but direct page URLs only required login. Restricted page components now do not mount or fetch their data. Backend permission checks remain authoritative; this does not replace them or claim every action's UI visibility has been audited.
- Expanded status badge labels/tones across queue, appointment, invoice, lab, and staff states. Corrected misleading crash guidance that asserted a submission had not been sent; users are now asked to check the saved record before retrying.
- Removed an unverified OpenEMR security assurance from the sidebar.
- Fixed Nginx header inheritance: location-level Cache-Control headers previously suppressed server-level security headers. Cache policy now uses an HTTP map and a server-level header alongside CSP and other security headers. The theme bootstrap has an exact-file route rather than SPA fallback.
- Excluded generated Graphify artifacts from application linting/formatting so normal tooling does not rewrite the map.

## Verification

- Frontend tests cover system/explicit preferences, remount persistence, storage events and clearing, blocked storage, invalid values, bootstrap consistency, and permission boundaries.
- Production build, repository lint, and format check passed. All 50 tests passed: API 31, frontend 9, worker 2, and shared contracts 8.
- Isolated Chromium tests against the production Vite preview used mocked API responses and invented records only. Verified login and invoice rendering, 375px viewport overflow, saved preference on reload, OS changes, explicit overrides, cross-tab synchronization, and restricted-route prevention of invoice fetches. No page errors occurred in these checks.
- Print emulation confirmed light color scheme, white invoice surface, hidden header/actions, and removal of the sidebar gutter.
- Applied the configured production CSP to browser responses: theme bootstrap worked without CSP violations. Blocking the React bundles still left the requested theme applied to the document before rendering.
- Measured semantic text/surface and status-tone pairs in both themes, plus white button labels: all checked pairs meet 4.5:1. This caught and corrected the existing light warning tone (now 5.17:1 against its warning background). This is not a full accessibility certification.
- Nginx configuration was reviewed statically, but container validation was not available: this shell lacks access to the Docker daemon and no local Nginx executable is installed. Run the normal container build/configuration and header checks before release. The browser CSP check does not prove live Nginx header delivery.

## Remaining release work

The theme does not resolve the existing production gates: real OpenEMR 8.x integration validation; reliable multi-document financial updates and reconciliation; refund/void policy; encrypted backup/restore drills; and clinic-hardware/security acceptance. UPI/card entries still record staff attestation, not provider-confirmed settlement. See README and the existing OpenEMR, deployment, and security plans.

For new pages, use `clinic-surface`, `clinic-text`, `clinic-muted`, and semantic status colors. Use `clinic-action` for solid primary buttons, not the brighter dark-mode `clinic-primary` text token. Keep non-document controls marked `no-print`. Theme preference is per browser origin, not a staff-account setting.
