# Scrapeyy usage guide

[Back to the project overview](../README.md).

Scrapeyy is a local-first Chrome and Firefox extension for capturing structured
website data and sanitized design references. Captures stay in the browser
until the user exports them.

## What it does

- Precise click-or-drag Quick Capture, with an explicit full-page option.
- Smart Quick Capture for dashboard metrics, nested native/ARIA tables,
  repeated lists/cards, open shadow roots, and ordinary regions.
- Independent **Content** and **Design & Code** switches. Enable either or both;
  both start enabled, and the last choice is remembered for new captures.
- Image downloads in either capture mode.
- One-click visible-page and scrolling full-page PNGs, plus draw-selection screenshots.
- Separate video discovery with direct-file downloads and metadata/caption export.
- Popup management for captures, projects, recipes, inbox runs, exports,
  permissions, and settings.
- Bounded Next-button and infinite-scroll traversal.
- Reusable projects and recipes with manual or scheduled runs.
- Local capture inbox with partial/error recovery.
- Inbox **Pop out ↗** opens the selected capture in a separate resizable preview
  window. Switch between text and screenshots, scroll long PNGs, use Fit width,
  100%, or 25–400% zoom, and save/export without keeping the toolbar popup open.
- Deterministic JSON, CSV, and design-reference ZIP exports.
- Optional per-origin permission for scheduled captures.

Scrapeyy does not export browser cookies or browser storage, and design exports
remove executable page scripts. Asset requests can use the existing browser
session. Captured text and images can still contain sensitive information; review
exports before sharing them. It does not bypass authentication, CAPTCHAs, or
anti-bot controls, and it is not a full-site cloning tool.

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
3. Enable **Content**, **Design & Code**, or both.
4. Press **Capture**.
5. Reopen the popup and use **Inbox** to preview or export the run.

Quick Content capture automatically recognizes dashboard label/value metrics,
tables nested anywhere in the selection, ARIA grids, and repeated cards/lists.
It also includes a normalized visible-text record, links, images, a sanitized
source URL, and an element description so unfamiliar page structures still
retain their readable data. Hidden elements and Scrapeyy's own interface are
excluded. Cross-origin frames and information drawn only as pixels on a canvas
remain subject to browser security and accessibility limits.

Content captures save discovered image files in the ZIP's `assets/` folder,
with source URLs and download results in `assets.json`. Design & Code includes
the same image support plus sanitized HTML, computed CSS (including font,
color, spacing, and layout values), and a screenshot. Existing saved recipes
retain their capture settings; the internal mode IDs remain compatible.

The main popup's **Screenshot** section has its own **Save screenshots to** setting:

- **Save As dialog** chooses a filename and any device location for each PNG.
- **Automatically save to device** uses the screenshot subfolder configured in
  Settings, inside the browser's download directory. Change the base directory
  in Zen / Firefox Settings → Downloads; extensions cannot silently write to an
  arbitrary absolute path.
- **Scrapeyy Inbox** stores the PNG locally with a preview. Use **Save PNG…** to
  export it later, or pin it to preserve it beyond normal inbox retention.

These choices persist and do not change the destination of other exports.
All three capture tools use the selected screenshot destination:

- **Visible page** captures the current viewport.
- **Full page** scrolls and stitches the page, then restores the original position.
  Substantial nested scrolling panels are temporarily expanded, sticky sections
  stay at their natural document positions, and original styles and panel scroll
  positions are restored afterward. The capture follows newly loaded content
  within size/tile limits and reports stalled scrolling instead of saving an
  incomplete image. Small scrolling widgets and virtualized feeds may still
  require a region capture.
  Keep the tab selected until it finishes. Extremely large pages exceed canvas
  limits; endless feeds and late-loading content may need smaller captures.
- **Draw selection** lets you drag an exact rectangle in the visible page.
  Its controls use the browser's top layer so site menus, dialogs, popovers, and
  transformed page elements do not cover the selection menu. A later site dialog
  or popover re-promotes the selection overlay while it remains open.
  Release to preview the crop, then click **Capture** to save. Drag again to
  redraw, or press Escape to cancel.

Screenshot success is shown only after the browser confirms the file finished
saving (with the actual saved path), or the PNG is stored in the inbox.
Cancelled or interrupted saves report an
error. After replacing the build files, open
`about:debugging#/runtime/this-firefox` in Firefox or Zen and click **Reload**
for Scrapeyy. The popup header shows the loaded version. Older page scripts are
refreshed automatically; an unrecognized background command reports a reload
instruction instead of claiming it saved a file.

**Video tools → Scan videos** checks loaded page content, nested open shadow
roots, accessible frames, Reddit player attributes and packaged media metadata,
and recognized video links. Duplicate references to a Reddit video are combined.
Scroll an unloaded video into view or start playback, then scan again if needed.
Closed players and cross-origin frames can expose fewer details; detected player
links are shown even when no direct file is available. **Download video** is offered for direct file
sources; websites can still reject a download. Streaming playlists, blob-backed
players, and cross-origin embeds are identified but not downloaded. **Export
video details** saves JSON with source links, available metadata, caption-track
URLs, and already-loaded caption cues. Content exports also include these details
in `media.json` when videos are found. No playback or caption settings are changed.

Design & Code describes browser-visible HTML and styles, not private server code
or the site's original application source.

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

For example, a capture from `app.example.com` exports as
`example.zip`.

Design exports are sanitized reference bundles. They contain captured HTML,
computed CSS, an asset manifest, and a selected-element screenshot when the
browser can capture it. They are designed to exclude executable page scripts.

See [ACCEPTANCE.md](ACCEPTANCE.md) for the complete browser checklist.
