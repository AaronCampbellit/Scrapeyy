import { useEffect, useMemo, useState } from "react";

import type {
  CaptureMode,
  CaptureRecord,
  FieldDefinition,
  TraversalSettings,
} from "../../contracts/models";
import { extractRecords } from "../../extraction/extract";
import { rankSelectorCandidates } from "../../extraction/selectors";
import { FieldEditor } from "./FieldEditor";
import { PickerHud } from "./PickerHud";
import { useElementPicker } from "./useElementPicker";

export interface PickerCapture {
  projectId: string;
  mode: CaptureMode;
  containerSelector: string;
  fields: FieldDefinition[];
  traversal: TraversalSettings;
}

interface PickerAppProps {
  ownerDocument: Document;
  projectId: string;
  projectName: string;
  onCapture?(capture: PickerCapture): void;
  onSaveRecipe?(capture: PickerCapture): void;
  onClose?(): void;
}

const initialFields: FieldDefinition[] = [
  { id: "title", name: "Title", kind: "text", selector: "h2" },
  { id: "url", name: "URL", kind: "link", selector: "a", identity: true },
];

export function PickerApp({
  ownerDocument,
  projectId,
  projectName,
  onCapture,
  onSaveRecipe,
  onClose,
}: PickerAppProps) {
  const picker = useElementPicker(ownerDocument);
  const [mode, setMode] = useState<CaptureMode>("both");
  const [shape, setShape] = useState<"single" | "repeated">("repeated");
  const [fields, setFields] = useState<FieldDefinition[]>(initialFields);
  const [pagination, setPagination] = useState<"none" | "next" | "infinite">(
    "next",
  );
  const [nextSelector, setNextSelector] = useState("button.next");
  const [maxPages, setMaxPages] = useState(5);
  const [maxItems, setMaxItems] = useState(250);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    ownerDocument.addEventListener("keydown", onKeyDown, true);
    return () => ownerDocument.removeEventListener("keydown", onKeyDown, true);
  }, [onClose, ownerDocument]);

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
  const capture: PickerCapture = {
    projectId,
    mode,
    containerSelector: selector,
    fields,
    traversal,
  };
  const target = picker.hovered ?? picker.selected;
  const targetBounds = target?.getBoundingClientRect();

  return (
    <div className="picker-root" data-scrapeyy-ui>
      {targetBounds && targetBounds.width > 0 ? (
        <div
          className="element-highlight"
          style={{
            left: targetBounds.left,
            top: targetBounds.top,
            width: targetBounds.width,
            height: targetBounds.height,
          }}
        />
      ) : null}
      <PickerHud
        canSelect={picker.hovered !== undefined}
        onCancel={() => onClose?.()}
        onParent={picker.selectParent}
        onSelect={picker.selectHovered}
      />
      <aside className="picker-panel" aria-label="Quick Capture">
        <header className="picker-panel-header">
          <h1>Quick Capture</h1>
          <button
            aria-label="Close Quick Capture"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <label className="form-field">
          <span>Project</span>
          <select value={projectId} disabled>
            <option value={projectId}>{projectName}</option>
          </select>
        </label>

        <div className="segmented" aria-label="Capture mode">
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
          <h2>Capture shape</h2>
          <div className="segmented">
            <button
              aria-pressed={shape === "single"}
              onClick={() => setShape("single")}
              type="button"
            >
              Single element
            </button>
            <button
              aria-pressed={shape === "repeated"}
              onClick={() => setShape("repeated")}
              type="button"
            >
              Repeated list
            </button>
          </div>
          <div className="selector-summary">
            <code>{selector || "Select a page element"}</code>
            <span>{matches} matches</span>
          </div>
        </section>

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
                    <tr key={JSON.stringify(record)}>
                      {fields.map((field) => (
                        <td key={field.id}>{record[field.id] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-preview">Select an element to preview results.</p>
          )}
        </section>

        <footer className="picker-actions">
          <button
            className="button button-primary"
            disabled={!selector || fields.length === 0}
            onClick={() => onCapture?.(capture)}
            type="button"
          >
            Capture now
          </button>
          <button
            className="button"
            disabled={!selector || fields.length === 0}
            onClick={() => onSaveRecipe?.(capture)}
            type="button"
          >
            Save recipe
          </button>
        </footer>
      </aside>
    </div>
  );
}
