import { useEffect, useMemo, useRef, useState } from "react";

import type {
  CaptureDestinations,
  CaptureMode,
  CaptureRecord,
  FieldDefinition,
  Project,
  QuickCaptureRequest,
  Recipe,
  Schedule,
  TraversalSettings,
} from "../../contracts/models";
import { extractRecords } from "../../extraction/extract";
import { fingerprintRecord } from "../../extraction/fingerprint";
import { sanitizeCapturedUrl } from "../../extraction/normalize";
import type { QuickDataset } from "../../extraction/quick-extract";
import {
  detectRecipeDatasets,
  extractSmartRecords,
} from "../../extraction/smart-extract";
import { rankSelectorCandidates } from "../../extraction/selectors";
import type { AppTheme } from "../../storage/app-settings";
import { advanceNextControl } from "../../traversal/next";
import type { AdvanceResult } from "../../traversal/types";
import {
  DEFAULT_TRAVERSAL_ITEMS,
  DEFAULT_TRAVERSAL_PAGES,
  traversalForExecution,
} from "../../traversal/settings";
import { FieldEditor } from "./FieldEditor";
import { QuickCaptureCard } from "./QuickCaptureCard";
import { CaptureOptions } from "../shared/CaptureOptions";
import { SmartFieldEditor } from "./SmartFieldEditor";
import {
  blockSelectionEvent,
  shouldIgnorePickerTarget,
} from "./selection-state";
import { useElementPicker } from "./useElementPicker";

export type PickerCapture = Recipe;
export type { QuickCaptureRequest } from "../../contracts/models";

export interface PickerAppProps {
  ownerDocument: Document;
  variant?: "quick" | "recipe";
  projectId: string;
  projectName: string;
  projects?: Project[];
  initialRecipe?: Recipe | undefined;
  initialCaptureMode?: CaptureMode;
  onCaptureModeChange?(mode: CaptureMode): void;
  theme?: AppTheme;
  onQuickCapture?(capture: QuickCaptureRequest): void | Promise<void>;
  onSaveRecipe?(recipe: Recipe): void | Promise<void>;
  onTestNext?(recipe: Recipe): Promise<AdvanceResult>;
  onMinimize?(): void;
  onClose?(): void;
  initialStep?: number;
  initialNextVerified?: boolean;
  initialNotice?: string;
  resumedDraft?: boolean;
}

const steps = ["Data", "Traversal", "Test & Save"] as const;
interface NextControlSelection {
  selector: string;
  matchIndex: number;
  matchCount: number;
}

function describeElement(element: Element): string {
  const tag = element.tagName.toLowerCase();
  const label =
    element.getAttribute("aria-label") ??
    element.getAttribute("alt") ??
    element.id ??
    [...element.classList][0] ??
    "";
  return label ? `${tag} · ${label}` : tag;
}

function pageIdentity(ownerDocument: Document): {
  origin: string;
  startUrl: string;
  hostname: string;
} {
  const startUrl = sanitizeCapturedUrl(
    ownerDocument.location?.href || "https://example.com/",
  );
  try {
    const url = new URL(startUrl);
    return { startUrl, origin: url.origin, hostname: url.hostname };
  } catch {
    return {
      startUrl: "https://example.com/",
      origin: "https://example.com",
      hostname: "example.com",
    };
  }
}

function createDraft(ownerDocument: Document, projectId: string): Recipe {
  const now = new Date().toISOString();
  const page = pageIdentity(ownerDocument);
  return {
    version: 1,
    id: crypto.randomUUID(),
    projectId,
    name: `${page.hostname.replace(/^app\./, "")} capture`,
    origin: page.origin,
    startUrl: page.startUrl,
    mode: "data",
    containerSelector: "",
    extraction: { kind: "smart", datasetKey: "" },
    fields: [],
    traversal: {
      kind: "none",
      maxPages: 1,
      maxItems: DEFAULT_TRAVERSAL_ITEMS,
      delayMs: 750,
      timeoutMs: 10_000,
    },
    destinations: { inbox: true, autoDownload: false },
    schedule: null,
    createdAt: now,
    updatedAt: now,
  };
}

function traversalKind(
  traversal: TraversalSettings,
): "none" | "next" | "infinite" {
  return traversal.kind;
}

function smartFields(dataset: QuickDataset): FieldDefinition[] {
  return dataset.fields.map((field) => ({
    ...field,
    sourceId: field.id,
    selector: ":scope",
  }));
}

function describeNextControl(
  control: Element,
  ownerDocument: Document,
): NextControlSelection {
  const candidate = rankSelectorCandidates(control, ownerDocument)[0];
  const selector = candidate?.selector ?? control.tagName.toLowerCase();
  const matches = [...ownerDocument.querySelectorAll(selector)];
  return {
    selector,
    matchIndex: Math.max(0, matches.indexOf(control)),
    matchCount: matches.length,
  };
}

function selectorMatchCount(ownerDocument: Document, selector: string): number {
  try {
    return selector ? ownerDocument.querySelectorAll(selector).length : 0;
  } catch {
    return 0;
  }
}

function suggestNextControl(ownerDocument: Document): NextControlSelection {
  const direct = [...ownerDocument.querySelectorAll(
    'a[rel="next"], button[aria-label*="next" i], a[aria-label*="next" i], [role="button"][aria-label*="next" i]',
  )].find((element) => !shouldIgnorePickerTarget(element));
  const textMatch = [...ownerDocument.querySelectorAll("button, a[href], [role='button']")]
    .find((element) =>
      !shouldIgnorePickerTarget(element) &&
      /^(?:next|more|load more|›|→)$/i.test(element.textContent?.trim() ?? ""),
    );
  const control = direct ?? textMatch;
  return control
    ? describeNextControl(control, ownerDocument)
    : { selector: "", matchIndex: 0, matchCount: 0 };
}

function DataPreview({
  fields,
  records,
  empty = "No matching data yet.",
}: {
  fields: FieldDefinition[];
  records: CaptureRecord[];
  empty?: string;
}) {
  if (records.length === 0 || fields.length === 0) {
    return <p className="empty-preview">{empty}</p>;
  }
  return (
    <div className="preview-table-wrap">
      <table>
        <thead>
          <tr>{fields.map((field) => <th key={field.id}>{field.name}</th>)}</tr>
        </thead>
        <tbody>
          {records.slice(0, 4).map((record, index) => (
            <tr key={index}>
              {fields.map((field) => <td key={field.id}>{record[field.id] ?? "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PickerApp({
  ownerDocument,
  variant = "recipe",
  projectId,
  projectName,
  projects = [],
  initialRecipe,
  initialCaptureMode = "both",
  onCaptureModeChange,
  theme = "dark",
  onQuickCapture,
  onSaveRecipe,
  onTestNext,
  onMinimize,
  onClose,
  initialStep = 0,
  initialNextVerified = false,
  initialNotice,
  resumedDraft = false,
}: PickerAppProps) {
  const effectiveProjectId = initialRecipe?.projectId ?? projectId;
  const originalCursor = useRef(ownerDocument.documentElement.style.cursor);
  const initialElement = initialRecipe
    ? (ownerDocument.querySelector(initialRecipe.containerSelector) ?? undefined)
    : undefined;
  const picker = useElementPicker(ownerDocument, onClose, initialElement);
  const initializedSmartFields = useRef(Boolean(initialRecipe));
  const [draftBase] = useState<Recipe>(
    () => initialRecipe ?? createDraft(ownerDocument, effectiveProjectId),
  );
  const draftTraversal = useRef(
    traversalForExecution(draftBase.traversal),
  ).current;
  const [smart, setSmart] = useState(
    !initialRecipe || initialRecipe.extraction?.kind === "smart",
  );
  const [step, setStep] = useState(initialStep);
  const [mode, setMode] = useState<CaptureMode>(initialRecipe?.mode ?? initialCaptureMode);
  const changeMode = (next: CaptureMode) => {
    setMode(next);
    onCaptureModeChange?.(next);
  };
  const [name, setName] = useState(draftBase.name);
  const [selectedProjectId, setSelectedProjectId] = useState(effectiveProjectId);
  const [fields, setFields] = useState<FieldDefinition[]>(draftBase.fields);
  const [datasetKey, setDatasetKey] = useState(
    draftBase.extraction?.kind === "smart" ? draftBase.extraction.datasetKey : "",
  );
  const suggestedNext = useRef(suggestNextControl(ownerDocument)).current;
  const [pagination, setPagination] = useState(traversalKind(draftTraversal));
  const [nextSelector, setNextSelector] = useState(
    draftTraversal.kind === "next"
      ? draftTraversal.nextSelector
      : suggestedNext.selector,
  );
  const [nextMatchIndex, setNextMatchIndex] = useState(
    draftTraversal.kind === "next"
      ? (draftTraversal.nextMatchIndex ?? 0)
      : suggestedNext.matchIndex,
  );
  const [maxPages, setMaxPages] = useState(draftTraversal.maxPages);
  const [maxItems, setMaxItems] = useState(draftTraversal.maxItems);
  const [schedule, setSchedule] = useState<Schedule | null>(draftBase.schedule);
  const [destinations, setDestinations] = useState<CaptureDestinations>(
    draftBase.destinations,
  );
  const [manualRunInWorkerTab, setManualRunInWorkerTab] = useState(
    draftBase.manualRunInWorkerTab ?? false,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(initialNotice);
  const [testRecords, setTestRecords] = useState<CaptureRecord[]>();
  const [testError, setTestError] = useState<string>();
  const [testSignature, setTestSignature] = useState<string>();
  const [selectingNext, setSelectingNext] = useState(false);
  const [nextHovered, setNextHovered] = useState<Element>();
  const [nextTestState, setNextTestState] = useState<
    "idle" | "testing" | "passed" | "failed"
  >(initialNextVerified ? "passed" : "idle");
  const [nextTestMessage, setNextTestMessage] = useState<string | undefined>(
    initialNextVerified
      ? "Test passed — the button loaded the next page of data."
      : undefined,
  );

  const testNextControl = async (
    selection: NextControlSelection = {
      selector: nextSelector,
      matchIndex: nextMatchIndex,
      matchCount: selectorMatchCount(ownerDocument, nextSelector),
    },
  ) => {
    if (!selection.selector || selection.matchIndex >= selection.matchCount) {
      setNextTestState("failed");
      setNextTestMessage("That selector does not identify the chosen button anymore.");
      return;
    }
    setNextTestState("testing");
    setNextTestMessage("Clicking the chosen button and waiting for the selected data to change…");
    const selectedDataSelector = picker.selected
      ? (rankSelectorCandidates(picker.selected, ownerDocument)[0]?.selector ??
        picker.selected.tagName.toLowerCase())
      : undefined;
    const readTestRecords = () => {
      if (!selectedDataSelector) return [];
      return smart
        ? extractSmartRecords(
            ownerDocument,
            selectedDataSelector,
            datasetKey,
            fields,
            ownerDocument.location?.href,
          ).records
        : extractRecords(ownerDocument, selectedDataSelector, fields);
    };
    const beforeKeys = new Set(
      readTestRecords().map((record) => fingerprintRecord(record, fields)),
    );
    const testRecipe: Recipe = {
      ...recipe,
      traversal: {
        kind: "next",
        nextSelector: selection.selector,
        nextMatchIndex: selection.matchIndex,
        maxPages,
        maxItems,
        delayMs: 750,
        timeoutMs: 10_000,
      },
    };
    const result = onTestNext
      ? await onTestNext(testRecipe)
      : await advanceNextControl(
          ownerDocument,
          selection.selector,
          6_000,
          {
            matchIndex: selection.matchIndex,
            readySignature: () => {
              const keys = readTestRecords().map((record) =>
                fingerprintRecord(record, fields),
              );
              return keys.some((key) => !beforeKeys.has(key))
                ? JSON.stringify(keys)
                : undefined;
            },
            settleMs: 300,
          },
        );
    if (result === "advanced") {
      setNextTestState("passed");
      setNextTestMessage("Test passed — the button loaded the next page of data.");
      return;
    }
    setNextTestState("failed");
    setNextTestMessage(
      result === "missing"
        ? "The chosen button could not be found after selection."
        : result === "disabled" || result === "complete"
          ? "The chosen button is disabled or did not load another page."
          : "The button was clicked, but the selected data did not change within 6 seconds.",
    );
  };

  useEffect(() => {
    ownerDocument.documentElement.style.cursor =
      picker.phase === "selecting" || selectingNext
        ? "crosshair"
        : originalCursor.current;
    return () => {
      ownerDocument.documentElement.style.cursor = originalCursor.current;
    };
  }, [ownerDocument, picker.phase, selectingNext]);

  useEffect(() => {
    if (!selectingNext) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!shouldIgnorePickerTarget(event.target)) blockSelectionEvent(event);
    };
    const onPointerMove = (event: PointerEvent) => {
      setNextHovered(
        shouldIgnorePickerTarget(event.target)
          ? undefined
          : (event.target as Element),
      );
    };
    const onClick = (event: MouseEvent) => {
      if (shouldIgnorePickerTarget(event.target)) return;
      blockSelectionEvent(event);
      const target = event.target as Element;
      const control = target.closest(
        "button, a[href], [role='button'], input[type='button'], input[type='submit']",
      ) ?? target;
      const selection = describeNextControl(control, ownerDocument);
      setNextSelector(selection.selector);
      setNextMatchIndex(selection.matchIndex);
      setSelectingNext(false);
      setNextHovered(undefined);
      setTestSignature(undefined);
      setNotice(undefined);
      // Let React remove the page-selection capture listener before issuing
      // the real test click, otherwise that listener would block the site.
      ownerDocument.defaultView?.setTimeout(
        () => void testNextControl(selection),
        0,
      );
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      blockSelectionEvent(event);
      setSelectingNext(false);
      setNextHovered(undefined);
    };
    ownerDocument.addEventListener("pointerdown", onPointerDown, true);
    ownerDocument.addEventListener("pointermove", onPointerMove, true);
    ownerDocument.addEventListener("click", onClick, true);
    ownerDocument.addEventListener("keydown", onKeyDown, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", onPointerDown, true);
      ownerDocument.removeEventListener("pointermove", onPointerMove, true);
      ownerDocument.removeEventListener("click", onClick, true);
      ownerDocument.removeEventListener("keydown", onKeyDown, true);
    };
  }, [ownerDocument, selectingNext]);

  const selector = useMemo(
    () =>
      picker.selected
        ? (rankSelectorCandidates(picker.selected, ownerDocument)[0]?.selector ??
          picker.selected.tagName.toLowerCase())
        : "",
    [ownerDocument, picker.selected],
  );
  const matches = selector ? ownerDocument.querySelectorAll(selector).length : 0;
  const datasets = useMemo(
    () => smart && selector
      ? detectRecipeDatasets(ownerDocument, selector, ownerDocument.location?.href)
      : [],
    [ownerDocument, selector, smart],
  );
  const requestedDataset = datasets.find((dataset) => dataset.key === datasetKey);
  const selectedDataset = requestedDataset ?? datasets[0];

  useEffect(() => {
    if (!smart || !selectedDataset) return;
    if (!requestedDataset || !initializedSmartFields.current) {
      setDatasetKey(selectedDataset.key);
      setFields(smartFields(selectedDataset));
      initializedSmartFields.current = true;
    }
  }, [requestedDataset, selectedDataset, smart]);

  const chooseDataset = (key: string) => {
    const dataset = datasets.find((candidate) => candidate.key === key);
    if (!dataset) return;
    setDatasetKey(key);
    setFields(smartFields(dataset));
    setTestRecords(undefined);
    setTestError(undefined);
  };
  const reselectRecipe = () => {
    setSmart(true);
    initializedSmartFields.current = false;
    setDatasetKey("");
    setFields([]);
    setTestRecords(undefined);
    setTestError(undefined);
    setStep(0);
    picker.reselect();
  };

  const preview = useMemo<CaptureRecord[]>(() => {
    if (!selector || !picker.selected) return [];
    if (smart) {
      return extractSmartRecords(
        ownerDocument,
        selector,
        selectedDataset?.key ?? datasetKey,
        fields,
        ownerDocument.location?.href,
      ).records.slice(0, 4);
    }
    return extractRecords(ownerDocument, selector, fields).slice(0, 4);
  }, [datasetKey, fields, ownerDocument, picker.selected, selectedDataset?.key, selector, smart]);

  const traversal: TraversalSettings =
    pagination === "next"
      ? {
          kind: "next",
          nextSelector,
          nextMatchIndex,
          maxPages,
          maxItems,
          delayMs: 750,
          timeoutMs: 10_000,
        }
      : pagination === "infinite"
        ? {
            kind: "infinite",
            scrollStepPx: 720,
            maxPages,
            maxItems,
            delayMs: 750,
            timeoutMs: 10_000,
          }
        : {
            kind: "none",
            maxPages: 1,
            maxItems,
            delayMs: 0,
            timeoutMs: 10_000,
          };
  const recipe: Recipe = {
    ...draftBase,
    projectId: selectedProjectId,
    name,
    mode,
    containerSelector: selector,
    ...(smart
      ? { extraction: { kind: "smart", datasetKey: selectedDataset?.key ?? datasetKey } }
      : {}),
    fields,
    traversal,
    destinations: { ...destinations, inbox: true },
    manualRunInWorkerTab,
    schedule,
    updatedAt: new Date().toISOString(),
  };
  const configurationSignature = JSON.stringify({
    selector,
    extraction: recipe.extraction,
    fields,
    traversal,
    mode,
  });
  const testIsCurrent = testSignature === configurationSignature;
  const canContinueFromData = Boolean(selector && fields.length > 0 && (!smart || selectedDataset));
  const nextMatchCount = selectorMatchCount(ownerDocument, nextSelector);
  const traversalIsValid =
    pagination !== "next" ||
    (Boolean(nextSelector.trim()) &&
      nextMatchIndex < nextMatchCount &&
      nextTestState === "passed");
  const canSave =
    canContinueFromData &&
    traversalIsValid &&
    name.trim().length > 0 &&
    testIsCurrent &&
    Boolean(testRecords?.length);
  const targetBounds =
    selectingNext
      ? nextHovered?.getBoundingClientRect()
      : picker.scope === "element"
      ? (picker.selected ?? picker.hovered)?.getBoundingClientRect()
      : undefined;

  const runQuickCapture = async (captureMode: CaptureMode) => {
    if (!selector || !onQuickCapture) return;
    setBusy(true);
    setNotice("Capturing selected content…");
    try {
      await onQuickCapture({
        projectId,
        mode: captureMode,
        containerSelector: selector,
        scope: picker.scope,
      });
      setNotice("Capture saved to the inbox.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Capture failed. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    if (!picker.selected || !selector || fields.length === 0) return;
    setBusy(true);
    setTestError(undefined);
    setTestRecords(undefined);
    try {
      await new Promise<void>((resolve) => ownerDocument.defaultView?.requestAnimationFrame(() => resolve()) ?? resolve());
      const records = smart
        ? extractSmartRecords(
            ownerDocument,
            selector,
            selectedDataset?.key ?? datasetKey,
            fields,
            ownerDocument.location?.href,
          ).records
        : extractRecords(ownerDocument, selector, fields);
      if (records.length === 0) {
        throw new Error("The current settings produced no records.");
      }
      setTestRecords(records);
      setTestSignature(configurationSignature);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Test failed.");
      setTestSignature(undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`picker-root picker-${picker.phase}`} data-scrapeyy-ui data-theme={theme}>
      {targetBounds && targetBounds.width > 0 ? (
        <div
          className="selection-highlight"
          aria-hidden="true"
          style={{
            left: targetBounds.left,
            top: targetBounds.top,
            width: targetBounds.width,
            height: targetBounds.height,
          }}
        />
      ) : null}
      {picker.dragRect ? (
        <div
          className="selection-marquee"
          aria-hidden="true"
          style={{
            left: picker.dragRect.left,
            top: picker.dragRect.top,
            width: picker.dragRect.width,
            height: picker.dragRect.height,
          }}
        />
      ) : null}

      {picker.phase === "selecting" ? (
        <div className="picker-instruction" role="status">
          <strong>{variant === "quick" ? "Quick Capture" : "Create Recipe"}</strong>
          <span>Click an element, drag a region, or use the full page</span>
          <button
            aria-label="Capture Full Page"
            className="instruction-button"
            onClick={picker.selectFullPage}
            type="button"
          >
            Full Page
          </button>
          <button className="text-button" onClick={onClose} type="button">Cancel</button>
        </div>
      ) : null}

      {selectingNext ? (
        <div className="picker-instruction" role="status">
          <strong>Select Next button</strong>
          <span>Click the page control that loads the next results</span>
          <button className="text-button" onClick={() => setSelectingNext(false)} type="button">Cancel</button>
        </div>
      ) : null}

      {notice ? <div className="picker-notice" role="status" aria-live="polite">{notice}</div> : null}

      {variant === "quick" && picker.selected ? (
        <QuickCaptureCard
          busy={busy}
          mode={mode}
          onModeChange={changeMode}
          description={picker.scope === "full-page" ? "Entire scrollable page" : describeElement(picker.selected)}
          onCancel={() => onClose?.()}
          onCapture={runQuickCapture}
          onReselect={picker.reselect}
        />
      ) : null}

      {variant === "recipe" && picker.selected && !selectingNext ? (
        <aside className="picker-panel recipe-builder" aria-label="Create Recipe">
          <header className="picker-panel-header">
            <div>
              <span className="picker-kicker">Smart recipe</span>
              <h1>{initialRecipe && !resumedDraft ? "Edit Recipe" : "Create Recipe"}</h1>
            </div>
            <div className="picker-window-actions">
              <button aria-label="Minimize Recipe Builder" className="header-action" onClick={onMinimize} type="button">Minimize</button>
              <button aria-label="Close Create Recipe" className="icon-button" onClick={onClose} type="button">×</button>
            </div>
          </header>

          <ol className="recipe-steps" aria-label="Recipe setup steps">
            {steps.map((label, index) => (
              <li className={index === step ? "is-active" : index < step ? "is-done" : ""} key={label}>
                <span>{index + 1}</span>{label}
              </li>
            ))}
          </ol>

          {step === 0 ? (
            <section className="recipe-step" aria-label="Detected data">
              <div className="selection-summary">
                <div>
                  <strong>{picker.scope === "full-page" ? "Entire page" : describeElement(picker.selected)}</strong>
                  <small>{matches} matching region{matches === 1 ? "" : "s"}</small>
                </div>
                <button className="button button-small" onClick={reselectRecipe} type="button">Reselect</button>
              </div>
              {smart ? (
                datasets.length > 0 && selectedDataset ? (
                  <>
                    <div className="detection-summary">
                      <div>
                        <span className="picker-kicker">Detected automatically</span>
                        <strong>{selectedDataset.records.length} records · {selectedDataset.fields.length} fields</strong>
                      </div>
                      <span>{datasets.length} dataset{datasets.length === 1 ? "" : "s"}</span>
                    </div>
                    <label className="form-field">
                      <span>Data to collect</span>
                      <select aria-label="Detected dataset" value={selectedDataset.key} onChange={(event) => chooseDataset(event.currentTarget.value)}>
                        {datasets.map((dataset) => (
                          <option value={dataset.key} key={dataset.key}>
                            {dataset.name} ({dataset.records.length})
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <h2>Choose fields</h2>
                      <p className="step-help">Turn fields on or off and rename them. No selectors required.</p>
                    </div>
                    <SmartFieldEditor
                      available={selectedDataset.fields}
                      enabled={fields}
                      records={selectedDataset.records}
                      onChange={setFields}
                    />
                  </>
                ) : (
                  <div className="picker-error">No readable dataset was detected. Try selecting a larger region or the full page.</div>
                )
              ) : (
                <>
                  <div className="legacy-recipe-note">
                    This older recipe uses CSS selectors. It remains editable and runnable; reselect the page to convert it to smart extraction.
                  </div>
                  <FieldEditor fields={fields} onChange={setFields} />
                </>
              )}
              <div className="preview-section">
                <h3>Live preview</h3>
                <DataPreview fields={fields} records={preview} />
              </div>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="recipe-step">
              <div>
                <h2>How many pages?</h2>
                <p className="step-help">Most dashboards only need the current page.</p>
              </div>
              <div className="traversal-choices" role="group" aria-label="Traversal mode">
                {([
                  ["none", "Current page", "Capture what is loaded now"],
                  ["next", "Next button", "Follow a pagination control"],
                  ["infinite", "Infinite scroll", "Load more while scrolling"],
                ] as const).map(([value, label, description]) => (
                  <button
                    aria-pressed={pagination === value}
                    key={value}
                    onClick={() => {
                      setPagination(value);
                      if (value !== "next") {
                        setNextTestState("idle");
                        setNextTestMessage(undefined);
                      }
                      if (value === "next" && !nextSelector) {
                        const suggestion = suggestNextControl(ownerDocument);
                        setNextSelector(suggestion.selector);
                        setNextMatchIndex(suggestion.matchIndex);
                        setNextTestState("idle");
                        setNextTestMessage(undefined);
                      }
                      if (value !== "none" && maxPages <= 1) {
                        setMaxPages(DEFAULT_TRAVERSAL_PAGES);
                      }
                      if (value !== "none" && maxItems <= 500) {
                        setMaxItems(DEFAULT_TRAVERSAL_ITEMS);
                      }
                    }}
                    type="button"
                  >
                    <strong>{label}</strong><small>{description}</small>
                  </button>
                ))}
              </div>
              {pagination === "next" ? (
                <div className="next-control-setup">
                  {nextSelector ? (
                    <span className={nextTestState === "passed" ? "test-success" : "test-stale"}>
                      {nextTestState === "passed"
                        ? "Next control verified"
                        : "Next control found · test required"}
                      {nextMatchCount > 1
                        ? ` · match ${nextMatchIndex + 1} of ${nextMatchCount}`
                        : ""}
                    </span>
                  ) : (
                    <span className="picker-error">No next button was detected.</span>
                  )}
                  <button className="button button-primary" onClick={() => setSelectingNext(true)} type="button">
                    {nextSelector ? "Choose a different button" : "Choose Next button on page"}
                  </button>
                  {nextSelector ? (
                    <button
                      className="button"
                      disabled={nextTestState === "testing"}
                      onClick={() => void testNextControl()}
                      type="button"
                    >
                      {nextTestState === "testing" ? "Testing button…" : "Test Next button"}
                    </button>
                  ) : null}
                  {nextTestMessage ? (
                    <div
                      className={nextTestState === "passed" ? "test-success" : nextTestState === "failed" ? "picker-error" : "test-stale"}
                      role={nextTestState === "failed" ? "alert" : "status"}
                    >
                      {nextTestMessage}
                    </div>
                  ) : null}
                  <details>
                    <summary>Advanced selector</summary>
                    <label className="form-field">
                      <span>Next button selector</span>
                      <input
                        aria-label="Next button selector"
                        className="mono"
                        value={nextSelector}
                        onChange={(event) => {
                          setNextSelector(event.currentTarget.value);
                          setNextMatchIndex(0);
                          setNextTestState("idle");
                          setNextTestMessage(undefined);
                        }}
                      />
                    </label>
                  </details>
                </div>
              ) : null}
              <div className="limit-grid">
                {pagination !== "none" ? (
                  <label className="form-field">
                    <span>Maximum pages</span>
                    <input min="1" type="number" value={maxPages} onChange={(event) => setMaxPages(event.currentTarget.valueAsNumber)} />
                  </label>
                ) : null}
                <label className="form-field">
                  <span>Maximum records</span>
                  <input min="1" type="number" value={maxItems} onChange={(event) => setMaxItems(event.currentTarget.valueAsNumber)} />
                </label>
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="recipe-step test-save-step">
              <label className="form-field">
                <span>Recipe name</span>
                <input aria-label="Recipe name" required value={name} onChange={(event) => setName(event.currentTarget.value)} />
              </label>
              <label className="form-field">
                <span>Project</span>
                <select aria-label="Project" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.currentTarget.value)}>
                  {(projects.length > 0 ? projects : [{ id: effectiveProjectId, name: projectName }]).map((project) => (
                    <option value={project.id} key={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>
              <div>
                <h2>Capture options</h2>
                <CaptureOptions mode={mode} onChange={changeMode} disabled={busy} />
              </div>
              <details className="optional-settings">
                <summary>Automation and downloads</summary>
                <div className="optional-settings-body">
                  <label className="check-line">
                    <input
                      aria-label="Enable schedule"
                      checked={Boolean(schedule?.enabled)}
                      type="checkbox"
                      onChange={(event) => setSchedule(event.currentTarget.checked ? { enabled: true, cadence: "interval", intervalMinutes: 60 } : null)}
                    />
                    Run automatically
                  </label>
                  {schedule?.enabled ? (
                    <div className="limit-grid">
                      <label className="form-field">
                        <span>Cadence</span>
                        <select value={schedule.cadence} onChange={(event) => setSchedule(event.currentTarget.value === "daily" ? { enabled: true, cadence: "daily", localTime: "09:00" } : { enabled: true, cadence: "interval", intervalMinutes: 60 })}>
                          <option value="interval">Interval</option>
                          <option value="daily">Daily</option>
                        </select>
                      </label>
                      {schedule.cadence === "daily" ? (
                        <label className="form-field">
                          <span>Local time</span>
                          <input type="time" value={schedule.localTime ?? "09:00"} onChange={(event) => setSchedule({ ...schedule, localTime: event.currentTarget.value })} />
                        </label>
                      ) : (
                        <label className="form-field">
                          <span>Minutes</span>
                          <input min="5" type="number" value={schedule.intervalMinutes ?? 60} onChange={(event) => setSchedule({ ...schedule, intervalMinutes: event.currentTarget.valueAsNumber })} />
                        </label>
                      )}
                    </div>
                  ) : null}
                  {schedule?.enabled ? <p className="step-help">Scheduled runs require persistent website access in Settings.</p> : null}
                  <label className="check-line">
                    <input
                      aria-label="Run manual captures in a background tab"
                      checked={manualRunInWorkerTab}
                      type="checkbox"
                      onChange={(event) => setManualRunInWorkerTab(event.currentTarget.checked)}
                    />
                    Run manual captures in a background tab
                  </label>
                  <p className="step-help">
                    Opens a temporary inactive tab for the scrape and closes it afterward, leaving your current tab free. Requires persistent website access.
                  </p>
                  <label className="check-line">
                    <input
                      aria-label="Download after each run"
                      checked={destinations.autoDownload}
                      type="checkbox"
                      onChange={(event) => setDestinations({ inbox: true, autoDownload: event.currentTarget.checked })}
                    />
                    Download after each run
                  </label>
                  <p className="step-help">Every run is kept in the Capture Inbox.</p>
                </div>
              </details>
              <div className="test-run-panel">
                <div>
                  <h2>Test on this page</h2>
                  <p className="step-help">Uses the live page and current fields. Pagination runs after the recipe is saved.</p>
                </div>
                <button className="button button-primary" disabled={busy || !canContinueFromData || !traversalIsValid} onClick={() => void runTest()} type="button">
                  {busy ? "Testing…" : testIsCurrent ? "Run test again" : "Run test"}
                </button>
                {testError ? <div className="picker-error" role="alert">{testError}</div> : null}
                {testRecords && testIsCurrent ? (
                  <div className="test-result">
                    <strong className="test-success">Test passed · {testRecords.length} records found</strong>
                    <DataPreview fields={fields} records={testRecords} />
                  </div>
                ) : testRecords ? (
                  <p className="test-stale">Settings changed. Run the test again before saving.</p>
                ) : null}
              </div>
            </section>
          ) : null}

          <footer className="picker-actions recipe-navigation">
            <button className="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))} type="button">Back</button>
            {step < steps.length - 1 ? (
              <button
                className="button button-primary"
                disabled={(step === 0 && !canContinueFromData) || (step === 1 && !traversalIsValid)}
                onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
                type="button"
              >
                Next
              </button>
            ) : (
              <button className="button button-primary" disabled={!canSave || busy} onClick={() => void onSaveRecipe?.(recipe)} type="button">Save recipe</button>
            )}
          </footer>
        </aside>
      ) : null}
    </div>
  );
}
