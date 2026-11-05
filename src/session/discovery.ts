import { getDomain } from "tldts";

export const DISCOVERY_KEY = "sessionDiscoveryV1";
export const MAX_ORIGINS = 100;
export const MAX_CANDIDATES = 250;
export const RECORD_MS = 10 * 60_000;
export const DISCOVERY_TTL = 60 * 60_000;
export const PERMISSION_WAIT_MS = 60_000;
export const PERMISSION_TIMEOUT = "Still waiting for browser permission. The prompt may be behind Scrapeyy. Close this popup, approve or dismiss the browser prompt, then reopen Borrow session and retry.";
export const PERMISSION_DENIED = "Website permission was declined. Click Scan sites or Record sign-in to retry, or enter origins manually.";
export const PERMISSION_FAILED = "The browser permission request could not finish. Close this popup, check the browser prompt, then reopen Borrow session and retry.";
export type Evidence = "current site" | "page link" | "form" | "frame" | "open tab" | "cookie" | "navigation" | "redirect" | "request";
export interface Candidate { origin: string; evidence: Evidence[] }
export interface DiscoveryState {
  id: string; sourceTabId: number; sourceOrigin: string; storeId: string;
  tabIds: number[]; candidates: Candidate[]; selected: string[]; excluded: string[];
  status: "waiting" | "scanning" | "recording" | "ready" | "error";
  recordUntil?: number; permissionUntil?: number; scanPending?: boolean; expiresAt: number; updatedAt: number; warnings: string[];
}
export interface DiscoveryClient {
  get(tabId: number): Promise<DiscoveryState | undefined>;
  start(tabId: number, origin: string, record: boolean, signal?: AbortSignal): Promise<DiscoveryState | undefined>;
  update(tabId: number, id: string, selected: string[]): Promise<DiscoveryState | undefined>;
  stop(tabId: number, id: string): Promise<DiscoveryState | undefined>;
  clear(tabId: number, id: string): Promise<void>;
}
export function safeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return;
    return url.origin;
  } catch { return; }
}
export function siteDomain(origin: string): string {
  const host = new URL(origin).hostname;
  return getDomain(host, { allowPrivateDomains: true }) || host;
}
export function sameSite(a: string, b: string): boolean { return siteDomain(a) === siteDomain(b); }
export function discoveryPermissions(origin: string, record: boolean): { permissions: ("cookies" | "tabs" | "webNavigation" | "webRequest")[]; origins: string[] } {
  const url = new URL(origin), domain = siteDomain(origin);
  const wildcard = getDomain(url.hostname, { allowPrivateDomains: true }) ? `*.${domain}` : domain;
  return {
    permissions: ["cookies", "tabs", "webNavigation", ...(record ? ["webRequest" as const] : [])],
    origins: record ? ["http://*/*", "https://*/*"] : [`${url.protocol}//${wildcard}/*`],
  };
}
export function addCandidate(state: DiscoveryState, value: string, evidence: Evidence, autoSelect = false) {
  const origin = safeOrigin(value);
  if (!origin) return;
  const existing = state.candidates.find(item => item.origin === origin);
  if (existing) {
    if (!existing.evidence.includes(evidence)) existing.evidence.push(evidence);
    if (autoSelect && !state.excluded.includes(origin) && !state.selected.includes(origin) && state.selected.length < MAX_ORIGINS) state.selected.push(origin);
    return;
  }
  if (state.candidates.length >= MAX_CANDIDATES) {
    warn(state, "Discovery reached 250 sites. Narrow the page or add any missing origins manually."); return;
  }
  state.candidates.push({ origin, evidence: [evidence] });
  if (autoSelect && !state.selected.includes(origin)) {
    if (state.selected.length < MAX_ORIGINS) state.selected.push(origin);
    else warn(state, "The export list reached 100 sites. Review the additional candidates below.");
  }
}
export function warn(state: DiscoveryState, warning: string) {
  if (!state.warnings.includes(warning)) state.warnings.push(warning);
}

// Injected in isolated frames. Return origins only: never form fields, URL tokens or storage.
export function inspectPageOrigins(expectedOrigin?: string) {
  if (expectedOrigin && location.origin !== expectedOrigin) throw new Error("The page navigated during discovery.");
  const found: { origin: string; evidence: Evidence }[] = [];
  const seen = new Set<string>();
  const add = (value: string | null, evidence: Evidence) => {
    if (!value || found.length >= 500) return;
    try {
      const url = new URL(value, document.baseURI);
      if (!/^https?:$/.test(url.protocol) || url.username || url.password) return;
      const key = `${evidence}:${url.origin}`;
      if (!seen.has(key)) { seen.add(key); found.push({ origin: url.origin, evidence }); }
    } catch { /* Ignore malformed page links. */ }
  };
  add(location.href, "frame");
  for (const node of document.querySelectorAll("a[href],area[href]")) add(node.getAttribute("href"), "page link");
  for (const node of document.querySelectorAll("form[action]")) add(node.getAttribute("action"), "form");
  for (const node of document.querySelectorAll("iframe[src],frame[src]")) add(node.getAttribute("src"), "frame");
  for (const item of performance.getEntriesByType("resource")) add(item.name, "request");
  return { found, limited: found.length >= 500 };
}
