import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import type {
  QuickCaptureRequest,
  Project,
  Recipe,
  RunError,
} from "../src/contracts/models";
import { createDesignSnapshot } from "../src/design/snapshot";
import { collectAssetReferences, type AssetReference } from "../src/design/assets";
import { collectVideos, type VideoInventory } from "../src/media/videos";
import { ScreenshotSelection } from "../src/features/picker/ScreenshotSelection";
import { CAPTURE_VERSION, screenshotSaved } from "../src/platform/screenshot-messages";
import { extractRecords } from "../src/extraction/extract";
import { fingerprintRecord } from "../src/extraction/fingerprint";
import { extractQuickData } from "../src/extraction/quick-extract";
import { sanitizeCapturedUrl } from "../src/extraction/normalize";
import { extractSmartRecords } from "../src/extraction/smart-extract";
import {
  PickerApp,
  type PickerCapture,
} from "../src/features/picker/PickerApp";
import "../src/features/picker/picker.css";
import {
  createCaptureUiVisibility,
  findCaptureUiHost,
} from "../src/platform/capture-ui";
import { createFullPageCaptureController } from "../src/platform/full-page-controller";
import type { FullPageCaptureController } from "../src/platform/screenshots";
import type { AppTheme } from "../src/storage/app-settings";
import type { QuickPageExecutionResult } from "../src/run/quick-run";
import { scrapeSharePointMetadata } from "../src/sharepoint/scrape";
import { advanceInfiniteScroll } from "../src/traversal/infinite-scroll";
import { advanceNextControl } from "../src/traversal/next";
import { runTraversal } from "../src/traversal/run-traversal";
import { traversalForExecution } from "../src/traversal/settings";
import type { AdvanceResult } from "../src/traversal/types";

async function executeRecipe(recipe: Recipe) {
  const errors: RunError[] = [];
  const assetReferences = new Map<string, AssetReference>();
  const media: VideoInventory = { pageUrl: window.location.href, videos: [], notes: [] };
  let matchedAPage = false;
  const readCurrentPage = (): {
    container?: Element;
    datasetMatched: boolean;
    records: Record<string, string | null>[];
  } => {
    const container = document.querySelector(recipe.containerSelector) ?? undefined;
    if (!container) return { datasetMatched: false, records: [] };
    if (recipe.extraction?.kind === "smart") {
      const extraction = extractSmartRecords(
        document,
        recipe.containerSelector,
        recipe.extraction.datasetKey,
        recipe.fields,
        window.location.href,
      );
      return {
        container,
        datasetMatched: Boolean(extraction.dataset),
        records: extraction.records,
      };
    }
    return {
      container,
      datasetMatched: true,
      records: extractRecords(document, recipe.containerSelector, recipe.fields),
    };
  };
  const result = await runTraversal(
    traversalForExecution(recipe.traversal),
    {
      cancelled: () => false,
      wait: (delayMs) =>
        new Promise((resolve) => window.setTimeout(resolve, delayMs)),
      advanceNext: (selector, matchIndex, timeoutMs) => {
        const beforeKeys = new Set(
          readCurrentPage().records.map((record) =>
            fingerprintRecord(record, recipe.fields),
          ),
        );
        return advanceNextControl(document, selector, timeoutMs, {
          ...(matchIndex === undefined ? {} : { matchIndex }),
          readySignature: () => {
            const keys = readCurrentPage().records.map((record) =>
              fingerprintRecord(record, recipe.fields),
            );
            return keys.some((key) => !beforeKeys.has(key))
              ? JSON.stringify(keys)
              : undefined;
          },
          settleMs: 500,
        });
      },
      advanceScroll: (stepPx, timeoutMs) =>
        advanceInfiniteScroll(window, stepPx, timeoutMs),
    },
    async () => {
      const page = readCurrentPage();
      const container = page.container;
      if (!container) {
        const authenticationVisible =
          document.querySelector('input[type="password"]') !== null;
        errors.push({
          code: authenticationVisible ? "AUTHENTICATION_REQUIRED" : "SELECTOR_CHANGED",
          message: authenticationVisible
            ? "The site requires an authenticated browser session."
            : matchedAPage
              ? "The item selector stopped matching on a later page."
              : "The configured item selector no longer matches this page.",
          recoverable: true,
          pageUrl: sanitizeCapturedUrl(window.location.href),
          selector: recipe.containerSelector,
        });
        return [];
      }
      matchedAPage = true;
      for (const match of document.querySelectorAll(recipe.containerSelector)) {
        for (const asset of collectAssetReferences(match)) assetReferences.set(asset.url, asset);
        if (recipe.mode !== "design") {
          const found = collectVideos(match);
          media.videos.push(...found.videos);
          media.notes = found.notes;
        }
      }
      if (recipe.extraction?.kind === "smart") {
        if (!page.datasetMatched) {
          errors.push({
            code: "DATASET_CHANGED",
            message: "The saved dataset was not detected on this page.",
            recoverable: true,
            pageUrl: sanitizeCapturedUrl(window.location.href),
            selector: recipe.containerSelector,
          });
        }
        return page.records;
      }
      return page.records;
    },
    (record) => fingerprintRecord(record, recipe.fields),
  );
  const selected = document.querySelector(recipe.containerSelector);
  const design =
    selected && recipe.mode !== "data"
      ? await createDesignSnapshot(selected)
      : undefined;
  const bounds = selected?.getBoundingClientRect();
  return {
    records: recipe.mode === "design" ? [] : result.records,
    assetReferences: [...assetReferences.values()],
    ...(recipe.mode !== "design" ? { media } : {}),
    warnings: result.warnings,
    errors,
    ...(design === undefined ? {} : { design }),
    ...(design && bounds
      ? {
          designBounds: {
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          },
        }
      : {}),
  };
}

function recordsForRecipe(recipe: Recipe) {
  if (!document.querySelector(recipe.containerSelector)) return [];
  if (recipe.extraction?.kind === "smart") {
    return extractSmartRecords(
      document,
      recipe.containerSelector,
      recipe.extraction.datasetKey,
      recipe.fields,
      window.location.href,
    ).records;
  }
  return extractRecords(document, recipe.containerSelector, recipe.fields);
}

async function advanceRecipeOnce(recipe: Recipe) {
  if (recipe.traversal.kind !== "next") return "missing" as const;
  const beforeKeys = new Set(
    recordsForRecipe(recipe).map((record) =>
      fingerprintRecord(record, recipe.fields),
    ),
  );
  return advanceNextControl(
    document,
    recipe.traversal.nextSelector,
    recipe.traversal.timeoutMs,
    {
      ...(recipe.traversal.nextMatchIndex === undefined
        ? {}
        : { matchIndex: recipe.traversal.nextMatchIndex }),
      readySignature: () => {
        const keys = recordsForRecipe(recipe).map((record) =>
          fingerprintRecord(record, recipe.fields),
        );
        return keys.some((key) => !beforeKeys.has(key))
          ? JSON.stringify(keys)
          : undefined;
      },
      settleMs: 500,
    },
  );
}

async function executeQuickCapture(
  request: QuickCaptureRequest,
): Promise<QuickPageExecutionResult> {
  await new Promise<void>((resolve) => {
    let finished = false;
    let quietTimer: number;
    let maximumTimer: number;
    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(quietTimer);
      window.clearTimeout(maximumTimer);
      observer.disconnect();
      resolve();
    };
    const scheduleQuietFinish = () => {
      window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(finish, 350);
    };
    const observer = new MutationObserver(scheduleQuietFinish);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    scheduleQuietFinish();
    maximumTimer = window.setTimeout(finish, 2_000);
  });
  const selected =
    request.scope === "full-page"
      ? document.documentElement
      : document.querySelector(request.containerSelector);
  if (!selected) {
    return {
      strategy: "generic",
      fields: [],
      records: [],
      warnings: [],
      errors: [
        {
          code: "SELECTOR_CHANGED",
          message: "The selected content is no longer available. Reselect it.",
          recoverable: true,
          pageUrl: sanitizeCapturedUrl(window.location.href),
          selector: request.containerSelector,
        },
      ],
    };
  }
  const extraction =
    request.mode === "design"
      ? { strategy: "generic" as const, fields: [], records: [] }
      : extractQuickData(selected, window.location.href);
  const design =
    request.mode === "data"
      ? undefined
      : await createDesignSnapshot(selected);
  const bounds = selected.getBoundingClientRect();
  return {
    ...extraction,
    assetReferences: design?.assets ?? collectAssetReferences(selected),
    ...(request.mode !== "design" ? { media: collectVideos(selected) } : {}),
    warnings: [],
    errors: [],
    ...(design ? { design } : {}),
    ...(design && request.scope === "element"
      ? {
          designBounds: {
            left: bounds.left,
            top: bounds.top,
            width: bounds.width,
            height: bounds.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
          },
        }
      : {}),
  };
}

export default defineContentScript({
  registration: "runtime",
  cssInjectionMode: "ui",
  async main(ctx) {
    let ui:
      | Awaited<ReturnType<typeof createShadowRootUi<Root>>>
      | undefined;
    let activePickerVariant: "quick" | "recipe" | undefined;
    let pickerMinimized = false;
    let fullPageCaptureController: FullPageCaptureController | undefined;
    let screenshotUi: Awaited<ReturnType<typeof createShadowRootUi<Root>>> | undefined;

    const waitForPaint = () =>
      new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => resolve());
        });
      });
    const captureUiVisibility = createCaptureUiVisibility(
      () => findCaptureUiHost(document),
      waitForPaint,
    );
    const setCaptureUiHidden = (hidden: boolean) =>
      hidden ? captureUiVisibility.hide() : captureUiVisibility.show();

    const mountPicker = async (
      variant: "quick" | "recipe",
      initialRecipe?: Recipe,
      availableProjects: Project[] = [],
      theme: AppTheme = "dark",
      resume?: {
        step?: number;
        nextVerified?: boolean;
        notice?: string;
        draft?: boolean;
      },
    ) => {
      const savedMode = (await browser.storage.local.get("captureMode")).captureMode;
      const initialCaptureMode = savedMode === "data" || savedMode === "design" ? savedMode : "both";
      if (ui) {
        ui.remove();
        ui = undefined;
      }
      activePickerVariant = variant;
      pickerMinimized = false;
      ui = await createShadowRootUi(ctx, {
        name: "scrapeyy-picker",
        position: "overlay",
        zIndex: 2_147_483_640,
        isolateEvents: true,
        onMount(container) {
          const root = createRoot(container);
          const close = () => {
            ui?.remove();
            ui = undefined;
            activePickerVariant = undefined;
            pickerMinimized = false;
          };
          const minimize = () => {
            const host = findCaptureUiHost(document);
            if (host) host.style.setProperty("display", "none", "important");
            pickerMinimized = true;
          };
          const saveRecipe = async (capture: PickerCapture) => {
            await browser.runtime.sendMessage({
              type: "SCRAPEYY_SAVE_PICKER_RECIPE",
              capture,
            });
            close();
          };
          root.render(
            <PickerApp
              ownerDocument={document}
              variant={variant}
              projectId="default-project"
              projectName="Local captures"
              projects={availableProjects}
              theme={theme}
              initialCaptureMode={initialCaptureMode}
              onCaptureModeChange={(mode) => { void browser.storage.local.set({ captureMode: mode }); }}
              {...(initialRecipe ? { initialRecipe } : {})}
              {...(resume?.step === undefined ? {} : { initialStep: resume.step })}
              {...(resume?.nextVerified === undefined
                ? {}
                : { initialNextVerified: resume.nextVerified })}
              {...(resume?.notice ? { initialNotice: resume.notice } : {})}
              {...(resume?.draft ? { resumedDraft: true } : {})}
              onQuickCapture={(capture) =>
                browser.runtime
                  .sendMessage({ type: "SCRAPEYY_QUICK_CAPTURE", capture })
                  .then(() => {
                    window.setTimeout(close, 900);
                  })
              }
              onClose={close}
              onMinimize={minimize}
              onSaveRecipe={saveRecipe}
              onTestNext={(capture) =>
                browser.runtime
                  .sendMessage({
                    type: "SCRAPEYY_TEST_RECIPE_NEXT",
                    capture,
                    theme,
                  })
                  .then((response: { result: AdvanceResult }) => response.result)
              }
            />,
          );
          return root;
        },
        onRemove(root) {
          root?.unmount();
        },
      });
      ui.mount();
    };

    const handleRuntimeMessage = (message: unknown) => {
      if (typeof message !== "object" || message === null) {
        return undefined;
      }
      const value = message as Record<string, unknown>;
      if (value.type === "SCRAPEYY_INSPECT_VIDEOS") {
        return Promise.resolve(collectVideos(document.documentElement));
      }
      if (value.type === "SCRAPEYY_START_SCREENSHOT_SELECTION") {
        const mount = async () => {
          screenshotUi?.remove();
          await setCaptureUiHidden(true);
          screenshotUi = await createShadowRootUi(ctx, {
            name: "scrapeyy-screenshot", position: "modal", anchor: document.documentElement,
            zIndex: 2_147_483_647,
            isolateEvents: true,
            onMount(container) {
              const root = createRoot(container);
              const close = () => {
                screenshotUi?.remove();
                screenshotUi = undefined;
                void setCaptureUiHidden(false);
              };
              root.render(<ScreenshotSelection onClose={close} onCapture={async (bounds) => {
                screenshotSaved(await browser.runtime.sendMessage({ type: "SCRAPEYY_SAVE_SCREENSHOT_SELECTION", bounds }));
              }} />);
              return root;
            },
            onRemove(root) { root?.unmount(); },
          });
          screenshotUi.mount();
          await waitForPaint();
          const layer = screenshotUi.shadow.querySelector(".screenshot-selection");
          const rect = layer?.getBoundingClientRect();
          if (!(layer instanceof HTMLDialogElement) || !layer.open || !layer.matches(":modal") ||
              !rect || rect.width < innerWidth - 1 || rect.height < innerHeight - 1) {
            screenshotUi.remove();
            screenshotUi = undefined;
            await setCaptureUiHidden(false);
            throw new Error("The selection tool could not cover this page. Reload Scrapeyy and try again.");
          }
        };
        return mount().then(
          () => ({ status: "selection-ready", version: CAPTURE_VERSION }),
          async (error: unknown) => {
            screenshotUi?.remove();
            screenshotUi = undefined;
            await setCaptureUiHidden(false);
            throw error;
          },
        );
      }
      if (value.type === "SCRAPEYY_PING") {
        return Promise.resolve({ ok: true, version: CAPTURE_VERSION });
      }
      if (value.type === "SCRAPEYY_PICKER_STATUS") {
        return Promise.resolve({
          active: Boolean(ui && activePickerVariant),
          minimized: pickerMinimized,
          variant: activePickerVariant,
        });
      }
      if (value.type === "SCRAPEYY_RESTORE_PICKER") {
        const host = findCaptureUiHost(document);
        if (!ui || !activePickerVariant || !pickerMinimized || !host) {
          return Promise.resolve({ restored: false });
        }
        host.style.removeProperty("display");
        pickerMinimized = false;
        return Promise.resolve({ restored: true, variant: activePickerVariant });
      }
      if (value.type === "SCRAPEYY_SCRAPE_SHAREPOINT") {
        return scrapeSharePointMetadata(window.location, window.fetch.bind(window));
      }
      if (
        value.type === "SCRAPEYY_SET_CAPTURE_UI_HIDDEN" &&
        typeof value.hidden === "boolean"
      ) {
        return setCaptureUiHidden(value.hidden).then(() => ({ ok: true }));
      }
      if (value.type === "SCRAPEYY_PREPARE_FULL_PAGE_CAPTURE") {
        const prepare = async () => {
          if (fullPageCaptureController) {
            await fullPageCaptureController.restore();
          }
          fullPageCaptureController = createFullPageCaptureController(
            window,
            document,
            setCaptureUiHidden,
          );
          return fullPageCaptureController.prepare();
        };
        return prepare();
      }
      if (
        value.type === "SCRAPEYY_SCROLL_FULL_PAGE_CAPTURE" &&
        typeof value.x === "number" &&
        typeof value.y === "number" &&
        typeof value.tileIndex === "number"
      ) {
        if (!fullPageCaptureController) {
          return Promise.reject(
            new Error("Full-page capture was not prepared"),
          );
        }
        return fullPageCaptureController.scrollTo(
          value.x,
          value.y,
          value.tileIndex,
        );
      }
      if (value.type === "SCRAPEYY_MEASURE_FULL_PAGE_CAPTURE") {
        if (!fullPageCaptureController?.measure) return Promise.reject(new Error("Full-page capture was not prepared"));
        return fullPageCaptureController.measure();
      }
      if (value.type === "SCRAPEYY_RESTORE_FULL_PAGE_CAPTURE") {
        const restore = fullPageCaptureController?.restore();
        fullPageCaptureController = undefined;
        return (restore ?? Promise.resolve()).then(() => ({ ok: true }));
      }
      if (
        value.type === "SCRAPEYY_START_QUICK_PICKER" ||
        value.type === "SCRAPEYY_START_PICKER"
      ) {
        return mountPicker(
          "quick",
          undefined,
          [],
          value.theme === "light" ? "light" : "dark",
        ).then(() => ({ ok: true }));
      }
      if (value.type === "SCRAPEYY_START_RECIPE_PICKER") {
        return mountPicker(
          "recipe",
          value.recipe as Recipe | undefined,
          Array.isArray(value.projects)
            ? (value.projects as Project[])
            : [],
          value.theme === "light" ? "light" : "dark",
          {
            ...(typeof value.resumeStep === "number"
              ? { step: value.resumeStep }
              : {}),
            ...(typeof value.nextVerified === "boolean"
              ? { nextVerified: value.nextVerified }
              : {}),
            ...(typeof value.notice === "string"
              ? { notice: value.notice }
              : {}),
            ...(value.resumedDraft === true ? { draft: true } : {}),
          },
        ).then(() => ({ ok: true }));
      }
      if (
        value.type === "SCRAPEYY_EXECUTE_QUICK_CAPTURE" &&
        value.request
      ) {
        return executeQuickCapture(value.request as QuickCaptureRequest);
      }
      if (value.type === "SCRAPEYY_RUN_RECIPE" && value.recipe) {
        return executeRecipe(value.recipe as Recipe);
      }
      if (value.type === "SCRAPEYY_ADVANCE_RECIPE_PAGE" && value.recipe) {
        return advanceRecipeOnce(value.recipe as Recipe);
      }
      return undefined;
    };
    browser.runtime.onMessage.addListener(handleRuntimeMessage);
    ctx.onInvalidated(() => {
      screenshotUi?.remove();
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    });
  },
});
