# 0.1.25 — personal-use functionality restoration

At the owner's request, this release restores the capture behavior removed for Mozilla compliance in 0.1.23/0.1.24. The previous 0.1.24 package remains the distinct compliance-submission artifact; this release is not claimed to meet Mozilla policies or be signed/approved.

## Restored

- Original HTTP and HTTPS images/fonts, with existing site credentials and browser-normal redirects. Page-world asset retrieval is restored for site/session compatibility.
- No added 100-reference, 50 MiB aggregate, or capture-request time cap. The pre-existing 25 MiB per-asset cap remains.
- Browser-managed video downloads after current-page source validation, restoring redirects and transfers beyond the extension-added 512 MiB/two-minute limit.
- Original HTTP caption URLs; the useful loaded-caption fallback remains. Original caption size/time/anonymous/redirect restrictions predate compliance and remain.
- Normal SharePoint API redirects.
- Original DOM snapshot parsing and unmodified upstream React, DOMPurify and JSZip behavior. Dependency security updates remain installed; no dependency downgrade.
- Private-window eligibility when the browser's own user-controlled extension permission is enabled. Private captures persist in the normal Inbox; background recipes still avoid private tabs.

No permissions, capture storage schema or extension ID changes beyond restoring private-window eligibility. Saved captures, recipes, settings, screenshots, previews and Borrow session are retained. No need to uninstall or clear data.

## Boundaries and tradeoffs

HTTP requests may transmit content/session cookies without encryption, subject to browser cookie rules. Assets may follow redirects and page-world fetch may be affected by website code. More/larger assets can increase memory use and capture duration. Upstream library validator warnings are expected again. Browser CORS, mixed-content, certificate restrictions, protected media and site access limits still apply; this does not bypass them or guarantee every site's assets are downloadable.

## Build and install

Use Node 24.22.2 / npm 11.19.1 on Linux x86-64, then `npm ci`, `npm run typecheck`, `npm test`, `npm run build:firefox`, and `npm run build`. No local dependency patching is required. The lockfile pins dependencies. The source archive omits historical design assets and generated/dependency directories.

Load the Firefox ZIP through about:debugging for a temporary Zen installation, then refresh source-page tabs. A temporary installation is removed on browser restart. Ordinary permanent installation still depends on the browser's signing requirements; this package does not bypass signing. Updating files/packages does not prove that the installed extension was reloaded.
