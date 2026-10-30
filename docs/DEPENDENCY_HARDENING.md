# 0.1.24 dependency restrictions and regression inventory

All seven warnings from 0.1.23 are removed by deleting unsupported execution paths, not by obscuring assignments or suppressing validator rules. Original package versions and license notices are retained. This is a local fork of the affected dependency code, not an upstream fix or Mozilla approval.

| Original warning | Change | Behavior lost / regression risk |
| --- | --- | --- |
| Four React DOM raw innerHTML assignments, duplicated across bundles | Both production/development DOM property paths reject non-null dangerouslySetInnerHTML; development raw HTML hydration also rejects | Future components relying on raw HTML props fail with a clear error. Current app source has no such props and uses client rendering, not hydration. Ordinary React children, events and SVG remain supported. |
| DOMPurify parser fallback | Remove the innerHTML fallback and throw when DOMParser cannot create the normal document | Parser-unavailable environments and future non-HTML namespace configuration fail closed instead of capturing. Nested SVG inside normal HTML remains supported and tested. This does not remove sanitization rules. |
| Snapshot template assignment | Consume sanitized DocumentFragment directly instead of serializing and reparsing HTML | Removes one parser round trip; unusual malformed markup may normalize differently. Tables and nested SVG are covered; arbitrary websites are not exhaustively tested. |
| JSZip scheduler Function constructor | Reject non-function callbacks in setimmediate and its copy inside JSZip's readable browser distribution | String callbacks no longer work. Existing JSZip callers use functions; callback arguments, cancellation, Unicode/binary ZIP round trips remain covered. |

## Maintenance and reproduction

`npm ci` applies the patches in postinstall. The dev/test/build/zip npm scripts verify them again. `scripts/dependency-hardening.json` records exact replacements and original/patched SHA-256 hashes; the script validates every input before writing any file and accepts already-patched files. Unexpected package bytes stop the build. A dependency upgrade requires deliberate patch review and new hashes; do not simply disable the check. Modified JavaScript files carry a local-change notice. Unused upstream distribution files remain in node_modules, but only the reviewed entries are bundled.

When invoking WXT's API directly, run `node scripts/harden-dependencies.mjs` first. Installation with `--ignore-scripts` does not prepare a release. Production build scripts still apply/verify the patches. Neither eval permissions nor page security policies are relaxed.

## Observed regressions and verification

No regressions were observed in 273 automated tests across 45 files, including the existing capture, preview, session, storage, routing and HTTP tests. Type checking and Chrome/Firefox production builds pass. Firefox web-ext lint reports zero errors, warnings or notices.

A real in-app Chromium browser smoke test at `http://127.0.0.1:4175/` used the production React bundle, patched DOMPurify and browser JSZip. Clicking “Test capture and ZIP export” captured table/SVG content and computed CSS, compressed/extracted the HTML and updated the React UI. The page rendered, the interaction passed, and no console errors/warnings were reported. This was a focused library test, not a loaded extension test. The temporary server was stopped afterwards.

Installed Zen/Firefox extension behavior, browser permission prompts, arbitrary sites and mobile viewports remain unverified here. On upgrade, reload 0.1.24 and refresh target tabs; check picker, both previews, reference ZIP, screenshots, HTTP capture and Borrow session. No data schema, extension ID, permissions or storage clearing changes are introduced by this release. Prior 0.1.23 HTTP download restrictions remain unchanged.
