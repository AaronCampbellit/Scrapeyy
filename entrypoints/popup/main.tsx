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

const services: PopupServices = {
  async load() {
    const savedRecipes = await recipes.list();
    const origins = [...new Set(savedRecipes.map((recipe) => recipe.origin))];
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
    const settings = await appSettings.get();
    await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_START_RECIPE_PICKER",
      tabId: tab.id,
      ...(recipeId ? { recipeId } : {}),
      theme: settings.theme,
    });
    window.close();
  },
  runRecipe: (recipeId) =>
    extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_RUN_RECIPE",
      recipeId,
    }),
  saveProject: (project) => projects.put(project),
  async exportRun(runId) {
    await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_EXPORT_RUN",
      runId,
    });
  },
  deleteRun: (runId) => captures.deleteRun(runId),
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
