import { useEffect, useState } from "react";

import type { CaptureRun, Recipe } from "../../contracts/models";

interface InboxViewProps {
  runs: CaptureRun[];
  recipes: Recipe[];
  disabled: boolean;
  onDelete(runId: string): void | Promise<void>;
  onExport(runId: string): void | Promise<void>;
  onPin(runId: string, pinned: boolean): void | Promise<void>;
  onRetry(recipeId: string): void | Promise<void>;
}

export function InboxView({
  runs,
  recipes,
  disabled,
  onDelete,
  onExport,
  onPin,
  onRetry,
}: InboxViewProps) {
  const [selectedId, setSelectedId] = useState(runs[0]?.id);
  useEffect(() => {
    if (!runs.some((run) => run.id === selectedId)) {
      setSelectedId(runs[0]?.id);
    }
  }, [runs, selectedId]);
  const selected = runs.find((run) => run.id === selectedId) ?? runs[0];
  const recipeName = (recipeId: string) =>
    recipes.find((recipe) => recipe.id === recipeId)?.name ?? "Quick capture";
  return (
    <section className="popup-view" aria-label="Inbox">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Local storage</span>
          <h2>Capture Inbox</h2>
        </div>
        <span className="count-badge">{runs.length}</span>
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
              {selected.errors[0] ? (
                <div className="popup-warning">{selected.errors[0].message}</div>
              ) : null}
              <h3>Data preview</h3>
              <pre>{JSON.stringify(selected.records.slice(0, 3), null, 2)}</pre>
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
