# HTTP request audit — 0.1.23

Audited 2026-10-30 against source 89fe4ff (0.1.22), before implementing the changes below. Scope: src/, entrypoints/, browser download and tab-navigation calls. The audit distinguishes reading rendered content, browser navigation and extension-initiated file/API requests. It does not claim Mozilla approval.

| Path | Before | 0.1.23 behavior |
| --- | --- | --- |
| Extraction, DOM/style snapshots, screenshots | Read the loaded page or browser-generated data URLs | Unchanged for HTTP and HTTPS pages. No remote upload. |
| `page-asset-download.ts` / `asset-download.ts` | HTTP(S), cookies included, automatic redirects | Shared self-contained `asset-transfer.ts` in the isolated script world (not website-overridden fetch): HTTPS only, no referrer, redirects rejected; HTTPS assets retain cookie access. HTTP references are tried over HTTPS without cookies/authentication. |
| Already-loaded HTTP images | Always re-fetched | If HTTPS fails, copy a complete origin-clean DOM image to PNG via canvas. No new image src or reload. Tainted images cannot be recovered; references and page screenshots remain. Raster copy is explicitly labelled and does not preserve animation/vector metadata. |
| Wistia metadata | HTTPS, no credentials/referrer, no redirects | Unchanged. Only current page media IDs are resolved; returned JavaScript is never executed. |
| Caption files | HTTP(S), anonymous, redirects rejected | Try HTTPS only. On failure, export existing browser cues as a labelled partial file rather than losing loaded text. |
| Direct video files | Browser-managed remote download; redirect/credential handling not controlled | Retrieve revalidated current-page source over HTTPS with redirect rejection, then save a local Blob. Upgraded HTTP sources omit credentials. Limit 512 MiB / two minutes; files requiring redirects, cross-origin access unavailable to the extension, or larger transfers require the site's download controls. Media metadata/link exports remain. |
| SharePoint metadata | HTTPS same-origin authenticated API; redirects followed | Same-origin HTTPS requests retained, redirects rejected, no referrer. |
| JSON/CSV/ZIP, screenshots, session export | Local Blob/data URLs to browser downloads | Unchanged; no remote upload. Session secrets remain transient and explicitly approved. |
| Recipe tabs / pagination / schedules | Navigate to user-configured HTTP(S) pages using normal browser sessions | Unchanged; HTTP recipes still work. Browser page navigation and website resources follow browser/site policy; this is not a claim that browsing an HTTP website is encrypted. Private tabs are excluded from reuse. |

## Preservation and limits

HTTP host permissions are retained intentionally; removing them would break reading and scheduled navigation on intranet sites. Existing filters, content, selectors, URLs and records are not discarded because a page uses HTTP. Asset failures are warnings, not capture failures. Original references remain associated with outputs. Do not automatically invent different HTTPS ports or bypass certificate/mixed-content/CORS errors.

Reference downloads are bounded to 25 MiB per file, 50 MiB total, 100 references and 60 seconds overall (15 seconds per request). These bounds prevent unbounded buffering. No extension-controlled asset, caption, SharePoint or video fetch follows a redirect to HTTP. Redirect-dependent HTTPS assets can also be omitted; keep their reference and explain the failure rather than silently weakening transport.

Tests cover HTTP upgrades with no credentials, cookie-bearing HTTPS requests, redirect refusal, loaded-image fallback, tainted images, userinfo rejection, response size limits, partial caption preservation, HTTP recipe tab selection and serialization of the injected function. Actual installed Firefox/Zen network capture remains a manual release check.
