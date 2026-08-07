import type { CaptureRun, Project, Recipe } from "../contracts/models";
import type { AppSettings } from "../storage/app-settings";
import { buildDownloadPath } from "./filename";

export interface RunDownload {
  path: string;
  saveAs: boolean;
}

export function resolveRunDownload(
  settings: AppSettings,
  project: Project,
  recipe: Recipe,
  run: CaptureRun,
): RunDownload {
  return {
    path: buildDownloadPath(
      project,
      recipe,
      run,
      settings.downloadSubfolder,
    ),
    saveAs: settings.downloadBehavior === "ask",
  };
}
