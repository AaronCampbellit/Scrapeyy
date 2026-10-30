# Reviewer source and testing instructions — 0.1.24

## Reproduce the submitted code

Build environment used: Linux x86-64, Node.js **24.22.2**, npm **11.19.1**. Install Node from https://nodejs.org/ (official distribution), then run from the source ZIP root:

```sh
npm ci
npm run typecheck
npm test
npm run build:firefox
npm run build
```

WXT outputs `.output/firefox-mv2` and `.output/chrome-mv3`. The submitted Firefox ZIP contains the contents of `.output/firefox-mv2` directly at its root. `package-lock.json` pins dependencies retrieved by npm; no private service or API key is needed. Build tools are open source. Do not use `npm update` during reproduction. The release source archive omits `.git`, dependencies, temporary outputs and historical `docs/design/` assets; none is required for building. Compare extracted file contents/hashes, not ZIP timestamps.

## Review notes

- Version 0.1.24 disables private-window operation and requires Firefox 140+ (Android manifest minimum 142; mobile behavior is not validated).
- Permissions: activeTab/scripting for deliberate page capture; storage for local state; downloads for local exports; alarms for opt-in schedules; clipboardWrite for explicit copy actions. Optional cookies/site access is for Borrow session; optional webNavigation discovers embedded frames for requested screenshots.
- `docs/HTTP_REQUEST_AUDIT.md` maps all request paths and HTTP preservation choices. No application code is fetched for execution. No page CSP/security headers are relaxed.
- `docs/PRIVACY.md` describes local data handling, website requests, scheduled browsing and optional session export. No remote backup/telemetry endpoint is implemented.
- `npm ci` applies reviewed, hash-pinned dependency restrictions using `scripts/harden-dependencies.mjs`. Builds/tests verify them again. See `docs/DEPENDENCY_HARDENING.md` and the exact before/after patch manifest. React DOM, DOMPurify and JSZip/setimmediate are locally modified; no warning suppression or dynamic property-name evasion is used.
- Snapshot capture consumes DOMPurify's sanitized DocumentFragment directly. React raw-HTML props and string scheduler callbacks are rejected; DOMPurify throws if its normal parser is unavailable. The Firefox package validates with zero warnings/errors; this does not constitute Mozilla approval.

## Functional checks

1. Run `npm run fixtures`, open the printed local fixture URL and temporarily load the Firefox ZIP using `about:debugging`. For Flatpak, select the ZIP, not a portal-isolated manifest. Temporary loading does not validate ordinary install prompts.
2. On `list.html` or `assets.html`, capture a region with Content and Design & Code enabled. Check Inbox, pop-out preview, JSON/CSV/reference ZIP and screenshots/clipboard. On an HTTP fixture, record fields and screenshot should remain; absent HTTPS assets show warnings. A complete origin-clean loaded image can be saved as PNG, explicitly labelled as rendered pixels.
3. Save a recipe, grant only its origin, run it and enable/disable a schedule. Verify permission denial fails clearly. Test pagination on the supplied fixtures.
4. Test Wistia on an accessible public player, including metadata, TXT/VTT/SRT and media download. Verify source changes invalidate old selections. HTTP tracks with only loaded cues produce labelled partial exports; inaccessible media keeps its metadata/link.
5. Borrow session: use a disposable local fixture with synthetic cookies/storage only. Select its exact origin, approve, grant permission, export encrypted JSON and decrypt with `node scripts/decrypt-session.mjs encrypted.json output.json` in an interactive terminal. Also test deny permission, unapproved export, mismatched passphrases and deliberate plaintext export. No real customer account or credentials are required for this workflow.
6. SharePoint metadata requires a SharePoint test tenant/list. Supply a dedicated test account through Mozilla's private reviewer channel if reviewers need to exercise it; none is included in public source.
7. Confirm the extension cannot run in private windows, existing captures/settings survive upgrade, and ordinary installed permission prompts match the listing. Test in Firefox and Zen separately.

## Release evidence and remaining acceptance

Type checking, automated tests, dependency audit, both browser builds, validator results and reproducibility results accompany the release artifacts. Automated/mocked API checks do not prove native permission dialogs, signed installation, SharePoint tenant access or existing installed-browser behavior. These remain manual checks before claiming full submission acceptance. Signing/submission is a separate action, not performed by preparing this package.
