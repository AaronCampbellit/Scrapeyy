import { useEffect, useMemo, useState } from "react";

import type { CaptureRun, ConfigurationV1, Project, Recipe } from "../../contracts/models";
import "../shared/theme.css";
import "./dashboard.css";
import { InboxView } from "./InboxView";
import { ProjectsView } from "./ProjectsView";
import { RecipeEditor } from "./RecipeEditor";

export interface DashboardData {
  projects: Project[];
  recipes: Recipe[];
  runs: CaptureRun[];
}

export interface DashboardServices {
  load(): Promise<DashboardData>;
  saveProject(project: Project): Promise<void>;
  saveRecipe(recipe: Recipe): Promise<void>;
  runRecipe(recipeId: string): Promise<unknown>;
  exportRun(runId: string): Promise<void>;
  deleteRun(runId: string): Promise<void>;
  pinRun(runId: string, pinned: boolean): Promise<void>;
  syncSchedules(): Promise<void>;
  exportConfiguration(): Promise<void>;
  importConfiguration(configuration: ConfigurationV1): Promise<void>;
}

type View = "projects" | "recipes" | "inbox" | "settings";

const emptyData: DashboardData = { projects: [], recipes: [], runs: [] };

function newRecipe(projectId: string): Recipe {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: crypto.randomUUID(),
    projectId,
    name: "New recipe",
    origin: "https://example.com",
    startUrl: "https://example.com",
    mode: "data",
    containerSelector: "article",
    fields: [{ id: "title", name: "Title", kind: "text", selector: "h2" }],
    traversal: {
      kind: "none",
      maxPages: 1,
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

export function DashboardApp({ services }: { services: DashboardServices }) {
  const [view, setView] = useState<View>("projects");
  const [data, setData] = useState<DashboardData>(emptyData);
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const [selectedRunId, setSelectedRunId] = useState<string>();
  const [editing, setEditing] = useState<Recipe>();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string>();

  const refresh = async () => {
    const next = await services.load();
    setData(next);
    setSelectedProjectId((current) => current ?? next.projects[0]?.id);
    setSelectedRunId((current) => current ?? next.runs[0]?.id);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const activeRecipes = useMemo(
    () =>
      selectedProjectId
        ? data.recipes.filter((recipe) => recipe.projectId === selectedProjectId)
        : data.recipes,
    [data.recipes, selectedProjectId],
  );

  const runAndRefresh = async (recipeId: string) => {
    setNotice("Capture running…");
    await services.runRecipe(recipeId);
    await refresh();
    setNotice("Capture saved to the inbox.");
  };

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="dashboard-brand">
          <span className="brand-mark">S</span>
          <div>
            <strong>Scrapeyy</strong>
            <small>Local capture studio</small>
          </div>
        </div>
        <nav aria-label="Dashboard sections">
          {(
            [
              ["projects", "Projects"],
              ["recipes", "Recipes"],
              ["inbox", "Capture Inbox"],
              ["settings", "Settings"],
            ] as const
          ).map(([id, label]) => (
            <button
              role="tab"
              aria-selected={view === id}
              className={view === id ? "is-active" : ""}
              type="button"
              key={id}
              onClick={() => setView(id)}
            >
              <span aria-hidden="true">{id.slice(0, 1).toUpperCase()}</span>
              {label}
              {id === "inbox" && data.runs.length > 0 ? (
                <small>{data.runs.length}</small>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="local-badge">
          <span aria-hidden="true">●</span>
          <div>
            <strong>Local-only</strong>
            <small>No cloud connected</small>
          </div>
        </div>
      </aside>
      <main className="dashboard-main">
        <header className="topbar">
          <div>
            <h1>
              {view === "inbox"
                ? "Capture Inbox"
                : view.slice(0, 1).toUpperCase() + view.slice(1)}
            </h1>
            <p>Build reusable captures without sending page content away.</p>
          </div>
          <div className="topbar-actions">
            {notice ? <span className="notice">{notice}</span> : null}
            <button
              className="button button-primary"
              type="button"
              disabled={data.projects.length === 0}
              onClick={() => {
                const projectId = selectedProjectId ?? data.projects[0]?.id;
                if (projectId) setEditing(newRecipe(projectId));
              }}
            >
              New recipe
            </button>
          </div>
        </header>

        <div className="dashboard-content" aria-busy={loading}>
          {view === "projects" ? (
            <>
              <ProjectsView
                projects={data.projects}
                recipes={data.recipes}
                selectedProjectId={selectedProjectId}
                onSelect={setSelectedProjectId}
                onCreate={() => {
                  const now = new Date().toISOString();
                  const project = {
                    id: crypto.randomUUID(),
                    name: `Project ${data.projects.length + 1}`,
                    createdAt: now,
                    updatedAt: now,
                  };
                  void services.saveProject(project).then(refresh);
                }}
              />
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <span className="kicker">Selected project</span>
                    <h2>Recipes</h2>
                  </div>
                </div>
                <RecipeTable
                  recipes={activeRecipes}
                  onEdit={setEditing}
                  onRun={runAndRefresh}
                />
              </section>
            </>
          ) : null}
          {view === "recipes" ? (
            <section className="panel">
              <div className="panel-header">
                <div>
                  <span className="kicker">Automation library</span>
                  <h2>Saved recipes</h2>
                </div>
              </div>
              <RecipeTable
                recipes={data.recipes}
                onEdit={setEditing}
                onRun={runAndRefresh}
              />
            </section>
          ) : null}
          {view === "inbox" ? (
            <InboxView
              runs={data.runs}
              recipes={data.recipes}
              selectedRunId={selectedRunId}
              onSelect={setSelectedRunId}
              onExport={services.exportRun}
              onRetry={runAndRefresh}
              onPin={async (runId, pinned) => {
                await services.pinRun(runId, pinned);
                await refresh();
              }}
              onDelete={async (runId) => {
                await services.deleteRun(runId);
                setSelectedRunId(undefined);
                await refresh();
              }}
            />
          ) : null}
          {view === "settings" ? (
            <section className="panel settings-panel">
              <div className="panel-header">
                <div>
                  <span className="kicker">Portability and retention</span>
                  <h2>Local settings</h2>
                </div>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Configuration backup</strong>
                  <p>Export projects and recipes as versioned Scrapeyy JSON.</p>
                </div>
                <button
                  className="button"
                  type="button"
                  onClick={() => void services.exportConfiguration()}
                >
                  Export configuration
                </button>
                <label className="button file-button">
                  Import configuration
                  <input
                    type="file"
                    accept=".json,.scrapeyy.json"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void file
                        .text()
                        .then((text) => JSON.parse(text) as ConfigurationV1)
                        .then(services.importConfiguration)
                        .then(refresh);
                    }}
                  />
                </label>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Default retention</strong>
                  <p>Keep the latest 20 runs per recipe. Pinned runs are kept.</p>
                </div>
                <input aria-label="Runs retained per recipe" type="number" value="20" readOnly />
              </div>
            </section>
          ) : null}
        </div>
      </main>
      {editing ? (
        <div className="editor-backdrop">
          <RecipeEditor
            recipe={editing}
            projects={data.projects}
            onCancel={() => setEditing(undefined)}
            onSave={async (recipe) => {
              await services.saveRecipe(recipe);
              await services.syncSchedules();
              setEditing(undefined);
              await refresh();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function RecipeTable({
  recipes,
  onEdit,
  onRun,
}: {
  recipes: Recipe[];
  onEdit(recipe: Recipe): void;
  onRun(recipeId: string): void | Promise<void>;
}) {
  if (recipes.length === 0) {
    return (
      <div className="empty-state">
        <strong>No recipes in this project</strong>
        <p>Create one from a page with Quick Capture or from this dashboard.</p>
      </div>
    );
  }
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Origin</th>
          <th>Mode</th>
          <th>Schedule</th>
          <th aria-label="Actions" />
        </tr>
      </thead>
      <tbody>
        {recipes.map((recipe) => (
          <tr key={recipe.id}>
            <td>
              <strong>{recipe.name}</strong>
            </td>
            <td className="mono">{recipe.origin}</td>
            <td>
              <span className="mode-badge">{recipe.mode}</span>
            </td>
            <td>
              {recipe.schedule?.enabled
                ? recipe.schedule.cadence === "daily"
                  ? `Daily at ${recipe.schedule.localTime}`
                  : `Every ${recipe.schedule.intervalMinutes} min`
                : "Manual"}
            </td>
            <td className="table-actions">
              <button className="button button-small" type="button" onClick={() => void onRun(recipe.id)}>
                Run
              </button>
              <button className="button button-small" type="button" onClick={() => onEdit(recipe)}>
                Edit
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
