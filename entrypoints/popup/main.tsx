import React from "react";
import ReactDOM from "react-dom/client";

import type { Recipe } from "../../src/contracts/models";
import { PopupApp } from "../../src/features/popup/PopupApp";
import { extensionBrowser } from "../../src/platform/browser-api";
import {
  hasOriginAccess,
  requestOriginAccess,
  revokeOriginAccess,
} from "../../src/platform/permissions";
import {
  createSettingsRepository,
  type StorageArea,
} from "../../src/storage/settings-repository";

const recipes = createSettingsRepository<Recipe>(
  extensionBrowser.storage.local as StorageArea,
  "recipes",
);

async function loadPopup() {
  const [tab] = await extensionBrowser.tabs.query({
    active: true,
    currentWindow: true,
  });
  const url = tab?.url;
  let origin: string | undefined;
  try {
    origin = url ? new URL(url).origin : undefined;
  } catch {
    origin = undefined;
  }
  const available = Boolean(
    origin && (origin.startsWith("http://") || origin.startsWith("https://")),
  );
  const access =
    available && origin && (await hasOriginAccess(origin))
      ? "persistent"
      : available
        ? "one-time"
        : "unavailable";
  const siteRecipes = (await recipes.list()).filter(
    (recipe) => recipe.origin === origin,
  );

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <PopupApp
        site={{ origin: origin ?? "Browser page", access }}
        recipes={siteRecipes}
        onQuickCapture={async () => {
          await extensionBrowser.runtime.sendMessage({
            type: "SCRAPEYY_START_PICKER",
            tabId: tab?.id,
          });
          window.close();
        }}
        onRunRecipe={async (recipeId) => {
          await extensionBrowser.runtime.sendMessage({
            type: "SCRAPEYY_RUN_RECIPE",
            recipeId,
          });
          window.close();
        }}
        onOpenDashboard={async () => {
          await extensionBrowser.tabs.create({
            url: extensionBrowser.runtime.getURL("dashboard.html" as never),
          });
          window.close();
        }}
        onTogglePersistentAccess={async (siteOrigin, enable) => {
          if (enable) await requestOriginAccess(siteOrigin);
          else await revokeOriginAccess(siteOrigin);
          window.location.reload();
        }}
      />
    </React.StrictMode>,
  );
}

void loadPopup();
