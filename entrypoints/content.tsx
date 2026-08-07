import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import type {
  QuickCaptureRequest,
  Project,
  Recipe,
  RunError,
} from "../src/contracts/models";
import { createDesignSnapshot } from "../src/design/snapshot";
import { extractRecords } from "../src/extraction/extract";
import { fingerprintRecord } from "../src/extraction/fingerprint";
import { extractQuickData } from "../src/extraction/quick-extract";
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
import { advanceInfiniteScroll } from "../src/traversal/infinite-scroll";
import { advanceNextControl } from "../src/traversal/next";
import { runTraversal } from "../src/traversal/run-traversal";

async function executeRecipe(recipe: Recipe) {
  const errors: RunError[] = [];
  let matchedAPage = false;
  const result = await runTraversal(
    recipe.traversal,
    {
      cancelled: () => false,
      wait: (delayMs) =>
        new Promise((resolve) => window.setTimeout(resolve, delayMs)),
      advanceNext: (selector, timeoutMs) =>
        advanceNextControl(document, selector, timeoutMs),
      advanceScroll: (stepPx, timeoutMs) =>
        advanceInfiniteScroll(window, stepPx, timeoutMs),
    },
    async () => {
      const selectorMatched =
        document.querySelector(recipe.containerSelector) !== null;
      if (!selectorMatched) {
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
          pageUrl: window.location.href,
          selector: recipe.containerSelector,
        });
        return [];
      }
      matchedAPage = true;
      return extractRecords(
        document,
        recipe.containerSelector,
        recipe.fields,
      );
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
    records: result.records,
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

async function executeQuickCapture(
  request: QuickCaptureRequest,
): Promise<QuickPageExecutionResult> {
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
          pageUrl: window.location.href,
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
    let fullPageCaptureController: FullPageCaptureController | undefined;

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
    ) => {
      if (ui) {
        ui.remove();
        ui = undefined;
      }
      ui = await createShadowRootUi(ctx, {
        name: "scrapeyy-picker",
        position: "overlay",
        zIndex: 2_147_483_640,
        isolateEvents: true,
        onMount(container) {
          const root = createRoot(container);
          const close = () => ui?.remove();
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
              {...(initialRecipe ? { initialRecipe } : {})}
              onQuickCapture={(capture) =>
                browser.runtime
                  .sendMessage({ type: "SCRAPEYY_QUICK_CAPTURE", capture })
                  .then(() => {
                    window.setTimeout(close, 900);
                  })
              }
              onClose={close}
              onSaveRecipe={saveRecipe}
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
      if (value.type === "SCRAPEYY_PING") {
        return Promise.resolve({ ok: true });
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
      return undefined;
    };
    browser.runtime.onMessage.addListener(handleRuntimeMessage);
    ctx.onInvalidated(() => {
      browser.runtime.onMessage.removeListener(handleRuntimeMessage);
    });
  },
});
