import { useEffect, useState } from "react";

import type { CaptureRun, Recipe } from "../../contracts/models";
import { captureText } from "../preview/capture-text";
import type { PreviewType } from "../../platform/preview-window";

interface InboxViewProps {
  runs: CaptureRun[];
  recipes: Recipe[];
  disabled: boolean;
  onClear(): void | Promise<void>;
  onDelete(runId: string): void | Promise<void>;
  onExport(runId: string): void | Promise<void>;
  onLoadScreenshot(runId: string): Promise<string | undefined>;
  onOpenPreview(runId: string, preview: PreviewType): void | Promise<void>;
  onPin(runId: string, pinned: boolean): void | Promise<void>;
  onRetry(recipeId: string): void | Promise<void>;
}

export function InboxView({
  runs,
  recipes,
  disabled,
  onClear,
  onDelete,
  onExport,
  onLoadScreenshot,
  onOpenPreview,
  onPin,
  onRetry,
}: InboxViewProps) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id);
  const [preview, setPreview] = useState<"text" | "screenshot">("text");
  const [screenshotUrl, setScreenshotUrl] = useState<string>();
  const [screenshotLoading, setScreenshotLoading] = useState(false);

  useEffect(() => {
    if (!runs.some((run) => run.id === selectedId)) {
      setSelectedId(runs[0]?.id);
    }
  }, [runs, selectedId]);

  const selected = runs.find((run) => run.id === selectedId) ?? runs[0];
  const recipeName = (recipeId: string) =>
    recipes.find((recipe) => recipe.id === recipeId)?.name ?? "Quick capture";
  const captureName = (run: CaptureRun) => run.screenshot ? `Screenshot · ${run.screenshot.title}` : recipeName(run.recipeId);

  useEffect(() => {
    setPreview(selected?.screenshot ? "screenshot" : "text");
    setScreenshotUrl(undefined);
  }, [selected?.id]);

  useEffect(() => {
    if (!selected || preview !== "screenshot" || screenshotUrl) return;
    let active = true;
    setScreenshotLoading(true);
    void onLoadScreenshot(selected.id)
      .then((url) => {
        if (active) setScreenshotUrl(url);
        else if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
      })
      .catch(() => { if (active) setScreenshotUrl(undefined); })
      .finally(() => {
        if (active) setScreenshotLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onLoadScreenshot, preview, screenshotUrl, selected]);

  useEffect(() => () => { if (screenshotUrl?.startsWith("blob:")) URL.revokeObjectURL(screenshotUrl); }, [screenshotUrl]);

  const clearCapture = (run: CaptureRun) => {
    if (
      window.confirm(
        `Clear “${captureName(run)}” from the inbox? This cannot be undone.`,
      )
    ) {
      void onDelete(run.id);
    }
  };

  const readableText = selected ? captureText(selected) : "";
  const warnings = selected?.warnings ?? [];

  return (
    <section className="popup-view inbox-view" aria-label="Inbox">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Local storage</span>
          <h2>Capture Inbox</h2>
        </div>
        <div className="inbox-heading-actions">
          <span className="count-badge">{runs.length}</span>
          {runs.some((run) => !run.pinned) ? (
            <button
              aria-label="Clear inbox"
              className="small-button danger-link"
              disabled={disabled}
              onClick={() => {
                if (
                  window.confirm(
                    "Delete every unpinned capture from the inbox? This cannot be undone.",
                  )
                ) {
                  void onClear();
                }
              }}
              type="button"
            >
              Clear unpinned
            </button>
          ) : null}
        </div>
      </div>

      {runs.length === 0 ? (
        <div className="popup-empty">
          <strong>No captures yet</strong>
          <span>Use Quick Capture or run a recipe.</span>
        </div>
      ) : (
        <>
          {selected ? (
            <article className="run-detail" aria-label="Selected capture">
              <div className="selected-capture-heading">
                <div>
                  <span className="eyebrow">Selected capture</span>
                  <h3>{captureName(selected)}</h3>
                </div>
                <span className={`run-status status-${selected.status}`}>
                  {selected.status}
                </span>
              </div>
              <div className="run-metrics">
                <span>{selected.screenshot ? "PNG · " + selected.screenshot.kind : <><strong>{selected.recordCount}</strong> records</>}</span>
                <span>{selected.trigger}</span>
                <span>{selected.exportState}</span>
              </div>
              {warnings.length > 0 ? (
                <details className="run-warning-details" open>
                  <summary>
                    {warnings.length} warning{warnings.length === 1 ? "" : "s"}
                  </summary>
                  <ul>
                    {warnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </details>
              ) : selected.status === "warning" ? (
                <div className="popup-warning">
                  Warning details were not saved by this older capture.
                </div>
              ) : null}
              {selected.errors.length > 0 ? (
                <div className="popup-warning">
                  {selected.errors.map((error) => (
                    <div key={`${error.code}-${error.message}`}>
                      <strong>{error.code}</strong>
                      <span>{error.message}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="preview-heading">
                <h3>Preview</h3>
                <button className="small-button preview-popout" type="button"
                  aria-label="Pop out preview" disabled={disabled}
                  onClick={() => void onOpenPreview(selected.id, preview)}>
                  Pop out ↗
                </button>
                <div className="preview-tabs" role="group" aria-label="Preview type">
                  <button
                    aria-pressed={preview === "text"}
                    onClick={() => setPreview("text")}
                    type="button"
                  >
                    Text
                  </button>
                  <button
                    aria-pressed={preview === "screenshot"}
                    onClick={() => setPreview("screenshot")}
                    type="button"
                  >
                    Screenshot
                  </button>
                </div>
              </div>
              {preview === "text" ? (
                readableText ? (
                  <div className="readable-preview">{readableText}</div>
                ) : (
                  <div className="preview-empty">No readable text was extracted.</div>
                )
              ) : screenshotLoading ? (
                <div className="preview-empty">Loading screenshot…</div>
              ) : screenshotUrl ? (
                <img
                  alt="Captured screenshot"
                  className="screenshot-preview"
                  src={screenshotUrl}
                />
              ) : (
                <div className="preview-empty">No screenshot was captured for this run.</div>
              )}
              <div className="detail-actions">
                <button aria-label={selected.screenshot ? "Save screenshot PNG" : "Export run"} disabled={disabled} onClick={() => void onExport(selected.id)} type="button">{selected.screenshot ? "Save PNG…" : "Export"}</button>
                {!selected.screenshot ? <button disabled={disabled} onClick={() => void onRetry(selected.recipeId)} type="button">Retry</button> : null}
                <button disabled={disabled} onClick={() => void onPin(selected.id, !selected.pinned)} type="button">{selected.pinned ? "Unpin" : "Pin"}</button>
                <button className="danger-link" disabled={disabled} onClick={() => clearCapture(selected)} type="button">Clear capture</button>
              </div>
            </article>
          ) : null}

          <div className="capture-shelf" aria-label="Capture list">
            <div className="capture-shelf-heading">
              <span className="eyebrow">All captures</span>
              <small>Newest first</small>
            </div>
            <div className="run-list">
              {runs.map((run) => (
                <div className={`run-list-item${run.id === selected?.id ? " is-selected" : ""}`} key={run.id}>
                  <button
                    aria-label={`View ${captureName(run)}`}
                    className="run-select"
                    onClick={() => setSelectedId(run.id)}
                    type="button"
                  >
                    <span>
                      <strong>{captureName(run)}</strong>
                      <small>{new Date(run.completedAt ?? run.startedAt).toLocaleString()}</small>
                    </span>
                    <span className={`run-status status-${run.status}`}>{run.status}</span>
                  </button>
                  <button
                    aria-label={`Clear capture ${captureName(run)}`}
                    className="run-clear danger-link"
                    disabled={disabled}
                    onClick={() => clearCapture(run)}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
