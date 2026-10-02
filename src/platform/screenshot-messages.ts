import { version } from "../../package.json";

export const CAPTURE_VERSION = version;
export const RELOAD_CAPTURE_MESSAGE =
  "Scrapeyy did not confirm the screenshot command. In Zen or Firefox, open about:debugging#/runtime/this-firefox, click Reload for Scrapeyy, then try again.";

export interface ScreenshotSaved {
  status: "saved";
  version: string;
  downloadId: number;
  filename: string;
}

export function assertSelectionReady(response: unknown): void {
  const value = response as { status?: string; version?: string } | undefined;
  if (value?.status !== "selection-ready" || value.version !== CAPTURE_VERSION) {
    throw new Error(RELOAD_CAPTURE_MESSAGE);
  }
}

export function screenshotSaved(response: unknown): ScreenshotSaved {
  const value = response as Partial<ScreenshotSaved> | undefined;
  if (value?.status !== "saved" || value.version !== CAPTURE_VERSION ||
      !Number.isInteger(value.downloadId) || typeof value.filename !== "string" || !value.filename) {
    throw new Error(RELOAD_CAPTURE_MESSAGE);
  }
  return value as ScreenshotSaved;
}
