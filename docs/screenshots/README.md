# Screenshot evidence

The popup, inbox and preview images show compiled Scrapeyy **0.1.21** pages, rendered on 2026-10-22 in headless Chromium using the synthetic API and IndexedDB fixtures from `tests/browser/preview-smoke.mjs`. They demonstrate the current scraper icon and actual compiled UI. Browser APIs are bridged by the harness; these captures do not establish acceptance in an installed extension or native permission dialogs.

| Image | Verified state |
|---|---|
| [capture-studio.png](capture-studio.png) | Current popup, scraper icon, six navigation tabs, capture and screenshot tools |
| [capture-inbox.png](capture-inbox.png) | Saved synthetic full-page PNG in the local inbox |
| [capture-preview.png](capture-preview.png) | Standalone preview displaying the same capture and scraper branding |
| [quick-capture.png](quick-capture.png) | Historical 0.1.7 selection capture from 2026-10-06; synthetic project table, Content and Design & Code enabled; no brand icon appears in this image |

The current fixtures use `https://fixture.test/` with synthetic content, a generated three-color screenshot and sample session values. No customer data or real authenticated session appears. The harness verifies real IndexedDB and PNG clipboard output, navigation, preview layout, encrypted/plaintext fixture exports and decryption.

The historical selection image used an unpacked Chrome MV3 build and the local [demo.html](demo.html). To serve that demo after `npm ci`, run:

```bash
npm exec -- vite docs/screenshots --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/demo.html` and follow the main README's capture steps. Its project names, people and metrics are synthetic. The original 0.1.7 capture session verified a completed reference ZIP with `data.json`, `data.csv`, `snapshot.html`, `styles.css`, `assets.json` and `manifest.json`; those historical checks do not establish current installed-browser acceptance.
