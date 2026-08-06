# Scrapeyy Product Design

Date: 2026-08-06
Status: Approved

## Purpose

Scrapeyy is a local-first Chrome and Firefox extension for capturing structured information and reusable design references from websites. It supports one-off visual captures and saved recipes that can be rerun manually or on a schedule.

The first release exports captured material for use in other tools. It does not include a report builder, cloud service, desktop companion, unattended multi-page crawler, or anti-bot bypass.

## Product Boundaries

### Included

- Equal support for current Chrome and Firefox desktop releases.
- One-time access to the active page.
- Optional persistent access for approved domains.
- Data, Design, and Both capture modes.
- Single-element and repeated list/card extraction.
- Next-button pagination and infinite scrolling.
- Manual and scheduled recipe execution.
- Local capture inbox and optional automatic downloads.
- JSON, CSV, and sanitized design-reference exports.
- Import and export of portable Scrapeyy project and recipe configurations.
- A storage abstraction that can gain a cloud implementation later.

### Excluded

- Cloud accounts, synchronization, or hosted storage.
- A native desktop application or native messaging host.
- Full website cloning or executable script capture.
- Cross-domain crawling without explicit permission.
- CAPTCHA bypass, anti-bot evasion, or high-volume crawling.
- Report authoring, templates, charts, or document generation.

## Technical Foundation

Use WXT, TypeScript, and React. One source tree produces Chrome and Firefox packages. Browser-specific behavior is isolated behind adapters so extraction, recipe evaluation, storage, scheduling, and export logic remain browser-neutral.

The user-facing behavior is equal across browsers even when packaging or background execution differs internally.

## Product Surfaces

### Toolbar Popup

The popup exposes three primary actions:

1. Quick Capture
2. Run Saved Recipe
3. Open Dashboard

It also shows the current site's access state and provides a clear action for granting or revoking persistent domain access.

### Page Overlay

The overlay provides visual element selection without modifying the source page permanently. It:

- Highlights the hovered and selected element.
- Identifies likely repeated containers.
- Generates multiple selector candidates.
- Shows candidate match counts.
- Lets the user move to a parent or child candidate.
- Names output fields.
- Previews several normalized records.
- Supports Data, Design, and Both modes.
- Can capture immediately or save the setup as a recipe.

### Recipe Builder

The recipe builder configures:

- Project and recipe identity.
- Allowed origin and starting URL.
- Repeated item/container selector.
- Named fields and extraction types.
- Pagination or infinite-scroll behavior.
- Item, page, delay, and timeout limits.
- Manual and scheduled execution.
- Inbox-only, automatic download, or both destinations.
- Retention and pinning behavior.

### Dashboard

The dashboard includes:

- Projects and saved recipes.
- Manual run controls.
- Schedule controls and next-run status.
- Capture inbox and run history.
- Success, warning, partial, missed, and failed states.
- Preview and comparison between runs.
- Pin, delete, retry, and export controls.
- Domain permissions and retention preferences.
- Configuration import and export.

## Core Modules

### Extraction Engine

The extraction engine reads the live DOM and returns normalized capture records. Supported field types are:

- Visible text
- Link URL
- Image URL
- Named safe attribute
- Sanitized HTML
- Design snapshot

The engine records the source URL, page title, capture time, selector, field names, and recipe version.

### Selector Engine

The selector engine proposes stable candidates in this order:

1. Unique author-provided IDs that do not look generated.
2. Stable semantic attributes such as `data-*`, accessible names, and roles.
3. Stable class combinations.
4. Structural selectors as a fallback.

Each candidate is validated against the current document and ranked by uniqueness, stability, and readability. A recipe stores the selected candidate and enough field metadata to explain a future mismatch.

### Recipe Engine

A recipe contains:

- Version and unique identifier.
- Project identifier.
- Name and optional description.
- Origin and starting URL.
- Container selector.
- Field definitions.
- Traversal settings.
- Safety limits.
- Destination settings.
- Schedule.
- Creation and update timestamps.

Recipe execution is deterministic for the same DOM state. Partial records are retained when later pages fail.

### Traversal Engine

Next-button mode clicks a configured control, waits for a meaningful DOM change, then extracts new records.

Infinite-scroll mode advances in bounded steps, waits for DOM settlement, and extracts new records after each step.

Both modes stop when:

- The configured item or page limit is reached.
- No new unique records appear.
- The Next control disappears or becomes disabled.
- A timeout occurs.
- A required selector no longer matches.
- The user cancels a manual run.

Duplicate detection uses a stable record fingerprint derived from configured identity fields when available, otherwise from the normalized record.

### Design Snapshot Engine

A Design capture produces a reference bundle, not an executable clone. It contains:

- Sanitized selected HTML.
- Relevant computed CSS for the selected subtree.
- Element dimensions and viewport metadata.
- Element screenshot.
- Source URL and capture timestamp.
- An asset manifest.
- Images and fonts that can be fetched safely with granted access.
- Source links for protected or unavailable assets.

The sanitizer removes scripts, inline event handlers, embedded frames, password values, hidden authentication fields, tokens, nonces, and dangerous URL schemes.

### Local Repository

The local repository has two implementations:

- Extension settings storage for projects, recipes, schedules, preferences, and schema version.
- IndexedDB for capture records, screenshots, asset blobs, previews, and queued exports.

All storage access goes through typed repository interfaces. A future cloud repository may implement the same contracts without changing extraction or export logic.

Default retention is the latest 20 runs per recipe. Pinned runs remain until explicitly deleted. Retention cleanup never deletes a queued or in-progress export.

### Scheduling Engine

Manual runs start from the popup, dashboard, or page overlay.

Scheduled recipes require:

- Persistent permission for the recipe origin.
- The browser to be running.
- A valid authenticated session if the site requires login.

A scheduled run reuses a matching open tab or opens an inactive tab. It closes only tabs that Scrapeyy created after the run finishes.

If the browser misses one or more occurrences, Scrapeyy performs at most one catch-up run after restart. It does not create a catch-up storm. Authentication pages, permission failures, and changed selectors create visible error records.

### Export Engine

Exports are generated entirely in the extension from local data. Automatic and user-triggered exports share the same deterministic serializer.

The default path is relative to the browser's Downloads directory:

`Scrapeyy/<project>/<recipe>/<run timestamp>/`

A run export is a ZIP bundle containing:

- `manifest.json`
- `data.json`
- `data.csv` when the capture has tabular fields
- `snapshot.html` and `styles.css` for Design or Both mode
- `screenshot.png` when available
- `assets/` for safely retrievable assets
- `assets.json` for downloaded and unresolved asset references

Recipe and project configuration exports use versioned JSON with a `.scrapeyy.json` suffix.

Downloads respect browser save-location preferences. If automatic download is blocked by a prompt or browser policy, the completed export remains queued in the inbox.

## Data Flow

1. The user grants one-time or persistent access.
2. The overlay or recipe selects a container and fields.
3. The extraction engine produces normalized records.
4. The traversal engine optionally advances and merges unique records.
5. The design engine optionally creates sanitized reference artifacts.
6. The local repository stores a run and its artifacts.
7. The export engine creates a bundle when requested.
8. The downloads adapter writes the bundle beneath the configured Downloads directory.

No capture data leaves the browser except through a user-configured download.

## Permissions and Privacy

Required capabilities are limited to:

- Active-tab access for one-time runs.
- Script injection into a user-approved page.
- Extension storage.
- Local downloads.
- Scheduling alarms.

Host access is optional and requested at runtime. Persistent access is required only for saved-domain and scheduled behavior. Scrapeyy does not request cookie access, inspect browser history, or store credentials.

Permission revocation disables affected schedules immediately and preserves their definitions in a needs-permission state.

## Failure Handling

Every run has one terminal status:

- Success
- Warning
- Partial
- Missed
- Failed
- Cancelled

Errors are structured with a stable code, user-facing explanation, recoverability flag, and optional selector/page context. Raw page contents and secrets are not placed in logs.

Partial results remain previewable and exportable. Retrying creates a new run and never overwrites the previous run.

## Safety Defaults

- Conservative delay between traversal actions.
- Explicit item and page caps.
- Same-origin traversal unless the user grants another origin.
- No CAPTCHA handling or anti-bot evasion.
- No password, cookie, local-storage, token, nonce, or executable-script capture.
- No destructive interaction with the source site.
- A visible reminder that site terms and content rights remain the user's responsibility.

## Verification Strategy

### Automated Unit Coverage

- Selector ranking and stability.
- Field extraction and normalization.
- Record fingerprints and duplicate handling.
- HTML and CSS sanitization.
- Pagination and infinite-scroll stop rules.
- Schedule calculation and catch-up behavior.
- Retention and pinning.
- Export serialization and configuration migrations.
- Permission-state transitions.

### Fixture Integration Coverage

Local fixture pages simulate:

- Static repeated cards.
- Next-button pagination.
- Infinite scrolling.
- Duplicate records.
- Disabled and disappearing Next controls.
- DOM mutations.
- Selector changes.
- Authentication redirects.
- Partial asset failures.

### Browser Acceptance

Run the same acceptance checklist in current Chrome and Firefox:

1. Quick Data capture.
2. Quick Design capture.
3. Both-mode capture.
4. Saved list recipe.
5. Next-button traversal.
6. Infinite-scroll traversal.
7. One-time permission.
8. Persistent permission and revocation.
9. Manual run.
10. Scheduled run and single catch-up behavior.
11. Inbox preview and retention.
12. Automatic and manual export.
13. Recipe/project export and import.
14. Recovery from selector and login failures.

Source checks, automated tests, package builds, and browser acceptance are reported as separate proof boundaries.

## Success Criteria

Scrapeyy v1 is complete when:

- Chrome and Firefox packages build from one source tree.
- All automated checks pass.
- The shared acceptance checklist passes in both browsers.
- Captures remain local unless exported.
- Data, Design, and Both bundles contain the documented artifacts.
- Saved recipes reliably handle bounded Next-button and infinite-scroll lists.
- Manual and scheduled runs produce recoverable inbox records.
- Permission revocation and session failures are safe and understandable.
- No cloud or native companion is required.
