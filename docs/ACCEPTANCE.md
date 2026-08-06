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
| 1 | Quick Data capture from `list.html` | BLOCKED | BLOCKED |
| 2 | Quick Design capture from `assets.html` | BLOCKED | BLOCKED |
| 3 | Both-mode capture | BLOCKED | BLOCKED |
| 4 | Save and rerun a repeated-list recipe | BLOCKED | BLOCKED |
| 5 | Next-button traversal from `next.html` | BLOCKED | BLOCKED |
| 6 | Infinite-scroll traversal from `infinite.html` | BLOCKED | BLOCKED |
| 7 | One-time active-tab access | BLOCKED | BLOCKED |
| 8 | Grant and revoke persistent origin access | BLOCKED | BLOCKED |
| 9 | Manual recipe run | BLOCKED | BLOCKED |
| 10 | Scheduled run and at-most-one catch-up | BLOCKED | BLOCKED |
| 11 | Inbox preview, pinning, deletion, and 20-run retention | BLOCKED | BLOCKED |
| 12 | Automatic and manual ZIP export | BLOCKED | BLOCKED |
| 13 | Project/recipe configuration export and import | BLOCKED | BLOCKED |
| 14 | Selector-change and login-required recovery | BLOCKED | BLOCKED |

### Interactive evidence from 2026-08-06

- Chrome acceptance is blocked because the installed-Chrome browser connection
  was unavailable to the test runtime. It was not replaced with a different
  automation path.
- Official Firefox acceptance is blocked because Firefox was not installed.
- Firefox-family compatibility smoke testing in Zen 1.21.10b (Firefox
  153.0.1) passed temporary add-on loading, dashboard rendering, recipe
  creation, the website-access settings UI, and safe missing-origin-permission
  failure handling.
- Persistent website access was intentionally left ungranted because expanding
  persistent browser access requires explicit confirmation at action time.
- The Zen compatibility smoke is supporting evidence only and does not count
  as Firefox acceptance in the table above.

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
