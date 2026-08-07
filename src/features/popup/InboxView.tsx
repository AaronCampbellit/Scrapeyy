import { useEffect, useState } from "react";

import type { CaptureRun, Recipe } from "../../contracts/models";

interface InboxViewProps {
  runs: CaptureRun[];
  recipes: Recipe[];
  disabled: boolean;
  onClear(): void | Promise<void>;
  onDelete(runId: string): void | Promise<void>;
  onExport(runId: string): void | Promise<void>;
  onLoadScreenshot(runId: string): Promise<string | undefined>;
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
  useEffect(() => {
    setPreview("text");
    setScreenshotUrl(undefined);
  }, [selected?.id]);
  useEffect(() => {
    if (!selected || preview !== "screenshot" || screenshotUrl) return;
    let active = true;
    setScreenshotLoading(true);
    void onLoadScreenshot(selected.id)
      .then((url) => {
        if (active) setScreenshotUrl(url);
      })
      .finally(() => {
        if (active) setScreenshotLoading(false);
      });
    return () => {
      active = false;
    };
  }, [onLoadScreenshot, preview, screenshotUrl, selected]);
  const recipeName = (recipeId: string) =>
    recipes.find((recipe) => recipe.id === recipeId)?.name ?? "Quick capture";
  const readableText = selected?.records
    .map((record) => {
      if (record.text?.trim()) return record.text.trim();
      const values = Object.entries(record)
        .filter(
          ([key, value]) =>
            value?.trim() &&
            !["source_url", "links", "images", "element"].includes(key),
        )
        .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`);
      return values.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
  const warnings = selected?.warnings ?? [];
  return (
    <section className="popup-view" aria-label="Inbox">
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
              Clear
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
          <div className="run-list">
            {runs.map((run) => (
              <button
                className={run.id === selected?.id ? "is-selected" : ""}
                key={run.id}
                onClick={() => setSelectedId(run.id)}
                type="button"
              >
                <span>
                  <strong>{recipeName(run.recipeId)}</strong>
                  <small>{new Date(run.completedAt ?? run.startedAt).toLocaleString()}</small>
                </span>
                <span className={`run-status status-${run.status}`}>{run.status}</span>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="run-detail">
              <div className="run-metrics">
                <span><strong>{selected.recordCount}</strong> records</span>
                <span>{selected.trigger}</span>
                <span>{selected.exportState}</span>
              </div>
              {warnings.length > 0 ? (
                <details className="run-warning-details" open>
                  <summary>
                    {warnings.length} warning{warnings.length === 1 ? "" : "s"}
                  </summary>
                  <ul>
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
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
                <div className="preview-empty">
                  No screenshot was captured for this run.
                </div>
              )}
              <div className="detail-actions">
                <button aria-label="Export run" disabled={disabled} onClick={() => void onExport(selected.id)} type="button">Export</button>
                <button disabled={disabled} onClick={() => void onRetry(selected.recipeId)} type="button">Retry</button>
                <button disabled={disabled} onClick={() => void onPin(selected.id, !selected.pinned)} type="button">{selected.pinned ? "Unpin" : "Pin"}</button>
                <button className="danger-link" disabled={disabled} onClick={() => void onDelete(selected.id)} type="button">Delete</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
