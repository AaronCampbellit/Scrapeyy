# 0.1.26: Borrow session site discovery

Borrow session now offers **Scan sites** and **Record sign-in**. Scans combine links, form destinations, frames, loaded resource origins, related open tabs and cookie-domain evidence. Related sites populate the editable origins field; external candidates show their evidence for review. Sign-in recording follows the source tab and child sign-in windows across navigation and redirects.

The background owns discovery. Closing/reopening the popup or suspending the Chrome worker preserves origin-only results and valid edits in browser-session memory. Results expire after one hour; recording stops after 10 minutes. PINs, account secrets and export approval are not persisted. Exact-origin export approval, encryption, cookie-store isolation and unsupported-cookie exclusions remain in place. The export list now supports up to 100 origins.

No Autodesk or other vendor-specific domain list is embedded. Registrable-domain grouping includes public and private suffixes. See [usage, permissions and limits](SESSION_BORROWING.md#discover-related-sites-0126).

## Validation

- TypeScript checks and the full 266-test suite passed; subsequent discovery changes passed focused regression checks.
- Chrome MV3 and Firefox MV2 builds generated from the same source and lockfile, version 0.1.26.
- Regression coverage includes domain/tenant boundaries, page extraction, cookie-store isolation, origin-only metadata, worker recreation, popup remount, PIN/approval clearing, user edits, excluded candidates, redirects/child tabs, permission cancellation, stop completion, timeout and expiry.
- Isolated Chromium acceptance could not start: the installed Playwright Chromium executable returned `spawn UNKNOWN` on four launch attempts. No live-browser acceptance is claimed.
- A standalone form preview rendered in the in-app browser; Scan populated synthetic origins and the form remained usable within the popup layout. This was UI verification with sample data, not real extension/API acceptance. The preview server was stopped.
- In-app extension management was blocked by the browser tool URL policy. Existing installed browser copies were not reloaded or validated. Manually reload the existing unpacked installation or update its ZIP copy through supported browser controls, preserve the extension identity and verify version 0.1.26 before testing.

## Manual acceptance still required

1. On a signed-in site, open Borrow session and scan; approve native browser permissions. Confirm related cookie, frame and link sites populate the field and unrelated links remain review candidates.
2. Start Record sign-in, wait for recording, close the popup, follow a sign-in flow (including a child login window), reopen and stop. Confirm the field survives and includes observed redirects.
3. Remove a selected origin; confirm future observations do not re-add it. Confirm unrelated tabs and another Firefox container are not included.
4. Reopen the popup, verify the field restores and PIN/approval are blank. Review, approve and export. Validate the borrowed session separately; discovery does not prove transferability.
