import { useEffect, useRef, useState } from "react";

import type {
  CaptureRun,
  Project,
  Recipe,
} from "../../contracts/models";
import {
  DEFAULT_APP_SETTINGS,
  normalizeAppSettings,
  type AppSettings,
} from "../../storage/app-settings";
import "../shared/theme.css";
import "./popup.css";
import { CaptureView } from "./CaptureView";
import { InboxView } from "./InboxView";
import { RecipesView } from "./RecipesView";
import { SettingsView } from "./SettingsView";
import { SharePointView } from "./SharePointView";
import type { SharePointMetadata } from "../../sharepoint/scrape";
import type { VideoInventory } from "../../media/videos";
import { CAPTURE_VERSION, type ScreenshotResult } from "../../platform/screenshot-messages";
import type { PreviewType } from "../../platform/preview-window";

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
  settings: AppSettings;
  sharePointMetadata?: SharePointMetadata;
  activePicker?: {
    variant: "quick" | "recipe";
    minimized: boolean;
  };
}

export interface PopupServices {
  load(): Promise<PopupWorkspaceData>;
  startQuickCapture(): Promise<void>;
  takeScreenshot(kind: "visible" | "full-page" | "selection"): Promise<ScreenshotResult | void>;
  inspectVideos(): Promise<VideoInventory>;
  downloadVideo(url: string): Promise<void>;
  exportVideoDetails(): Promise<void>;
  startRecipeCapture(recipeId?: string): Promise<void>;
  resumePicker(): Promise<void>;
  scrapeSharePoint(): Promise<SharePointMetadata>;
  runRecipe(recipeId: string): Promise<CaptureRun>;
  deleteRecipe(recipeId: string): Promise<void>;
  saveProject(project: Project): Promise<void>;
  exportRun(runId: string): Promise<void>;
  deleteRun(runId: string): Promise<void>;
  clearInbox(): Promise<void>;
  loadRunScreenshot(runId: string): Promise<string | undefined>;
  openPreview(runId: string, preview: PreviewType): Promise<void>;
  pinRun(runId: string, pinned: boolean): Promise<void>;
  requestOriginAccess(origin: string): Promise<boolean>;
  revokeOriginAccess(origin: string): Promise<boolean>;
  exportConfiguration(): Promise<void>;
  importConfiguration(input: unknown): Promise<void>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
}

type PopupView = "capture" | "inbox" | "recipes" | "sharepoint" | "settings";

const popupTabs: Array<{ id: PopupView; label: string }> = [
  { id: "capture", label: "Capture" },
  { id: "inbox", label: "Inbox" },
  { id: "recipes", label: "Recipes" },
  { id: "sharepoint", label: "SharePoint" },
  { id: "settings", label: "Settings" },
];

const emptyData: PopupWorkspaceData = {
  projects: [],
  recipes: [],
  runs: [],
  permissions: {},
  retentionLimit: 20,
  settings: DEFAULT_APP_SETTINGS,
};

export function PopupApp({ services }: { services: PopupServices }) {
  const [view, setView] = useState<PopupView>("capture");
  const [data, setData] = useState<PopupWorkspaceData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [videos, setVideos] = useState<VideoInventory>();
  const [sharePointMetadata, setSharePointMetadata] =
    useState<SharePointMetadata>();
  const resumeAttempted = useRef(false);

  const refresh = async () => {
    const loaded = await services.load();
    setData(loaded);
    setSharePointMetadata(loaded.sharePointMetadata);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (
      loading ||
      !data.activePicker?.minimized ||
      resumeAttempted.current
    ) return;
    resumeAttempted.current = true;
    void services.resumePicker().catch((error: unknown) => {
      setNotice(
        error instanceof Error
          ? error.message
          : "The minimized recipe could not be restored.",
      );
    });
  }, [data.activePicker?.minimized, loading, services]);

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

  const updateSettings = (settings: AppSettings) =>
    perform(async () => {
      const saved = await services.saveSettings(normalizeAppSettings(settings));
      setData((current) => ({ ...current, settings: saved }));
    });

  const requireRecipeAccess = async (origin: string) => {
    const alreadyGranted =
      data.permissions[origin] === true ||
      (data.site?.origin === origin && data.site.access === "persistent");
    if (alreadyGranted) return;
    const granted = await services.requestOriginAccess(origin);
    if (!granted) {
      throw new Error(
        "Website access is required so recipe tests and multi-page scrapes can survive navigation.",
      );
    }
  };

  return (
    <main
      className="popup-shell"
      aria-busy={loading}
      data-theme={data.settings.theme}
    >
      <header className="popup-header">
        <div className="brand-mark" aria-hidden="true">
          <img alt="" src="/icon/32.png" />
        </div>
        <div>
          <h1>Scrapeyy</h1>
          <p>Local capture studio · {CAPTURE_VERSION}</p>
        </div>
        <span className="local-badge">Local-only</span>
      </header>

      <nav className="popup-tabs" role="tablist" aria-label="Scrapeyy sections">
        {popupTabs.map(({ id, label }) => (
          <button
            aria-label={label}
            aria-selected={view === id}
            key={id}
            onClick={() => setView(id)}
            role="tab"
            type="button"
          >
            {label}
            {id === "inbox" && data.runs.length > 0 ? (
              <small>{data.runs.length}</small>
            ) : null}
          </button>
        ))}
      </nav>

      {notice ? <div className="popup-notice" role="status">{notice}</div> : null}

      <div className="popup-content">
        {view === "capture" ? (
          <CaptureView
            settings={data.settings}
            onScreenshotDestinationChange={(screenshotDestination) => updateSettings({ ...data.settings, screenshotDestination })}
            disabled={busy}
            site={data.site}
            onQuickCapture={() => perform(services.startQuickCapture)}
            onScreenshot={(kind) => perform(async () => {
              setNotice(kind === "selection" ? "Opening selection tool…" : "Saving screenshot…");
              const result = await services.takeScreenshot(kind);
              if (result && "destination" in result && result.destination === "inbox") {
                await refresh();
                setNotice("Screenshot saved to Inbox.");
              } else setNotice(result ? `Screenshot saved: ${result.filename}` : undefined);
            })}
            onInspectVideos={() => perform(async () => { setVideos(await services.inspectVideos()); })}
            onDownloadVideo={(url) => perform(() => services.downloadVideo(url), "Video download requested.")}
            onExportVideoDetails={() => perform(services.exportVideoDetails, "Video details exported.")}
            videos={videos}
            onCreateRecipe={() =>
              perform(async () => {
                if (!data.site || data.site.access === "unavailable") {
                  throw new Error("Open a website before creating a recipe.");
                }
                await requireRecipeAccess(data.site.origin);
                await services.startRecipeCapture();
              })
            }
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
            onEdit={(recipeId) =>
              perform(async () => {
                const recipe = data.recipes.find((item) => item.id === recipeId);
                if (!recipe) throw new Error("That recipe no longer exists.");
                await requireRecipeAccess(recipe.origin);
                await services.startRecipeCapture(recipeId);
              })
            }
            onDelete={(recipeId) =>
              performAndRefresh(
                () => services.deleteRecipe(recipeId),
                "Recipe deleted.",
              )
            }
            onRun={(recipeId) =>
              performAndRefresh(
                async () => {
                  const recipe = data.recipes.find((item) => item.id === recipeId);
                  if (
                    recipe?.manualRunInWorkerTab &&
                    !data.permissions[recipe.origin]
                  ) {
                    const granted = await services.requestOriginAccess(recipe.origin);
                    if (!granted) {
                      throw new Error(
                        "Website access is required to run this recipe in a background tab.",
                      );
                    }
                  }
                  await services.runRecipe(recipeId);
                },
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
            onClear={() =>
              performAndRefresh(
                services.clearInbox,
                "Unpinned captures cleared.",
              )
            }
            onExport={(runId) => perform(() => services.exportRun(runId),
              data.runs.find((run) => run.id === runId)?.screenshot ? "Screenshot saved to device." : "Export started.")}
            onLoadScreenshot={services.loadRunScreenshot}
            onOpenPreview={(runId, preview) => perform(() => services.openPreview(runId, preview))}
            onPin={(runId, pinned) =>
              performAndRefresh(() => services.pinRun(runId, pinned))
            }
            onRetry={(recipeId) =>
              performAndRefresh(() => services.runRecipe(recipeId).then(() => undefined))
            }
          />
        ) : null}
        {view === "sharepoint" ? (
          <SharePointView
            disabled={busy}
            metadata={sharePointMetadata}
            site={data.site}
            onScrape={() =>
              perform(async () => {
                setSharePointMetadata(await services.scrapeSharePoint());
              }, "SharePoint details found.")
            }
          />
        ) : null}
        {view === "settings" ? (
          <SettingsView
            disabled={busy}
            permissions={data.permissions}
            recipes={data.recipes}
            retentionLimit={data.retentionLimit}
            settings={data.settings}
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
            onUpdateSettings={updateSettings}
          />
        ) : null}
      </div>
    </main>
  );
}
