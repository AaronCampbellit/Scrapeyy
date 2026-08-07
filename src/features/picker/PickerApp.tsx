import { useEffect, useMemo, useRef, useState } from "react";

import type {
  CaptureMode,
  CaptureRecord,
  CaptureDestinations,
  FieldDefinition,
  QuickCaptureRequest,
  Recipe,
  Schedule,
  TraversalSettings,
} from "../../contracts/models";
import { extractRecords } from "../../extraction/extract";
import { rankSelectorCandidates } from "../../extraction/selectors";
import { FieldEditor } from "./FieldEditor";
import { QuickCaptureCard } from "./QuickCaptureCard";
import { useElementPicker } from "./useElementPicker";

export type PickerCapture = Recipe;
export type { QuickCaptureRequest } from "../../contracts/models";

export interface PickerAppProps {
  ownerDocument: Document;
  variant?: "quick" | "recipe";
  projectId: string;
  projectName: string;
  initialRecipe?: Recipe | undefined;
  onQuickCapture?(capture: QuickCaptureRequest): void | Promise<void>;
  onSaveRecipe?(recipe: Recipe): void | Promise<void>;
  onClose?(): void;
}

const initialFields: FieldDefinition[] = [
  { id: "title", name: "Title", kind: "text", selector: "h2" },
  { id: "url", name: "URL", kind: "link", selector: "a", identity: true },
];

const steps = ["Selection", "Data", "Traversal", "Delivery", "Review"] as const;

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
} {
  const startUrl = ownerDocument.location?.href || "https://example.com/";
  try {
    return { startUrl, origin: new URL(startUrl).origin };
  } catch {
    return { startUrl: "https://example.com/", origin: "https://example.com" };
  }
}

function createDraft(
  ownerDocument: Document,
  projectId: string,
): Recipe {
  const now = new Date().toISOString();
  const page = pageIdentity(ownerDocument);
  return {
    version: 1,
    id: crypto.randomUUID(),
    projectId,
    name: "New recipe",
    origin: page.origin,
    startUrl: page.startUrl,
    mode: "both",
    containerSelector: "",
    fields: initialFields,
    traversal: {
      kind: "next",
      nextSelector: "button.next",
      maxPages: 5,
      maxItems: 250,
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

export function PickerApp({
  ownerDocument,
  variant = "recipe",
  projectId,
  projectName,
  initialRecipe,
  onQuickCapture,
  onSaveRecipe,
  onClose,
}: PickerAppProps) {
  const effectiveProjectId = initialRecipe?.projectId ?? projectId;
  const originalCursor = useRef(ownerDocument.documentElement.style.cursor);
  const initialElement = initialRecipe
    ? (ownerDocument.querySelector(initialRecipe.containerSelector) ?? undefined)
    : undefined;
  const picker = useElementPicker(ownerDocument, onClose, initialElement);
  useEffect(() => {
    ownerDocument.documentElement.style.cursor =
      picker.phase === "hovering" ? "crosshair" : originalCursor.current;
    return () => {
      ownerDocument.documentElement.style.cursor = originalCursor.current;
    };
  }, [ownerDocument, picker.phase]);
  const [draftBase] = useState<Recipe>(
    () => initialRecipe ?? createDraft(ownerDocument, effectiveProjectId),
  );
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<CaptureMode>(draftBase.mode);
  const [name, setName] = useState(draftBase.name);
  const [fields, setFields] = useState<FieldDefinition[]>(draftBase.fields);
  const [pagination, setPagination] = useState(traversalKind(draftBase.traversal));
  const [nextSelector, setNextSelector] = useState(
    draftBase.traversal.kind === "next"
      ? draftBase.traversal.nextSelector
      : "button.next",
  );
  const [maxPages, setMaxPages] = useState(draftBase.traversal.maxPages);
  const [maxItems, setMaxItems] = useState(draftBase.traversal.maxItems);
  const [schedule, setSchedule] = useState<Schedule | null>(draftBase.schedule);
  const [destinations, setDestinations] = useState<CaptureDestinations>(
    draftBase.destinations,
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const selector = useMemo(
    () =>
      picker.selected
        ? (rankSelectorCandidates(picker.selected, ownerDocument)[0]?.selector ??
          picker.selected.tagName.toLowerCase())
        : "",
    [ownerDocument, picker.selected],
  );
  const matches = selector
    ? ownerDocument.querySelectorAll(selector).length
    : 0;
  const preview = useMemo<CaptureRecord[]>(
    () =>
      selector
        ? extractRecords(ownerDocument, selector, fields).slice(0, 4)
        : [],
    [fields, ownerDocument, selector],
  );
  const traversal: TraversalSettings =
    pagination === "next"
      ? {
          kind: "next",
          nextSelector,
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
    projectId: effectiveProjectId,
    name,
    mode,
    containerSelector: selector,
    fields,
    traversal,
    destinations,
    schedule,
    updatedAt: new Date().toISOString(),
  };
  const target = picker.phase === "selected" ? picker.selected : picker.hovered;
  const targetBounds = target?.getBoundingClientRect();

  const runQuickCapture = async (captureMode: CaptureMode) => {
    if (!selector || !onQuickCapture) return;
    setBusy(true);
    setNotice("Capturing selected content…");
    try {
      await onQuickCapture({
        projectId,
                  mode: captureMode,
        containerSelector: selector,
      });
      setNotice("Capture saved to the inbox.");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Capture failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`picker-root picker-${picker.phase}`} data-scrapeyy-ui>
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

      {picker.phase === "hovering" ? (
        <div className="picker-instruction" role="status">
          <strong>{variant === "quick" ? "Quick Capture" : "Create Recipe"}</strong>
          <span>Click content to select · Esc to cancel</span>
          <button className="text-button" onClick={onClose} type="button">Cancel</button>
        </div>
      ) : null}

      {notice ? (
        <div className="picker-notice" role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}

      {variant === "quick" && picker.selected ? (
        <QuickCaptureCard
          busy={busy}
          description={describeElement(picker.selected)}
          onCancel={() => onClose?.()}
          onCapture={runQuickCapture}
          onReselect={picker.reselect}
        />
      ) : null}

      {variant === "recipe" && picker.selected ? (
        <aside className="picker-panel recipe-builder" aria-label="Create Recipe">
          <header className="picker-panel-header">
            <div>
              <span className="picker-kicker">Advanced capture</span>
              <h1>Create Recipe</h1>
            </div>
            <button
              aria-label="Close Create Recipe"
              className="icon-button"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </header>

          <ol className="recipe-steps" aria-label="Recipe setup steps">
            {steps.map((label, index) => (
              <li className={index === step ? "is-active" : index < step ? "is-done" : ""} key={label}>
                <span>{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>

          {step === 0 ? (
            <section className="recipe-step">
              <h2>Selection</h2>
              <div className="selection-summary">
                <div>
                  <code>{selector}</code>
                  <small>{matches} matches</small>
                </div>
                <button className="button button-small" onClick={picker.reselect} type="button">
                  Reselect
                </button>
              </div>
              <p className="step-help">
                This region becomes the repeatable container for the recipe.
              </p>
            </section>
          ) : null}

          {step === 1 ? (
            <section className="recipe-step">
              <h2>Fields</h2>
              <FieldEditor fields={fields} onChange={setFields} />
              <div className="preview-section">
                <h3>Preview</h3>
                {preview.length > 0 ? (
                  <div className="preview-table-wrap">
                    <table>
                      <thead>
                        <tr>{fields.map((field) => <th key={field.id}>{field.name}</th>)}</tr>
                      </thead>
                      <tbody>
                        {preview.map((record, index) => (
                          <tr key={`${selector}-${index}`}>
                            {fields.map((field) => <td key={field.id}>{record[field.id] ?? "—"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="empty-preview">No matching data yet.</p>
                )}
              </div>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="recipe-step">
              <h2>Pagination</h2>
              <label className="form-field">
                <span>Traversal mode</span>
                <select
                  aria-label="Pagination mode"
                  value={pagination}
                  onChange={(event) =>
                    setPagination(event.currentTarget.value as typeof pagination)
                  }
                >
                  <option value="none">Current page only</option>
                  <option value="next">Next button</option>
                  <option value="infinite">Infinite scroll</option>
                </select>
              </label>
              {pagination === "next" ? (
                <label className="form-field">
                  <span>Next button selector</span>
                  <input
                    aria-label="Next button selector"
                    className="mono"
                    value={nextSelector}
                    onChange={(event) => setNextSelector(event.currentTarget.value)}
                  />
                </label>
              ) : null}
              <p className="step-help">
                Traversal is bounded by the limits configured in Delivery.
              </p>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="recipe-step">
              <h2>Delivery</h2>
              <label className="form-field">
                <span>Recipe name</span>
                <input
                  aria-label="Recipe name"
                  required
                  value={name}
                  onChange={(event) => setName(event.currentTarget.value)}
                />
              </label>
              <label className="form-field">
                <span>Project</span>
                <select value={effectiveProjectId} disabled>
                  <option value={effectiveProjectId}>{projectName}</option>
                </select>
              </label>
              <div className="segmented" role="group" aria-label="Recipe capture type">
                {(["data", "design", "both"] as const).map((value) => (
                  <button
                    aria-pressed={mode === value}
                    key={value}
                    onClick={() => setMode(value)}
                    type="button"
                  >
                    {value[0]!.toUpperCase() + value.slice(1)}
                  </button>
                ))}
              </div>
              <div className="picker-section">
                <h2>Schedule</h2>
                <label className="check-line">
                  <input
                    aria-label="Enable schedule"
                    checked={Boolean(schedule?.enabled)}
                    type="checkbox"
                    onChange={(event) =>
                      setSchedule(
                        event.currentTarget.checked
                          ? {
                              enabled: true,
                              cadence: "interval",
                              intervalMinutes: 60,
                            }
                          : null,
                      )
                    }
                  />
                  Run automatically
                </label>
                {schedule?.enabled ? (
                  <div className="limit-grid">
                    <label className="form-field">
                      <span>Cadence</span>
                      <select
                        value={schedule.cadence}
                        onChange={(event) =>
                          setSchedule(
                            event.currentTarget.value === "daily"
                              ? { enabled: true, cadence: "daily", localTime: "09:00" }
                              : { enabled: true, cadence: "interval", intervalMinutes: 60 },
                          )
                        }
                      >
                        <option value="interval">Interval</option>
                        <option value="daily">Daily</option>
                      </select>
                    </label>
                    {schedule.cadence === "daily" ? (
                      <label className="form-field">
                        <span>Local time</span>
                        <input
                          type="time"
                          value={schedule.localTime ?? "09:00"}
                          onChange={(event) =>
                            setSchedule({ ...schedule, localTime: event.currentTarget.value })
                          }
                        />
                      </label>
                    ) : (
                      <label className="form-field">
                        <span>Minutes</span>
                        <input
                          min="5"
                          type="number"
                          value={schedule.intervalMinutes ?? 60}
                          onChange={(event) =>
                            setSchedule({
                              ...schedule,
                              intervalMinutes: event.currentTarget.valueAsNumber,
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="picker-section">
                <h2>Destinations</h2>
                <label className="check-line">
                  <input
                    aria-label="Keep in Capture Inbox"
                    checked={destinations.inbox}
                    type="checkbox"
                    onChange={(event) =>
                      setDestinations({ ...destinations, inbox: event.currentTarget.checked })
                    }
                  />
                  Keep in Capture Inbox
                </label>
                <label className="check-line">
                  <input
                    aria-label="Download after each run"
                    checked={destinations.autoDownload}
                    type="checkbox"
                    onChange={(event) =>
                      setDestinations({
                        ...destinations,
                        autoDownload: event.currentTarget.checked,
                      })
                    }
                  />
                  Download after each run
                </label>
              </div>
              <div className="picker-section">
                <h2>Safety limits</h2>
                <div className="limit-grid">
                  <label className="form-field">
                    <span>Max pages</span>
                    <input
                      min="1"
                      type="number"
                      value={maxPages}
                      onChange={(event) => setMaxPages(event.currentTarget.valueAsNumber)}
                    />
                  </label>
                  <label className="form-field">
                    <span>Max items</span>
                    <input
                      min="1"
                      type="number"
                      value={maxItems}
                      onChange={(event) => setMaxItems(event.currentTarget.valueAsNumber)}
                    />
                  </label>
                </div>
              </div>
            </section>
          ) : null}

          {step === 4 ? (
            <section className="recipe-step review-step">
              <h2>Review</h2>
              <dl>
                <div><dt>Name</dt><dd>{name}</dd></div>
                <div><dt>Matches</dt><dd>{matches}</dd></div>
                <div><dt>Fields</dt><dd>{fields.length}</dd></div>
                <div><dt>Mode</dt><dd>{mode}</dd></div>
                <div><dt>Traversal</dt><dd>{pagination}</dd></div>
                <div><dt>Schedule</dt><dd>{schedule?.enabled ? schedule.cadence : "Manual"}</dd></div>
              </dl>
            </section>
          ) : null}

          <footer className="picker-actions recipe-navigation">
            <button
              className="button"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              type="button"
            >
              Back
            </button>
            {step < steps.length - 1 ? (
              <button
                className="button button-primary"
                onClick={() => setStep((value) => Math.min(steps.length - 1, value + 1))}
                type="button"
              >
                Next
              </button>
            ) : (
              <button
                className="button button-primary"
                disabled={!selector || !name.trim() || fields.length === 0}
                onClick={() => void onSaveRecipe?.(recipe)}
                type="button"
              >
                Save recipe
              </button>
            )}
          </footer>
        </aside>
      ) : null}
    </div>
  );
}
