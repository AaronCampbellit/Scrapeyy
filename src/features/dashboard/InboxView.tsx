import type { CaptureRun, Recipe } from "../../contracts/models";

interface InboxViewProps {
  runs: CaptureRun[];
  recipes: Recipe[];
  selectedRunId?: string | undefined;
  onSelect(runId: string): void;
  onExport(runId: string): void | Promise<void>;
  onRetry(recipeId: string): void | Promise<void>;
  onPin(runId: string, pinned: boolean): void | Promise<void>;
  onDelete(runId: string): void | Promise<void>;
}

function titleCase(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

export function InboxView({
  runs,
  recipes,
  selectedRunId,
  onSelect,
  onExport,
  onRetry,
  onPin,
  onDelete,
}: InboxViewProps) {
  const selected = runs.find((run) => run.id === selectedRunId) ?? runs[0];
  const recipeName = (recipeId: string) =>
    recipes.find((recipe) => recipe.id === recipeId)?.name ?? "Unknown recipe";

  return (
    <div className="inbox-layout">
      <section className="panel inbox-list">
        <div className="panel-header">
          <div>
            <span className="kicker">Local storage</span>
            <h2>Capture Inbox</h2>
          </div>
          <span className="count-badge">{runs.length} runs</span>
        </div>
        {runs.length === 0 ? (
          <div className="empty-state">
            <strong>No captures yet</strong>
            <p>Run a recipe or use Quick Capture to add the first one.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Recipe</th>
                <th>Status</th>
                <th>Records</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr
                  className={run.id === selected?.id ? "is-selected" : ""}
                  key={run.id}
                  onClick={() => onSelect(run.id)}
                >
                  <td>
                    <button
                      className="table-link"
                      type="button"
                      onClick={() => onSelect(run.id)}
                    >
                      {recipeName(run.recipeId)}
                    </button>
                  </td>
                  <td>
                    <span className={`run-status status-${run.status}`}>
                      {titleCase(run.status)}
                    </span>
                  </td>
                  <td>{run.recordCount}</td>
                  <td>
                    {new Date(run.completedAt ?? run.startedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {selected ? (
        <aside className="panel run-inspector">
          <div className="panel-header">
            <div>
              <span className="kicker">Run details</span>
              <h2>{recipeName(selected.recipeId)}</h2>
            </div>
            <span className={`run-status status-${selected.status}`}>
              {titleCase(selected.status)}
            </span>
          </div>
          <dl className="run-metrics">
            <div>
              <dt>Records</dt>
              <dd>{selected.recordCount}</dd>
            </div>
            <div>
              <dt>Trigger</dt>
              <dd>{titleCase(selected.trigger)}</dd>
            </div>
            <div>
              <dt>Export</dt>
              <dd>{titleCase(selected.exportState)}</dd>
            </div>
          </dl>
          {selected.errors.length > 0 ? (
            <div className="warning-box">
              <strong>{selected.errors[0]?.code}</strong>
              <p>{selected.errors[0]?.message}</p>
            </div>
          ) : null}
          <div className="record-preview">
            <h3>Data preview</h3>
            <pre>{JSON.stringify(selected.records.slice(0, 3), null, 2)}</pre>
          </div>
          <div className="inspector-actions">
            <button
              className="button button-primary"
              type="button"
              onClick={() => void onExport(selected.id)}
              aria-label="Export run"
            >
              Export run
            </button>
            <button
              className="button"
              type="button"
              onClick={() => void onRetry(selected.recipeId)}
            >
              Retry
            </button>
            <button
              className="button"
              type="button"
              onClick={() => void onPin(selected.id, !selected.pinned)}
            >
              {selected.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              className="button button-danger"
              type="button"
              onClick={() => void onDelete(selected.id)}
            >
              Delete
            </button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
