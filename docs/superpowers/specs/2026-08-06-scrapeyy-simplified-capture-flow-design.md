# Scrapeyy Simplified Capture Flow Design

**Date:** 2026-08-06  
**Status:** Approved interaction design

## Objective

Replace Scrapeyy's separate dashboard and complex picker with a popup-first
product and a direct page-selection flow.

Quick Capture must be fast:

1. Press **Quick Capture** in the extension popup.
2. Hover to preview a region.
3. Click the region directly.
4. Choose **Data**, **Design**, or **Both**.
5. Press **Capture**.

Advanced extraction, traversal, scheduling, and destination controls appear
only when the user chooses **Create Recipe**.

## Problems Being Corrected

The current picker listens for hover but has no direct page-click selection
handler. It requires the user to preserve a hovered target while moving to a
separate HUD and pressing **Select element**. That interaction is indirect and
does not match the expected point-and-click behavior.

The current Quick Capture panel also exposes recipe-only concepts before a
selection is complete: shape, fields, pagination, safety limits, preview, and
project settings. This makes the simple path feel like an advanced
configuration workflow.

Finally, projects, recipes, inbox runs, permissions, and settings are split
between the extension popup and a full dashboard page. The revised product
keeps those management surfaces inside the extension popup.

## Product Surfaces

### Extension Popup

The popup is the complete management surface. It uses compact tabs or views:

- **Capture:** current-site identity and access, Quick Capture, Create Recipe,
  and the most relevant saved recipe actions.
- **Recipes:** project grouping, saved recipes, run, edit, and schedule state.
- **Inbox:** recent runs, status, preview, retry, pin, delete, and export.
- **Settings:** website permissions, retention, and configuration import and
  export.

There is no **Open Dashboard** action and no standalone dashboard entrypoint.
The popup remains usable within normal Chrome and Firefox extension-popup
dimensions by using one primary view at a time and vertical scrolling.

Closing and reopening the popup returns to the most recently used management
view when practical. Capture actions that move onto the page intentionally
close the popup.

### On-Page Selection Layer

The content script provides two related modes:

- **Quick mode:** direct selection followed by a compact mode-confirmation
  card.
- **Recipe mode:** the same direct selection followed by an advanced recipe
  setup flow.

Both modes share one selection engine and one visual language.

## Direct Selection Interaction

When selection starts:

- The pointer changes to a crosshair.
- A small instruction bar says **Click content to select · Esc to cancel**.
- Pointer movement highlights the candidate element under the pointer.
- Scrapeyy UI and its shadow-root host are never selectable.
- Pressing Escape removes all Scrapeyy selection UI and listeners.

When the user clicks a candidate:

- Scrapeyy captures the click during the capture phase and prevents the
  underlying page action, navigation, submission, or other click handler.
- The clicked element becomes the stable selection.
- The highlight remains fixed on that element.
- Pointer tracking pauses until the user captures, cancels, or chooses
  **Reselect**.
- The page remains otherwise unchanged.

Selection does not require a separate HUD button. The old **Select element**
and **Parent** HUD is removed. A compact **Reselect** action is available after
selection. The selector engine may still choose a stable selector internally,
but selectors are not shown during Quick Capture.

## Quick Capture

After a direct selection, a compact card appears near the selection when space
allows and falls back to a viewport edge when necessary. It contains:

- A short description of the selected element.
- A three-way choice: **Data**, **Design**, or **Both**.
- **Capture** as the primary action.
- **Reselect** and **Cancel** as secondary actions.

No project, fields, pagination, traversal, schedule, or safety-limit controls
appear in Quick Capture.

After Capture:

- The selected content is processed locally.
- A run is stored in the Capture Inbox.
- Quick Capture does not automatically download a ZIP; the user may export the
  stored run from the popup Inbox.
- A small success or failure notice appears on the page and then dismisses.
- The selection UI is removed.

Quick Capture uses a generated internal recipe/run identity so existing
storage, retention, export, and inbox contracts remain usable without asking
the user to name or configure a recipe.

## Smart Data Extraction

Quick Capture Data is automatic and structure-aware.

### Tables

For a selected table:

- Header cells become field names.
- Body rows become records.
- Missing cells are represented as empty values.
- Links and images within cells include their resolved source URLs alongside
  visible labels when available.

### Lists and Repeated Content

For a selected list or region containing repeated sibling cards:

- Scrapeyy detects the repeated child structure.
- Common headings, labels, links, images, and concise text blocks become
  inferred fields.
- Each repeated child becomes one record.
- Field names are derived from semantic roles or stable, human-readable
  fallbacks.

### Generic Regions

When a reliable tabular or repeated structure is not present, Scrapeyy creates
one record containing:

- normalized visible text,
- contained links with label and resolved URL,
- contained images with alternative text and resolved source URL,
- the source page URL, and
- a short element descriptor.

Quick extraction favors predictable output over aggressive inference. If
structure detection is uncertain, it uses the generic-region fallback rather
than inventing unreliable columns.

## Design Capture

Design mode keeps the existing capture-only security boundary:

- sanitized selected HTML,
- relevant computed and authored styles,
- an asset inventory,
- and a screenshot when browser support and visibility allow it.

Scripts, inline event handlers, credentials, hidden tokens, cookies, storage
values, and executable page behavior are not captured.

**Both** combines the smart data result and sanitized design bundle in one run.

## Create Recipe

The Capture view exposes **Create Recipe** separately from Quick Capture.
Recipe creation begins with the same direct-click selection interaction.

After selection, Scrapeyy opens a staged advanced setup:

1. **Selection:** selected region, stable selector, match count, and reselect.
2. **Data:** inferred fields with rename, type, identity, add, and remove
   controls.
3. **Traversal:** current page, Next control, or bounded infinite scroll.
4. **Delivery:** project, recipe name, Data/Design/Both, inbox, automatic
   download, schedule, and safety limits.
5. **Review:** concise preview and Save Recipe.

The advanced panel may use more page space because the user explicitly chose
recipe creation. It must still preserve the direct selection and must not
require returning to a full dashboard page.

Saved recipes are managed and run from the popup's Recipes view. Editing a
recipe opens the same staged setup with its current values.

## State and Messaging

The popup starts either selection mode through the background script using the
active tab ID. The background ensures the content script is present before
sending the start message.

The content script owns transient selection state:

- idle,
- hovering,
- selected,
- processing,
- success or failure,
- closed.

It sends a completed Quick Capture or recipe definition to the background.
The background remains responsible for:

- storage and retention,
- manual and scheduled recipe runs,
- permission checks,
- export creation and downloads,
- alarm synchronization,
- and disabling schedules when origin access is revoked.

The popup loads projects, recipes, runs, and permission state through a shared
service layer rather than depending on a dashboard React tree.

## Error Handling

- Unsupported browser pages disable capture in the popup.
- Failure to inject the content script produces a clear popup error.
- If the selected element disappears before processing, the page notice asks
  the user to reselect.
- A page click is blocked only while selection is armed and only for the
  selection click.
- Extraction failure creates a failed inbox run with a recoverable message.
- Partial smart extraction creates a partial run and retains usable records.
- Download failure never discards the inbox copy.
- Permission revocation continues to disable affected schedules.

## Accessibility

- All popup views and on-page actions are keyboard reachable.
- Escape always cancels on-page selection.
- Enter or Space selects the current keyboard-focused candidate when keyboard
  selection is active.
- Mode choices expose pressed or selected state.
- Instructions and result notices use live regions without stealing focus.
- Highlights are not conveyed by color alone.
- The confirmation card remains inside the viewport at supported zoom levels.

## Removal and Migration

- Remove the standalone dashboard entrypoint and dashboard-open action.
- Reuse or refactor its project, recipe, inbox, settings, and service logic
  into popup-sized views.
- Remove the existing Quick Capture fields, pagination, limits, and preview
  panel.
- Remove the hover-plus-HUD selection contract.
- Preserve existing stored projects, recipes, runs, configuration version,
  retention behavior, and export formats.
- Existing recipes remain editable and runnable after the popup migration.

## Verification

### Automated

- Direct page click selects the candidate and prevents the underlying click.
- Scrapeyy UI cannot become the selected target.
- Escape, Cancel, and Reselect remove or restore listeners correctly.
- Quick Capture does not expose recipe-only settings.
- Data, Design, and Both produce the expected run payloads.
- Smart extraction covers tables, repeated cards/lists, and generic fallback.
- Popup tabs expose recipes, projects, inbox, and settings without a dashboard
  dependency.
- Existing recipe, traversal, scheduling, storage, retention, permission, and
  deterministic export tests remain green.
- Chrome Manifest V3 and Firefox Manifest V2 production builds and ZIPs pass.

### Interactive Browser Acceptance

In both Chrome and Firefox:

1. Open a normal website and press Quick Capture.
2. Hover several page regions and confirm the highlight follows.
3. Click a link or button region and confirm the page action does not fire.
4. Select Data, Design, and Both in separate runs.
5. Confirm each run appears in the popup Inbox and exports correctly.
6. Start Create Recipe and complete selection, fields, traversal, delivery, and
   review.
7. Close and reopen the popup and manage the saved recipe without a dashboard.
8. Validate Escape, Reselect, unsupported pages, missing permission, selector
   change, authentication-required, and download-failure states.

## Acceptance Boundary

The revision is complete when the standalone dashboard is absent, the popup
contains all management functions, Quick Capture is a direct-click two-stage
flow, smart extraction produces safe useful output without field setup, Create
Recipe owns every advanced option, and the automated and available interactive
browser checks pass with exact browser-specific evidence recorded.
