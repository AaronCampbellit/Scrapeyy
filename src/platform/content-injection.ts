import type { ScriptPublicPath } from "wxt/utils/inject-script";

import { extensionBrowser } from "./browser-api";

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
    if (
      typeof response === "object" &&
      response !== null &&
      (response as { ok?: boolean }).ok
    ) {
      return;
    }
  } catch {
    // A missing receiving end is the expected first-run state.
  }
  await api.insertCSS(tabId, "content-scripts/content.css");
  await api.executeScript(tabId, "content-scripts/content.js");
  const response = await api.sendMessage(tabId, { type: "SCRAPEYY_PING" });
  if (
    typeof response !== "object" ||
    response === null ||
    !(response as { ok?: boolean }).ok
  ) {
    throw new Error("Scrapeyy could not start on this page");
  }
}
