import { useEffect, useState } from "react";

import type {
  CaptureRun,
  Project,
  Recipe,
} from "../../contracts/models";
import "../shared/theme.css";
import "./popup.css";
import { CaptureView } from "./CaptureView";
import { InboxView } from "./InboxView";
import { RecipesView } from "./RecipesView";
import { SettingsView } from "./SettingsView";

export interface PopupSite {
  origin: string;
  access: "one-time" | "persistent" | "unavailable";
}

export interface PopupWorkspaceData {
  site?: PopupSite;
  projects: Project[];
  recipes: Recipe[];
  runs: CaptureRun[];
  permissions: Record<string, boolean>;
  retentionLimit: number;
}

export interface PopupServices {
  load(): Promise<PopupWorkspaceData>;
  startQuickCapture(): Promise<void>;
  startRecipeCapture(recipeId?: string): Promise<void>;
  runRecipe(recipeId: string): Promise<CaptureRun>;
  saveProject(project: Project): Promise<void>;
  exportRun(runId: string): Promise<void>;
  deleteRun(runId: string): Promise<void>;
  pinRun(runId: string, pinned: boolean): Promise<void>;
  requestOriginAccess(origin: string): Promise<boolean>;
  revokeOriginAccess(origin: string): Promise<boolean>;
  exportConfiguration(): Promise<void>;
  importConfiguration(input: unknown): Promise<void>;
}

type PopupView = "capture" | "recipes" | "inbox" | "settings";

const emptyData: PopupWorkspaceData = {
  projects: [],
  recipes: [],
  runs: [],
  permissions: {},
  retentionLimit: 20,
};

export function PopupApp({ services }: { services: PopupServices }) {
  const [view, setView] = useState<PopupView>("capture");
  const [data, setData] = useState<PopupWorkspaceData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const refresh = async () => {
    setData(await services.load());
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const perform = async (
    action: () => void | Promise<void>,
    success?: string,
  ) => {
    setBusy(true);
    setNotice(undefined);
    try {
      await action();
      if (success) setNotice(success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const performAndRefresh = async (
    action: () => void | Promise<void>,
    success?: string,
  ) => perform(async () => {
    await action();
    await refresh();
  }, success);

  return (
    <main className="popup-shell" aria-busy={loading}>
      <header className="popup-header">
        <div className="brand-mark" aria-hidden="true">S</div>
        <div>
          <h1>Scrapeyy</h1>
          <p>Local capture studio</p>
        </div>
        <span className="local-badge">Local-only</span>
      </header>

      <nav className="popup-tabs" role="tablist" aria-label="Scrapeyy sections">
        {(["capture", "recipes", "inbox", "settings"] as const).map((item) => (
          <button
            aria-label={item[0]!.toUpperCase() + item.slice(1)}
            aria-selected={view === item}
            key={item}
            onClick={() => setView(item)}
            role="tab"
            type="button"
          >
            {item[0]!.toUpperCase() + item.slice(1)}
            {item === "inbox" && data.runs.length > 0 ? (
              <small>{data.runs.length}</small>
            ) : null}
          </button>
        ))}
      </nav>

      {notice ? <div className="popup-notice" role="status">{notice}</div> : null}

      <div className="popup-content">
        {view === "capture" ? (
          <CaptureView
            disabled={busy}
            site={data.site}
            onQuickCapture={() => perform(services.startQuickCapture)}
            onCreateRecipe={() => perform(() => services.startRecipeCapture())}
          />
        ) : null}
        {view === "recipes" ? (
          <RecipesView
            disabled={busy}
            projects={data.projects}
            recipes={data.recipes}
            onCreateProject={() => {
              const now = new Date().toISOString();
              return performAndRefresh(
                () =>
                  services.saveProject({
                    id: crypto.randomUUID(),
                    name: `Project ${data.projects.length + 1}`,
                    createdAt: now,
                    updatedAt: now,
                  }),
                "Project created.",
              );
            }}
            onEdit={(recipeId) => perform(() => services.startRecipeCapture(recipeId))}
            onRun={(recipeId) =>
              performAndRefresh(
                () => services.runRecipe(recipeId).then(() => undefined),
                "Capture saved to the inbox.",
              )
            }
          />
        ) : null}
        {view === "inbox" ? (
          <InboxView
            disabled={busy}
            recipes={data.recipes}
            runs={data.runs}
            onDelete={(runId) =>
              performAndRefresh(() => services.deleteRun(runId), "Run deleted.")
            }
            onExport={(runId) => perform(() => services.exportRun(runId), "Export started.")}
            onPin={(runId, pinned) =>
              performAndRefresh(() => services.pinRun(runId, pinned))
            }
            onRetry={(recipeId) =>
              performAndRefresh(() => services.runRecipe(recipeId).then(() => undefined))
            }
          />
        ) : null}
        {view === "settings" ? (
          <SettingsView
            disabled={busy}
            permissions={data.permissions}
            recipes={data.recipes}
            retentionLimit={data.retentionLimit}
            onExportConfiguration={() => perform(services.exportConfiguration)}
            onImportConfiguration={(input) =>
              performAndRefresh(() => services.importConfiguration(input))
            }
            onRequestAccess={(origin) =>
              performAndRefresh(() => services.requestOriginAccess(origin).then(() => undefined))
            }
            onRevokeAccess={(origin) =>
              performAndRefresh(() => services.revokeOriginAccess(origin).then(() => undefined))
            }
          />
        ) : null}
      </div>
    </main>
  );
}
