import { createRoot, type Root } from "react-dom/client";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import type { Recipe } from "../src/contracts/models";
import { createDesignSnapshot } from "../src/design/snapshot";
import { extractRecords } from "../src/extraction/extract";
import { fingerprintRecord } from "../src/extraction/fingerprint";
import {
  PickerApp,
  type PickerCapture,
} from "../src/features/picker/PickerApp";
import "../src/features/picker/picker.css";
import { advanceInfiniteScroll } from "../src/traversal/infinite-scroll";
import { advanceNextControl } from "../src/traversal/next";
import { runTraversal } from "../src/traversal/run-traversal";

async function executeRecipe(recipe: Recipe) {
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
    async () =>
      extractRecords(document, recipe.containerSelector, recipe.fields),
    (record) => fingerprintRecord(record, recipe.fields),
  );
  const selected = document.querySelector(recipe.containerSelector);
  const design =
    selected && recipe.mode !== "data"
      ? await createDesignSnapshot(selected)
      : undefined;
  return {
    records: result.records,
    warnings: result.warnings,
    ...(design === undefined ? {} : { design }),
  };
}

export default defineContentScript({
  registration: "runtime",
  cssInjectionMode: "ui",
  async main(ctx) {
    let ui:
      | Awaited<ReturnType<typeof createShadowRootUi<Root>>>
      | undefined;

    const mountPicker = async () => {
      if (ui) {
        ui.mount();
        return;
      }
      ui = await createShadowRootUi(ctx, {
        name: "scrapeyy-picker",
        position: "overlay",
        zIndex: 2_147_483_640,
        isolateEvents: true,
        onMount(container) {
          const root = createRoot(container);
          const close = () => ui?.remove();
          const send = (type: string, capture: PickerCapture) => {
            void browser.runtime.sendMessage({ type, capture });
          };
          root.render(
            <PickerApp
              ownerDocument={document}
              projectId="default-project"
              projectName="Local captures"
              onCapture={(capture) =>
                send("SCRAPEYY_QUICK_CAPTURE", capture)
              }
              onClose={close}
              onSaveRecipe={(capture) =>
                send("SCRAPEYY_SAVE_PICKER_RECIPE", capture)
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

    browser.runtime.onMessage.addListener((message: unknown) => {
      if (typeof message !== "object" || message === null) {
        return undefined;
      }
      const value = message as Record<string, unknown>;
      if (value.type === "SCRAPEYY_PING") {
        return Promise.resolve({ ok: true });
      }
      if (value.type === "SCRAPEYY_START_PICKER") {
        return mountPicker().then(() => ({ ok: true }));
      }
      if (value.type === "SCRAPEYY_RUN_RECIPE" && value.recipe) {
        return executeRecipe(value.recipe as Recipe);
      }
      return undefined;
    });
  },
});
