import type {
  CaptureRun,
  Project,
  QuickCaptureRequest,
  Recipe,
} from "../src/contracts/models";
import type { DesignSnapshot } from "../src/design/snapshot";
import { buildRunBundle } from "../src/export/bundle";
import { buildDownloadPath } from "../src/export/filename";
import type { PickerCapture } from "../src/features/picker/PickerApp";
import { extensionBrowser } from "../src/platform/browser-api";
import { ensureContentScript } from "../src/platform/content-injection";
import { downloadBundle } from "../src/platform/downloads";
import { hasOriginAccess } from "../src/platform/permissions";
import { captureElementScreenshot } from "../src/platform/screenshots";
import { acquireRecipeTab, releaseRecipeTab } from "../src/platform/tabs";
import {
  createQuickCaptureResult,
  type QuickPageExecutionResult,
} from "../src/run/quick-run";
import {
  type PageExecutionResult,
  runRecipe,
} from "../src/scheduling/runner";
import {
  alarmName,
  nextOccurrence,
  recipeIdFromAlarm,
  shouldCatchUp,
} from "../src/scheduling/schedule";
import { CaptureDatabase } from "../src/storage/capture-database";
import { applyRetention } from "../src/storage/retention";
import {
  createSettingsRepository,
  type StorageArea,
} from "../src/storage/settings-repository";

const DEFAULT_PROJECT_ID = "default-project";
const SCHEDULE_STATE_KEY = "scheduleState";

interface ScheduleState {
  nextDue: string;
  lastRunAt?: string;
}

function fallbackProject(now: string): Project {
  return {
    id: DEFAULT_PROJECT_ID,
    name: "Local captures",
    description: "Captures created directly from the browser toolbar.",
    createdAt: now,
    updatedAt: now,
  };
}

function recipeFromPicker(
  capture: PickerCapture,
  startUrl: string,
): Recipe {
  const now = new Date().toISOString();
  const url = new URL(startUrl);
  return {
    ...capture,
    projectId: capture.projectId || DEFAULT_PROJECT_ID,
    origin: url.origin,
    startUrl,
    createdAt: capture.createdAt || now,
    updatedAt: now,
  };
}

export default defineBackground(() => {
  const storage = extensionBrowser.storage.local as StorageArea;
  const projects = createSettingsRepository<Project>(storage, "projects");
  const recipes = createSettingsRepository<Recipe>(storage, "recipes");
  const captures = new CaptureDatabase();
  const executionResults = new Map<string, PageExecutionResult>();

  const readScheduleState = async (): Promise<Record<string, ScheduleState>> => {
    const result = await storage.get(SCHEDULE_STATE_KEY);
    const value = result[SCHEDULE_STATE_KEY];
    return typeof value === "object" && value !== null
      ? (value as Record<string, ScheduleState>)
      : {};
  };

  const writeScheduleState = (value: Record<string, ScheduleState>) =>
    storage.set({ [SCHEDULE_STATE_KEY]: value });

  const ensureDefaultProject = async (): Promise<Project> => {
    const existing = await projects.get(DEFAULT_PROJECT_ID);
    if (existing) return existing;
    const project = fallbackProject(new Date().toISOString());
    await projects.put(project);
    return project;
  };

  const executeOnTab = async (
    recipe: Recipe,
    tabId: number,
  ): Promise<PageExecutionResult> => {
    await ensureContentScript(tabId);
    const result = (await extensionBrowser.tabs.sendMessage(tabId, {
      type: "SCRAPEYY_RUN_RECIPE",
      recipe,
    })) as PageExecutionResult;
    executionResults.set(recipe.id, result);
    return result;
  };

  const execute = async (recipe: Recipe): Promise<PageExecutionResult> => {
    const tab = await acquireRecipeTab(recipe.startUrl, recipe.origin);
    try {
      return await executeOnTab(recipe, tab.tabId);
    } finally {
      await releaseRecipeTab(tab);
    }
  };

  const storeRunArtifacts = async (
    run: CaptureRun,
    recipe: Recipe,
    result: Pick<PageExecutionResult, "design">,
    storeRecipeSnapshot = false,
  ) => {
    if (storeRecipeSnapshot) {
      await captures.putArtifact({
        id: `${run.id}:recipe`,
        runId: run.id,
        name: "recipe.json",
        blob: new Blob([JSON.stringify(recipe)], { type: "application/json" }),
      });
    }
    if (result.design) {
      const { screenshot, ...serializable } = result.design;
      await captures.putArtifact({
        id: `${run.id}:design`,
        runId: run.id,
        name: "design.json",
        blob: new Blob([JSON.stringify(serializable)], {
          type: "application/json",
        }),
      });
      if (screenshot) {
        await captures.putArtifact({
          id: `${run.id}:screenshot`,
          runId: run.id,
          name: "screenshot.png",
          blob: screenshot,
        });
      }
    }
  };

  const designForRun = async (
    runId: string,
  ): Promise<DesignSnapshot | undefined> => {
    const artifact = await captures.getArtifact(`${runId}:design`);
    if (!artifact) return undefined;
    const design = JSON.parse(await artifact.blob.text()) as DesignSnapshot;
    const screenshot = await captures.getArtifact(`${runId}:screenshot`);
    return screenshot ? { ...design, screenshot: screenshot.blob } : design;
  };

  const recipeForRun = async (run: CaptureRun): Promise<Recipe | undefined> => {
    const saved = await recipes.get(run.recipeId);
    if (saved) return saved;
    const artifact = await captures.getArtifact(`${run.id}:recipe`);
    return artifact
      ? (JSON.parse(await artifact.blob.text()) as Recipe)
      : undefined;
  };

  const exportRun = async (runId: string, saveAs = false): Promise<number> => {
    const run = await captures.getRun(runId);
    if (!run) throw new Error("Capture run not found");
    const recipe = await recipeForRun(run);
    if (!recipe) throw new Error("Recipe snapshot not found");
    const project =
      (await projects.get(run.projectId)) ?? (await ensureDefaultProject());
    try {
      const design = await designForRun(run.id);
      const bundle = await buildRunBundle({
        project,
        recipe,
        run,
        ...(design ? { design } : {}),
      });
      const downloadId = await downloadBundle(
        bundle,
        buildDownloadPath(project, recipe, run),
        saveAs,
      );
      await captures.putRun({ ...run, exportState: "complete" });
      return downloadId;
    } catch (error) {
      await captures.putRun({ ...run, exportState: "failed" });
      throw error;
    }
  };

  const dependencies = {
    now: () => new Date(),
    createId: () => crypto.randomUUID(),
    getRecipe: (id: string) => recipes.get(id),
    hasOriginAccess,
    executeInTab: execute,
    saveRun: async (run: CaptureRun) => {
      await captures.putRun(run);
      const recipe = await recipes.get(run.recipeId);
      const result = executionResults.get(run.recipeId);
      if (recipe && result) {
        await storeRunArtifacts(run, recipe, result);
      }
      executionResults.delete(run.recipeId);
      const expired = applyRetention(await captures.listRuns(), 20);
      await Promise.all(expired.map((id) => captures.deleteRun(id)));
    },
  };

  const runSavedRecipe = async (
    recipeId: string,
    trigger: CaptureRun["trigger"],
  ) => {
    const run = await runRecipe(recipeId, trigger, dependencies);
    const recipe = await recipes.get(recipeId);
    if (recipe?.destinations.autoDownload && run.status !== "failed") {
      await exportRun(run.id);
    }
    return run;
  };

  const syncSchedules = async () => {
    await extensionBrowser.alarms.clearAll();
    const state = await readScheduleState();
    const active = new Set<string>();
    for (const recipe of await recipes.list()) {
      const schedule = recipe.schedule;
      if (!schedule?.enabled) continue;
      active.add(recipe.id);
      const first = nextOccurrence(schedule, new Date()).getTime();
      await extensionBrowser.alarms.create(alarmName(recipe.id), {
        when: first,
        periodInMinutes:
          schedule.cadence === "interval"
            ? schedule.intervalMinutes
            : 24 * 60,
      });
      const previous = state[recipe.id];
      state[recipe.id] = {
        ...(previous?.lastRunAt ? { lastRunAt: previous.lastRunAt } : {}),
        nextDue: new Date(first).toISOString(),
      };
    }
    for (const recipeId of Object.keys(state)) {
      if (!active.has(recipeId)) delete state[recipeId];
    }
    await writeScheduleState(state);
  };

  const recordScheduledRun = async (recipe: Recipe) => {
    if (!recipe.schedule?.enabled) return;
    const state = await readScheduleState();
    const now = new Date();
    state[recipe.id] = {
      lastRunAt: now.toISOString(),
      nextDue: nextOccurrence(recipe.schedule, now).toISOString(),
    };
    await writeScheduleState(state);
  };

  const catchUpSchedules = async () => {
    const state = await readScheduleState();
    const now = new Date();
    for (const recipe of await recipes.list()) {
      if (!recipe.schedule?.enabled) continue;
      const existing = state[recipe.id];
      if (
        existing &&
        shouldCatchUp(
          new Date(existing.nextDue),
          existing.lastRunAt ? new Date(existing.lastRunAt) : undefined,
          now,
        )
      ) {
        await runSavedRecipe(recipe.id, "catch-up");
        await recordScheduledRun(recipe);
      }
    }
  };

  const runQuickCapture = async (
    request: QuickCaptureRequest,
    tabId: number,
    tabUrl: string,
  ): Promise<CaptureRun> => {
    const project =
      (await projects.get(request.projectId)) ?? (await ensureDefaultProject());
    await ensureContentScript(tabId);
    const execution = (await extensionBrowser.tabs.sendMessage(tabId, {
      type: "SCRAPEYY_EXECUTE_QUICK_CAPTURE",
      request,
    })) as QuickPageExecutionResult;
    if (
      execution.design &&
      execution.designBounds
    ) {
      const screenshot = await captureElementScreenshot(
        tabId,
        execution.designBounds,
        undefined,
        undefined,
        {
          hide: () =>
            extensionBrowser.tabs
              .sendMessage(tabId, {
                type: "SCRAPEYY_SET_CAPTURE_UI_HIDDEN",
                hidden: true,
              })
              .then(() => undefined),
          show: () =>
            extensionBrowser.tabs
              .sendMessage(tabId, {
                type: "SCRAPEYY_SET_CAPTURE_UI_HIDDEN",
                hidden: false,
              })
              .then(() => undefined),
        },
      );
      if (screenshot) execution.design.screenshot = screenshot;
    }
    const now = new Date().toISOString();
    const { recipe, run } = createQuickCaptureResult({
      request,
      project,
      startUrl: tabUrl,
      execution,
      id: crypto.randomUUID(),
      recipeId: crypto.randomUUID(),
      now,
    });
    await captures.putRun(run);
    await storeRunArtifacts(run, recipe, execution, true);
    const expired = applyRetention(await captures.listRuns(), 20);
    await Promise.all(expired.map((id) => captures.deleteRun(id)));
    return run;
  };

  extensionBrowser.runtime.onInstalled.addListener(() => {
    void ensureDefaultProject().then(syncSchedules);
  });
  extensionBrowser.runtime.onStartup.addListener(() => {
    void ensureDefaultProject()
      .then(catchUpSchedules)
      .then(syncSchedules);
  });
  extensionBrowser.alarms.onAlarm.addListener((alarm) => {
    const recipeId = recipeIdFromAlarm(alarm.name);
    if (recipeId) {
      void runSavedRecipe(recipeId, "scheduled").then(async () => {
        const recipe = await recipes.get(recipeId);
        if (recipe) await recordScheduledRun(recipe);
      });
    }
  });
  extensionBrowser.runtime.onMessage.addListener(
    (message: unknown, sender) => {
      if (typeof message !== "object" || message === null) return undefined;
      const value = message as Record<string, unknown>;
      if (
        (value.type === "SCRAPEYY_START_PICKER" ||
          value.type === "SCRAPEYY_START_QUICK_PICKER") &&
        typeof value.tabId === "number"
      ) {
        return ensureContentScript(value.tabId)
          .then(() =>
            extensionBrowser.tabs.sendMessage(value.tabId as number, {
              type: "SCRAPEYY_START_QUICK_PICKER",
            }),
          )
          .then(() => ({ ok: true }));
      }
      if (
        value.type === "SCRAPEYY_START_RECIPE_PICKER" &&
        typeof value.tabId === "number"
      ) {
        return Promise.all([
          ensureContentScript(value.tabId),
          typeof value.recipeId === "string"
            ? recipes.get(value.recipeId)
            : Promise.resolve(undefined),
          extensionBrowser.tabs.get(value.tabId),
          ensureDefaultProject().then(() => projects.list()),
        ]).then(async ([, recipe, tab, savedProjects]) => {
          if (
            recipe &&
            (!tab.url || new URL(tab.url).origin !== recipe.origin)
          ) {
            throw new Error(
              `Open ${recipe.origin} before editing this recipe.`,
            );
          }
          await extensionBrowser.tabs.sendMessage(value.tabId as number, {
            type: "SCRAPEYY_START_RECIPE_PICKER",
            ...(recipe ? { recipe } : {}),
            projects: savedProjects,
          });
          return { ok: true };
        });
      }
      if (
        value.type === "SCRAPEYY_QUICK_CAPTURE" &&
        value.capture &&
        sender.tab?.id !== undefined &&
        sender.tab.url
      ) {
        return runQuickCapture(
          value.capture as QuickCaptureRequest,
          sender.tab.id,
          sender.tab.url,
        );
      }
      if (
        value.type === "SCRAPEYY_SAVE_PICKER_RECIPE" &&
        value.capture &&
        sender.tab?.url
      ) {
        const recipe = recipeFromPicker(
          value.capture as PickerCapture,
          sender.tab.url,
        );
        return ensureDefaultProject()
          .then(() => recipes.put(recipe))
          .then(syncSchedules)
          .then(() => ({ ok: true, recipeId: recipe.id }));
      }
      if (
        value.type === "SCRAPEYY_RUN_RECIPE" &&
        typeof value.recipeId === "string"
      ) {
        return runSavedRecipe(value.recipeId, "manual");
      }
      if (
        value.type === "SCRAPEYY_EXPORT_RUN" &&
        typeof value.runId === "string"
      ) {
        return exportRun(value.runId, true).then((downloadId) => ({
          ok: true,
          downloadId,
        }));
      }
      if (value.type === "SCRAPEYY_SYNC_SCHEDULES") {
        return syncSchedules().then(() => ({ ok: true }));
      }
      if (
        value.type === "SCRAPEYY_PERMISSION_REVOKED" &&
        typeof value.origin === "string"
      ) {
        return recipes.list().then(async (savedRecipes) => {
          await Promise.all(
            savedRecipes
              .filter(
                (recipe) =>
                  recipe.origin === value.origin && recipe.schedule?.enabled,
              )
              .map((recipe) =>
                recipes.put({
                  ...recipe,
                  schedule: recipe.schedule
                    ? { ...recipe.schedule, enabled: false }
                    : null,
                  updatedAt: new Date().toISOString(),
                }),
              ),
          );
          await syncSchedules();
          return { ok: true };
        });
      }
      return undefined;
    },
  );
});
