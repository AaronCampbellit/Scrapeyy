import type { Recipe } from "../src/contracts/models";
import { extensionBrowser } from "../src/platform/browser-api";
import { hasOriginAccess } from "../src/platform/permissions";
import {
  acquireRecipeTab,
  releaseRecipeTab,
} from "../src/platform/tabs";
import { runRecipe } from "../src/scheduling/runner";
import {
  alarmName,
  nextOccurrence,
  recipeIdFromAlarm,
} from "../src/scheduling/schedule";
import { CaptureDatabase } from "../src/storage/capture-database";
import {
  createSettingsRepository,
  type StorageArea,
} from "../src/storage/settings-repository";

export default defineBackground(() => {
  const recipes = createSettingsRepository<Recipe>(
    extensionBrowser.storage.local as StorageArea,
    "recipes",
  );
  const captures = new CaptureDatabase();

  const execute = async (recipe: Recipe) => {
    const tab = await acquireRecipeTab(recipe.startUrl, recipe.origin);
    try {
      return await extensionBrowser.tabs.sendMessage(tab.tabId, {
        type: "SCRAPEYY_RUN_RECIPE",
        recipe,
      });
    } finally {
      await releaseRecipeTab(tab);
    }
  };

  const dependencies = {
    now: () => new Date(),
    createId: () => crypto.randomUUID(),
    getRecipe: (id: string) => recipes.get(id),
    hasOriginAccess,
    executeInTab: execute,
    saveRun: (run: Parameters<typeof captures.putRun>[0]) =>
      captures.putRun(run),
  };

  const syncSchedules = async () => {
    await extensionBrowser.alarms.clearAll();
    for (const recipe of await recipes.list()) {
      const schedule = recipe.schedule;
      if (!schedule?.enabled) {
        continue;
      }
      const first = nextOccurrence(schedule, new Date()).getTime();
      await extensionBrowser.alarms.create(alarmName(recipe.id), {
        when: first,
        periodInMinutes:
          schedule.cadence === "interval"
            ? schedule.intervalMinutes
            : 24 * 60,
      });
    }
  };

  extensionBrowser.runtime.onInstalled.addListener(() => {
    void syncSchedules();
  });
  extensionBrowser.runtime.onStartup.addListener(() => {
    void syncSchedules();
  });
  extensionBrowser.alarms.onAlarm.addListener((alarm) => {
    const recipeId = recipeIdFromAlarm(alarm.name);
    if (recipeId) {
      void runRecipe(recipeId, "scheduled", dependencies);
    }
  });
  extensionBrowser.runtime.onMessage.addListener((message: unknown) => {
    if (typeof message !== "object" || message === null) {
      return undefined;
    }
    const value = message as Record<string, unknown>;
    if (value.type === "SCRAPEYY_RUN_RECIPE" && typeof value.recipeId === "string") {
      return runRecipe(value.recipeId, "manual", dependencies);
    }
    if (value.type === "SCRAPEYY_SYNC_SCHEDULES") {
      return syncSchedules().then(() => ({ ok: true }));
    }
    return undefined;
  });
});
