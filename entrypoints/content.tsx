import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import type {
  QuickCaptureRequest,
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
  const selected = document.querySelector(request.containerSelector);
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
    ...(design
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

    const mountPicker = async (variant: "quick" | "recipe") => {
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

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (typeof message !== "object" || message === null) {
        return undefined;
      }
      const value = message as Record<string, unknown>;
      if (value.type === "SCRAPEYY_PING") {
        return Promise.resolve({ ok: true });
      }
      if (
        value.type === "SCRAPEYY_START_QUICK_PICKER" ||
        value.type === "SCRAPEYY_START_PICKER"
      ) {
        return mountPicker("quick").then(() => ({ ok: true }));
      }
      if (value.type === "SCRAPEYY_START_RECIPE_PICKER") {
        return mountPicker("recipe").then(() => ({ ok: true }));
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
    });
  },
});
