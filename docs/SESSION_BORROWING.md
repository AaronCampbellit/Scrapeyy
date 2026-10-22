# Borrow a session for another VM or project

Open the signed-in website, open Scrapeyy, and select **Borrow session**. Review the exact origins, add related login origins if needed, and check the approval box. Open related origins in tabs in the same profile/container to capture their localStorage and sessionStorage. The source tab takes precedence; otherwise the first matching tab is used, with a warning when multiple tabs exist. No new website tabs are opened automatically.

Encryption is on by default. Set a PIN or passphrase, confirm it, then export. A short PIN is vulnerable to offline guessing; prefer a longer passphrase. Scrapeyy neither stores the secret nor ties it to a particular VM. The same export and secret can be used in multiple authorized projects. Explicitly choose **Plaintext** for a readable JSON export. Both forms contain account access material; encryption protects the downloaded file, not an already compromised endpoint.

The export asks for optional `cookies` and exact selected-origin permissions. Existing grants remain until revoked in browser extension settings. No runtime/page-message capture endpoint exists, and no session data is placed in the inbox, configuration backups, logs, or extension storage. The dedicated extension page retains transient state only while open. Downloads remain on disk until you delete them.

For Lenovo, explicitly select the origins you need, for example:

```
https://account.lenovo.com
https://openapi.lenovo.com
https://www.lenovo.com
https://passport.lenovo.com
https://bpsso.lenovo.com
```

This is a generic feature, not a Lenovo preset. Parent-domain cookies can inherently authorize multiple sibling sites, even when only one origin is selected. The exporter captures selected-host cookies across paths plus parent-domain cookies applicable at `/` and each matching open tab URL; parent-domain cookies limited to other paths may be missing. Open the authenticated order/detail page before borrowing its session. Only the source tab's cookie store is queried. Partitioned and first-party-isolated cookies are explicitly excluded and counted in warnings. Storage is top-level only; inaccessible, unopened, or navigated origins are reported as omitted. IndexedDB, service workers, HTTP authentication, hardware keys and device-bound credentials are not exported. Expiration attributes are preserved, not extended. Sites may require a new login on the destination.

## Portable file format v1

Plaintext JSON uses `format: "scrapeyy-session"`, `version: 1`, ISO `createdAt`, `source: {browser, locale, timezone}`, approved `origins`, `cookies`, `storage`, and `warnings`. Each storage entry is `{origin, localStorage: [{name,value}], sessionStorage: [{name,value}]}`. Cookie attributes retain browser API spelling: `name`, `value`, `domain`, `path`, `hostOnly`, `secure`, `httpOnly`, `sameSite`, `session`, optional Unix-seconds `expirationDate`, and `storeId`. SameSite is `no_restriction`, `lax`, `strict`, or `unspecified`. Do not silently upgrade `unspecified` or reinterpret host-only cookies as domain cookies. Importers must reject unsupported partition attributes.

Encrypted JSON uses `format: "scrapeyy-session-encrypted"`, `version: 1`, `kdf: {name: "PBKDF2", hash: "SHA-256", iterations: 600000, salt}`, `cipher: {name: "AES-GCM", iv, tagLength: 128}`, and `ciphertext`. Salt (16 bytes), IV (12 bytes), and ciphertext (including authentication tag) are standard padded base64. Every export generates a new salt and IV. AES uses a 256-bit key. The raw PIN/passphrase is UTF-8 encoded without trimming or normalization (maximum 4096 UTF-8 bytes). Authenticated additional data is exactly UTF-8 `scrapeyy-session-encrypted:1`. Plaintext is UTF-8 JSON. Consumers must bound input size and PBKDF2 work before deriving keys; the included utility allows 100,000–1,000,000 iterations and 20 MiB plaintext.

## Decrypt outside Scrapeyy

With Node 24, run the dependency-free utility from this repository:

```
node scripts/decrypt-session.mjs encrypted.json session.json
```

It prompts privately for the secret, authenticates the file, and exclusively creates the output with owner-only POSIX permissions. It will not overwrite an existing file. On Windows, place it in a directory with appropriate ACLs; POSIX mode is not a Windows access-control guarantee. This utility decrypts only; the destination importer must validate every origin/cookie and enforce its own allowed-site policy before applying the state. For Playwright, preserve host-only cookies with a `domain` containing the exact hostname without a leading dot plus the original `path`; use a leading dot for domain cookies. Do not combine `url` and `path` in one Playwright cookie. Omit `sameSite` when the source value is `unspecified`, map expiration seconds only for persistent cookies, and load sessionStorage before the target navigation (Playwright storageState does not include sessionStorage). Do not send secrets to unrelated domains or log their contents. Delete plaintext after use. First perform a read-only login/account check on the destination; a parseable bundle does not prove the session is valid.

Browser API references: [Chrome cookies](https://developer.chrome.com/docs/extensions/reference/api/cookies), [Firefox cookies.getAll](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/cookies/getAll).

## Manual browser acceptance

The automated suite covers encryption/decryption, tamper rejection, scoped cookie-store selection, partition exclusion, and navigation races. A real installed Chromium extension smoke test also verifies synthetic HttpOnly cookies, localStorage/sessionStorage, actual encrypted/plaintext downloads, and decryption. It pregrants permissions in a temporary test-only manifest; it does not exercise the native optional-permission dialog. Run `node tests/browser/session-smoke.mjs` after a Chrome build with Playwright available (or set `SCRAPEYY_PLAYWRIGHT_MODULE` to its absolute `index.mjs` path). Before relying on a real session, load the packaged build in each target browser and check:

1. In a synthetic signed-in site, include an HttpOnly cookie, host-only cookie, parent-domain cookie on the current non-root path, localStorage, and sessionStorage. Open a second origin and a second container/profile with different synthetic values.
2. Select only the intended origins. Cancel the optional permission prompt and confirm no download. Retry, grant it, and export with a PIN. Close the source tab or navigate it to an unselected origin and confirm capture fails.
3. Decrypt locally and verify only the selected store and origins were captured; preserve cookie attributes and verify partition exclusions/omitted-storage warnings. Repeat with plaintext explicitly selected. Check that ordinary inbox/configuration exports contain none of the synthetic session values.
4. Import into a disposable destination browser context and verify the expected account through a read-only page. Confirm that expiry and device binding are not bypassed. Repeat the extension permission and Save As flow on Windows Chrome and Firefox.

Real Windows/browser permission dialogs and authenticated cross-device sessions have not been validated by the automated tests.
