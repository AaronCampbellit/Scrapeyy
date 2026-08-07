import { useMemo, useState } from "react";

import type {
  CaptureMode,
  CaptureRecord,
  FieldDefinition,
  TraversalSettings,
} from "../../contracts/models";
import { extractRecords } from "../../extraction/extract";
import { rankSelectorCandidates } from "../../extraction/selectors";
import { FieldEditor } from "./FieldEditor";
import { QuickCaptureCard } from "./QuickCaptureCard";
import { useElementPicker } from "./useElementPicker";

export interface PickerCapture {
  projectId: string;
  mode: CaptureMode;
  containerSelector: string;
  fields: FieldDefinition[];
  traversal: TraversalSettings;
}

export interface QuickCaptureRequest {
  projectId: string;
  mode: CaptureMode;
  containerSelector: string;
}

export interface PickerAppProps {
  ownerDocument: Document;
  variant?: "quick" | "recipe";
  projectId: string;
  projectName: string;
  onCapture?(capture: PickerCapture): void | Promise<void>;
  onQuickCapture?(capture: QuickCaptureRequest): void | Promise<void>;
  onSaveRecipe?(capture: PickerCapture): void | Promise<void>;
  onClose?(): void;
}

const initialFields: FieldDefinition[] = [
  { id: "title", name: "Title", kind: "text", selector: "h2" },
  { id: "url", name: "URL", kind: "link", selector: "a", identity: true },
];

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

export function PickerApp({
  ownerDocument,
  variant = "recipe",
  projectId,
  projectName,
  onCapture,
  onQuickCapture,
  onSaveRecipe,
  onClose,
}: PickerAppProps) {
  const picker = useElementPicker(ownerDocument, onClose);
  const [mode, setMode] = useState<CaptureMode>("both");
  const [fields, setFields] = useState<FieldDefinition[]>(initialFields);
  const [pagination, setPagination] = useState<"none" | "next" | "infinite">(
    "next",
  );
  const [nextSelector, setNextSelector] = useState("button.next");
  const [maxPages, setMaxPages] = useState(5);
  const [maxItems, setMaxItems] = useState(250);
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
  const recipeCapture: PickerCapture = {
    projectId,
    mode,
    containerSelector: selector,
    fields,
    traversal,
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
    <div
      className={`picker-root picker-${picker.phase}`}
      data-scrapeyy-ui
    >
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
          <strong>
            {variant === "quick" ? "Quick Capture" : "Create Recipe"}
          </strong>
          <span>Click content to select · Esc to cancel</span>
          <button className="text-button" onClick={onClose} type="button">
            Cancel
          </button>
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

          <section className="selection-summary">
            <div>
              <span>Selection</span>
              <code>{selector}</code>
              <small>{matches} matches</small>
            </div>
            <button className="button button-small" onClick={picker.reselect} type="button">
              Reselect
            </button>
          </section>

          <label className="form-field">
            <span>Project</span>
            <select value={projectId} disabled>
              <option value={projectId}>{projectName}</option>
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

          <section className="picker-section">
            <h2>Fields</h2>
            <FieldEditor fields={fields} onChange={setFields} />
          </section>

          <section className="picker-section">
            <h2>Pagination</h2>
            <label className="form-field">
              <span className="sr-only">Pagination mode</span>
              <select
                aria-label="Pagination mode"
                value={pagination}
                onChange={(event) =>
                  setPagination(
                    event.currentTarget.value as
                      | "none"
                      | "next"
                      | "infinite",
                  )
                }
              >
                <option value="none">Current page only</option>
                <option value="next">Next button</option>
                <option value="infinite">Infinite scroll</option>
              </select>
            </label>
            {pagination === "next" ? (
              <input
                aria-label="Next button selector"
                className="mono"
                value={nextSelector}
                onChange={(event) => setNextSelector(event.currentTarget.value)}
              />
            ) : null}
          </section>

          <section className="picker-section">
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
          </section>

          <section className="picker-section preview-section">
            <h2>Preview</h2>
            {preview.length > 0 ? (
              <div className="preview-table-wrap">
                <table>
                  <thead>
                    <tr>
                      {fields.map((field) => (
                        <th key={field.id}>{field.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((record, index) => (
                      <tr key={`${selector}-${index}`}>
                        {fields.map((field) => (
                          <td key={field.id}>{record[field.id] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-preview">No matching data yet.</p>
            )}
          </section>

          <footer className="picker-actions">
            {onCapture ? (
              <button
                className="button"
                onClick={() => void onCapture(recipeCapture)}
                type="button"
              >
                Capture now
              </button>
            ) : null}
            <button
              className="button button-primary"
              disabled={!selector || fields.length === 0}
              onClick={() => void onSaveRecipe?.(recipeCapture)}
              type="button"
            >
              Save recipe
            </button>
          </footer>
        </aside>
      ) : null}
    </div>
  );
}
