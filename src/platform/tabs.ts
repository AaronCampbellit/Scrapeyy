import { extensionBrowser } from "./browser-api";

export interface AcquiredTab {
  tabId: number;
  created: boolean;
}

export async function acquireRecipeTab(
  startUrl: string,
  origin: string,
  options: { dedicated?: boolean } = {},
): Promise<AcquiredTab> {
  if (!options.dedicated) {
    const existing = await extensionBrowser.tabs.query({
      url: `${new URL(origin).origin}/*`,
    });
    const reusable = existing.find((tab) => tab.id !== undefined);
    if (reusable?.id !== undefined) {
      if (reusable.url !== startUrl) {
        await extensionBrowser.tabs.update(reusable.id, { url: startUrl });
      }
      await waitForTabComplete(reusable.id);
      return { tabId: reusable.id, created: false };
    }
  }
  const created = await extensionBrowser.tabs.create({
    url: startUrl,
    active: false,
  });
  if (created.id === undefined) {
    throw new Error("Browser did not return an id for the recipe tab");
  }
  await waitForTabComplete(created.id);
  return { tabId: created.id, created: true };
}

export async function releaseRecipeTab(tab: AcquiredTab): Promise<void> {
  if (tab.created) {
    await extensionBrowser.tabs.remove(tab.tabId);
  }
}

export async function waitForTabComplete(
  tabId: number,
  timeoutMs = 30_000,
): Promise<void> {
  const current = await extensionBrowser.tabs.get(tabId);
  if (current.status === "complete") {
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      extensionBrowser.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for the recipe page to load"));
    }, timeoutMs);
    const listener = (
      updatedTabId: number,
      changeInfo: { status?: string },
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timer);
        extensionBrowser.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    extensionBrowser.tabs.onUpdated.addListener(listener);
  });
}
