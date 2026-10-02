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

export interface ScreenshotInboxSaved {
  status: "saved";
  version: string;
  destination: "inbox";
  runId: string;
  filename: string;
}
export type ScreenshotResult = ScreenshotSaved | ScreenshotInboxSaved;

export function assertSelectionReady(response: unknown): void {
  const value = response as { status?: string; version?: string } | undefined;
  if (value?.status !== "selection-ready" || value.version !== CAPTURE_VERSION) {
    throw new Error(RELOAD_CAPTURE_MESSAGE);
  }
}

export function screenshotSaved(response: unknown): ScreenshotResult {
  const value = response as (Partial<ScreenshotSaved> & Partial<ScreenshotInboxSaved>) | undefined;
  if (value?.status !== "saved" || value.version !== CAPTURE_VERSION ||
      typeof value.filename !== "string" || !value.filename ||
      (value.destination === "inbox" ? typeof value.runId !== "string" || !value.runId : !Number.isInteger(value.downloadId))) {
    throw new Error(RELOAD_CAPTURE_MESSAGE);
  }
  return value as ScreenshotResult;
}
