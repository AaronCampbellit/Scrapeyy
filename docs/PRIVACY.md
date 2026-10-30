# Scrapeyy privacy and network behavior

Version 0.1.25 — 2026-10-30

Scrapeyy captures content you select from websites: text, tables, links, images, media metadata, page markup/styles and screenshots. Captures are stored in the browser's local Inbox; recipes, schedules and settings are also stored locally. No analytics, advertising identifier, developer telemetry or upload service is implemented. Private-window capture is available only when enabled in the browser. Captured private-page content is saved to the persistent local Inbox; it is not automatically erased when a private window closes. Background recipes do not reuse private tabs.

## Your controls

Start a capture yourself or explicitly enable a recipe schedule. A schedule runs while the browser is open and may open a configured site in a background tab using your browser session. You can disable schedules and revoke website permissions. One-time capture uses activeTab; reusable operations request access to the relevant website. Cookie and embedded-frame discovery access are optional.

You can export files to your device or copy content to the clipboard. The system clipboard and exported files are outside Scrapeyy's Inbox; other applications or device backup/sync settings may access them. Scrapeyy does not upload these files. Remove saved captures from the Inbox and separately delete exported files when no longer needed. Retention removes older unpinned runs; do not rely on it to remove exported copies or pinned captures.

## Requests made to websites

Capturing design references retrieves original HTTP or HTTPS asset URLs using the site's session and normal redirects. Page-world retrieval can use the site's fetch implementation. HTTP requests and redirects may be unencrypted; browser cookie, mixed-content and certificate rules still apply. The original 25 MiB per-asset limit remains; the added 100-reference/50 MiB total/time limits are removed.

Captions retain their original HTTP(S) URL and anonymous request policy; loaded cues remain a labelled fallback. Wistia metadata still uses its existing HTTPS endpoint. Direct video files are handed to the browser download manager with normal session/redirect handling, without the extension's 512 MiB/two-minute buffering limit. SharePoint API requests use the existing same-origin session and follow redirects. Services receive ordinary request information such as IP address and requested URL. No developer upload service is added.

See [restoration notes](FUNCTIONALITY_RESTORATION.md) for limits and distribution status.

## Borrow session — optional account-secret export

This separate popup tab exports selected origins' cookies (including HttpOnly cookies), localStorage and sessionStorage from the source cookie store. These files can grant access to your accounts. Export requires your explicit approval and optional cookie/site permissions. Partitioned/first-party-isolated cookies are excluded. Encryption with a PIN/passphrase is the default; plaintext requires selecting that option. Prefer a strong passphrase and protect exported files.

Session exports and passphrases are not saved to the Inbox or configuration backups. Only a local file is created; Scrapeyy does not send it to another VM, application or server. Moving/importing the file elsewhere is your separate action. Deleting the export does not revoke the original website session; use the website's account/session controls if needed.

## Data declaration

The manifest declares no developer data collection/transmission. Local capture and deliberate local backup exports are not an analytics/upload service. Website requests above are part of the requested capture function. Any future remote upload, synchronization or telemetry requires reevaluating the declaration and implementing appropriate consent before enabling it.

Questions or reports: https://github.com/AaronCampbellit/Scrapeyy/issues — do not attach account secrets, session exports or sensitive captures.
