import { describe, expect, it, vi } from "vitest";
import { embeddedFrameCommand, createEmbeddedFrameCaptureController, prepareEmbeddedViewerAccess, requestEmbeddedViewerPermission, type EmbeddedFrameApi, type FrameInspection } from "../../src/platform/embedded-frame-capture";
import { captureFullPageScreenshot } from "../../src/platform/screenshots";

const top: FrameInspection = { key: "top", viewportWidth: 757, viewportHeight: 1244, documentWidth: 757, documentHeight: 1244,
  region: { left: 0, top: 0, width: 757, height: 1244 }, children: [{ key: "office", src: "", left: 0, top: 0, width: 757, height: 1244 }] };
const office: FrameInspection = { key: "office", viewportWidth: 757, viewportHeight: 1244, documentWidth: 740, documentHeight: 2855,
  region: { left: 0, top: 88, width: 740, height: 1131 }, children: [] };
function fixture(granted = true) {
  const calls: Array<{ frameId: number; command: string; y?: number }> = [];
  const request = vi.fn(async () => true);
  const api: EmbeddedFrameApi = {
    execute: async (_id, ids, value) => {
      const frameId = ids[0]!;
      calls.push({ frameId, command: value.command, ...(value.y === undefined ? {} : { y: value.y }) });
      if (value.command === "restore") return [{ frameId }];
      if (value.command === "scroll") return [{ frameId, result: { x: value.x ?? 0, y: Math.min(value.y ?? 0, 2855 - 1131) } }];
      return [{ frameId, result: frameId === 0 ? structuredClone(top) : structuredClone(office) }];
    },
    frames: async () => [{ frameId: 0, parentFrameId: -1, url: "https://itglue.test/doc" },
      { frameId: 42, parentFrameId: 0, url: "https://word-view.officeapps.live.com/document" },
      { frameId: 43, parentFrameId: 0, url: "about:blank" }],
    contains: async () => granted,
    request,
  };
  return { api, calls, request };
}
describe("embedded Office viewer capture", () => {
  it("keeps lower sticky headings in the document and restores the panel's original styles and scroll", async () => {
    const panel = document.createElement("main");
    panel.style.cssText = "overflow-y:auto;scroll-behavior:smooth";
    const heading = document.createElement("h2"); heading.style.position = "sticky"; heading.textContent = "Last page";
    panel.append(heading); document.body.replaceChildren(panel);
    Object.defineProperties(window, { innerWidth: { value: 100, configurable: true }, innerHeight: { value: 100, configurable: true } });
    Object.defineProperties(panel, { clientWidth: { value: 100 }, clientHeight: { value: 80 }, scrollWidth: { value: 100 }, scrollHeight: { value: 260 } });
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({ left: 0, top: 10, width: 100, height: 80, bottom: 90, right: 100, x: 0, y: 10, toJSON() {} });
    panel.scrollTop = 37;
    const token = "sticky-panel-regression";
    try {
      await embeddedFrameCommand({ command: "prepare", token });
      expect(heading.style.position).toBe("static");
      await embeddedFrameCommand({ command: "scroll", token, x: 0, y: 80, tileIndex: 1 });
      expect(heading.style.visibility).toBe("");
    } finally { await embeddedFrameCommand({ command: "restore", token }); }
    expect(panel.scrollTop).toBe(37);
    expect(panel.style.scrollBehavior).toBe("smooth");
    expect(heading.style.position).toBe("sticky");
  });
  it("stitches high-DPI panel crops without copying toolbars or overlapping the last tile", async () => {
    const { api } = fixture();
    const controller = await createEmbeddedFrameCaptureController(1, api);
    const drawImage = vi.fn();
    const sizes: number[][] = [];
    vi.stubGlobal("createImageBitmap", async () => ({ width: 1514, height: 2488, close: vi.fn() }));
    vi.stubGlobal("OffscreenCanvas", class {
      constructor(width: number, height: number) { sizes.push([width, height]); }
      getContext() { return { drawImage }; }
      async convertToBlob() { return new Blob(["stitched"]); }
    });
    try {
      await captureFullPageScreenshot(1, controller!, { api: { getTab: async () => ({}), captureVisibleTab: async () => "data:image/png;base64,AA==" }, wait: async () => {} });
      expect(sizes).toEqual([[1480, 5710]]);
      expect(drawImage.mock.calls.map(call => call.slice(1))).toEqual([
        [0, 176, 1480, 2262, 0, 0, 1480, 2262],
        [0, 176, 1480, 2262, 0, 2262, 1480, 2262],
        [0, 1252, 1480, 1186, 0, 4524, 1480, 1186],
      ]);
    } finally { vi.unstubAllGlobals(); }
  });
  it("captures all 2855 pixels in three tiles, cropping the 1131px document panel rather than the outer 1244px page", async () => {
    const { api, calls } = fixture();
    const controller = await createEmbeddedFrameCaptureController(1, api);
    const stitch = vi.fn(async (metrics, tiles) => {
      expect(metrics).toEqual({ documentWidth: 740, documentHeight: 2855, viewportWidth: 740, viewportHeight: 1131,
        captureBounds: { left: 0, top: 88, width: 740, height: 1131, viewportWidth: 757, viewportHeight: 1244 } });
      expect(tiles.map((tile: { y: number }) => tile.y)).toEqual([0, 1131, 1724]);
      expect(tiles[2].clipTop).toBe(538);
      return new Blob(["three pages"]);
    });
    await captureFullPageScreenshot(1, controller!, { api: { getTab: async () => ({ windowId: 1 }), captureVisibleTab: async () => "tile" }, stitcher: { stitch }, wait: async () => {} });
    expect(stitch).toHaveBeenCalledOnce();
    expect(calls.filter(call => call.command === "restore").map(call => call.frameId)).toEqual([42, 0]);
  });
  it("discovers one missing permission at a time without requesting it asynchronously", async () => {
    const { api, request } = fixture(false);
    const frames = vi.spyOn(api, "frames");
    expect(await prepareEmbeddedViewerAccess(1, api)).toEqual({ kind: "discovery", tabId: 1 });
    expect(frames).not.toHaveBeenCalled();
    api.contains = async request => Boolean(request.permissions);
    expect(await prepareEmbeddedViewerAccess(1, api)).toEqual({ kind: "origin", tabId: 1, origin: "https://word-view.officeapps.live.com" });
    api.contains = async () => true;
    expect(await prepareEmbeddedViewerAccess(1, api)).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
  });
  it("requests a narrowly scoped permission synchronously before the click gesture expires", async () => {
    const { api } = fixture(false);
    let gesture = true;
    const contains = vi.spyOn(api, "contains");
    api.request = vi.fn(request => {
      if (!gesture) throw new Error("permissions.request may only be called from a user input handler");
      expect(contains).not.toHaveBeenCalled();
      return Promise.resolve(Boolean(request.permissions || request.origins));
    });
    const discovery = requestEmbeddedViewerPermission({ kind: "discovery", tabId: 1 }, api);
    gesture = false;
    expect(await discovery).toBe(true);
    gesture = true;
    const origin = requestEmbeddedViewerPermission({ kind: "origin", tabId: 1, origin: "https://word-view.officeapps.live.com" }, api);
    gesture = false;
    expect(await origin).toBe(true);
    expect(api.request).toHaveBeenNthCalledWith(1, { permissions: ["webNavigation"] });
    expect(api.request).toHaveBeenNthCalledWith(2, { origins: ["https://word-view.officeapps.live.com/*"] });
  });
  it("does not request ambiguous or unrelated frame origins", async () => {
    const { api, request } = fixture();
    api.frames = async () => [{ frameId: 42, parentFrameId: 0, url: "https://office.test/document" }, { frameId: 43, parentFrameId: 0, url: "https://tracker.test/frame" }];
    await expect(prepareEmbeddedViewerAccess(1, api)).rejects.toThrow("identify the embedded viewer safely");
    expect(request).not.toHaveBeenCalled();
  });
  it("stops instead of claiming full-page success when embedded access is missing", async () => {
    const { api, calls } = fixture();
    api.contains = async request => Boolean(request.permissions);
    await expect(createEmbeddedFrameCaptureController(1, api)).rejects.toThrow("needs access");
    expect(calls.at(-1)).toMatchObject({ frameId: 0, command: "restore" });
  });
  it("rejects a viewer clipped by its parent instead of stitching missing content", async () => {
    const { api, calls } = fixture();
    const execute = api.execute;
    api.execute = async (...args) => {
      const results = await execute(...args);
      const value = results[0]?.result;
      if (value && "region" in value && results[0]?.frameId === 0) value.children[0]!.top = 100;
      return results;
    };
    await expect(createEmbeddedFrameCaptureController(1, api)).rejects.toThrow("fully visible");
    expect(calls.filter(call => call.command === "restore").map(call => call.frameId)).toEqual([42, 0]);
  });
  it("restores every connected frame when taking a screenshot fails", async () => {
    const { api, calls } = fixture();
    const controller = await createEmbeddedFrameCaptureController(1, api);
    await expect(captureFullPageScreenshot(1, controller!, { api: { getTab: async () => ({}), captureVisibleTab: async () => { throw new Error("capture failed"); } } })).rejects.toThrow("capture failed");
    expect(calls.filter(call => call.command === "restore").map(call => call.frameId)).toEqual([42, 0]);
  });
  it("does not change ordinary long-page capture behavior or request permissions", async () => {
    const { api, request, calls } = fixture();
    const execute = api.execute;
    api.execute = async (...args) => {
      const results = await execute(...args);
      if (results[0]?.result && "region" in results[0].result) results[0].result.documentHeight = 4000;
      return results;
    };
    expect(await createEmbeddedFrameCaptureController(1, api)).toBeUndefined();
    expect(await prepareEmbeddedViewerAccess(1, api)).toBeUndefined();
    expect(request).not.toHaveBeenCalled();
    expect(calls.every(call => call.frameId === 0)).toBe(true);
  });
});
