import React from "react";
import ReactDOM from "react-dom/client";

import type {
  ConfigurationV1,
  Project,
  Recipe,
} from "../../src/contracts/models";
import {
  PopupApp,
  type PopupServices,
  type PopupSite,
} from "../../src/features/popup/PopupApp";
import { extensionBrowser } from "../../src/platform/browser-api";
import { openCapturePreview } from "../../src/platform/preview-window";
import { ensureContentScript } from "../../src/platform/content-injection";
import { assertSelectionReady, screenshotSaved } from "../../src/platform/screenshot-messages";
import {
  isSharePointMetadata,
  isSharePointUrl,
  type SharePointMetadata,
} from "../../src/sharepoint/scrape";
import {
  hasOriginAccess,
  requestOriginAccess,
  revokeOriginAccess,
} from "../../src/platform/permissions";
import { CaptureDatabase } from "../../src/storage/capture-database";
import { createAppSettingsStore } from "../../src/storage/app-settings";
import { migrateConfiguration } from "../../src/storage/migrations";
import {
  createSettingsRepository,
  type StorageArea,
} from "../../src/storage/settings-repository";

const storage = extensionBrowser.storage.local as StorageArea;
const projects = createSettingsRepository<Project>(storage, "projects");
const recipes = createSettingsRepository<Recipe>(storage, "recipes");
const captures = new CaptureDatabase();
const appSettings = createAppSettingsStore(storage);
const sharePointMetadataKey = "sharepoint:last-metadata";

async function loadSharePointMetadata(): Promise<SharePointMetadata | undefined> {
  const saved = (await storage.get(sharePointMetadataKey))[sharePointMetadataKey];
  return isSharePointMetadata(saved) ? saved : undefined;
}

async function activeTab() {
  const [tab] = await extensionBrowser.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab;
}

function httpOrigin(url?: string): string | undefined {
  try {
    if (!url) return undefined;
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.origin
      : undefined;
  } catch {
    return undefined;
  }
}

async function currentSite(): Promise<PopupSite> {
  const tab = await activeTab();
  const origin = httpOrigin(tab?.url);
  if (!origin) {
    return { origin: "Browser page", access: "unavailable" };
  }
  return {
    origin,
    access: (await hasOriginAccess(origin)) ? "persistent" : "one-time",
  };
}

interface PickerStatus {
  active: boolean;
  minimized: boolean;
  variant?: "quick" | "recipe";
}

interface PendingRecipeStatus {
  pending: boolean;
}

async function activePickerStatus(): Promise<PickerStatus | undefined> {
  const tab = await activeTab();
  if (tab?.id === undefined || !httpOrigin(tab.url)) return undefined;
  try {
    const result = await extensionBrowser.tabs.sendMessage(tab.id, {
      type: "SCRAPEYY_PICKER_STATUS",
    }) as PickerStatus;
    return result?.active && result.variant ? result : undefined;
  } catch {
    return undefined;
  }
}

async function pendingRecipeStatus(tabId?: number): Promise<boolean> {
  if (tabId === undefined) return false;
  try {
    const result = await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_PENDING_RECIPE_STATUS",
      tabId,
    }) as PendingRecipeStatus;
    return result?.pending === true;
  } catch {
    return false;
  }
}

const services: PopupServices = {
  async takeScreenshot(kind) {
    const tab = await activeTab();
    if (tab?.id === undefined || !httpOrigin(tab.url)) throw new Error("Open a website first.");
    const response = await extensionBrowser.runtime.sendMessage({
      type: kind === "selection" ? "SCRAPEYY_START_SCREENSHOT_SELECTION" : "SCRAPEYY_SCREENSHOT",
      tabId: tab.id, kind,
    });
    if (kind === "selection") {
      assertSelectionReady(response);
      window.close();
      return;
    }
    return screenshotSaved(response);
  },
  async inspectVideos() {
    const tab = await activeTab();
    if (tab?.id === undefined || !httpOrigin(tab.url)) throw new Error("Open a website first.");
    await ensureContentScript(tab.id);
    return extensionBrowser.tabs.sendMessage(tab.id, { type: "SCRAPEYY_INSPECT_VIDEOS" });
  },
  async downloadVideo(url) {
    const tab = await activeTab();
    if (tab?.id === undefined) throw new Error("Open a website first.");
    await extensionBrowser.runtime.sendMessage({ type: "SCRAPEYY_DOWNLOAD_VIDEO", tabId: tab.id, url });
  },
  async exportVideoDetails() {
    const tab = await activeTab();
    if (tab?.id === undefined) throw new Error("Open a website first.");
    await extensionBrowser.runtime.sendMessage({ type: "SCRAPEYY_EXPORT_VIDEO_DETAILS", tabId: tab.id });
  },
  async load() {
    const tab = await activeTab();
    const savedRecipes = await recipes.list();
    const origins = [...new Set(savedRecipes.map((recipe) => recipe.origin))];
    const savedSharePointMetadata = await loadSharePointMetadata();
    const pickerStatus = await activePickerStatus();
    const hasPendingRecipe = await pendingRecipeStatus(tab?.id);
    return {
      site: await currentSite(),
      projects: await projects.list(),
      recipes: savedRecipes,
      runs: (await captures.listRuns()).sort((a, b) =>
        b.startedAt.localeCompare(a.startedAt),
      ),
      permissions: Object.fromEntries(
        await Promise.all(
          origins.map(async (origin) => [origin, await hasOriginAccess(origin)]),
        ),
      ),
      retentionLimit: 20,
      settings: await appSettings.get(),
      ...(savedSharePointMetadata
        ? { sharePointMetadata: savedSharePointMetadata }
        : {}),
      ...(pickerStatus?.variant || hasPendingRecipe
        ? {
            activePicker: {
              variant: pickerStatus?.variant ?? "recipe",
              minimized: pickerStatus?.minimized ?? true,
            },
          }
        : {}),
    };
  },
  async startQuickCapture() {
    const tab = await activeTab();
    if (tab?.id === undefined || !httpOrigin(tab.url)) {
      throw new Error("Scrapeyy cannot capture this browser page.");
    }
    const settings = await appSettings.get();
    await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_START_QUICK_PICKER",
      tabId: tab.id,
      theme: settings.theme,
    });
    window.close();
  },
  async startRecipeCapture(recipeId) {
    const tab = await activeTab();
    if (tab?.id === undefined || !httpOrigin(tab.url)) {
      throw new Error("Scrapeyy cannot create a recipe on this browser page.");
    }
    const origin = httpOrigin(tab.url)!;
    if (!(await hasOriginAccess(origin))) {
      const granted = await requestOriginAccess(origin);
      if (!granted) {
        throw new Error(
          "Website access is required so recipe tests and multi-page scrapes can survive navigation.",
        );
      }
    }
    const settings = await appSettings.get();
    await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_START_RECIPE_PICKER",
      tabId: tab.id,
      ...(recipeId ? { recipeId } : {}),
      theme: settings.theme,
    });
    window.close();
  },
  async resumePicker() {
    const tab = await activeTab();
    if (tab?.id === undefined) {
      throw new Error("The minimized recipe tab is no longer available.");
    }
    const pending = await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_RESUME_PENDING_RECIPE",
      tabId: tab.id,
    }) as { restored?: boolean };
    if (pending?.restored) {
      window.close();
      return;
    }
    const result = await extensionBrowser.tabs.sendMessage(tab.id, {
      type: "SCRAPEYY_RESTORE_PICKER",
    }) as { restored?: boolean };
    if (!result?.restored) {
      throw new Error("The minimized recipe is no longer available.");
    }
    window.close();
  },
  async scrapeSharePoint() {
    const tab = await activeTab();
    if (tab?.id === undefined || !tab.url || !isSharePointUrl(tab.url)) {
      throw new Error("Open a SharePoint list or document library first.");
    }
    await ensureContentScript(tab.id);
    const result = await extensionBrowser.tabs.sendMessage(tab.id, {
      type: "SCRAPEYY_SCRAPE_SHAREPOINT",
    });
    if (!isSharePointMetadata(result)) {
      throw new Error("SharePoint returned incomplete site details.");
    }
    await storage.set({ [sharePointMetadataKey]: result });
    return result;
  },
  runRecipe: (recipeId) =>
    extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_RUN_RECIPE",
      recipeId,
    }),
  async deleteRecipe(recipeId) {
    await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_DELETE_RECIPE",
      recipeId,
    });
  },
  saveProject: (project) => projects.put(project),
  async exportRun(runId) {
    await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_EXPORT_RUN",
      runId,
    });
  },
  deleteRun: (runId) => captures.deleteRun(runId),
  clearInbox: () => captures.clearUnpinnedRuns().then(() => undefined),
  async loadRunScreenshot(runId) {
    const artifact = await captures.getArtifact(`${runId}:screenshot`);
    return artifact ? URL.createObjectURL(artifact.blob) : undefined;
  },
  openPreview: openCapturePreview,
  async pinRun(runId, pinned) {
    const run = await captures.getRun(runId);
    if (run) await captures.putRun({ ...run, pinned });
  },
  requestOriginAccess,
  async revokeOriginAccess(origin) {
    const revoked = await revokeOriginAccess(origin);
    if (revoked) {
      await extensionBrowser.runtime.sendMessage({
        type: "SCRAPEYY_PERMISSION_REVOKED",
        origin,
      });
    }
    return revoked;
  },
  async exportConfiguration() {
    const configuration: ConfigurationV1 = {
      version: 1,
      projects: await projects.list(),
      recipes: await recipes.list(),
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(configuration, null, 2)], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "scrapeyy-configuration.scrapeyy.json";
    anchor.click();
    URL.revokeObjectURL(url);
  },
  async importConfiguration(input) {
    const migrated = migrateConfiguration(input);
    await Promise.all(migrated.projects.map((project) => projects.put(project)));
    await Promise.all(migrated.recipes.map((recipe) => recipes.put(recipe)));
  },
  saveSettings: (settings) => appSettings.set(settings),
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PopupApp services={services} />
  </React.StrictMode>,
);
