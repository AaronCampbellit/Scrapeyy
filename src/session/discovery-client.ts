import { extensionBrowser as browser } from "../platform/browser-api";
import { discoveryPermissions, type DiscoveryClient, type DiscoveryState } from "./discovery";

async function command(action: string, tabId: number, extra = {}): Promise<DiscoveryState | undefined> {
  const result = await browser.runtime.sendMessage({ type: "SCRAPEYY_SESSION_DISCOVERY", action, tabId, ...extra }) as
    { ok?: boolean; state?: DiscoveryState };
  if (!result?.ok) throw new Error("Discovery could not connect. Reopen Scrapeyy on the original site and try again.");
  return result.state;
}
export const discoveryClient: DiscoveryClient = {
  get: tabId => command("get", tabId),
  start(tabId, origin, record) {
    // Native permissions must be requested during the button's direct user gesture.
    const requestId = crypto.randomUUID();
    const access = browser.permissions.request(discoveryPermissions(origin, record));
    // Dispatch immediately; background owns all work even if this popup closes for the dialog.
    const job = command("start", tabId, { origin, record, requestId });
    const allowed = access.then(granted => {
      if (!granted) {
        void command("cancel", tabId, { requestId }).catch(() => undefined);
        throw new Error("Website access is needed for discovery. You can retry or enter origins manually.");
      }
    });
    return Promise.all([allowed, job]).then(([, state]) => state);
  },
  update: (tabId, id, selected) => command("update", tabId, { id, selected }),
  stop: (tabId, id) => command("stop", tabId, { id }),
  clear: (tabId, id) => command("clear", tabId, { id }).then(() => undefined),
};
