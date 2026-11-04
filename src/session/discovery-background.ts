import { extensionBrowser as browser } from "../platform/browser-api";
import { parseOrigins } from "./format";
import { addCandidate, DISCOVERY_KEY, DISCOVERY_TTL, discoveryPermissions, inspectPageOrigins,
  RECORD_MS, safeOrigin, sameSite, siteDomain, warn, type DiscoveryState, type Evidence } from "./discovery";

const ALARM = "scrapeyy-session-discovery";
type States = Record<string, DiscoveryState>;

export function createDiscoveryController(api = browser) {
  // Serialize read/modify/write so concurrent request events and popup edits cannot lose results.
  let queue: Promise<unknown> = Promise.resolve();
  let hydrated = false;
  let recordingTabs = new Set<number>();
  const jobs = new Set<string>();
  const pendingTabs = new Map<number, Promise<void>>();
  const attempts = new Map<number, string>();
  const transact = <T>(fn: (states: States) => Promise<T> | T): Promise<T> => {
    const task = queue.then(async () => {
      const stored = await api.storage.session.get(DISCOVERY_KEY);
      const states = (stored[DISCOVERY_KEY] || {}) as States;
      const before = JSON.stringify(states);
      const now = Date.now();
      for (const [key, state] of Object.entries(states)) {
        if (state.expiresAt <= now) delete states[key];
        else if (state.status === "recording" && (state.recordUntil || 0) <= now) {
          state.status = "ready"; warn(state, "Sign-in recording stopped after 10 minutes.");
        }
      }
      const result = await fn(states);
      recordingTabs = new Set(Object.values(states).filter(s => s.status === "recording").flatMap(s => s.tabIds));
      hydrated = true;
      if (JSON.stringify(states) !== before) await api.storage.session.set({ [DISCOVERY_KEY]: states });
      return result;
    });
    queue = task.catch(() => undefined);
    return task;
  };
  const storeFor = async (tabId: number) => {
    const stores = await api.cookies.getAllCookieStores();
    const store = stores.find(item => item.tabIds.includes(tabId));
    if (!store) throw new Error("Open a website in the same profile or container, then try again.");
    return store;
  };
  const mutate = (id: string, fn: (state: DiscoveryState) => void) => transact(states => {
    const state = Object.values(states).find(item => item.id === id);
    if (state) { fn(state); state.updatedAt = Date.now(); }
    return state;
  });
  async function scan(id: string) {
    const state = await mutate(id, state => { state.scanPending = true; if (state.status !== "recording") state.status = "scanning"; });
    if (!state) return;
    const store = await storeFor(state.sourceTabId);
    if (store.id !== state.storeId) throw new Error("The source profile or container changed. Start a new scan.");
    const source = await api.tabs.get(state.sourceTabId);
    const sourceOrigin = safeOrigin(source.url || "");
    if (sourceOrigin) await mutate(id, current => addCandidate(current, sourceOrigin, "current site", true));
    const tabs = (await api.tabs.query({})).filter(tab => tab.id !== undefined && store.tabIds.includes(tab.id));
    const related = tabs.filter(tab => {
      const origin = safeOrigin(tab.url || "");
      return origin && (sameSite(origin, state.sourceOrigin) || state.tabIds.includes(tab.id!));
    });
    await mutate(id, current => {
      for (const tab of related) addCandidate(current, tab.url!, "open tab", true);
      if (related.length > 30) warn(current, "Only the first 30 related tabs were inspected.");
    });
    // Inspect the source first and other related tabs only within this exact cookie store.
    const inspect = [source, ...related.filter(tab => tab.id !== source.id)].slice(0, 30);
    for (const tab of inspect) {
      if (!await mutate(id, () => {})) return;
      if (tab.id === undefined) continue;
      let frames: { frameId: number; url: string }[] = [];
      try { frames = (await api.webNavigation.getAllFrames({ tabId: tab.id })) || []; }
      catch { await mutate(id, current => warn(current, "Some embedded frame addresses were unavailable.")); }
      await mutate(id, current => {
        for (const frame of frames) {
          const origin = safeOrigin(frame.url);
          if (origin) addCandidate(current, origin, "frame", sameSite(origin, current.sourceOrigin));
        }
      });
      // Individual frames avoid losing readable results when one cross-origin frame is denied.
      const readable = frames.length ? frames.slice(0, 50) : [{ frameId: 0, url: tab.url || "" }];
      if (frames.length > 50) await mutate(id, current => warn(current, "Only the first 50 frames per tab were inspected."));
      for (const frame of readable) {
        const origin = safeOrigin(frame.url);
        if (!origin || !await api.permissions.contains({ origins: [origin + "/*"] })) continue;
        try {
          const results = await api.scripting.executeScript({ target: { tabId: tab.id, frameIds: [frame.frameId] }, func: inspectPageOrigins, args: [origin] });
          await mutate(id, current => {
            for (const result of results) {
              for (const item of result.result?.found || []) {
                addCandidate(current, item.origin, item.evidence, sameSite(item.origin, current.sourceOrigin));
              }
              if (result.result?.limited) warn(current, "A page reached the discovery limit; some links may be missing.");
            }
          });
        } catch { await mutate(id, current => warn(current, "Some pages could not be inspected. Reopen the page and scan again.")); }
      }
    }
    // Cookie values returned by the browser are discarded immediately; only domain evidence is retained.
    const latest = await mutate(id, () => {});
    if (!latest) return;
    const domains = [...new Set([siteDomain(latest.sourceOrigin), ...latest.selected.map(siteDomain)])];
    for (const domain of domains) {
      if (!await mutate(id, () => {})) return;
      try {
        const cookies = await api.cookies.getAll({ domain, storeId: store.id });
        await mutate(id, current => {
          for (const cookie of cookies) {
            if (cookie.partitionKey || (cookie as { firstPartyDomain?: string }).firstPartyDomain) continue;
            const host = cookie.domain.replace(/^\./, "");
            const origin = safeOrigin(`${cookie.secure ? "https:" : new URL(current.sourceOrigin).protocol}//${host}`);
            if (origin) addCandidate(current, origin, "cookie", sameSite(origin, current.sourceOrigin));
          }
        });
      } catch { await mutate(id, current => warn(current, "Some cookie domains were unavailable; review website permissions.")); }
    }
    await mutate(id, current => { delete current.scanPending; });
  }
  async function run(id: string, record: boolean) {
    if (jobs.has(id)) return;
    jobs.add(id);
    try {
      const state = await mutate(id, () => {});
      if (!state || !["waiting", "scanning"].includes(state.status)) return;
      // The request starts from the popup click, but the job survives that popup disappearing.
      const permission = discoveryPermissions(state.sourceOrigin, record);
      const deadline = Date.now() + 60_000;
      while (!await api.permissions.contains(permission)) {
        if (Date.now() >= deadline) throw new Error("Website permission was not granted. Click Scan sites or Record sign-in to retry.");
        const pending = await mutate(id, () => {});
        if (!pending || !["waiting", "scanning"].includes(pending.status)) return;
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      const started = await mutate(id, current => {
        if (record && !current.recordUntil) return;
        current.status = record ? "recording" : "scanning";
        if (record) current.recordUntil = Date.now() + RECORD_MS;
      });
      if (!started || (record && started.status !== "recording")) return;
      await scan(id);
      await mutate(id, current => { if (current.status === "scanning") current.status = "ready"; });
    } catch (error) {
      await mutate(id, current => {
        current.status = "error"; delete current.scanPending;
        // Never display browser errors that might echo URLs or cookie values.
        warn(current, error instanceof Error && error.message.startsWith("Website permission") ? error.message :
          "Discovery was interrupted. Check website permissions and that the original tab is open, then retry.");
      });
    } finally { jobs.delete(id); }
  }
  async function handle(message: Record<string, unknown>, sender: { id?: string; url?: string; tab?: unknown }) {
    if (sender.id !== api.runtime.id || sender.url !== api.runtime.getURL("/popup.html")) return { ok: false };
    const tabId = message.tabId;
    if (!Number.isInteger(tabId) || (tabId as number) < 0) return { ok: false };
    try {
      if (message.action === "cancel" && typeof message.requestId === "string") {
        if (attempts.get(tabId as number) === message.requestId) attempts.delete(tabId as number);
        await transact(states => { for (const [key, state] of Object.entries(states)) if (state.id === message.requestId) delete states[key]; });
        return { ok: true };
      }
      const requestId = typeof message.requestId === "string" ? message.requestId : crypto.randomUUID();
      // No permissions on first open: show the scan button without prompting.
      if (message.action === "start") {
        attempts.set(tabId as number, requestId);
        const deadline = Date.now() + 60_000;
        while (!await api.permissions.contains({ permissions: ["cookies"] })) {
          if (Date.now() >= deadline || attempts.get(tabId as number) !== requestId) return { ok: false };
          await new Promise(resolve => setTimeout(resolve, 400));
        }
      } else if (!await api.permissions.contains({ permissions: ["cookies"] })) return { ok: true };
      const store = await storeFor(tabId as number);
      if (message.action === "start") {
        if (attempts.get(tabId as number) !== requestId) return { ok: false };
        const tab = await api.tabs.get(tabId as number), origin = safeOrigin(tab.url || "");
        if (!origin || origin !== message.origin) return { ok: false };
        const record = message.record === true;
        const state = await transact(states => {
          const previous = states[store.id];
          const resume = previous && previous.sourceTabId === tabId && previous.sourceOrigin === origin;
          const next: DiscoveryState = { id: requestId, sourceTabId: tabId as number, sourceOrigin: origin,
            storeId: store.id, tabIds: [tabId as number], candidates: resume ? previous.candidates : [],
            selected: resume ? previous.selected : [], excluded: resume ? previous.excluded : [], status: "waiting", expiresAt: Date.now() + DISCOVERY_TTL,
            updatedAt: Date.now(), warnings: [], ...(record ? { recordUntil: Date.now() + RECORD_MS } : {}) };
          addCandidate(next, origin, "current site", true); states[store.id] = next; return next;
        });
        void run(state.id, record);
        return { ok: true, state };
      }
      const state = await transact(states => {
        const current = states[store.id];
        if (!current || message.action === "get") return current;
        if (current.id !== message.id) throw new Error("Stale discovery");
        if (message.action === "update") {
          const selected = parseOrigins((message.selected as string[]).join("\n"));
          current.excluded = [...new Set([...current.excluded, ...current.selected.filter(o => !selected.includes(o))])].filter(o => !selected.includes(o));
          current.selected = selected;
        }
        if (message.action === "stop") { current.status = "scanning"; delete current.recordUntil; }
        if (message.action === "clear") { delete states[store.id]; return; }
        current.updatedAt = Date.now(); return current;
      });
      if (message.action === "stop" && state) void scan(state.id)
        .catch(() => mutate(state.id, current => warn(current, "The final cookie scan was incomplete.")))
        .finally(() => mutate(state.id, current => { if (current.status === "scanning") current.status = "ready"; }));
      return { ok: true, state };
    } catch { return { ok: false }; }
  }
  async function observe(tabId: number, value: string, evidence: Evidence, main = false) {
    await pendingTabs.get(tabId);
    if (hydrated && !recordingTabs.has(tabId)) return;
    const origin = safeOrigin(value);
    if (!origin) return;
    await transact(states => {
      for (const state of Object.values(states)) {
        if (state.status !== "recording" || !state.tabIds.includes(tabId)) continue;
        addCandidate(state, origin, evidence, main || sameSite(origin, state.sourceOrigin));
        state.updatedAt = Date.now();
      }
    });
  }
  function trackTab(sourceId: number, tabId: number): Promise<void> {
    const pending = pendingTabs.get(tabId);
    if (pending) return pending;
    if (hydrated && !recordingTabs.has(sourceId)) return Promise.resolve();
    const task = (async () => {
      const store = await storeFor(tabId);
      await transact(states => {
        const state = states[store.id];
        if (state?.status === "recording" && state.tabIds.includes(sourceId) && !state.tabIds.includes(tabId)) {
          if (state.tabIds.length < 20) state.tabIds.push(tabId);
          else warn(state, "Recording reached 20 related tabs; further tabs are not recorded.");
        }
      });
    })();
    pendingTabs.set(tabId, task);
    void task.finally(() => pendingTabs.delete(tabId)).catch(() => undefined);
    return task;
  }
  function install() {
    const safely = (promise: Promise<unknown>) => { void promise.catch(() => undefined); };
    // Register synchronously at background startup so Chrome can wake the worker for events.
    const request = (d: { tabId: number; url: string; type: string }): undefined => {
      safely(observe(d.tabId, d.url, d.type === "main_frame" ? "navigation" : "request", d.type === "main_frame"));
    };
    const redirect = (d: { tabId: number; redirectUrl: string; type: string }) => {
      safely(observe(d.tabId, d.redirectUrl, "redirect", d.type === "main_frame"));
    };
    const navigate = (d: { tabId: number; url: string; frameId: number }) => {
      safely(observe(d.tabId, d.url, "navigation", d.frameId === 0));
    };
    const created = (d: { sourceTabId: number; tabId: number; url: string }) => {
      safely(trackTab(d.sourceTabId, d.tabId).then(() => observe(d.tabId, d.url, "navigation", true)));
    };
    const attach = () => {
      // Optional APIs may be absent until granted; never break the rest of the extension.
      try {
        if (!api.webRequest.onBeforeRequest.hasListener(request)) api.webRequest.onBeforeRequest.addListener(request, { urls: ["http://*/*", "https://*/*"] });
        if (!api.webRequest.onBeforeRedirect.hasListener(redirect)) api.webRequest.onBeforeRedirect.addListener(redirect, { urls: ["http://*/*", "https://*/*"] });
      } catch { /* Retry after the user grants optional access. */ }
      try {
        if (!api.webNavigation.onBeforeNavigate.hasListener(navigate)) api.webNavigation.onBeforeNavigate.addListener(navigate);
        if (!api.webNavigation.onCommitted.hasListener(navigate)) api.webNavigation.onCommitted.addListener(navigate);
        if (!api.webNavigation.onCreatedNavigationTarget.hasListener(created)) api.webNavigation.onCreatedNavigationTarget.addListener(created);
      } catch { /* Retry after the user grants optional access. */ }
    };
    attach();
    api.permissions.onAdded.addListener(attach);
    api.tabs.onCreated.addListener(tab => {
      if (tab.id !== undefined && tab.openerTabId !== undefined) safely(trackTab(tab.openerTabId, tab.id));
    });
    api.tabs.onRemoved.addListener(tabId => safely(transact(states => {
      for (const state of Object.values(states)) {
        state.tabIds = state.tabIds.filter(id => id !== tabId);
        if (state.sourceTabId === tabId) { state.status = "ready"; delete state.recordUntil;
          warn(state, "The original tab was closed. Start a new scan from the site you want to export."); }
      }
    })));
    api.permissions.onRemoved.addListener(() => safely(transact(states => {
      for (const state of Object.values(states)) if (state.status === "recording") {
        state.status = "ready"; warn(state, "Recording stopped because browser permissions changed.");
      }
    })));
    api.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) safely(transact(() => {})); });
    safely(Promise.resolve(api.alarms.create(ALARM, { periodInMinutes: 1 })));
    safely(transact(states => Object.values(states).filter(s => s.status === "waiting" || s.status === "scanning" || s.scanPending))
      .then(states => { for (const state of states) {
        if (state.status === "recording") safely(scan(state.id));
        else void run(state.id, !!state.recordUntil);
      } }));
  }
  return { handle, install, observe, trackTab };
}
