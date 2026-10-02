import { safePathSegment } from "../export/filename";
import type { StorageArea } from "./settings-repository";

export type AppTheme = "dark" | "light";
export type DownloadBehavior = "ask" | "automatic";
export type ScreenshotDestination = DownloadBehavior | "inbox";

export interface AppSettings {
  theme: AppTheme;
  downloadBehavior: DownloadBehavior;
  downloadSubfolder: string;
  screenshotDestination: ScreenshotDestination;
  screenshotSubfolder: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: "dark",
  downloadBehavior: "ask",
  downloadSubfolder: "Scrapeyy",
  screenshotDestination: "ask",
  screenshotSubfolder: "Scrapeyy/Screenshots",
};

const APP_SETTINGS_KEY = "appSettings";

function normalizeDownloadSubfolder(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_APP_SETTINGS.downloadSubfolder;
  const segments = value
    .normalize("NFKC")
    .replaceAll("\\", "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment !== "" && segment !== "." && segment !== "..")
    .map(safePathSegment);
  return segments.length > 0
    ? segments.join("/")
    : DEFAULT_APP_SETTINGS.downloadSubfolder;
}

export function normalizeAppSettings(input: unknown): AppSettings {
  const value =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};
  return {
    theme: value.theme === "light" ? "light" : "dark",
    downloadBehavior:
      value.downloadBehavior === "automatic" ? "automatic" : "ask",
    downloadSubfolder: normalizeDownloadSubfolder(value.downloadSubfolder),
    screenshotDestination: value.screenshotDestination === "inbox" || value.screenshotDestination === "automatic" || value.screenshotDestination === "ask"
      ? value.screenshotDestination : value.downloadBehavior === "automatic" ? "automatic" : "ask",
    screenshotSubfolder: typeof value.screenshotSubfolder === "string" && validScreenshotSubfolder(value.screenshotSubfolder)
      ? normalizeDownloadSubfolder(value.screenshotSubfolder)
      : `${normalizeDownloadSubfolder(value.downloadSubfolder)}/Screenshots`,
  };
}

export function validScreenshotSubfolder(value: string): boolean {
  return Boolean(value.trim()) && !/^(?:[a-z]:|[\\/])|(^|[\\/])\.\.([\\/]|$)/i.test(value.trim());
}

export function createAppSettingsStore(area: StorageArea) {
  return {
    async get(): Promise<AppSettings> {
      const values = await area.get(APP_SETTINGS_KEY);
      return normalizeAppSettings(values[APP_SETTINGS_KEY]);
    },
    async set(settings: AppSettings): Promise<AppSettings> {
      const normalized = normalizeAppSettings(settings);
      await area.set({ [APP_SETTINGS_KEY]: normalized });
      return normalized;
    },
  };
}
