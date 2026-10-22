# Screenshot evidence

These are real screenshots of Scrapeyy 0.1.7, captured on 2026-10-06 with the
unpacked Chrome MV3 production build in headless Chromium. They contain only
synthetic projects, names, and metrics from [demo.html](demo.html).

| Image | Verified state |
|---|---|
| [quick-capture.png](quick-capture.png) | Project delivery section selected; Content and Design & Code enabled; packaged picker CSS loaded |
| [capture-studio.png](capture-studio.png) | Actual popup with local origin access, screenshot tools, and recipe entry point |
| [capture-inbox.png](capture-inbox.png) | Successful saved run: five table rows plus one page-text record |
| [capture-preview.png](capture-preview.png) | Separate preview window reading the same saved capture |

To serve the demo after `npm ci`, run:

```bash
npm exec -- vite docs/screenshots --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173/demo.html` and follow the main README's capture steps.
The final gallery uses that served demo page at `http://127.0.0.1:4173/demo.html`.
An initial pass loaded the same DOM into a fixture tab on port 44473. The popup
ran as an extension tab while the demo remained active. A clicked disposable harness button called
`chrome.permissions.request` for `http://127.0.0.1/*`; the grant succeeded.
The harness button was removed by reloading before screenshots. Neither the
built manifest nor the product UI was modified for these final captures.

The source build includes an explicit web-accessible mapping for
`content-scripts/content.css` on HTTP/HTTPS pages. This lets WXT's on-demand
shadow-root UI fetch its stylesheet; it does not grant access to website data.
Chrome has optional host permissions and Firefox has the equivalent optional
permissions. Both production builds and type checking passed after this change,
along with all four content-injection unit tests.

The real UI exported a completed ZIP with `data.json`, `data.csv`,
`snapshot.html`, `styles.css`, `assets.json`, and `manifest.json`. The records
matched the five sample projects plus the readable selection text. A design
PNG was unavailable in this standalone-popup automation, which lacked the
toolbar's active-tab capture grant. These images demonstrate selection, stored
data, preview, and export; they do not establish installed Firefox acceptance,
scheduled-run behavior, or a security audit result.
