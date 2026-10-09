# Scrapeyy V1 Acceptance

## Version 0.1.12 inline screenshot copy

- **Copy image** sits immediately before **Save PNG…** in the Inbox as well as
  the pop-out preview. It remains available for captures containing a screenshot
  regardless of the screenshot destination or selected text/screenshot view.
- Copying reads the original saved PNG and reports success only after the
  clipboard write finishes. It does not change settings, save a file, or export
  the capture.
- Strict TypeScript, 33 Vitest files / 185 tests, and Chrome MV3 plus Firefox MV2
  production builds passed. Both compiled Inbox/preview checks verified the
  inline button order and a real 1600 by 4200 PNG clipboard write.
- Both existing local build folders were refreshed to 0.1.12 and all 38 files
  were SHA-256 verified against the production build. Browser reload and native
  Firefox/Zen acceptance are left to Aaron for testing at his request.

## Version 0.1.11 screenshot clipboard

- **Clipboard** is available in the Capture and Settings screenshot destination
  menus. Visible page, Full page, and Draw selection use the selected destination.
  Clipboard capture creates no download or Inbox item.
- **Copy image** in the Inbox pop-out preview copies the original saved PNG,
  regardless of zoom or the selected preview view. Progress, successful copy,
  denied clipboard access, and retry are covered.
- Firefox/Zen use the native image clipboard API. Chrome background captures
  use a focused copy window, which shows confirmation and closes automatically.
  Chrome preview copies run directly in the focused preview. Only clipboard-write
  permission is requested; the extension never reads the clipboard.
- Strict TypeScript, 33 Vitest files / 184 tests, both production builds, and
  compiled browser checks passed. The Chrome copy page wrote a real 80 by 40 PNG
  with verified green pixels and reported a denied write without success.
  Both compiled preview builds copied a real 1600 by 4200 PNG.
  Screenshot regressions covered all three modes, nested panels, sticky content,
  overlap, lazy growth, and restoration.
- Browser fixtures bridge extension runtime/window APIs. The extension-capable
  Chromium executable failed to launch after three retries on this Windows host.
  Reloading the user's installed browser and native Firefox/Zen clipboard acceptance
  remain unverified.

## Version 0.1.7 Inbox preview window

- Select a capture in Inbox and click **Pop out ↗**. A separate 1100×800 browser
  popup window opens at the selected capture and preview type. It uses its own
  IndexedDB connection and object URL, so the toolbar popup can close safely.
- Text and screenshot views, Fit width, original image size, 25–400% zoom, image
  dimensions, vertical/horizontal scrolling, and Save PNG/Export are available.
  The window follows the saved theme and adapts when resized. Missing captures,
  missing/invalid screenshots, and load/export failures show clear messages.
- All 159 unit/integration tests and strict type checking pass; Firefox MV2 and
  Chrome MV3 builds include `preview.html`. Image URLs are revoked on unmount.
- `tests/browser/preview-smoke.mjs` checks compiled inbox/preview pages with real
  IndexedDB, a 1600×4200 PNG, inbox closure, zoom, narrow-window resizing, text,
  export commands, expired captures, and absence of browser page errors.
  WebExtension window/storage/export APIs are simulated in headless Chromium;
  installed Zen/Firefox window behavior still needs manual verification.

## Version 0.1.6 selection-menu layering

- The draw-selection overlay is a transparent native modal dialog in the browser
  top layer. It escapes ordinary stacking contexts and transformed ancestors;
  site dialogs/popovers opened afterward re-promote the selection overlay.
- The instruction menu stays above selection shading. Capture hides the overlay
  and transparent backdrop from the PNG. Cancel/Escape remove the overlay without
  closing the site's existing modal or manual popover.
- Compiled-script Chromium checks cover maximum-z-index menus, existing and later
  native modals/popovers, a transformed document root, viewport-sized geometry,
  drag/capture/cancel hit testing, Escape, and an overlay-free saved crop pixel.
  All 152 tests, type checking, and Firefox/Chrome builds pass. Installed Zen
  verification remains pending; no desktop/computer-use automation was used.


## Version 0.1.5 full-page screenshot repair

- Substantial nested scrolling panels, including fixed app panels and open
  shadow-root panels, are expanded for viewport capture. Changed style values,
  priorities, and original panel/window scroll positions are restored.
- Sticky sections retain their natural document location. Later tiles draw only
  their uncovered area, preserving the initial fixed header when the last tile
  overlaps the first. Page dimensions are rechecked as content loads.
- Stalled scrolling and viewport changes produce an error instead of a silently
  incomplete PNG. High-DPI canvas limits are checked after the first tile.
- All 152 unit/integration tests and strict type checking passed. The compiled
  Firefox scripts passed headless Chromium checks for all three screenshot modes,
  nested/fixed panels, sticky content, overlap, lazy growth, and restoration,
  including PNG dimensions and sampled pixel colors. WebExtension capture and
  download APIs were bridged to Playwright; this is not installed Zen acceptance.
- Codex browser automation tools are unavailable in the Ubuntu chat running this
  repair. A local acceptance page is included at `/full-page.html` for native
  browser testing. Installed Zen acceptance remains pending after loading 0.1.5.


## Version 0.1.4 destinations and video discovery

- Screenshot destination is separate from other exports: automatic device save,
  Save As, or Inbox. Existing download settings migrate to equivalent screenshot
  settings. Automatic saving accepts a relative subfolder of the browser's
  configured download directory; no arbitrary absolute-path access is claimed.
- All nine screenshot-type/destination combinations have background integration
  tests. Inbox PNGs and metadata are committed in one IndexedDB transaction,
  preview as images, support pin/clear/retention, and export directly as PNG.
- Video tests cover nested shadow roots, same-origin frames, extensionless Reddit
  and external video links, exposed Reddit playback JSON, closed-player attribute
  fallback, captions, de-duplication, malformed metadata, and audio-only filtering.
- Codex browser UI checks passed for persisted preferences, separate folders,
  real IndexedDB inbox preview, three fixture video results, and 420px popup width.
  Device capture/download APIs were simulated in those UI checks; the routing and
  completion behavior are covered by code tests.
- Live Reddit opened a verification challenge in Codex browser. It was not solved
  or bypassed. The exact reported Reddit page was not supplied during this run;
  live Reddit and installed Zen acceptance remain pending.
- No desktop/computer-use automation was used; browser UI checks used only the
  Codex in-app browser.

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
## Version 0.1.8 embedded document screenshot repair

- Full-page screenshot recognizes a dominant embedded document viewer on a
  viewport-sized page, including IT Glue's Office iframe without a `src`.
- It discovers frames through optional `webNavigation` access and requests only
  the uniquely identified viewer origin. Version 0.1.9 uses dedicated Allow
  buttons for each missing permission, as described below.
  Ambiguous or inaccessible viewers stop with a clear message, not a partial PNG.
- The frame is matched to its actual parent iframe using a per-capture token and
  `postMessage` source identity. Captures scroll the document panel and crop out
  the viewer toolbar/footer before stitching. Original scroll and styles are
  restored on success and failure, and high-DPI/last-tile overlap is covered.
- Scope: the viewer must be fully visible and unscaled. A normal long outer page
  continues using the existing page capture path. Nested inaccessible viewers
  require separately granted origin access; their content is not silently skipped.
- Regression checks cover the live IT Glue dimensions (1244px outer viewport,
  1131px panel, 2855px document), explicit missing permission errors, origin
  selection, failed-capture cleanup, and 2x pixel stitching.
- Codex in-app browser fixture validation captured a real cross-origin,
  three-page/2850px viewer with no iframe `src`, including END OF DOCUMENT, and
  restored the panel to its starting scroll position of 137px. Fixture transport
  simulates the WebExtension APIs; installed add-on testing on IT Glue is a
  separate check after the browser reloads the updated local extension.
- Live IT Glue validation: after reloading the local 0.1.8 extension and running
  Full page on `/5667882/docs/21231734`, Aaron confirmed **All three pages
  captured** on 2026-10-05. This is user-confirmed installed-extension evidence.

## Version 0.1.9 permission gesture repair

- Real-browser feedback exposed a 0.1.8 failure: awaited frame discovery caused
  `permissions.request may only be called from a user input handler`, before a
  permission dialog could appear.
- Full page now discovers the next missing permission without requesting it.
  The popup shows **Allow viewer discovery**, then **Allow document access**
  with the exact viewer origin. Each click invokes `permissions.request`
  synchronously before awaiting any browser API. Already granted permissions
  are skipped; capture continues after the final grant.
- Denial leaves the Allow button available to retry and prevents partial capture.
  The selected tab is checked again before resuming a pending screenshot.
- Regression tests enforce the original click stack for both permission stages,
  exact-origin scope, asynchronous discovery without permission requests, and
  denial/retry behavior. TypeScript, 32 test files/171 tests, and Chrome MV3 plus
  Firefox MV2 production builds passed on 2026-10-05.
- Codex browser testing rendered the actual popup with simulated WebExtension
  permission APIs. Native click-dispatch checks passed for discovery and exact
  viewer-origin access, including a denied request and successful retry. Capture
  resumed after the final grant. Aaron confirmed the native permission flow
  worked in a real browser on 2026-10-05, then requested a higher prompt position.

## Version 0.1.10 permission prompt visibility

- The document access prompt sits directly below the popup's tabs, outside the
  scrolling content area. Its Allow button stays visible when the capture tools
  are scrolled and when a denied request displays a notice.
- The popup uses a fixed-height flex column so optional notices and permission
  prompts take their own space while the tools continue scrolling below them.
- Browser fixture validation at 600px and 500px popup heights kept the Allow
  button at 180px below the popup top while the content scrolled (182px/282px).
  The denied-request notice also left the button visible at the compact height.
  Both permission clicks still ran during native click dispatch and capture
  resumed. TypeScript and the 20 popup/capture integration tests passed.

## Version 0.1.13 Wistia video discovery and MP4 downloads

- Video tools recognize Wistia iframe, legacy async/class, script and Aurora
  embeds, combining duplicate references before resolving public player metadata.
  Scanning does not start playback or transfer the video itself.
- Public MP4 playback assets appear in descending quality with resolution and
  file size. Downloads retain the actual exposed asset URL and save with a
  readable `.mp4` filename even when the CDN URL ends in `.bin`.
- Downloads re-scan the selected page and re-resolve the provider's current
  assets before accepting a URL. Unsupported/protected metadata, unrelated
  delivery hosts, originals, audio-only assets, images and streaming playlists
  do not become provider download candidates. Failures keep the embed visible.
- Metadata requests omit credentials and referrers, reject redirects, and bound
  response size, time and per-page work. Public metadata uses CORS; no new host
  permission or Wistia API token was added.
- Exact live source: [IT Glue Q3 2026 innovation webinar recap](https://community.kaseya.com/quarterly-innovation-webinars-157/it-glue-q3-2026-innovation-webinar-recap-31893),
  Wistia media `i0vm82gvvs`, checked on 2026-10-09. Public metadata exposed five
  MP4 assets: 1080p, 720p, 540p, 360p and 224p. Each returned HTTP 206 for a
  32-byte range, the MP4 `ftyp` signature, `video/mp4` content type and a total
  size matching its metadata. This checks real file availability without
  transferring the full 59-minute webinar.
- The actual popup components and shipping resolver were tested in the Codex
  browser using a fixture containing the live page's exact iframe. The resolver
  fetched real Wistia metadata across origins, displayed one webinar with five
  downloads, and selecting 1080p produced the expected asset request. The fixture
  records download requests; it does not simulate a completed native download.
- TypeScript, all 35 test files / 204 tests, and Chrome MV3 / Firefox MV2
  production builds passed. Regression coverage includes discovery, deduplication,
  quality ordering, filename safety, metadata failures, protection handling,
  invalid delivery hosts, stale/arbitrary download rejection and popup actions.
- Local evidence is in `work/wistia-video`: `live-verification.json`,
  `wistia-video-validation.jpg`, staged builds, release ZIPs and hash receipts.
  Both durable `.output` folders are refreshed by the validated release workflow.
- After updating/reloading Chrome 0.1.13, Aaron confirmed on 2026-10-09 that the
  installed Codex browser extension shows the webinar and all five download
  choices. This is user-confirmed installed discovery evidence. A completed
  native transfer of the full webinar and installed Firefox acceptance were
  not reported; file availability was checked using the real MP4 byte ranges.

## Version 0.1.14 independent captions and transcript exports

- Video tools now expose text actions above MP4 downloads, grouped by language:
  Copy transcript, Download transcript (TXT), Captions (VTT), and Captions (SRT).
  The metadata-only action is labeled Export video metadata (JSON).
- Public Wistia metadata supplies complete transcript text plus canonical caption
  endpoints. TXT/copy uses this text without transferring subtitle or video bytes.
  Other exposed VTT/SRT tracks can be read on demand; currently loaded browser
  cues remain a clearly labeled partial fallback when no track URL exists.
  Transcript-only tracks never receive fabricated subtitle timings.
- Exports re-scan the current page and validate the selected video/track identity
  before reading its URL. Caption requests omit credentials/referrers, reject
  redirects, and enforce a 10-second timeout and 2 MB response limit. No new host
  permissions, API tokens, microphone access, or transcription service was added.
  If the player exposes no text, the UI reports that limitation; audio speech-to-
  text generation is outside this feature.
- Exact live webinar `i0vm82gvvs`, checked 2026-10-09: one English track, 51,737
  characters in the titled/source-attributed TXT export; VTT and SRT each contain
  1,132 cues ending at 3580.055 seconds of the 3582.73-second webinar. Both subtitle
  exports round-trip to the same cue text/times. No video bytes were downloaded.
- The shipping popup/resolver/exporter were exercised in the Codex browser using
  live CORS-enabled metadata/caption responses in a labeled validation fixture.
  All three formats produced the expected content/counts; the text controls fit
  the popup without overflow. The fixture clipboard write resolved and displayed
  success, but the browser tool's separate clipboard read returned empty. Native
  installed clipboard readback and Save As downloads remain manual checks; the
  fixture's success notice alone is not proof of either.
- TypeScript, all 36 Vitest files / 222 tests, and Chrome MV3 / Firefox MV2 builds
  passed. Coverage includes parsing/conversion, language selection, full versus
  partial text, absent timings, size limits, stale/forged selection rejection,
  background routing, clipboard text retrieval, and independent popup actions.
- Both durable `.output` folders and all ZIP entries match staged builds by
  SHA-256 (21 Chrome files, 17 Firefox files). Evidence, sample TXT/VTT/SRT exports,
  ZIPs, source/build verification and prior-build backups are in `work/video-text`.
  Installed 0.1.14 update/reload remains pending: browser policy prevents operating
  the extension manager, and no installed-browser acceptance has been supplied.
