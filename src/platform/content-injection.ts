import type { ScriptPublicPath } from "wxt/utils/inject-script";

import { extensionBrowser } from "./browser-api";
import { CAPTURE_VERSION } from "./screenshot-messages";

function isCurrentBridge(response: unknown): boolean {
  const value = response as { ok?: boolean; version?: string } | undefined;
  return value?.ok === true && value.version === CAPTURE_VERSION;
}

export interface ContentInjectionApi {
  sendMessage(tabId: number, message: unknown): Promise<unknown>;
  insertCSS(tabId: number, file: string): Promise<void>;
  executeScript(tabId: number, file: string): Promise<unknown>;
}

const defaultApi: ContentInjectionApi = {
  sendMessage: (tabId, message) =>
    extensionBrowser.tabs.sendMessage(tabId, message),
  async insertCSS(tabId, file) {
    await extensionBrowser.scripting.insertCSS({
      target: { tabId },
      files: [file as ScriptPublicPath],
    });
  },
  executeScript: (tabId, file) =>
    extensionBrowser.scripting.executeScript({
      target: { tabId },
      files: [file as ScriptPublicPath],
    }),
};

export async function ensureContentScript(
  tabId: number,
  api: ContentInjectionApi = defaultApi,
): Promise<void> {
  try {
    const response = await api.sendMessage(tabId, { type: "SCRAPEYY_PING" });
    if (isCurrentBridge(response)) {
      return;
    }
  } catch {
    // A missing receiving end is the expected first-run state.
  }
  await api.insertCSS(tabId, "content-scripts/content.css");
  await api.executeScript(tabId, "content-scripts/content.js");
  const response = await api.sendMessage(tabId, { type: "SCRAPEYY_PING" });
  if (!isCurrentBridge(response)) {
    throw new Error("Scrapeyy could not start on this page");
  }
}
