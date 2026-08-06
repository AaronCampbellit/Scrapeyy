# Scrapeyy

Scrapeyy is a local-first Chrome and Firefox extension for capturing structured
website data and sanitized design references. Captures stay in the browser
until the user exports them.

## What it does

- Visual selection of one element or a repeated list/card pattern.
- Data, Design, and Both capture modes.
- Text, link, image, safe attribute, and sanitized HTML fields.
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

Use the toolbar popup for Quick Capture, running a saved recipe, or opening the
dashboard. One-time capture uses the active-tab grant. Enable “Allow scheduled
captures” only for origins that should retain permission.

## Scheduling and exports

The browser must be running for a schedule to execute. A signed-in site also
requires a valid browser session. Scrapeyy performs at most one catch-up run
after restart and records permission, authentication, and selector failures in
the inbox.

Exports are written beneath:

```text
Downloads/Scrapeyy/<project>/<recipe>/<UTC run timestamp>/scrapeyy-run.zip
```

Design exports are sanitized reference bundles. They contain captured HTML,
computed CSS, an asset manifest, and a selected-element screenshot when the
browser can capture it. They never contain page scripts.

See [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) for the complete browser checklist.
