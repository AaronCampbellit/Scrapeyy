import { extensionBrowser } from "./browser-api";
import { originPattern } from "./permissions";
import type { ElementBounds, FullPageCaptureController, FullPageMetrics } from "./screenshots";

export interface ViewerFrame { frameId: number; parentFrameId: number; url: string }
interface FrameRect { left: number; top: number; width: number; height: number }
interface ChildFrame extends FrameRect { key?: string; src: string }
export interface FrameInspection {
  key: string;
  viewportWidth: number;
  viewportHeight: number;
  documentWidth: number;
  documentHeight: number;
  region: FrameRect;
  children: ChildFrame[];
}
interface FrameRequest { command: "connect" | "identify" | "inspect" | "prepare" | "scroll" | "restore"; token: string; x?: number; y?: number; tileIndex?: number }
interface FrameState {
  key: string;
  children: Map<Window, string>;
  listener: (event: MessageEvent) => void;
  panel?: HTMLElement;
  original?: { x: number; y: number };
  styles: Array<{ element: HTMLElement; property: string; value: string; priority: string }>;
  fixed?: HTMLElement[];
}

// This function is serialized by scripting.executeScript. Keep all runtime
// helpers inside it; it runs in the extension's isolated world in each frame.
export async function embeddedFrameCommand(request: FrameRequest): Promise<FrameInspection | { x: number; y: number } | undefined> {
  const host = window as Window & { __scrapeyyFrameCapture?: Map<string, FrameState> };
  const sessions = host.__scrapeyyFrameCapture ??= new Map();
  let state = sessions.get(request.token);
  if (!state) {
    if (request.command === "restore") return;
    const children = new Map<Window, string>();
    const listener = (event: MessageEvent) => {
      if (event.data?.scrapeyyFrameCapture !== request.token || typeof event.data.key !== "string") return;
      // Bind identity to the real child Window, rather than trusting a URL or
      // frame order. This also works for IT Glue's iframe without a src attribute.
      if ([...document.querySelectorAll("iframe")].some(frame => frame.contentWindow === event.source)) {
        children.set(event.source as Window, event.data.key);
      }
    };
    state = { key: crypto.randomUUID(), children, listener, styles: [] };
    sessions.set(request.token, state);
    window.addEventListener("message", listener);
  }
  const saved = state;
  const waitForPaint = () => new Promise<void>(resolve => {
    const timeout = setTimeout(resolve, 500);
    requestAnimationFrame(() => requestAnimationFrame(() => { clearTimeout(timeout); setTimeout(resolve, 150); }));
  });
  const style = (element: HTMLElement, property: string, value: string) => {
    if (!saved.styles.some(item => item.element === element && item.property === property)) {
      saved.styles.push({ element, property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) });
    }
    element.style.setProperty(property, value, "important");
  };
  const inspect = (): FrameInspection => {
    const panels = [...document.querySelectorAll<HTMLElement>("*")].filter(element => {
      if (element === document.body || element === document.documentElement) return false;
      const rect = element.getBoundingClientRect();
      return /^(auto|scroll)$/.test(getComputedStyle(element).overflowY) &&
        element.scrollHeight > element.clientHeight + 1 && rect.width >= innerWidth * .5 &&
        rect.height >= innerHeight * .4 && rect.bottom > 0 && rect.top < innerHeight;
    }).sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight);
    const panel = saved.panel ?? panels[0] ?? document.scrollingElement as HTMLElement;
    if (!saved.original) saved.panel = panel;
    const isDocument = panel === document.scrollingElement;
    const rect = panel.getBoundingClientRect();
    const region = isDocument ? { left: 0, top: 0, width: innerWidth, height: innerHeight } :
      { left: rect.left + panel.clientLeft, top: rect.top + panel.clientTop, width: panel.clientWidth, height: panel.clientHeight };
    return { key: saved.key, viewportWidth: innerWidth, viewportHeight: innerHeight,
      documentWidth: Math.max(panel.scrollWidth, region.width), documentHeight: Math.max(panel.scrollHeight, region.height), region,
      children: [...document.querySelectorAll("iframe")].flatMap(frame => {
        const bounds = frame.getBoundingClientRect();
        if (bounds.width < innerWidth * .5 || bounds.height < innerHeight * .4 || bounds.bottom <= 0 || bounds.top >= innerHeight) return [];
        const key = frame.contentWindow ? saved.children.get(frame.contentWindow) : undefined;
        return [{ ...(key ? { key } : {}), src: frame.src,
          left: bounds.left + frame.clientLeft, top: bounds.top + frame.clientTop, width: frame.clientWidth, height: frame.clientHeight }];
      }).sort((a, b) => b.width * b.height - a.width * a.height) };
  };
  if (request.command === "restore") {
    try {
      // Restore scroll while scroll-behavior is still forced to auto; an
      // original smooth-scroll rule must not animate the restoration.
      if (saved.panel && saved.original) {
        saved.panel.scrollLeft = saved.original.x; saved.panel.scrollTop = saved.original.y;
      }
      for (const item of [...saved.styles].reverse()) {
        if (item.value) item.element.style.setProperty(item.property, item.value, item.priority);
        else item.element.style.removeProperty(item.property);
      }
      await waitForPaint();
    } finally { window.removeEventListener("message", saved.listener); sessions.delete(request.token); }
    return;
  }
  if (request.command === "identify") {
    if (window.parent !== window) window.parent.postMessage({ scrapeyyFrameCapture: request.token, key: saved.key }, "*");
    // postMessage is asynchronous; allow each parent to record the Window mapping.
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  if (request.command === "prepare") {
    inspect();
    const panel = saved.panel!;
    saved.original = { x: panel.scrollLeft, y: panel.scrollTop };
    style(panel, "scroll-behavior", "auto"); style(panel, "scroll-snap-type", "none"); style(panel, "overflow-anchor", "none");
    saved.fixed = [];
    for (const element of panel.querySelectorAll<HTMLElement>("*")) {
      const position = getComputedStyle(element).position;
      if (position === "sticky") style(element, "position", "static");
      else if (position === "fixed") saved.fixed.push(element);
    }
    panel.scrollTop = 0; panel.scrollLeft = 0;
    await waitForPaint();
  }
  if (request.command === "scroll") {
    if (!saved.original || !saved.panel) throw new Error("Embedded viewer capture was not prepared.");
    saved.panel.scrollLeft = request.x ?? 0; saved.panel.scrollTop = request.y ?? 0;
    if ((request.tileIndex ?? 0) > 0) {
      for (const element of saved.fixed ?? []) style(element, "visibility", "hidden");
    }
    await waitForPaint();
    const bounds = saved.panel.getBoundingClientRect();
    const images = [...saved.panel.querySelectorAll("img")].filter(image => {
      const rect = image.getBoundingClientRect(); return rect.bottom > bounds.top && rect.top < bounds.bottom && rect.width > 0;
    });
    const deadline = Date.now() + 4000;
    while (images.some(image => !image.complete || image.naturalWidth === 0)) {
      if (Date.now() >= deadline) throw new Error("The embedded document is still loading. Try the screenshot again when its pages are visible.");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return { x: saved.panel.scrollLeft, y: saved.panel.scrollTop };
  }
  return inspect();
}

export interface EmbeddedFrameApi {
  execute(tabId: number, frameIds: number[], request: FrameRequest): Promise<Array<{ frameId: number; result?: FrameInspection | { x: number; y: number } | undefined }>>;
  frames(tabId: number): Promise<ViewerFrame[]>;
  contains(request: { permissions?: Array<"webNavigation">; origins?: string[] }): Promise<boolean>;
  request(request: { permissions?: Array<"webNavigation">; origins?: string[] }): Promise<boolean>;
}
const defaultApi: EmbeddedFrameApi = {
  execute: (tabId, frameIds, request) => extensionBrowser.scripting.executeScript({ target: { tabId, frameIds }, func: embeddedFrameCommand, args: [request] }),
  frames: async tabId => await extensionBrowser.webNavigation.getAllFrames({ tabId }) ?? [],
  contains: request => extensionBrowser.permissions.contains(request),
  request: request => extensionBrowser.permissions.request(request),
};
const inspection = (results: Awaited<ReturnType<EmbeddedFrameApi["execute"]>>, frameId: number) => {
  const value = results.find(item => item.frameId === frameId)?.result;
  if (!value || !("region" in value)) throw new Error("The embedded viewer changed or is no longer available. Try again.");
  return value;
};

export type EmbeddedViewerPermission =
  | { kind: "discovery"; tabId: number }
  | { kind: "origin"; tabId: number; origin: string };

// Discovery may await browser APIs. It only describes the next permission;
// the popup must wait for a fresh Allow click before requesting that permission.
export async function prepareEmbeddedViewerAccess(tabId: number, api: EmbeddedFrameApi = defaultApi): Promise<EmbeddedViewerPermission | undefined> {
  const token = crypto.randomUUID();
  try {
    const top = inspection(await api.execute(tabId, [0], { command: "inspect", token }), 0);
    if (!top.children.length || top.documentHeight > top.viewportHeight + 1) return;
    if (!await api.contains({ permissions: ["webNavigation"] })) return { kind: "discovery", tabId };
    const frames = await api.frames(tabId);
    const roots = frames.filter(frame => frame.parentFrameId === 0 && /^https?:/.test(frame.url));
    const viewer = top.children[0]!;
    const matches = viewer.src ? roots.filter(frame => frame.url === viewer.src) : roots;
    if (matches.length !== 1) throw new Error("Could not identify the embedded viewer safely. Open the document in its own tab and capture it there.");
    const origin = new URL(matches[0]!.url).origin;
    if (!await api.contains({ origins: [originPattern(origin)] })) return { kind: "origin", tabId, origin };
  } finally { await api.execute(tabId, [0], { command: "restore", token }); }
}

// Keep this synchronous: permissions.request must be the first browser API
// called from the Allow button, before any await, tab query, or permission check.
export function requestEmbeddedViewerPermission(permission: EmbeddedViewerPermission, api: EmbeddedFrameApi = defaultApi): Promise<boolean> {
  return api.request(permission.kind === "discovery"
    ? { permissions: ["webNavigation"] }
    : { origins: [originPattern(permission.origin)] });
}

export async function createEmbeddedFrameCaptureController(tabId: number, api: EmbeddedFrameApi = defaultApi): Promise<FullPageCaptureController | undefined> {
  const token = crypto.randomUUID();
  const connected = new Set<number>([0]);
  let handedOff = false;
  const command = async (frameId: number, command: FrameRequest["command"], extra: Partial<FrameRequest> = {}) =>
    api.execute(tabId, [frameId], { ...extra, command, token });
  const cleanup = async () => {
    const results = await Promise.allSettled([...connected].reverse().map(frameId => command(frameId, "restore")));
    if (results.some(result => result.status === "rejected")) throw new Error("Could not restore the embedded viewer after capture. Reload the page before continuing.");
  };
  try {
    let top = inspection(await command(0, "connect"), 0);
    if (!top.children.length || top.documentHeight > top.viewportHeight + 1) return;
    if (!await api.contains({ permissions: ["webNavigation"] })) throw new Error("Use the Full-page screenshot button and allow access to the embedded viewer first.");
    const frames = await api.frames(tabId);
    const results = [{ frameId: 0, result: top }];
    for (const frame of frames.filter(frame => frame.frameId !== 0)) {
      if (!/^https?:/.test(frame.url) || !await api.contains({ origins: [originPattern(frame.url)] })) continue;
      connected.add(frame.frameId);
      results.push({ frameId: frame.frameId, result: inspection(await command(frame.frameId, "connect"), frame.frameId) });
    }
    for (const frameId of connected) await command(frameId, "identify");
    top = inspection(await command(0, "inspect"), 0);
    let current = top;
    let frameId = 0;
    let left = 0, topOffset = 0;
    const visited = new Set<number>();
    while (current.children.length && current.documentHeight <= current.viewportHeight + 1) {
      const child = current.children[0]!;
      if (child.left < -1 || child.top < -1 || child.left + child.width > current.viewportWidth + 1 || child.top + child.height > current.viewportHeight + 1) {
        throw new Error("Keep the embedded viewer fully visible while taking a full-page screenshot.");
      }
      const next = results.find(result => result.result.key === child.key);
      if (!next || visited.has(next.frameId)) throw new Error("Full-page capture needs access to the embedded viewer. Use the Full-page screenshot button to allow it.");
      visited.add(next.frameId);
      if (Math.abs(child.width - next.result.viewportWidth) > 2 || Math.abs(child.height - next.result.viewportHeight) > 2) {
        throw new Error("The embedded viewer is scaled. Reset the page zoom before capturing it.");
      }
      left += child.left; topOffset += child.top;
      frameId = next.frameId; current = inspection(await command(frameId, "inspect"), frameId);
    }
    if (frameId === 0) return;
    const metrics = (value: FrameInspection): FullPageMetrics => {
      const bounds: ElementBounds = { left: left + value.region.left, top: topOffset + value.region.top,
        width: value.region.width, height: value.region.height, viewportWidth: top.viewportWidth, viewportHeight: top.viewportHeight };
      if (bounds.left < -1 || bounds.top < -1 || bounds.left + bounds.width > top.viewportWidth + 1 || bounds.top + bounds.height > top.viewportHeight + 1) {
        throw new Error("Keep the embedded viewer fully visible while taking a full-page screenshot.");
      }
      return { documentWidth: value.documentWidth, documentHeight: value.documentHeight,
        viewportWidth: bounds.width, viewportHeight: bounds.height, captureBounds: bounds };
    };
    let initial: FullPageMetrics | undefined;
    handedOff = true;
    return {
      async prepare() { initial = metrics(inspection(await command(frameId, "prepare"), frameId)); return initial; },
      async measure() {
        const value = metrics(inspection(await command(frameId, "inspect"), frameId));
        if (initial && JSON.stringify(value.captureBounds) !== JSON.stringify(initial.captureBounds)) throw new Error("The embedded viewer moved during capture. Try again without resizing or scrolling the page.");
        return value;
      },
      async scrollTo(x, y, tileIndex) {
        const value = (await command(frameId, "scroll", { x, y, tileIndex }))[0]?.result;
        if (!value || !("x" in value)) throw new Error("The embedded document could not scroll.");
        return value;
      },
      restore: cleanup,
    };
  } finally { if (!handedOff) await cleanup(); }
}
