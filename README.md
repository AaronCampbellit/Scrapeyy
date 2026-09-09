# Scrapeyy

Scrapeyy is a local-first Chrome and Firefox extension for capturing structured
website data and sanitized design references. Captures stay in the browser
until the user exports them.

## What it does

- Precise click-or-drag Quick Capture, with an explicit full-page option.
- Smart Quick Capture for dashboard metrics, nested native/ARIA tables,
  repeated lists/cards, open shadow roots, and ordinary regions.
- Data, Design, and Both capture modes.
- Popup-only management for captures, projects, recipes, inbox runs, exports,
  permissions, and settings.
- Bounded Next-button and infinite-scroll traversal.
- Reusable projects and recipes with manual or scheduled runs.
- Local capture inbox with partial/error recovery.
- Deterministic JSON, CSV, and design-reference ZIP exports.
- Optional per-origin permission for scheduled captures.

Scrapeyy does not collect credentials, cookies, tokens, executable scripts, or
browser history. It does not bypass authentication, CAPTCHAs, or anti-bot
controls, and it is not a full-site cloning tool.

## Develop

Requirements: Node.js 24 and npm.

```bash
npm ci
npm test
npm run typecheck
npm run build
npm run build:firefox
```

Run local acceptance pages with:

```bash
npm run fixtures
```

The fixture index is at `http://127.0.0.1:4173`.

## Install unpacked builds

Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose **Load unpacked**.
4. Select `.output/chrome-mv3`.

Firefox:

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `.output/firefox-mv2/manifest.json`.

The toolbar popup contains the complete product.

For a one-time capture:

1. Press **Quick Capture**.
2. Click an element, drag around a region, or press **Full Page**.
3. Choose **Data**, **Design**, or **Both**.
4. Press **Capture**.
5. Reopen the popup and use **Inbox** to preview or export the run.

Quick Data capture automatically recognizes dashboard label/value metrics,
tables nested anywhere in the selection, ARIA grids, and repeated cards/lists.
It also includes a normalized visible-text record, links, images, a sanitized
source URL, and an element description so unfamiliar page structures still
retain their readable data. Hidden elements and Scrapeyy's own interface are
excluded. Cross-origin frames and information drawn only as pixels on a canvas
remain subject to browser security and accessibility limits.

Use **Create Recipe** when the capture needs reusable fields, pagination,
infinite scrolling, schedules, project assignment, limits, or automatic
downloads. Select a page or region and Scrapeyy detects datasets and fields
automatically. The on-page flow is Data, Traversal, and Test & Save; a successful
live-page test is required before saving. Recipe creation requests website
access so the builder and scraper can reconnect after full-page navigation.
Minimize hides the builder without
losing the in-page draft; click the extension again to restore it. If pagination
is not detected, **Choose Next button on page** temporarily hides the builder so
the correct site control can be selected. Scrapeyy then clicks that exact control
and verifies that the selected data or page URL changes before allowing the
recipe to continue. If that test opens a new page, the background process
restores the complete unsaved draft at the verified Traversal step on the new
page. A recovery copy is also kept locally until the builder is restored, so
clicking the extension again can recover the draft if reinjection is delayed.
During a run, pagination waits for genuinely new extracted records
instead of page counters or loading animations. Full-page navigations
reconnect through the background process and continue the same run.

Enable **Run manual captures in a background tab** under Automation and
downloads to use a temporary inactive worker tab that closes after the scrape.
This requires persistent website access. Scheduled runs use isolated temporary
tabs automatically. Saved recipes, inbox runs, and settings remain in the popup;
there is no separate dashboard page.

Next-button recipes support JavaScript-rendered tables whose URL does not
change. Scrapeyy remembers the exact selected control even when Previous and
Next share the same class, waits for the selected dataset to finish updating,
deduplicates records between pages, and stops when the control is disabled,
missing, produces no new records, or reaches a safety limit. Selecting a
multi-page mode defaults to 50 pages and 10,000 records; both limits remain
editable in the Traversal step.

One-time capture uses the active-tab grant. Grant persistent website access
only to origins that should support manual recipe runs from the popup or
scheduled captures.

## Scheduling and exports

The browser must be running for a schedule to execute. A signed-in site also
requires a valid browser session. Scrapeyy performs at most one catch-up run
after restart and records permission, authentication, and selector failures in
the inbox.

Exports are written beneath:

```text
Downloads/Scrapeyy/<project>/<recipe>/<UTC run timestamp>/<site-shorthand>.zip
```

For example, a capture from `app.inkyphishfence.com` exports as
`inkyphishfence.zip`.

Design exports are sanitized reference bundles. They contain captured HTML,
computed CSS, an asset manifest, and a selected-element screenshot when the
browser can capture it. They never contain page scripts.

See [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) for the complete browser checklist.
