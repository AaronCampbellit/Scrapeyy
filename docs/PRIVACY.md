# Scrapeyy privacy and network behavior

Version 0.1.23 — 2026-10-30

Scrapeyy captures content you select from websites: text, tables, links, images, media metadata, page markup/styles and screenshots. Captures are stored in the browser's local Inbox; recipes, schedules and settings are also stored locally. No analytics, advertising identifier, developer telemetry or upload service is implemented. Private-window use is disabled.

## Your controls

Start a capture yourself or explicitly enable a recipe schedule. A schedule runs while the browser is open and may open a configured site in a background tab using your browser session. You can disable schedules and revoke website permissions. One-time capture uses activeTab; reusable operations request access to the relevant website. Cookie and embedded-frame discovery access are optional.

You can export files to your device or copy content to the clipboard. The system clipboard and exported files are outside Scrapeyy's Inbox; other applications or device backup/sync settings may access them. Scrapeyy does not upload these files. Remove saved captures from the Inbox and separately delete exported files when no longer needed. Retention removes older unpinned runs; do not rely on it to remove exported copies or pinned captures.

## Requests made to websites

Capturing design references may retrieve images/assets from their source websites. HTTPS requests can include the site's existing cookies. HTTP references are tried over HTTPS without cookies; failure retains the reference and may preserve an already-loaded image as PNG. No plaintext fallback or redirect is followed by these requests.

Video tools can contact Wistia over HTTPS to resolve a player already present on the page. Provider metadata and captions use no cookies or referrer. Direct media files use HTTPS and can use the site's cookies; inaccessible files keep their links. SharePoint tools query your current SharePoint site's HTTPS API using your existing session. Remote services receive ordinary request information such as your IP address and requested URL. Responses are treated as content, not executable code.

Capturing an HTTP page does not make that website secure: navigation, pagination and the website's own resource requests are handled normally by the browser. See [the request audit](HTTP_REQUEST_AUDIT.md) for details and limits.

## Borrow session — optional account-secret export

This separate popup tab exports selected origins' cookies (including HttpOnly cookies), localStorage and sessionStorage from the source cookie store. These files can grant access to your accounts. Export requires your explicit approval and optional cookie/site permissions. Partitioned/first-party-isolated cookies are excluded. Encryption with a PIN/passphrase is the default; plaintext requires selecting that option. Prefer a strong passphrase and protect exported files.

Session exports and passphrases are not saved to the Inbox or configuration backups. Only a local file is created; Scrapeyy does not send it to another VM, application or server. Moving/importing the file elsewhere is your separate action. Deleting the export does not revoke the original website session; use the website's account/session controls if needed.

## Data declaration

The manifest declares no developer data collection/transmission. Local capture and deliberate local backup exports are not an analytics/upload service. Website requests above are part of the requested capture function. Any future remote upload, synchronization or telemetry requires reevaluating the declaration and implementing appropriate consent before enabling it.

Questions or reports: https://github.com/AaronCampbellit/Scrapeyy/issues — do not attach account secrets, session exports or sensitive captures.
