import { extensionBrowser as browser } from "../platform/browser-api";
import { discoveryPermissions, PERMISSION_WAIT_MS, PERMISSION_TIMEOUT, PERMISSION_DENIED, PERMISSION_FAILED,
  type DiscoveryClient, type DiscoveryState } from "./discovery";

async function command(action: string, tabId: number, extra = {}): Promise<DiscoveryState | undefined> {
  const result = await browser.runtime.sendMessage({ type: "SCRAPEYY_SESSION_DISCOVERY", action, tabId, ...extra }) as
    { ok?: boolean; state?: DiscoveryState };
  if (!result?.ok) throw new Error("Discovery could not connect. Reopen Scrapeyy on the original site and try again.");
  return result.state;
}
export const discoveryClient: DiscoveryClient = {
  get: tabId => command("get", tabId),
  start(tabId, origin, record, signal) {
    // Native permissions must be requested during the button's direct user gesture.
    const requestId = crypto.randomUUID();
    const permissions = discoveryPermissions(origin, record);
    if (signal?.aborted) return Promise.reject(new Error("Discovery canceled."));
    let access: Promise<boolean>;
    try { access = browser.permissions.request(permissions); }
    catch { return Promise.reject(new Error(PERMISSION_FAILED)); }
    // Dispatch immediately; background owns all work even if this popup closes for the dialog.
    const job = command("start", tabId, { origin, record, requestId });
    return new Promise<DiscoveryState | undefined>((resolve, reject) => {
      let settled = false, granted = false, handedOff = false;
      let state: DiscoveryState | undefined;
      let poll: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: Error, reason?: string) => {
        if (settled) return;
        if (!error && (!granted || !handedOff)) return;
        settled = true;
        clearTimeout(timeout); clearTimeout(poll);
        signal?.removeEventListener("abort", abort);
        if (error) {
          // Scope cancellation to this attempt. Late prompt responses cannot start or cancel a retry.
          void command("cancel", tabId, { requestId, reason }).catch(() => undefined);
          reject(error);
        } else resolve(state);
      };
      const abort = () => finish(new Error("Discovery canceled. You can dismiss the browser permission prompt."), "canceled");
      const timeout = setTimeout(() => finish(new Error(PERMISSION_TIMEOUT), "timeout"), PERMISSION_WAIT_MS);
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      // Firefox can grant access before settling the popup's request promise.
      // Use actual browser grants as a second signal, never as a substitute for requesting consent.
      const check = async () => {
        if (settled) return;
        try { if (await browser.permissions.contains(permissions)) { granted = true; finish(); } }
        catch { /* The native result or the bounded timeout still settles this attempt. */ }
        if (!settled && !granted) poll = setTimeout(() => void check(), 250);
      };
      access.then(allowed => {
        if (settled) return;
        if (allowed) { granted = true; finish(); }
        else finish(new Error(PERMISSION_DENIED), "denied");
      }, () => finish(new Error(PERMISSION_FAILED), "failed"));
      job.then(next => { state = next; handedOff = true; finish(); }, () => finish(new Error(PERMISSION_FAILED), "failed"));
      void check();
    });
  },
  update: (tabId, id, selected) => command("update", tabId, { id, selected }),
  stop: (tabId, id) => command("stop", tabId, { id }),
  clear: (tabId, id) => command("clear", tabId, { id }).then(() => undefined),
};
