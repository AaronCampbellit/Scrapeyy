# Scrapeyy Product Design and Implementation Plan

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

---

# Scrapeyy V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify an extension-only, local-first website capture product with equal Chrome and Firefox workflows.

**Architecture:** WXT produces browser-specific packages from a single React and TypeScript source tree. Pure domain modules implement selectors, extraction, traversal, storage, scheduling, and deterministic exports; thin extension entrypoints connect those modules to browser APIs and React surfaces.

**Tech Stack:** Node.js 24, npm, WXT 0.21.3, TypeScript 7.0.2, React 19.2.8, Vitest 4.1.10, Testing Library 16.3.2, DOMPurify 3.4.13, JSZip 3.10.1, and IndexedDB.

## Global Constraints

- Chrome and Firefox must expose the same user-visible core workflow.
- Captures remain local unless the user exports them.
- Site access is one-time by default and persistent only after a runtime permission grant.
- Scheduled recipes require persistent origin permission and a running browser.
- Data, Design, and Both modes must produce the documented artifacts.
- Traversal is limited to bounded Next-button pagination and infinite scrolling.
- No cookies, credentials, password values, hidden tokens, executable scripts, CAPTCHA bypass, or anti-bot evasion.
- Product code is test-driven and every task ends with a focused commit.
- No cloud service, report builder, native companion, or unattended cross-domain crawler is introduced.

## Planned File Structure

- `package.json`: dependency versions and cross-browser build/test scripts.
- `wxt.config.ts`: WXT, React, manifest permissions, and browser-specific manifest settings.
- `tsconfig.json`, `vitest.config.ts`: strict TypeScript and DOM test configuration.
- `entrypoints/background.ts`: scheduling, permission, run orchestration, and download messages.
- `entrypoints/content.tsx`: page overlay bootstrap and DOM-side run bridge.
- `entrypoints/popup/`: compact toolbar UI.
- `entrypoints/dashboard/`: project, recipe, schedule, inbox, and settings UI.
- `src/contracts/`: versioned product types and validation.
- `src/extraction/`: selector ranking, field extraction, normalization, and fingerprints.
- `src/design/`: HTML sanitization, computed-style capture, assets, and screenshots.
- `src/traversal/`: bounded Next and infinite-scroll state machines.
- `src/storage/`: settings, IndexedDB, retention, and future repository interfaces.
- `src/scheduling/`: next-run calculation, catch-up policy, and alarm adapter.
- `src/export/`: CSV, JSON, manifest, ZIP, filenames, and downloads.
- `src/platform/`: browser API, permission, tab, screenshot, and download adapters.
- `src/features/`: overlay, popup, dashboard, and recipe-builder components.
- `tests/fixtures/`: deterministic fixture pages for integration and browser acceptance.
- `tests/unit/`, `tests/integration/`: pure-domain and cross-module coverage.

### Task 1: Scaffold the Cross-Browser Extension and Contracts

**Files:**
- Create: `package.json`
- Create: `wxt.config.ts`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/contracts/models.ts`
- Create: `src/contracts/validation.ts`
- Test: `tests/unit/contracts.test.ts`

**Interfaces:**
- Produces: `CaptureMode`, `FieldDefinition`, `TraversalSettings`, `Recipe`, `CaptureRun`, `Project`, `Schedule`, `RunStatus`, `Repository<T>`, and `validateRecipe(input: unknown): Recipe`.
- Consumes: no product interfaces.

- [ ] **Step 1: Write the contract test**

```ts
import { describe, expect, it } from "vitest";
import { validateRecipe } from "../../src/contracts/validation";

describe("validateRecipe", () => {
  it("accepts a bounded list recipe and rejects an unbounded recipe", () => {
    const recipe = validateRecipe({
      version: 1,
      id: "recipe-1",
      projectId: "project-1",
      name: "Cards",
      origin: "https://example.test",
      startUrl: "https://example.test/list",
      mode: "data",
      containerSelector: ".card",
      fields: [{ id: "title", name: "Title", kind: "text", selector: "h2" }],
      traversal: { kind: "next", nextSelector: "button.next", maxPages: 3, maxItems: 100, delayMs: 750, timeoutMs: 10_000 },
      destinations: { inbox: true, autoDownload: false },
      schedule: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z"
    });
    expect(recipe.traversal.maxItems).toBe(100);
    expect(() => validateRecipe({ ...recipe, traversal: { ...recipe.traversal, maxItems: 0 } })).toThrow("maxItems");
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing-module failure**

Run: `npm test -- tests/unit/contracts.test.ts`

Expected: FAIL because `src/contracts/validation.ts` does not exist.

- [ ] **Step 3: Add the WXT project and strict versioned contracts**

Create scripts for `dev`, `dev:firefox`, `test`, `typecheck`, `build`, `build:firefox`, `zip`, `zip:firefox`, and `fixtures` (Vite serving `tests/fixtures` on `127.0.0.1:4173`). Configure WXT with the React module and only `activeTab`, `scripting`, `storage`, `downloads`, `alarms`, and broad optional HTTP/HTTPS host patterns. Implement discriminated unions for field kinds, traversal kinds, capture modes, and run statuses. Validate URLs, origins, selector presence, unique field IDs, and positive finite limits.

```ts
export type CaptureMode = "data" | "design" | "both";
export type RunStatus = "success" | "warning" | "partial" | "missed" | "failed" | "cancelled";

export interface FieldDefinition {
  id: string;
  name: string;
  kind: "text" | "link" | "image" | "attribute" | "html" | "design";
  selector: string;
  attribute?: string;
  identity?: boolean;
}

export interface Repository<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(value: T): Promise<void>;
  remove(id: string): Promise<void>;
}
```

- [ ] **Step 4: Run contract and static checks**

Run: `npm test -- tests/unit/contracts.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the scaffold**

```bash
git add .gitignore package.json package-lock.json tsconfig.json vitest.config.ts wxt.config.ts src/contracts tests/unit/contracts.test.ts
git commit -m "build: scaffold Scrapeyy extension contracts"
```

### Task 2: Build Selector Ranking and Structured Extraction

**Files:**
- Create: `src/extraction/selectors.ts`
- Create: `src/extraction/extract.ts`
- Create: `src/extraction/normalize.ts`
- Create: `src/extraction/fingerprint.ts`
- Test: `tests/unit/selectors.test.ts`
- Test: `tests/unit/extraction.test.ts`

**Interfaces:**
- Consumes: `FieldDefinition` from `src/contracts/models.ts`.
- Produces: `rankSelectorCandidates(element: Element, root?: ParentNode): SelectorCandidate[]`, `extractRecords(document: Document, containerSelector: string, fields: FieldDefinition[]): CaptureRecord[]`, and `fingerprintRecord(record: CaptureRecord, fields: FieldDefinition[]): string`.

- [ ] **Step 1: Write failing selector and extraction tests**

```ts
it("prefers a stable semantic attribute to generated classes", () => {
  document.body.innerHTML = '<article data-product="alpha" class="x-7812"><h2> Alpha </h2></article>';
  const element = document.querySelector("article")!;
  expect(rankSelectorCandidates(element)[0].selector).toBe('[data-product="alpha"]');
});

it("extracts normalized repeated records", () => {
  document.body.innerHTML = '<article class="card"><h2> Alpha </h2><a href="/a">View</a></article>';
  expect(extractRecords(document, ".card", [
    { id: "title", name: "Title", kind: "text", selector: "h2" },
    { id: "url", name: "URL", kind: "link", selector: "a", identity: true }
  ])).toEqual([{ title: "Alpha", url: "http://localhost:3000/a" }]);
});
```

- [ ] **Step 2: Run the focused tests**

Run: `npm test -- tests/unit/selectors.test.ts tests/unit/extraction.test.ts`

Expected: FAIL because extraction modules do not exist.

- [ ] **Step 3: Implement selector ranking, normalization, extraction, and stable fingerprints**

Reject generated-looking IDs and classes, CSS-escape all values, validate each candidate with `querySelectorAll`, and rank by stability followed by match count. Normalize whitespace, resolve links and images against `document.baseURI`, return `null` for missing optional values, and hash identity-field JSON with a deterministic FNV-1a implementation.

```ts
export interface SelectorCandidate {
  selector: string;
  matches: number;
  score: number;
  reason: "id" | "semantic" | "class" | "structural";
}

export type CaptureRecord = Record<string, string | null>;
```

- [ ] **Step 4: Run the focused and contract tests**

Run: `npm test -- tests/unit/contracts.test.ts tests/unit/selectors.test.ts tests/unit/extraction.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit extraction**

```bash
git add src/extraction tests/unit/selectors.test.ts tests/unit/extraction.test.ts
git commit -m "feat: add selector and extraction engines"
```

### Task 3: Build Safe Design Reference Captures

**Files:**
- Create: `src/design/sanitize.ts`
- Create: `src/design/styles.ts`
- Create: `src/design/assets.ts`
- Create: `src/design/snapshot.ts`
- Test: `tests/unit/design-snapshot.test.ts`

**Interfaces:**
- Consumes: selected `Element` and the current `Document`.
- Produces: `sanitizeElement(element: Element): string`, `collectComputedStyles(element: Element): string`, `collectAssetReferences(element: Element): AssetReference[]`, and `createDesignSnapshot(element: Element): Promise<DesignSnapshot>`.

- [ ] **Step 1: Write the failing security-focused test**

```ts
it("removes executable and secret-bearing content", () => {
  document.body.innerHTML = `
    <section onclick="steal()">
      <script>steal()</script>
      <input type="password" value="secret">
      <input type="hidden" name="csrf_token" value="token">
      <a href="javascript:steal()">Bad</a>
      <img src="/safe.png">
    </section>`;
  const html = sanitizeElement(document.querySelector("section")!);
  expect(html).not.toMatch(/script|onclick|secret|csrf|javascript:/i);
  expect(html).toContain("/safe.png");
});
```

- [ ] **Step 2: Confirm the security test fails**

Run: `npm test -- tests/unit/design-snapshot.test.ts`

Expected: FAIL because `sanitizeElement` is missing.

- [ ] **Step 3: Implement sanitization and reference artifacts**

Use bundled DOMPurify with an explicit allowlist, then perform a second pass removing form values, dangerous schemes, token-like hidden inputs, iframes, embeds, and inline events. Serialize computed styles by assigning deterministic `data-scrapeyy-node` identifiers to a clone. Collect image, source, CSS background, and font URLs as typed asset references without executing page code.

```ts
export interface DesignSnapshot {
  html: string;
  css: string;
  width: number;
  height: number;
  viewport: { width: number; height: number; devicePixelRatio: number };
  assets: AssetReference[];
  screenshot?: Blob;
}
```

- [ ] **Step 4: Run design and extraction tests**

Run: `npm test -- tests/unit/design-snapshot.test.ts tests/unit/extraction.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit safe design captures**

```bash
git add src/design tests/unit/design-snapshot.test.ts
git commit -m "feat: add sanitized design reference captures"
```

### Task 4: Implement Bounded Traversal State Machines

**Files:**
- Create: `src/traversal/types.ts`
- Create: `src/traversal/run-traversal.ts`
- Create: `src/traversal/next.ts`
- Create: `src/traversal/infinite-scroll.ts`
- Test: `tests/unit/traversal.test.ts`
- Create: `tests/fixtures/list.html`
- Create: `tests/fixtures/next.html`
- Create: `tests/fixtures/infinite.html`
- Create: `tests/fixtures/vite.config.ts`

**Interfaces:**
- Consumes: `TraversalSettings`, an `extractPage(): Promise<CaptureRecord[]>` callback, and a cancellable `TraversalEnvironment`.
- Produces: `runTraversal(settings, environment, extractPage): Promise<TraversalResult>`.

- [ ] **Step 1: Write failing bounded-stop tests**

```ts
it("stops next traversal after no new records", async () => {
  const environment = fakeTraversalEnvironment(["a", "a", "a"]);
  const result = await runTraversal(nextSettings({ maxPages: 10 }), environment, environment.extract);
  expect(result.stopReason).toBe("no-new-records");
  expect(result.pagesVisited).toBe(2);
});

it("never exceeds configured limits", async () => {
  const environment = fakeTraversalEnvironment(["a", "b", "c", "d"]);
  const result = await runTraversal(nextSettings({ maxPages: 2, maxItems: 100 }), environment, environment.extract);
  expect(result.pagesVisited).toBe(2);
  expect(result.stopReason).toBe("page-limit");
});
```

- [ ] **Step 2: Confirm traversal tests fail**

Run: `npm test -- tests/unit/traversal.test.ts`

Expected: FAIL because the traversal runner is missing.

- [ ] **Step 3: Implement cancellable Next and scroll traversal**

Use an injected environment for click, scroll, DOM-settlement waits, cancellation, and time. Deduplicate each page before evaluating stop conditions. Return all retained records plus page count, item count, warnings, and an explicit stop reason.

```ts
export type StopReason =
  | "complete" | "page-limit" | "item-limit" | "no-new-records"
  | "control-missing" | "control-disabled" | "timeout" | "cancelled";

export interface TraversalResult {
  records: CaptureRecord[];
  pagesVisited: number;
  stopReason: StopReason;
  warnings: string[];
}
```

- [ ] **Step 4: Run traversal tests and all unit tests**

Run: `npm test -- tests/unit/traversal.test.ts && npm test`

Expected: PASS.

- [ ] **Step 5: Commit traversal**

```bash
git add src/traversal tests/unit/traversal.test.ts tests/fixtures
git commit -m "feat: add bounded list traversal"
```

### Task 5: Add Local Repositories, Retention, and Configuration Migration

**Files:**
- Create: `src/storage/settings-repository.ts`
- Create: `src/storage/capture-database.ts`
- Create: `src/storage/retention.ts`
- Create: `src/storage/migrations.ts`
- Test: `tests/unit/storage.test.ts`

**Interfaces:**
- Consumes: `Project`, `Recipe`, `CaptureRun`, and `Repository<T>`.
- Produces: `createSettingsRepositories(browserStorage)`, `CaptureDatabase`, `applyRetention(runs, limit): string[]`, and `migrateConfiguration(input): ConfigurationV1`.

- [ ] **Step 1: Write failing repository and retention tests**

```ts
it("retains twenty newest unpinned runs plus every pinned run", () => {
  const runs = makeRuns(24, { pinnedIds: ["run-1"] });
  const deletions = applyRetention(runs, 20);
  expect(deletions).toHaveLength(3);
  expect(deletions).not.toContain("run-1");
});

it("round-trips blobs and records through IndexedDB", async () => {
  const database = new CaptureDatabase("scrapeyy-test");
  await database.putRun(makeRun({ id: "run-1" }));
  expect((await database.getRun("run-1"))?.id).toBe("run-1");
});
```

- [ ] **Step 2: Confirm storage tests fail**

Run: `npm test -- tests/unit/storage.test.ts`

Expected: FAIL because storage modules are missing.

- [ ] **Step 3: Implement typed browser-storage repositories and IndexedDB**

Use `fake-indexeddb` only in tests. Store settings under versioned keys. Create IndexedDB stores for runs and artifacts with recipe/time indexes. Make migrations pure and idempotent. Cleanup excludes pinned, queued, and in-progress records.

- [ ] **Step 4: Run storage and full unit suites**

Run: `npm test -- tests/unit/storage.test.ts && npm test`

Expected: PASS.

- [ ] **Step 5: Commit local persistence**

```bash
git add src/storage tests/unit/storage.test.ts
git commit -m "feat: add local capture repositories"
```

### Task 6: Implement Permissions, Scheduling, and Run Orchestration

**Files:**
- Create: `src/platform/browser-api.ts`
- Create: `src/platform/permissions.ts`
- Create: `src/platform/tabs.ts`
- Create: `src/platform/screenshots.ts`
- Create: `src/scheduling/schedule.ts`
- Create: `src/scheduling/runner.ts`
- Create: `entrypoints/background.ts`
- Test: `tests/unit/scheduling.test.ts`
- Test: `tests/unit/permissions.test.ts`

**Interfaces:**
- Consumes: `Recipe`, repositories, `CaptureDatabase`, and browser adapters.
- Produces: `requestOriginAccess(origin): Promise<boolean>`, `revokeOriginAccess(origin): Promise<boolean>`, `captureElementScreenshot(tabId, bounds): Promise<Blob | undefined>`, `nextOccurrence(schedule, after): Date`, `shouldCatchUp(lastDue, lastRun, now): boolean`, and `runRecipe(recipeId, trigger): Promise<CaptureRun>`.

- [ ] **Step 1: Write failing permission and catch-up tests**

```ts
it("requests only the selected origin", async () => {
  const api = fakePermissionApi(true);
  await requestOriginAccess("https://example.test", api);
  expect(api.request).toHaveBeenCalledWith({ origins: ["https://example.test/*"] });
});

it("allows one catch-up but not a catch-up storm", () => {
  expect(shouldCatchUp(date("08:00"), undefined, date("10:00"))).toBe(true);
  expect(shouldCatchUp(date("08:00"), date("09:59"), date("10:00"))).toBe(false);
});
```

- [ ] **Step 2: Confirm scheduling tests fail**

Run: `npm test -- tests/unit/permissions.test.ts tests/unit/scheduling.test.ts`

Expected: FAIL because permission and scheduling modules are missing.

- [ ] **Step 3: Implement minimal-permission scheduling**

Normalize origins before permission requests. Create one alarm per enabled recipe. On alarm, verify permission, locate or create an inactive tab, wait for navigation, send a run message, record a structured failure on login redirect or injection failure, and close only tabs marked as created by Scrapeyy. Mark schedules as `needs-permission` immediately after revocation. Capture visible-tab pixels through the browser adapter only during a user-visible design run, crop them to validated element bounds, and return `undefined` with a warning when the element is outside the viewport or browser capture is unavailable.

- [ ] **Step 4: Run scheduling tests and typecheck**

Run: `npm test -- tests/unit/permissions.test.ts tests/unit/scheduling.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit orchestration**

```bash
git add src/platform src/scheduling entrypoints/background.ts tests/unit/permissions.test.ts tests/unit/scheduling.test.ts
git commit -m "feat: add permissions and scheduled runs"
```

### Task 7: Build Deterministic JSON, CSV, and ZIP Exports

**Files:**
- Create: `src/export/csv.ts`
- Create: `src/export/manifest.ts`
- Create: `src/export/bundle.ts`
- Create: `src/export/filename.ts`
- Create: `src/platform/downloads.ts`
- Test: `tests/unit/export.test.ts`

**Interfaces:**
- Consumes: `CaptureRun`, records, and optional `DesignSnapshot`.
- Produces: `serializeCsv(records, fields): string`, `buildRunBundle(input): Promise<Blob>`, `buildDownloadPath(project, recipe, run): string`, and `downloadBundle(blob, path): Promise<number>`.

- [ ] **Step 1: Write failing deterministic export tests**

```ts
it("escapes CSV and preserves field order", () => {
  expect(serializeCsv([{ title: 'A, "B"', url: null }], [
    { id: "title", name: "Title", kind: "text", selector: "h2" },
    { id: "url", name: "URL", kind: "link", selector: "a" }
  ])).toBe('Title,URL\\r\\n"A, ""B""",\\r\\n');
});

it("creates a safe relative download path", () => {
  expect(buildDownloadPath({ name: "../Acme" }, { name: "Products/2026" }, run))
    .toBe("Scrapeyy/Acme/Products-2026/2026-08-06T12-00-00Z/scrapeyy-run.zip");
});
```

- [ ] **Step 2: Confirm export tests fail**

Run: `npm test -- tests/unit/export.test.ts`

Expected: FAIL because export modules are missing.

- [ ] **Step 3: Implement stable serializers and queued downloads**

Sort object keys in JSON manifests, preserve recipe field order in CSV, normalize timestamps to UTC, sanitize every path segment, and use JSZip without remote code. Include only artifacts valid for the selected mode. Keep the generated blob in IndexedDB if the downloads adapter rejects or requires unresolved user interaction.

- [ ] **Step 4: Run export and full unit suites**

Run: `npm test -- tests/unit/export.test.ts && npm test`

Expected: PASS.

- [ ] **Step 5: Commit exports**

```bash
git add src/export src/platform/downloads.ts tests/unit/export.test.ts
git commit -m "feat: add deterministic capture exports"
```

### Task 8: Implement the Page Overlay and Recipe Preview

**Files:**
- Create: `entrypoints/content.tsx`
- Create: `src/features/picker/PickerApp.tsx`
- Create: `src/features/picker/PickerHud.tsx`
- Create: `src/features/picker/FieldEditor.tsx`
- Create: `src/features/picker/useElementPicker.ts`
- Create: `src/features/picker/picker.css`
- Test: `tests/integration/picker.test.tsx`

**Interfaces:**
- Consumes: selector and extraction engines, design snapshot engine, contracts, and content/background messages.
- Produces: `PickerApp`, `startPicker(options)`, preview records, and `CAPTURE_PAGE` / `RUN_RECIPE_IN_PAGE` message handlers.

- [ ] **Step 1: Write the failing picker interaction test**

```tsx
it("selects a repeated container and previews named fields", async () => {
  document.body.innerHTML = '<main><article class="card"><h2>Alpha</h2></article><article class="card"><h2>Beta</h2></article></main>';
  render(<PickerApp projectId="project-1" />);
  await user.click(screen.getByRole("button", { name: "Repeated list" }));
  dispatchHoveredElement(document.querySelector(".card")!);
  await user.click(screen.getByRole("button", { name: "Select element" }));
  await user.click(screen.getByRole("button", { name: "Add text field" }));
  expect(screen.getByText("2 matches")).toBeVisible();
  expect(screen.getByText("Alpha")).toBeVisible();
});
```

- [ ] **Step 2: Confirm the picker test fails**

Run: `npm test -- tests/integration/picker.test.tsx`

Expected: FAIL because `PickerApp` is missing.

- [ ] **Step 3: Implement an isolated, accessible overlay**

Mount React inside a shadow root. Keep page highlight layers outside the selected element and remove them on exit. Provide keyboard cancellation, parent/child navigation, selector cycling, match counts, field naming, mode selection, traversal controls, and a bounded preview. Never serialize the overlay itself.

- [ ] **Step 4: Run picker tests and build both targets**

Run: `npm test -- tests/integration/picker.test.tsx && npm run build && npm run build:firefox`

Expected: PASS with Chrome and Firefox output directories.

- [ ] **Step 5: Commit the overlay**

```bash
git add entrypoints/content.tsx src/features/picker tests/integration/picker.test.tsx
git commit -m "feat: add visual capture overlay"
```

### Task 9: Implement Popup, Dashboard, Recipe Management, and Inbox

**Files:**
- Create: `entrypoints/popup/index.html`
- Create: `entrypoints/popup/main.tsx`
- Create: `entrypoints/dashboard/index.html`
- Create: `entrypoints/dashboard/main.tsx`
- Create: `src/features/popup/PopupApp.tsx`
- Create: `src/features/dashboard/DashboardApp.tsx`
- Create: `src/features/dashboard/ProjectsView.tsx`
- Create: `src/features/dashboard/RecipeEditor.tsx`
- Create: `src/features/dashboard/ScheduleEditor.tsx`
- Create: `src/features/dashboard/InboxView.tsx`
- Create: `src/features/shared/theme.css`
- Test: `tests/integration/popup.test.tsx`
- Test: `tests/integration/dashboard.test.tsx`

**Interfaces:**
- Consumes: repositories, scheduling, permissions, export, and background messages.
- Produces: the complete toolbar and dashboard user workflows.

- [ ] **Step 1: Write failing popup and dashboard workflow tests**

```tsx
it("shows the three primary popup actions", () => {
  render(<PopupApp />);
  expect(screen.getByRole("button", { name: "Quick Capture" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Run Saved Recipe" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Open Dashboard" })).toBeVisible();
});

it("preserves partial runs and lets the user export them", async () => {
  render(<DashboardApp services={servicesWithRun({ status: "partial" })} />);
  await user.click(screen.getByRole("tab", { name: "Capture Inbox" }));
  expect(screen.getByText("Partial")).toBeVisible();
  expect(screen.getByRole("button", { name: "Export run" })).toBeEnabled();
});
```

- [ ] **Step 2: Confirm UI tests fail**

Run: `npm test -- tests/integration/popup.test.tsx tests/integration/dashboard.test.tsx`

Expected: FAIL because popup and dashboard components are missing.

- [ ] **Step 3: Implement the compact popup and responsive dashboard**

Use semantic controls, keyboard-visible focus, accessible status text, and a restrained local-tool visual system. Implement project CRUD, recipe import/export, validation messages, manual run, schedule enable/disable, permission grant/revoke, run retry, pin, delete, comparison, retention settings, queued export retry, and the documented status states.

- [ ] **Step 4: Run UI tests, typecheck, and both builds**

Run: `npm test -- tests/integration/popup.test.tsx tests/integration/dashboard.test.tsx && npm run typecheck && npm run build && npm run build:firefox`

Expected: PASS.

- [ ] **Step 5: Commit the user interfaces**

```bash
git add entrypoints/popup entrypoints/dashboard src/features/popup src/features/dashboard src/features/shared tests/integration/popup.test.tsx tests/integration/dashboard.test.tsx
git commit -m "feat: add Scrapeyy dashboard and popup"
```

### Task 10: Add End-to-End Fixtures, Cross-Module Runs, and Documentation

**Files:**
- Create: `tests/integration/run-pipeline.test.ts`
- Create: `tests/fixtures/auth-redirect.html`
- Create: `tests/fixtures/changed-selector.html`
- Create: `tests/fixtures/assets.html`
- Create: `README.md`
- Create: `docs/ACCEPTANCE.md`

**Interfaces:**
- Consumes: all product modules and built browser packages.
- Produces: executable acceptance instructions and cross-module proof.

- [ ] **Step 1: Write a failing full-pipeline integration test**

```ts
it("retains and exports partial data when page two changes structure", async () => {
  const result = await runFixtureRecipe({
    fixture: "changed-selector",
    traversal: nextSettings({ maxPages: 3 }),
    mode: "both"
  });
  expect(result.run.status).toBe("partial");
  expect(result.run.recordCount).toBeGreaterThan(0);
  expect(await zipEntries(result.bundle)).toEqual(expect.arrayContaining([
    "manifest.json", "data.json", "data.csv", "snapshot.html", "styles.css"
  ]));
});
```

- [ ] **Step 2: Confirm the pipeline test fails**

Run: `npm test -- tests/integration/run-pipeline.test.ts`

Expected: FAIL until the modules are wired into one run service.

- [ ] **Step 3: Wire the pipeline and write exact usage/acceptance documentation**

Connect content extraction, traversal, design capture, persistence, and export through a single `RunService`. Document developer setup, unpacked installation in both browsers, permissions, fixture usage, schedule limitations, export layout, and the fourteen-item browser checklist from the design.

- [ ] **Step 4: Run the complete local quality gate**

Run: `npm test && npm run typecheck && npm run build && npm run build:firefox && npm run zip && npm run zip:firefox && git diff --check`

Expected: all commands pass and both installable archives exist.

- [ ] **Step 5: Commit integration and documentation**

```bash
git add src tests README.md docs/ACCEPTANCE.md
git commit -m "test: complete Scrapeyy run pipeline"
```

### Task 11: Perform Real Chrome and Firefox Acceptance

**Files:**
- Modify only if acceptance exposes a reproducible product defect.
- Record: `docs/ACCEPTANCE.md`

**Interfaces:**
- Consumes: packaged Chrome and Firefox extensions and local fixture pages.
- Produces: browser-specific acceptance evidence with failures separated from source/build proof.

- [ ] **Step 1: Start the deterministic fixture server**

Run: `npm run fixtures`

Expected: fixture index is reachable at `http://127.0.0.1:4173`.

- [ ] **Step 2: Load and test the Chrome package**

Use the installed Chrome connection, load the unpacked Chrome output, and execute all fourteen acceptance items. Verify the downloaded ZIP contents from disk and revoke persistent permission after the permission test.

- [ ] **Step 3: Load and test the Firefox package**

Use Computer Use with Firefox, load the temporary extension from the Firefox output, and execute the same fourteen acceptance items. Verify that user-visible behavior and exported bundle contents match Chrome.

- [ ] **Step 4: Fix only reproducible defects with a failing test first**

For every discovered defect, add the smallest automated regression test, confirm it fails, implement the correction, rerun the focused test, rebuild both targets, and repeat the affected acceptance item in both browsers.

- [ ] **Step 5: Run the final verification gate and commit acceptance evidence**

Run: `npm test && npm run typecheck && npm run build && npm run build:firefox && npm run zip && npm run zip:firefox && git diff --check && git status --short`

Expected: checks pass, only intentional acceptance-note changes remain, and the final commit records exact Chrome/Firefox outcomes without claiming publication or deployment.

```bash
git add docs/ACCEPTANCE.md
git commit -m "docs: record Chrome and Firefox acceptance"
```
