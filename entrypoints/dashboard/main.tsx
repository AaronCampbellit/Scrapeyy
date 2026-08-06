import React from "react";
import ReactDOM from "react-dom/client";

import type {
  CaptureRun,
  ConfigurationV1,
  Project,
  Recipe,
} from "../../src/contracts/models";
import {
  DashboardApp,
  type DashboardServices,
} from "../../src/features/dashboard/DashboardApp";
import { extensionBrowser } from "../../src/platform/browser-api";
import {
  hasOriginAccess,
  requestOriginAccess,
  revokeOriginAccess,
} from "../../src/platform/permissions";
import { CaptureDatabase } from "../../src/storage/capture-database";
import { migrateConfiguration } from "../../src/storage/migrations";
import {
  createSettingsRepository,
  type StorageArea,
} from "../../src/storage/settings-repository";

const storage = extensionBrowser.storage.local as StorageArea;
const projects = createSettingsRepository<Project>(storage, "projects");
const recipes = createSettingsRepository<Recipe>(storage, "recipes");
const captures = new CaptureDatabase();

const services: DashboardServices = {
  async load() {
    const savedRecipes = await recipes.list();
    const origins = [...new Set(savedRecipes.map((recipe) => recipe.origin))];
    return {
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
    };
  },
  saveProject: (project) => projects.put(project),
  saveRecipe: (recipe) => recipes.put(recipe),
  runRecipe: (recipeId) =>
    extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_RUN_RECIPE",
      recipeId,
    }),
  exportRun: async (runId) => {
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
  async syncSchedules() {
    await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_SYNC_SCHEDULES",
    });
  },
  async exportConfiguration() {
    const configuration: ConfigurationV1 = {
      version: 1,
      projects: await projects.list(),
      recipes: await recipes.list(),
    };
    const blob = new Blob([JSON.stringify(configuration, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "scrapeyy-configuration.scrapeyy.json";
    anchor.click();
    URL.revokeObjectURL(url);
  },
  async importConfiguration(configuration) {
    const migrated = migrateConfiguration(configuration);
    await Promise.all(migrated.projects.map((project) => projects.put(project)));
    await Promise.all(migrated.recipes.map((recipe) => recipes.put(recipe)));
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
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DashboardApp services={services} />
  </React.StrictMode>,
);
