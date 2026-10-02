# Scrapeyy V1 Acceptance

## Version 0.1.3 screenshot fixes

- Versioned page bridges replace stale injected scripts. Empty or outdated
  screenshot responses are errors, never download success.
- Screenshot saves wait for download completion and retain the image URL until
  then. Popup success includes the browser-reported filename.
- The crop overlay mounts at the document root to avoid transformed body
  clipping. A mounted viewport-sized overlay is required before popup dismissal.
- Drawing keeps a visible crop rectangle until Capture; redraw and Escape work.
- Regression tests cover outdated bridges, invalid receipts, download completion
  races, cancellation, missing files, and popup progress/errors.
- `tests/browser/screenshot-smoke.mjs` runs the compiled Firefox background and
  content scripts together in headless Chromium. It verifies the real shadow
  overlay on a transformed-body fixture, reverse dragging, explicit Capture,
  Escape, three PNGs with correct dimensions, and restored scroll position.
  WebExtension APIs are simulated; this is not installed Zen acceptance.
  Run after a Firefox build with `node tests/browser/screenshot-smoke.mjs
  <build-directory>`. Playwright must be resolvable, or set `PLAYWRIGHT_MODULE`
  to its module path.
- [ ] Reload 0.1.3 in installed Zen, verify header version, then check all three
  modes and the real Save As / Downloads behavior on a normal website.

The download lifecycle follows Mozilla's
[download API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/download)
and [completion events](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/downloads/onChanged).

## Version 0.1.2 changes

The historical browser results below describe the earlier release. The new
capture switches, standalone screenshot tools, image exports in Content mode,
and video inspector have source tests and a Firefox production build. Headless
Chromium checks cover popup actions/layout, reverse rectangle drawing, Escape
cancellation, and the two capture switches. Installed Firefox acceptance for
this release remains pending:

- [ ] Load the 0.1.2 Firefox build and check that capture choices persist.
- [ ] Export Content-only capture and verify image files plus media.json.
- [ ] Capture a visible PNG, scrolling full-page PNG, and manually drawn PNG.
- [ ] Verify crop dimensions at non-default display scaling/browser zoom.
- [ ] Cancel drawing while a recipe is open and confirm the recipe is preserved.
- [ ] Download an exposed direct MP4/WebM and export available caption details.
- [ ] Confirm embedded/streamed video is identified without a download claim.

API references used for this release:
[visible-tab capture](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/captureVisibleTab),
[media text tracks](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/textTracks),
and [MediaSource streams](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource).

## Earlier release evidence

This file separates source/build proof from interactive browser proof. Complete
the same checklist in current Chrome and Firefox against
`http://127.0.0.1:4173`.

## Automated proof

- [x] TypeScript strict type check.
- [x] Unit and integration tests for contracts, extraction, selectors, design
  sanitization, traversal, storage, retention, permissions, schedules, exports,
  smart Quick Capture, direct element selection, the popup workspace, staged
  recipe creation, content injection, and the cross-module run service.
- [x] Next-button traversal tests cover shared Previous/Next selectors,
  JavaScript tables that update without URL navigation, intermediate loading
  mutations, disabled-control completion, deduplication, and legacy one-page
  recipe defaults.
- [x] Chrome Manifest V3 production build.
- [x] Firefox Manifest V2 production build.
- [x] Production builds contain the popup, background, and content script with
  no standalone dashboard page or dashboard asset.
- [x] Chrome uses `optional_host_permissions`; Firefox uses
  `optional_permissions` for the same HTTP/HTTPS runtime grant.
- [x] Production dependency audit reports zero vulnerabilities.

## Browser checklist

Record each item as `PASS`, `FAIL`, or `BLOCKED`, with a short note. A build
result does not count as browser acceptance.

| # | Workflow | Chrome | Firefox |
|---:|---|---|---|
| 1 | Popup contains Capture, Inbox, Recipes, SharePoint, and Settings | BLOCKED | PASS |
| 2 | Quick Capture directly selects a page link without navigating | BLOCKED | PASS |
| 3 | Quick Data capture saves smart inferred data to Inbox | BLOCKED | PASS |
| 4 | Data, Design, and Both choices are available after selection | BLOCKED | PASS |
| 5 | Inbox shows the saved run, data preview, and export/retry/pin/delete actions | BLOCKED | PASS |
| 6 | Create Recipe detects datasets and uses Data, Traversal, and Test & Save | BLOCKED | PASS |
| 7 | Save a bounded repeated-list recipe and see it in popup Recipes | BLOCKED | PASS |
| 8 | One-time active-tab access | BLOCKED | PASS |
| 9 | Quick Design and Both-mode artifacts | BLOCKED | BLOCKED |
| 10 | Grant and revoke persistent origin access | BLOCKED | BLOCKED |
| 11 | Manual and scheduled recipe runs | BLOCKED | BLOCKED |
| 12 | Next-button and infinite-scroll traversal | BLOCKED | BLOCKED |
| 12a | Shared-class, in-place JavaScript pagination fixture | BLOCKED | BLOCKED |
| 13 | Automatic/manual ZIP export and configuration import/export | BLOCKED | BLOCKED |
| 14 | Selector-change and login-required recovery | BLOCKED | BLOCKED |

### Interactive evidence from 2026-08-06

- Chrome connected successfully, and the ChatGPT browser extension and native
  host both passed diagnostics. Interactive Scrapeyy acceptance is blocked
  because browser-control policy does not allow access to Chrome's internal
  extension manager to load the unpacked build.
- The current official Firefox build was downloaded from Mozilla and run from
  a temporary location with an isolated profile. The Firefox MV2 package was
  installed as a temporary add-on through `web-ext`.
- Firefox passed popup rendering, direct link selection without navigation,
  Quick Data capture, Inbox storage and preview, all three recipe stages, recipe
  save, and popup recipe visibility.
- Persistent website access was intentionally left ungranted because expanding
  persistent browser access requires explicit confirmation at action time.
- The temporary Firefox app, profile, and mounted disk image were removed after
  acceptance. No existing tabs or browser profile files were deleted.

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
