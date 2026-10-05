import React from "react";
import ReactDOM from "react-dom/client";

import type { Recipe } from "../../src/contracts/models";
import {
  PreviewApp,
  type PreviewServices,
} from "../../src/features/preview/PreviewApp";
import { extensionBrowser } from "../../src/platform/browser-api";
import { createAppSettingsStore } from "../../src/storage/app-settings";
import { CaptureDatabase } from "../../src/storage/capture-database";
import {
  createSettingsRepository,
  type StorageArea,
} from "../../src/storage/settings-repository";

const captures = new CaptureDatabase();
const storage = extensionBrowser.storage.local as StorageArea;
const recipes = createSettingsRepository<Recipe>(storage, "recipes");
const settings = createAppSettingsStore(storage);
const services: PreviewServices = {
  async load(runId) {
    const run = await captures.getRun(runId);
    if (!run) return undefined;
    const [artifact, recipe, appSettings] = await Promise.all([
      captures.getArtifact(`${runId}:screenshot`),
      recipes.get(run.recipeId),
      settings.get(),
    ]);
    return {
      run,
      title: run.screenshot
        ? `Screenshot · ${run.screenshot.title}`
        : (recipe?.name ?? "Quick capture"),
      theme: appSettings.theme,
      ...(artifact ? { screenshot: artifact.blob } : {}),
    };
  },
  async exportRun(runId) {
    await extensionBrowser.runtime.sendMessage({
      type: "SCRAPEYY_EXPORT_RUN",
      runId,
    });
  },
};

const params = new URLSearchParams(location.search);
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PreviewApp
      runId={params.get("run")}
      initialView={params.get("view") === "screenshot" ? "screenshot" : "text"}
      services={services}
    />
  </React.StrictMode>,
);
