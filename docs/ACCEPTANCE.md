# Scrapeyy V1 Acceptance

This file separates source/build proof from interactive browser proof. Complete
the same checklist in current Chrome and Firefox against
`http://127.0.0.1:4173`.

## Automated proof

- [x] TypeScript strict type check.
- [x] Unit and integration tests for contracts, extraction, selectors, design
  sanitization, traversal, storage, retention, permissions, schedules, exports,
  picker, popup, dashboard, content injection, and the cross-module run service.
- [x] Chrome Manifest V3 production build.
- [x] Firefox Manifest V2 production build.
- [x] Chrome uses `optional_host_permissions`; Firefox uses
  `optional_permissions` for the same HTTP/HTTPS runtime grant.
- [x] Production dependency audit reports zero vulnerabilities.

## Browser checklist

Record each item as `PASS`, `FAIL`, or `BLOCKED`, with a short note. A build
result does not count as browser acceptance.

| # | Workflow | Chrome | Firefox |
|---:|---|---|---|
| 1 | Quick Data capture from `list.html` | PENDING | PENDING |
| 2 | Quick Design capture from `assets.html` | PENDING | PENDING |
| 3 | Both-mode capture | PENDING | PENDING |
| 4 | Save and rerun a repeated-list recipe | PENDING | PENDING |
| 5 | Next-button traversal from `next.html` | PENDING | PENDING |
| 6 | Infinite-scroll traversal from `infinite.html` | PENDING | PENDING |
| 7 | One-time active-tab access | PENDING | PENDING |
| 8 | Grant and revoke persistent origin access | PENDING | PENDING |
| 9 | Manual recipe run | PENDING | PENDING |
| 10 | Scheduled run and at-most-one catch-up | PENDING | PENDING |
| 11 | Inbox preview, pinning, deletion, and 20-run retention | PENDING | PENDING |
| 12 | Automatic and manual ZIP export | PENDING | PENDING |
| 13 | Project/recipe configuration export and import | PENDING | PENDING |
| 14 | Selector-change and login-required recovery | PENDING | PENDING |

## Export inspection

For a Both-mode run, inspect the downloaded ZIP and confirm:

- `manifest.json`, `data.json`, and `data.csv` are present.
- `snapshot.html`, `styles.css`, and `assets.json` are present.
- `screenshot.png` is present when visible-tab capture was available.
- No `<script>`, inline event handler, password value, hidden token, nonce,
  `javascript:` URL, cookie, or browser-storage value is present.
- Re-exporting an unchanged stored run yields deterministic serialized content.

## Known runtime constraints

- The browser must be running for scheduled work.
- Authentication is the website's existing browser session; Scrapeyy never
  stores credentials.
- Protected or unavailable assets remain source links in `assets.json`.
- Browser download policies may show a save prompt. A failed download remains
  recoverable from the Capture Inbox.
- Site terms and content rights remain the user's responsibility.
