import type {
  CaptureRun,
  Project,
  QuickCaptureRequest,
  Recipe,
} from "../src/contracts/models";
import type { DesignSnapshot } from "../src/design/snapshot";
import type { AssetReference } from "../src/design/assets";
import { videoMetadataForExport, type VideoInventory } from "../src/media/videos";
import { safePathSegment } from "../src/export/filename";
import {
  buildRunBundle,
  type DownloadedAsset,
} from "../src/export/bundle";
import { resolveRunDownload } from "../src/export/run-download";
import { sanitizeCapturedUrl } from "../src/extraction/normalize";
import { fingerprintRecord } from "../src/extraction/fingerprint";
import type { PickerCapture } from "../src/features/picker/PickerApp";
import { extensionBrowser } from "../src/platform/browser-api";
import { ensureContentScript } from "../src/platform/content-injection";
import { downloadBundle } from "../src/platform/downloads";
import { downloadScreenshot } from "../src/platform/screenshot-download";
import { saveScreenshotToInbox } from "../src/storage/screenshot-inbox";
import { assertSelectionReady } from "../src/platform/screenshot-messages";
import { hasOriginAccess } from "../src/platform/permissions";
import { downloadReferencedAssetsFromPage } from "../src/platform/page-asset-download";
import {
  captureElementScreenshot,
  captureFullPageScreenshot,
  captureVisibleScreenshot,
  type ElementBounds,
} from "../src/platform/screenshots";
import { createTabFullPageCaptureController } from "../src/platform/tab-full-page-controller";
import { advanceAcrossNavigation } from "../src/platform/tab-navigation";
import {
  acquireRecipeTab,
  releaseRecipeTab,
  waitForTabComplete,
} from "../src/platform/tabs";
import {
  createQuickCaptureResult,
  type QuickPageExecutionResult,
} from "../src/run/quick-run";
import {
  type PageExecutionResult,
  runRecipe,
} from "../src/scheduling/runner";
import { runTraversal } from "../src/traversal/run-traversal";
import type { AdvanceResult } from "../src/traversal/types";
import {
  alarmName,
  nextOccurrence,
  recipeIdFromAlarm,
  shouldCatchUp,
} from "../src/scheduling/schedule";
import { CaptureDatabase } from "../src/storage/capture-database";
import {
  loadReferenceAssets,
  storeReferenceAssets,
} from "../src/storage/reference-assets";
import { applyRetention } from "../src/storage/retention";
import { createAppSettingsStore } from "../src/storage/app-settings";
import {
  createSettingsRepository,
  type StorageArea,
} from "../src/storage/settings-repository";

const DEFAULT_PROJECT_ID = "default-project";
const SCHEDULE_STATE_KEY = "scheduleState";
const PENDING_RECIPE_DRAFTS_KEY = "pendingRecipeDrafts";

interface ScheduleState {
  nextDue: string;
  lastRunAt?: string;
}

interface PendingRecipeDraft {
  recipe: Recipe;
  theme: "light" | "dark";
  nextVerified: boolean;
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
  const currentUrl = sanitizeCapturedUrl(startUrl);
  let safeStartUrl = currentUrl;
  try {
    const draftUrl = new URL(sanitizeCapturedUrl(capture.startUrl));
    if (draftUrl.origin === new URL(currentUrl).origin) {
      safeStartUrl = draftUrl.href;
    }
  } catch {
    // New drafts use the current tab URL if their stored URL is unavailable.
  }
  const url = new URL(safeStartUrl);
  return {
    ...capture,
    projectId: capture.projectId || DEFAULT_PROJECT_ID,
    origin: url.origin,
    startUrl: safeStartUrl,
    createdAt: capture.createdAt || now,
    updatedAt: now,
  };
}

export default defineBackground(() => {
  const storage = extensionBrowser.storage.local as StorageArea;
  const projects = createSettingsRepository<Project>(storage, "projects");
  const recipes = createSettingsRepository<Recipe>(storage, "recipes");
  const captures = new CaptureDatabase();
  const appSettings = createAppSettingsStore(storage);
  const executionResults = new Map<string, PageExecutionResult>();
  const executionAssets = new Map<string, DownloadedAsset[]>();

  const readPendingRecipeDrafts = async (): Promise<
    Record<string, PendingRecipeDraft>
  > => {
    const result = await storage.get(PENDING_RECIPE_DRAFTS_KEY);
    const value = result[PENDING_RECIPE_DRAFTS_KEY];
    return typeof value === "object" && value !== null
      ? (value as Record<string, PendingRecipeDraft>)
      : {};
  };

  const putPendingRecipeDraft = async (
    tabId: number,
    draft: PendingRecipeDraft,
  ) => {
    const drafts = await readPendingRecipeDrafts();
    drafts[String(tabId)] = draft;
    await storage.set({ [PENDING_RECIPE_DRAFTS_KEY]: drafts });
  };

  const getPendingRecipeDraft = async (tabId: number) =>
    (await readPendingRecipeDrafts())[String(tabId)];

  const removePendingRecipeDraft = async (tabId: number) => {
    const drafts = await readPendingRecipeDrafts();
    if (!(String(tabId) in drafts)) return;
    delete drafts[String(tabId)];
    await storage.set({ [PENDING_RECIPE_DRAFTS_KEY]: drafts });
  };

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

  const sendRecipeToTab = async (
    recipe: Recipe,
    tabId: number,
  ): Promise<PageExecutionResult> => {
    await ensureContentScript(tabId);
    return (await extensionBrowser.tabs.sendMessage(tabId, {
      type: "SCRAPEYY_RUN_RECIPE",
      recipe,
    })) as PageExecutionResult;
  };

  const advanceRecipeTab = async (
    recipe: Recipe,
    tabId: number,
  ): Promise<AdvanceResult> => {
    return advanceAcrossNavigation({
      tabId,
      timeoutMs: recipe.traversal.timeoutMs,
      onUpdated: extensionBrowser.tabs.onUpdated,
      sendAdvance: () =>
        ensureContentScript(tabId)
          .then(() => extensionBrowser.tabs.sendMessage(tabId, {
            type: "SCRAPEYY_ADVANCE_RECIPE_PAGE",
            recipe,
          }))
          .then((result) => result as AdvanceResult),
      afterNavigation: async () => {
        await waitForTabComplete(tabId);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      },
    });
  };

  const testRecipeNext = async (
    capture: PickerCapture,
    tabId: number,
    tabUrl: string,
    theme: "light" | "dark",
  ): Promise<{ result: AdvanceResult }> => {
    const recipe = recipeFromPicker(capture, tabUrl);
    await putPendingRecipeDraft(tabId, {
      recipe,
      theme,
      nextVerified: false,
    });
    let resultSource: "page" | "navigation" | undefined;
    const result = await advanceAcrossNavigation({
      tabId,
      timeoutMs: recipe.traversal.timeoutMs,
      onUpdated: extensionBrowser.tabs.onUpdated,
      sendAdvance: () =>
        ensureContentScript(tabId)
          .then(() => extensionBrowser.tabs.sendMessage(tabId, {
            type: "SCRAPEYY_ADVANCE_RECIPE_PAGE",
            recipe,
          }))
          .then((value) => value as AdvanceResult),
      afterNavigation: async () => {
        await putPendingRecipeDraft(tabId, {
          recipe,
          theme,
          nextVerified: true,
        });
        await waitForTabComplete(tabId);
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        await ensureContentScript(tabId);
        await ensureDefaultProject();
        const savedProjects = await projects.list();
        await extensionBrowser.tabs.sendMessage(tabId, {
          type: "SCRAPEYY_START_RECIPE_PICKER",
          recipe,
          projects: savedProjects,
          theme,
          resumeStep: 1,
          nextVerified: true,
          resumedDraft: true,
          notice: "Next button verified after navigation. Your recipe draft was restored.",
        });
        await removePendingRecipeDraft(tabId);
      },
      onResult: (source) => {
        resultSource = source;
      },
    });
    if (resultSource === "page") {
      await removePendingRecipeDraft(tabId);
    }
    return { result };
  };

  const resumePendingRecipeDraft = async (tabId: number): Promise<boolean> => {
    const pending = await getPendingRecipeDraft(tabId);
    if (!pending) return false;
    await ensureContentScript(tabId);
    await ensureDefaultProject();
    const savedProjects = await projects.list();
    await extensionBrowser.tabs.sendMessage(tabId, {
      type: "SCRAPEYY_START_RECIPE_PICKER",
      recipe: pending.recipe,
      projects: savedProjects,
      theme: pending.theme,
      resumeStep: 1,
      nextVerified: pending.nextVerified,
      resumedDraft: true,
      notice: pending.nextVerified
        ? "Next button verified after navigation. Your recipe draft was restored."
        : "Your recipe draft was restored after navigation. Test the Next button again to verify it.",
    });
    await removePendingRecipeDraft(tabId);
    return true;
  };

  const executeNextOnTab = async (
    recipe: Recipe,
    tabId: number,
  ): Promise<PageExecutionResult> => {
    if (recipe.traversal.kind !== "next") {
      return sendRecipeToTab(recipe, tabId);
    }
    const warnings: string[] = [];
    const errors: NonNullable<PageExecutionResult["errors"]> = [];
    let design: PageExecutionResult["design"];
    let designBounds: PageExecutionResult["designBounds"];
    const references = new Map<string, AssetReference>();
    const media: VideoInventory = { pageUrl: recipe.startUrl, videos: [], notes: [] };
    const singlePageRecipe: Recipe = {
      ...recipe,
      traversal: {
        kind: "none",
        maxPages: 1,
        maxItems: recipe.traversal.maxItems,
        delayMs: 0,
        timeoutMs: recipe.traversal.timeoutMs,
      },
    };
    const traversal = await runTraversal(
      recipe.traversal,
      {
        cancelled: () => false,
        wait: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
        advanceNext: () => advanceRecipeTab(recipe, tabId),
        advanceScroll: async () => "complete",
      },
      async () => {
        const page = await sendRecipeToTab(singlePageRecipe, tabId);
        warnings.push(...page.warnings);
        errors.push(...(page.errors ?? []));
        design = page.design ?? design;
        designBounds = page.designBounds ?? designBounds;
        for (const asset of page.assetReferences ?? page.design?.assets ?? []) references.set(asset.url, asset);
        if (page.media) {
          media.videos.push(...page.media.videos);
          media.notes = page.media.notes;
        }
        return page.records;
      },
      (record) => fingerprintRecord(record, recipe.fields),
    );
    return {
      records: traversal.records,
      assetReferences: [...references.values()],
      ...(recipe.mode !== "design" ? { media } : {}),
      warnings: [...new Set([...warnings, ...traversal.warnings])],
      errors,
      ...(design ? { design } : {}),
      ...(designBounds ? { designBounds } : {}),
    };
  };

  const executeOnTab = async (
    recipe: Recipe,
    tabId: number,
  ): Promise<PageExecutionResult> => {
    const result = recipe.traversal.kind === "next"
      ? await executeNextOnTab(recipe, tabId)
      : await sendRecipeToTab(recipe, tabId);
    if (result.assetReferences || result.design) {
      const downloaded = await downloadReferencedAssetsFromPage(
        tabId,
        result.assetReferences ?? result.design?.assets ?? [],
      );
      result.warnings.push(...downloaded.warnings);
      executionAssets.set(recipe.id, downloaded.assets);
    }
    executionResults.set(recipe.id, result);
    return result;
  };

  const execute = async (
    recipe: Recipe,
    trigger: CaptureRun["trigger"],
  ): Promise<PageExecutionResult> => {
    const tab = await acquireRecipeTab(recipe.startUrl, recipe.origin, {
      dedicated:
        trigger !== "manual" || recipe.manualRunInWorkerTab === true,
    });
    try {
      return await executeOnTab(recipe, tab.tabId);
    } finally {
      await releaseRecipeTab(tab);
    }
  };

  const storeRunArtifacts = async (
    run: CaptureRun,
    recipe: Recipe,
    result: Pick<PageExecutionResult, "design" | "assetReferences" | "media">,
    storeRecipeSnapshot = false,
    downloadedAssets: DownloadedAsset[] = [],
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
    await storeReferenceAssets(run.id, downloadedAssets, captures);
    await captures.putArtifact({
      id: run.id + ":resources", runId: run.id, name: "resources.json",
      blob: new Blob([JSON.stringify({ assetReferences: result.assetReferences,
        media: result.media ? videoMetadataForExport(result.media) : undefined })],
        { type: "application/json" }),
    });
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

  const exportRun = async (runId: string): Promise<number> => {
    const run = await captures.getRun(runId);
    if (!run) throw new Error("Capture run not found");
    if (run.screenshot) {
      try {
        const artifact = await captures.getArtifact(`${run.id}:screenshot`);
        if (!artifact) throw new Error("Screenshot file not found in the inbox");
        const settings = await appSettings.get();
        const saved = await downloadScreenshot(artifact.blob, `${settings.screenshotSubfolder}/${run.screenshot.filename}`, true);
        await captures.putRun({ ...run, exportState: "complete" });
        return saved.downloadId;
      } catch (error) {
        await captures.putRun({ ...run, exportState: "failed" });
        throw error;
      }
    }
    const recipe = await recipeForRun(run);
    if (!recipe) throw new Error("Recipe snapshot not found");
    const project =
      (await projects.get(run.projectId)) ?? (await ensureDefaultProject());
    try {
      const design = await designForRun(run.id);
      const assets = await loadReferenceAssets(run.id, captures);
      const resourcesArtifact = await captures.getArtifact(run.id + ":resources");
      const resources = resourcesArtifact
        ? JSON.parse(await resourcesArtifact.blob.text()) as Pick<PageExecutionResult, "assetReferences" | "media">
        : {};
      const bundle = await buildRunBundle({
        project,
        recipe,
        run,
        ...resources,
        ...(design ? { design } : {}),
        ...(assets.length > 0 ? { assets } : {}),
      });
      const download = resolveRunDownload(
        await appSettings.get(),
        project,
        recipe,
        run,
      );
      const downloadId = await downloadBundle(
        bundle,
        download.path,
        download.saveAs,
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
      const downloadedAssets = executionAssets.get(run.recipeId) ?? [];
      if (recipe && result) {
        await storeRunArtifacts(run, recipe, result, false, downloadedAssets);
      }
      executionResults.delete(run.recipeId);
      executionAssets.delete(run.recipeId);
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
    if (execution.design) {
      const screenshot =
        request.scope === "full-page"
          ? await captureFullPageScreenshot(
              tabId,
              createTabFullPageCaptureController(
                tabId,
                (targetTabId, message) =>
                  extensionBrowser.tabs.sendMessage(targetTabId, message),
              ),
            )
          : execution.designBounds
            ? await captureElementScreenshot(
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
              )
            : undefined;
      if (screenshot) execution.design.screenshot = screenshot;
    }
    const downloadedAssets = await downloadReferencedAssetsFromPage(
      tabId, execution.assetReferences ?? execution.design?.assets ?? [],
    );
    execution.warnings.push(...downloadedAssets.warnings);
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
    await storeRunArtifacts(
      run,
      recipe,
      execution,
      true,
      downloadedAssets.assets,
    );
    const expired = applyRetention(await captures.listRuns(), 20);
    await Promise.all(expired.map((id) => captures.deleteRun(id)));
    return run;
  };

  extensionBrowser.runtime.onInstalled.addListener(() => {
    void ensureDefaultProject().then(syncSchedules);
  });
  const screenshotTabs = new Set<number>();
  const saveScreenshot = async (tabId: number, kind: "visible" | "full-page" | "selection", bounds?: ElementBounds) => {
    if (screenshotTabs.has(tabId)) throw new Error("A screenshot is already in progress.");
    screenshotTabs.add(tabId);
    try {
      const tab = await extensionBrowser.tabs.get(tabId);
      if (!tab.url || !/^https?:/.test(tab.url)) throw new Error("Open a website to take a screenshot.");
      await ensureContentScript(tabId);
      const visibility = {
        hide: () => extensionBrowser.tabs.sendMessage(tabId, { type: "SCRAPEYY_SET_CAPTURE_UI_HIDDEN", hidden: true }).then(() => undefined),
        show: () => extensionBrowser.tabs.sendMessage(tabId, { type: "SCRAPEYY_SET_CAPTURE_UI_HIDDEN", hidden: false }).then(() => undefined),
      };
      const image = kind === "full-page"
        ? await captureFullPageScreenshot(tabId, createTabFullPageCaptureController(
            tabId, (id, message) => extensionBrowser.tabs.sendMessage(id, message)))
        : kind === "selection" && bounds
          ? await captureElementScreenshot(tabId, bounds)
          : await captureVisibleScreenshot(tabId, visibility);
      if (!image) throw new Error("The screenshot could not be captured. Keep the page selected and try again.");
      const settings = await appSettings.get();
      const filename = safePathSegment(new URL(tab.url).hostname) + "-" + kind + "-" +
        new Date().toISOString().replace(/[:.]/g, "-") + ".png";
      if (settings.screenshotDestination === "inbox") {
        return await saveScreenshotToInbox(image, {
          kind, filename, sourceUrl: tab.url, title: tab.title || new URL(tab.url).hostname,
        }, captures);
      }
      return await downloadScreenshot(image, `${settings.screenshotSubfolder}/${filename}`,
        settings.screenshotDestination === "ask");
    } finally { screenshotTabs.delete(tabId); }
  };
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
      if (value.type === "SCRAPEYY_SCREENSHOT" && typeof value.tabId === "number" &&
          (value.kind === "visible" || value.kind === "full-page")) {
        return saveScreenshot(value.tabId, value.kind);
      }
      if (value.type === "SCRAPEYY_START_SCREENSHOT_SELECTION" && typeof value.tabId === "number") {
        const tabId = value.tabId;
        return ensureContentScript(tabId).then(async () => {
          const response = await extensionBrowser.tabs.sendMessage(tabId, { type: "SCRAPEYY_START_SCREENSHOT_SELECTION" });
          assertSelectionReady(response);
          return response;
        });
      }
      if (value.type === "SCRAPEYY_SAVE_SCREENSHOT_SELECTION" && sender.tab?.id !== undefined && value.bounds) {
        return saveScreenshot(sender.tab.id, "selection", value.bounds as ElementBounds);
      }
      if (value.type === "SCRAPEYY_DOWNLOAD_VIDEO" && typeof value.tabId === "number" && typeof value.url === "string") {
        const tabId = value.tabId;
        const url = value.url;
        return (async () => {
          await ensureContentScript(tabId);
          const inventory = await extensionBrowser.tabs.sendMessage(tabId, { type: "SCRAPEYY_INSPECT_VIDEOS" }) as VideoInventory;
          if (!inventory.videos.some((video) => video.sources.some((source) => source.kind === "file" && source.url === url))) {
            throw new Error("That direct video file is no longer on the page. Scan again.");
          }
          const settings = await appSettings.get();
          const name = safePathSegment(decodeURIComponent(new URL(url).pathname.split("/").pop() || "video"));
          return extensionBrowser.downloads.download({ url, filename: settings.downloadSubfolder + "/Videos/" + name,
            saveAs: settings.downloadBehavior === "ask", conflictAction: "uniquify" });
        })();
      }
      if (value.type === "SCRAPEYY_EXPORT_VIDEO_DETAILS" && typeof value.tabId === "number") {
        const tabId = value.tabId;
        return (async () => {
          await ensureContentScript(tabId);
          const inventory = await extensionBrowser.tabs.sendMessage(tabId, { type: "SCRAPEYY_INSPECT_VIDEOS" }) as VideoInventory;
          const settings = await appSettings.get();
          return downloadBundle(new Blob([JSON.stringify(videoMetadataForExport(inventory), null, 2)], { type: "application/json" }),
            settings.downloadSubfolder + "/Videos/media.json", settings.downloadBehavior === "ask");
        })();
      }
      if (
        (value.type === "SCRAPEYY_START_PICKER" ||
          value.type === "SCRAPEYY_START_QUICK_PICKER") &&
        typeof value.tabId === "number"
      ) {
        return ensureContentScript(value.tabId)
          .then(() =>
            extensionBrowser.tabs.sendMessage(value.tabId as number, {
              type: "SCRAPEYY_START_QUICK_PICKER",
              theme: value.theme === "light" ? "light" : "dark",
            }),
          )
          .then(() => ({ ok: true }));
      }
      if (
        value.type === "SCRAPEYY_START_RECIPE_PICKER" &&
        typeof value.tabId === "number"
      ) {
        void removePendingRecipeDraft(value.tabId);
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
            theme: value.theme === "light" ? "light" : "dark",
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
          .then(() =>
            sender.tab?.id === undefined
              ? undefined
              : removePendingRecipeDraft(sender.tab.id),
          )
          .then(syncSchedules)
          .then(() => ({ ok: true, recipeId: recipe.id }));
      }
      if (
        value.type === "SCRAPEYY_TEST_RECIPE_NEXT" &&
        value.capture &&
        sender.tab?.id !== undefined &&
        sender.tab.url
      ) {
        return testRecipeNext(
          value.capture as PickerCapture,
          sender.tab.id,
          sender.tab.url,
          value.theme === "light" ? "light" : "dark",
        );
      }
      if (
        value.type === "SCRAPEYY_RUN_RECIPE" &&
        typeof value.recipeId === "string"
      ) {
        return runSavedRecipe(value.recipeId, "manual");
      }
      if (
        value.type === "SCRAPEYY_DELETE_RECIPE" &&
        typeof value.recipeId === "string"
      ) {
        return recipes
          .remove(value.recipeId)
          .then(syncSchedules)
          .then(() => ({ ok: true }));
      }
      if (
        value.type === "SCRAPEYY_PENDING_RECIPE_STATUS" &&
        typeof value.tabId === "number"
      ) {
        return getPendingRecipeDraft(value.tabId).then((draft) => ({
          pending: Boolean(draft),
        }));
      }
      if (
        value.type === "SCRAPEYY_RESUME_PENDING_RECIPE" &&
        typeof value.tabId === "number"
      ) {
        return resumePendingRecipeDraft(value.tabId).then((restored) => ({
          restored,
        }));
      }
      if (
        value.type === "SCRAPEYY_EXPORT_RUN" &&
        typeof value.runId === "string"
      ) {
        return exportRun(value.runId).then((downloadId) => ({
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
