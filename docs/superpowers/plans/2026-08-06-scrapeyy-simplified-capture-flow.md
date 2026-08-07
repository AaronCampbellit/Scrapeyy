# Scrapeyy Simplified Capture Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the separate dashboard and broken hover-plus-HUD picker with a popup-only management workspace, direct page-click Quick Capture, structure-aware automatic data extraction, and a separate advanced recipe flow.

**Architecture:** One content-script selection engine will drive Quick Capture and Create Recipe. Quick Capture will send a selector and mode to the background, the content script will return inferred fields, records, and an optional sanitized design snapshot, and the background will store the result through existing run/artifact contracts. The popup will load projects, recipes, runs, permissions, and settings through one service interface and render compact Capture, Recipes, Inbox, and Settings views; the dashboard entrypoint will be removed.

**Tech Stack:** TypeScript 7, React 19, WXT 0.21, WebExtension APIs, Vitest 4, Testing Library, DOMPurify, JSZip, IndexedDB.

## Global Constraints

- Chrome Manifest V3 and Firefox Manifest V2 receive equal support.
- Captured content stays local; there is no cloud dependency.
- Quick Capture exposes only direct selection followed by Data, Design, or Both.
- Quick Capture always stores the run in the inbox and never auto-downloads.
- Advanced fields, traversal, scheduling, limits, destinations, and project assignment appear only in Create Recipe.
- Page selection must block the underlying page action for the selection click.
- Design capture remains sanitized and capture-only: no scripts, event handlers, credentials, tokens, cookies, storage values, or executable behavior.
- Existing projects, recipes, runs, configuration version, retention behavior, permissions, schedules, and export formats remain compatible.
- Do not add runtime dependencies unless an existing platform API cannot satisfy an approved requirement.

## File Structure

- Create `src/extraction/quick-extract.ts`: structure-aware table, repeated-content, and generic-region extraction.
- Create `src/features/picker/selection-state.ts`: pure selection state transitions and page-event guards.
- Modify `src/features/picker/useElementPicker.ts`: direct pointer/click/keyboard selection lifecycle.
- Create `src/features/picker/QuickCaptureCard.tsx`: post-selection Data/Design/Both confirmation.
- Modify `src/features/picker/PickerApp.tsx`: distinct quick and recipe modes using the shared selection engine.
- Modify `src/features/picker/picker.css`: crosshair, instruction bar, highlight, confirmation card, and advanced recipe panel.
- Modify `entrypoints/content.tsx`: quick execution, recipe execution, and mode-specific picker messages.
- Modify `entrypoints/background.ts`: quick request pipeline, synthetic recipe metadata, screenshots, storage, and start messages.
- Modify `src/features/popup/PopupApp.tsx`: complete popup workspace shell and navigation.
- Create `src/features/popup/CaptureView.tsx`: current-site actions and recent capture status.
- Create `src/features/popup/RecipesView.tsx`: compact project and saved-recipe management.
- Create `src/features/popup/InboxView.tsx`: compact run list, preview, retry, pin, delete, and export.
- Create `src/features/popup/SettingsView.tsx`: permissions, retention, and configuration portability.
- Modify `entrypoints/popup/main.tsx`: shared popup services and all management actions.
- Modify `src/features/popup/popup.css`: popup-sized workspace layout.
- Delete `entrypoints/dashboard/index.html`, `entrypoints/dashboard/main.tsx`, and `src/features/dashboard/*`.
- Modify `README.md` and `docs/ACCEPTANCE.md`: revised use and exact browser evidence.

---

### Task 1: Structure-Aware Quick Data Extraction

**Files:**
- Create: `src/extraction/quick-extract.ts`
- Modify: `src/extraction/normalize.ts`
- Test: `tests/unit/quick-extraction.test.ts`
- Fixture: `tests/fixtures/quick-regions.html`

**Interfaces:**
- Consumes: `CaptureRecord`, `FieldDefinition`, `normalizeWhitespace`, and `resolveHttpUrl`.
- Produces:

```ts
export interface QuickExtractionResult {
  strategy: "table" | "repeated" | "generic";
  fields: FieldDefinition[];
  records: CaptureRecord[];
}

export function extractQuickData(
  selected: Element,
  baseUrl?: string,
): QuickExtractionResult;
```

- [ ] **Step 1: Write failing table and generic extraction tests**

```ts
it("turns a selected table into named records", () => {
  document.body.innerHTML = `
    <table id="prices">
      <thead><tr><th>Plan</th><th>Price</th></tr></thead>
      <tbody>
        <tr><td>Basic</td><td>$10</td></tr>
        <tr><td>Pro</td><td>$20</td></tr>
      </tbody>
    </table>`;
  expect(extractQuickData(document.querySelector("#prices")!)).toEqual({
    strategy: "table",
    fields: [
      expect.objectContaining({ id: "plan", name: "Plan" }),
      expect.objectContaining({ id: "price", name: "Price" }),
    ],
    records: [
      { plan: "Basic", price: "$10" },
      { plan: "Pro", price: "$20" },
    ],
  });
});

it("falls back to visible text, links, images, source, and descriptor", () => {
  document.body.innerHTML = `
    <section id="hero"><h2>Launch</h2>
      <a href="/learn">Learn more</a>
      <img src="/hero.png" alt="Launch graphic">
    </section>`;
  const result = extractQuickData(
    document.querySelector("#hero")!,
    "https://example.test/page",
  );
  expect(result.strategy).toBe("generic");
  expect(result.records[0]).toMatchObject({
    text: "Launch Learn more",
    links: "Learn more — https://example.test/learn",
    images: "Launch graphic — https://example.test/hero.png",
    source_url: "https://example.test/page",
    element: "section#hero",
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `npm test -- tests/unit/quick-extraction.test.ts`

Expected: FAIL because `src/extraction/quick-extract.ts` does not exist.

- [ ] **Step 3: Implement table headers and the safe generic fallback**

Implement stable slug generation with duplicate suffixes, normalized cell
values, resolved HTTP/HTTPS links and images, and a descriptor made from tag,
ID, and at most two classes. Represent multiple links or images as
newline-separated strings so `CaptureValue` and CSV compatibility remain
unchanged.

```ts
export function extractQuickData(
  selected: Element,
  baseUrl = selected.ownerDocument.baseURI,
): QuickExtractionResult {
  if (selected instanceof HTMLTableElement) {
    return extractTable(selected, baseUrl);
  }
  return extractGeneric(selected, baseUrl);
}
```

- [ ] **Step 4: Add a failing repeated-card inference test**

```ts
it("infers common fields from repeated cards", () => {
  document.body.innerHTML = `
    <div id="cards">
      <article class="card"><h3>Alpha</h3><a href="/a">Open</a><img src="/a.png" alt="Alpha"></article>
      <article class="card"><h3>Beta</h3><a href="/b">Open</a><img src="/b.png" alt="Beta"></article>
    </div>`;
  const result = extractQuickData(
    document.querySelector("#cards")!,
    "https://example.test/",
  );
  expect(result.strategy).toBe("repeated");
  expect(result.records).toEqual([
    expect.objectContaining({ title: "Alpha", link: "https://example.test/a" }),
    expect.objectContaining({ title: "Beta", link: "https://example.test/b" }),
  ]);
});
```

- [ ] **Step 5: Implement conservative repeated-child detection**

Treat a region as repeated only when it has at least two direct element
children sharing the same tag and class signature. Infer `title`, `text`,
`link`, and `image` only when each inferred selector appears in at least half
of the repeated children. Fall back to generic extraction when no useful
common field exists.

- [ ] **Step 6: Run extraction and existing extraction tests**

Run: `npm test -- tests/unit/quick-extraction.test.ts tests/unit/extraction.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the extraction unit**

```bash
git add src/extraction/quick-extract.ts src/extraction/normalize.ts tests/unit/quick-extraction.test.ts tests/fixtures/quick-regions.html
git commit -m "feat: add smart quick capture extraction"
```

---

### Task 2: Direct Page-Click Selection Engine

**Files:**
- Create: `src/features/picker/selection-state.ts`
- Modify: `src/features/picker/useElementPicker.ts`
- Test: `tests/unit/selection-state.test.ts`
- Test: `tests/integration/picker.test.tsx`

**Interfaces:**
- Produces:

```ts
export type SelectionPhase = "hovering" | "selected";

export interface ElementPickerState {
  phase: SelectionPhase;
  hovered?: Element;
  selected?: Element;
}

export interface ElementPickerController {
  phase: SelectionPhase;
  hovered?: Element;
  selected?: Element;
  reselect(): void;
}

export function shouldIgnorePickerTarget(target: EventTarget | null): boolean;
export function useElementPicker(
  ownerDocument: Document,
  onCancel?: () => void,
): ElementPickerController;
```

- [ ] **Step 1: Replace HUD-oriented tests with failing direct-click tests**

```ts
it("selects the clicked page element and blocks its page action", async () => {
  const pageClick = vi.fn();
  document.querySelector(".product-card")!.addEventListener("click", pageClick);
  render(<PickerApp ownerDocument={document} variant="quick" />);

  const target = document.querySelector(".product-card")!;
  fireEvent.pointerMove(target);
  const event = createEvent.click(target, { bubbles: true, cancelable: true });
  fireEvent(target, event);

  expect(pageClick).not.toHaveBeenCalled();
  expect(screen.getByRole("group", { name: "Capture type" })).toBeVisible();
});
```

Add tests for Escape cancellation, Scrapeyy UI exclusion, and Reselect
returning to hover mode.

- [ ] **Step 2: Run the picker tests and verify failure**

Run: `npm test -- tests/integration/picker.test.tsx tests/unit/selection-state.test.ts`

Expected: FAIL because clicks do not select and the old HUD remains.

- [ ] **Step 3: Implement captured pointer and click listeners**

Register `pointermove`, `click`, and `keydown` on the owner document with
capture enabled. While hovering, a valid click must call
`preventDefault()`, `stopPropagation()`, and `stopImmediatePropagation()`
before storing the selected element. Remove every listener on unmount.

```ts
const onClick = (event: MouseEvent) => {
  if (phaseRef.current !== "hovering" || shouldIgnorePickerTarget(event.target)) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  setSelected(event.target as Element);
  setPhase("selected");
};
```

- [ ] **Step 4: Implement Escape, keyboard selection, and Reselect lifecycle**

Escape calls `onCancel` from either phase. `reselect()` clears the selected
element, restores hover tracking, and does not duplicate document listeners.
While hovering, Enter or Space selects a valid focused page element through
the same guarded transition as a pointer click and prevents the page action.

- [ ] **Step 5: Run picker tests and the full suite**

Run: `npm test -- tests/integration/picker.test.tsx tests/unit/selection-state.test.ts && npm test`

Expected: focused tests and full suite PASS.

- [ ] **Step 6: Commit direct selection**

```bash
git add src/features/picker/selection-state.ts src/features/picker/useElementPicker.ts tests/unit/selection-state.test.ts tests/integration/picker.test.tsx
git commit -m "fix: make page regions directly selectable"
```

---

### Task 3: Two-Stage Quick Capture and Advanced Recipe Picker

**Files:**
- Create: `src/features/picker/QuickCaptureCard.tsx`
- Modify: `src/features/picker/PickerApp.tsx`
- Modify: `src/features/picker/PickerHud.tsx` (remove file after references are gone)
- Modify: `src/features/picker/picker.css`
- Test: `tests/integration/picker.test.tsx`

**Interfaces:**
- Replace `PickerCapture` for the simple path with:

```ts
export interface QuickCaptureRequest {
  projectId: string;
  mode: CaptureMode;
  containerSelector: string;
}

export interface PickerAppProps {
  ownerDocument: Document;
  variant: "quick" | "recipe";
  projectId: string;
  projectName: string;
  initialRecipe?: Recipe;
  onQuickCapture?(capture: QuickCaptureRequest): void;
  onSaveRecipe?(recipe: Recipe): void;
  onClose?(): void;
}
```

- [ ] **Step 1: Write failing Quick Capture simplicity tests**

Assert that before selection the instruction is
`Click content to select · Esc to cancel`; after a page click the UI shows
Data, Design, Both, Capture, Reselect, and Cancel; and Quick Capture never
shows Project, Fields, Pagination, Safety limits, selector text, or preview.

- [ ] **Step 2: Run the picker test and verify the old panel fails it**

Run: `npm test -- tests/integration/picker.test.tsx`

Expected: FAIL because recipe-only controls and the HUD are rendered.

- [ ] **Step 3: Build the compact confirmation card**

`QuickCaptureCard` owns only mode state and confirmation actions. Default to
Data, preserve all three modes, describe the selected element without
exposing a CSS selector, and keep the card inside the viewport using fixed
edge placement when element bounds are too close to an edge.

- [ ] **Step 4: Split PickerApp into quick and recipe stages**

Quick mode renders the instruction bar, highlight, and confirmation card.
Recipe mode renders the same selection stage followed by Selection, Data,
Traversal, Delivery, and Review stages. Move the existing fields, traversal,
schedule, limit, project, and destination controls into recipe-only stages.

- [ ] **Step 5: Remove the old HUD contract and simplify CSS**

Delete `PickerHud.tsx`, `.picker-hud`, and the full-height Quick Capture panel.
Add `.picker-instruction`, `.quick-capture-card`, `.selection-highlight`,
`.recipe-builder`, crosshair cursor, viewport-safe placement, live notice, and
mobile-width rules.

- [ ] **Step 6: Run picker tests and accessibility assertions**

Run: `npm test -- tests/integration/picker.test.tsx`

Expected: PASS, including role/label checks for the capture-type group, live
processing/result notice, Escape, and keyboard actions. The capture callback
must remain mounted while awaiting the background response, show success or
failure, and dismiss the selection UI only after the result notice is
observable.

- [ ] **Step 7: Commit the picker redesign**

```bash
git add src/features/picker/QuickCaptureCard.tsx src/features/picker/PickerApp.tsx src/features/picker/useElementPicker.ts src/features/picker/picker.css tests/integration/picker.test.tsx
git rm src/features/picker/PickerHud.tsx
git commit -m "feat: simplify quick capture selection flow"
```

---

### Task 4: Quick Capture Runtime Pipeline

**Files:**
- Modify: `entrypoints/content.tsx`
- Modify: `entrypoints/background.ts`
- Modify: `src/contracts/models.ts`
- Modify: `src/run/run-service.ts`
- Test: `tests/integration/run-pipeline.test.ts`
- Test: `tests/unit/contracts.test.ts`

**Interfaces:**
- Content message:

```ts
{
  type: "SCRAPEYY_EXECUTE_QUICK_CAPTURE";
  request: QuickCaptureRequest;
}
```

- Content response:

```ts
export interface QuickPageExecutionResult extends PageExecutionResult {
  fields: FieldDefinition[];
  strategy: "table" | "repeated" | "generic";
}
```

- Start messages:

```ts
{ type: "SCRAPEYY_START_QUICK_PICKER"; tabId: number }
{ type: "SCRAPEYY_START_RECIPE_PICKER"; tabId: number; recipeId?: string }
```

- [ ] **Step 1: Write a failing pipeline test for inferred quick records**

```ts
it("stores inferred Quick Capture fields and records without saving a recipe", async () => {
  const result = await runQuickCapture(
    { projectId: "project-1", mode: "data", containerSelector: "#prices" },
    12,
    "https://example.test/prices",
  );
  expect(result.status).toBe("success");
  expect(result.records).toEqual([{ plan: "Basic", price: "$10" }]);
  expect(await recipes.list()).toHaveLength(0);
  expect(await captures.getArtifact(`${result.id}:recipe`)).toBeDefined();
});
```

- [ ] **Step 2: Run the pipeline test and verify the request contract fails**

Run: `npm test -- tests/integration/run-pipeline.test.ts`

Expected: FAIL because Quick Capture still requires configured fields and
traversal.

- [ ] **Step 3: Add content-side quick execution**

Locate the selected container by selector. If absent, return
`SELECTOR_CHANGED`. For Data or Both, call `extractQuickData`. For Design or
Both, call `createDesignSnapshot`. Return inferred fields and strategy with
records, warnings, errors, design, and bounds.

- [ ] **Step 4: Create the synthetic recipe after extraction**

Build the artifact-only recipe from inferred fields with no traversal, inbox
enabled, auto-download disabled, and a generated name such as
`Quick capture · <host> · <timestamp>`. Store the run and recipe snapshot, but
do not add the synthetic recipe to the saved recipe repository.

- [ ] **Step 5: Route mode-specific picker start and completion messages**

The popup starts quick or recipe mode explicitly. Quick completion calls the
new runtime pipeline. Recipe completion validates and saves the full recipe,
then synchronizes schedules. Return a typed success or failure response to the
content script so it can render the processing/result live notice before
closing.

- [ ] **Step 6: Preserve screenshots, retention, failure runs, and exports**

Use the existing element screenshot path for Design and Both. Apply 20-run
retention, preserve pinned runs, and leave failed downloads recoverable from
the inbox.

- [ ] **Step 7: Run pipeline, contracts, export, and storage tests**

Run: `npm test -- tests/integration/run-pipeline.test.ts tests/unit/contracts.test.ts tests/unit/export.test.ts tests/unit/storage.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit the runtime pipeline**

```bash
git add entrypoints/content.tsx entrypoints/background.ts src/contracts/models.ts src/run/run-service.ts tests/integration/run-pipeline.test.ts tests/unit/contracts.test.ts
git commit -m "feat: run smart quick captures"
```

---

### Task 5: Popup-Only Management Workspace

**Files:**
- Create: `src/features/popup/CaptureView.tsx`
- Create: `src/features/popup/RecipesView.tsx`
- Create: `src/features/popup/InboxView.tsx`
- Create: `src/features/popup/SettingsView.tsx`
- Modify: `src/features/popup/PopupApp.tsx`
- Modify: `src/features/popup/popup.css`
- Modify: `entrypoints/popup/main.tsx`
- Test: `tests/integration/popup.test.tsx`

**Interfaces:**
- Popup data and service boundary:

```ts
export interface PopupWorkspaceData {
  site?: PopupSite;
  projects: Project[];
  recipes: Recipe[];
  runs: CaptureRun[];
  permissions: Record<string, boolean>;
  retentionLimit: number;
}

export interface PopupServices {
  load(): Promise<PopupWorkspaceData>;
  startQuickCapture(): Promise<void>;
  startRecipeCapture(recipeId?: string): Promise<void>;
  runRecipe(recipeId: string): Promise<CaptureRun>;
  saveProject(project: Project): Promise<void>;
  exportRun(runId: string): Promise<void>;
  deleteRun(runId: string): Promise<void>;
  pinRun(runId: string, pinned: boolean): Promise<void>;
  requestOriginAccess(origin: string): Promise<boolean>;
  revokeOriginAccess(origin: string): Promise<boolean>;
  exportConfiguration(): Promise<void>;
  importConfiguration(input: unknown): Promise<void>;
}
```

- [ ] **Step 1: Write failing popup navigation and management tests**

Test Capture, Recipes, Inbox, and Settings tabs; Quick Capture and Create
Recipe dispatch; saved-recipe run; inbox preview/export/pin/delete; website
access; configuration import/export; and absence of Open Dashboard.
Include unsupported browser-page disabling and a rejected picker-start request
that remains open with `Scrapeyy could not start on this page`.

```ts
expect(screen.queryByRole("button", { name: /Open Dashboard/i })).toBeNull();
await user.click(screen.getByRole("tab", { name: "Inbox" }));
expect(screen.getByText("Data preview")).toBeVisible();
```

- [ ] **Step 2: Run the popup tests and verify missing views**

Run: `npm test -- tests/integration/popup.test.tsx`

Expected: FAIL because the popup only exposes three actions and delegates to
the dashboard.

- [ ] **Step 3: Implement the compact popup shell**

Use four tabs with one active view at a time. Keep the current-site access
summary pinned at the top of Capture. Put project selection inside Recipes
instead of dedicating a full Projects page. Store the last active tab in
extension local storage.

- [ ] **Step 4: Port recipe and inbox actions**

Adapt the existing dashboard logic into popup-sized list/detail states. Recipe
edit starts the staged on-page recipe builder. Inbox supports select, preview,
retry, export, pin, and delete without opening another page.

- [ ] **Step 5: Port settings and permission handling**

List only origins used by saved recipes. Grant/revoke calls use existing
permission helpers; revocation tells the background to disable affected
schedules. Configuration import must pass through `migrateConfiguration`.

- [ ] **Step 6: Wire real popup services**

Load the active tab, repositories, capture database, permission map, and
retention. Send the mode-specific picker messages and close the popup only
after a picker starts successfully. Keep management actions open and refresh
their view state.

- [ ] **Step 7: Constrain the popup layout**

Target `420px` width and at most `600px` content height with internal scrolling.
Verify empty, loading, failed, and populated states without horizontal scroll.

- [ ] **Step 8: Run popup, permission, storage, and scheduling tests**

Run: `npm test -- tests/integration/popup.test.tsx tests/unit/permissions.test.ts tests/unit/storage.test.ts tests/unit/scheduling.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit popup management**

```bash
git add src/features/popup/CaptureView.tsx src/features/popup/RecipesView.tsx src/features/popup/InboxView.tsx src/features/popup/SettingsView.tsx src/features/popup/PopupApp.tsx src/features/popup/popup.css entrypoints/popup/main.tsx tests/integration/popup.test.tsx
git commit -m "feat: move Scrapeyy management into popup"
```

---

### Task 6: Remove Dashboard and Preserve Recipe Compatibility

**Files:**
- Delete: `entrypoints/dashboard/index.html`
- Delete: `entrypoints/dashboard/main.tsx`
- Delete: `src/features/dashboard/DashboardApp.tsx`
- Delete: `src/features/dashboard/InboxView.tsx`
- Delete: `src/features/dashboard/ProjectsView.tsx`
- Delete: `src/features/dashboard/RecipeEditor.tsx`
- Delete: `src/features/dashboard/ScheduleEditor.tsx`
- Delete: `src/features/dashboard/dashboard.css`
- Delete: `tests/integration/dashboard.test.tsx`
- Modify: `src/features/picker/PickerApp.tsx`
- Test: `tests/integration/picker.test.tsx`
- Test: `tests/integration/popup.test.tsx`

**Interfaces:**
- Existing `Recipe` and `ConfigurationV1` storage formats remain unchanged.
- Editing calls `startRecipeCapture(recipe.id)` and initializes the advanced
  on-page builder from the saved recipe.

- [ ] **Step 1: Add compatibility tests for an existing stored recipe**

Load an existing version-1 recipe, open it from the popup, assert the picker
receives its selector, fields, traversal, schedule, destinations, and project,
then save without changing its ID or creation date.

- [ ] **Step 2: Run the compatibility test**

Run: `npm test -- tests/integration/popup.test.tsx tests/integration/picker.test.tsx`

Expected: FAIL until the edit message loads the saved recipe into the staged
builder.

- [ ] **Step 3: Wire recipe editing through the background**

When `recipeId` is present, load the saved recipe, confirm its origin matches
the active page, ensure the content script, and send the full recipe with
`SCRAPEYY_START_RECIPE_PICKER`.

- [ ] **Step 4: Delete the standalone dashboard surface**

Remove the dashboard entrypoint, components, CSS, tests, all
`dashboard.html` URL creation, and every Open Dashboard label. Confirm no
manifest-generated dashboard asset remains after a clean build.

- [ ] **Step 5: Run the full test suite and strict typecheck**

Run: `npm test && npm run typecheck`

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit dashboard removal**

```bash
git add entrypoints src tests
git commit -m "refactor: remove standalone dashboard"
```

---

### Task 7: Documentation, Production Builds, and Browser Acceptance

**Files:**
- Modify: `README.md`
- Modify: `docs/ACCEPTANCE.md`

**Interfaces:**
- Chrome package: `.output/scrapeyy-0.1.0-chrome.zip`
- Firefox package: `.output/scrapeyy-0.1.0-firefox.zip`
- Source package: `.output/scrapeyy-0.1.0-sources.zip`

- [ ] **Step 1: Update user documentation**

Document popup-only management, Quick Capture's click → mode → Capture flow,
smart extraction behavior, Create Recipe stages, local storage, permissions,
manual export, scheduling constraints, and temporary extension loading for
Chrome and Firefox.

- [ ] **Step 2: Update the exact acceptance checklist**

Replace dashboard checks with popup checks. Add direct-link click suppression,
table/list/generic smart extraction, Data/Design/Both, Create Recipe stages,
recipe compatibility, and confirmation that no dashboard entrypoint ships.

- [ ] **Step 3: Run the complete release gate**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run build:firefox
npm run zip
npm run zip:firefox
npm audit --omit=dev
git diff --check
```

Expected: zero test failures, typecheck/build/zip exit 0, zero production
vulnerabilities, and no whitespace errors.

- [ ] **Step 4: Inspect built manifests and archives**

Run:

```bash
node -e 'const fs=require("fs"); for (const p of [".output/chrome-mv3/manifest.json",".output/firefox-mv2/manifest.json"]) { const m=JSON.parse(fs.readFileSync(p)); if (JSON.stringify(m).includes("dashboard")) process.exit(1); }'
unzip -t .output/scrapeyy-0.1.0-chrome.zip
unzip -t .output/scrapeyy-0.1.0-firefox.zip
```

Expected: no dashboard asset references and both ZIP integrity checks report
no errors.

- [ ] **Step 5: Run interactive extension acceptance where connections exist**

For each available installed browser, load the unpacked production build and
exercise:

`popup Capture → Quick Capture → hover → direct click → Data → Capture → reopen popup → Inbox → export`

Repeat for Design and Both, then Create Recipe. Record exact browser/version,
DOM or accessibility evidence, screenshots, and any untestable item as
BLOCKED rather than PASS.

- [ ] **Step 6: Commit docs and acceptance evidence**

```bash
git add README.md docs/ACCEPTANCE.md
git commit -m "docs: update simplified capture acceptance"
```

- [ ] **Step 7: Verify the committed revision**

Run:

```bash
git status --short
git log --oneline -12
npm test
```

Expected: clean status, intended commits present, and the complete test suite
passes on the committed tree.
