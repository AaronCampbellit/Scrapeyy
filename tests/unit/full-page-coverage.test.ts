import { describe, expect, it, vi } from "vitest";
import { captureFullPageScreenshot, type FullPageCaptureController, type FullPageMetrics } from "../../src/platform/screenshots";

const dimensions = (height: number): FullPageMetrics => ({ documentWidth: 100, documentHeight: height, viewportWidth: 100, viewportHeight: 100 });
const api = { getTab: async () => ({ windowId: 1 }), captureVisibleTab: vi.fn(async () => "tile") };
const wait = async () => undefined;

describe("full-page screenshot coverage", () => {
  it("rejects stalled scrolling instead of exporting blank lower content and restores the page", async () => {
    const restore = vi.fn(async () => undefined);
    const stitch = vi.fn(async () => new Blob());
    const controller: FullPageCaptureController = {
      prepare: async () => dimensions(300), scrollTo: async () => ({ x: 0, y: 0 }), restore,
    };
    await expect(captureFullPageScreenshot(1, controller, { api, stitcher: { stitch }, wait })).rejects.toThrow("could not scroll");
    expect(stitch).not.toHaveBeenCalled(); expect(restore).toHaveBeenCalledOnce();
  });

  it("includes newly loaded content and retries a scroll clamped to the old bottom", async () => {
    let height = 150;
    const controller: FullPageCaptureController = {
      prepare: async () => dimensions(height), measure: async () => dimensions(height),
      scrollTo: async (x, y) => {
        const actualY = Math.min(y, height - 100);
        if (y > 0) height = 350;
        return { x, y: actualY };
      }, restore: async () => undefined,
    };
    const stitch = vi.fn(async (metrics, tiles) => {
      expect(metrics.documentHeight).toBe(350);
      expect(tiles.map((tile: { y: number }) => tile.y)).toEqual([0, 100, 200, 250]);
      expect(tiles[3].clipTop).toBe(50);
      return new Blob();
    });
    await captureFullPageScreenshot(1, controller, { api, stitcher: { stitch }, wait });
    expect(stitch).toHaveBeenCalledOnce();
  });

  it("stops safely if the viewport is resized during capture", async () => {
    const restore = vi.fn(async () => undefined);
    const controller: FullPageCaptureController = {
      prepare: async () => dimensions(300),
      measure: async () => ({ ...dimensions(300), viewportHeight: 90 }),
      scrollTo: async (x, y) => ({ x, y }), restore,
    };
    await expect(captureFullPageScreenshot(1, controller, { api, stitcher: { stitch: async () => new Blob() }, wait })).rejects.toThrow("layout changed");
    expect(restore).toHaveBeenCalledOnce();
  });

  it("rejects an oversized high-DPI canvas after only the first tile", async () => {
    const close = vi.fn();
    const captureVisibleTab = vi.fn(async () => "data:image/png;base64,AA==");
    const restore = vi.fn(async () => undefined);
    vi.stubGlobal("createImageBitmap", async () => ({ width: 200, height: 200, close }));
    const controller: FullPageCaptureController = {
      prepare: async () => dimensions(17000), scrollTo: async (x, y) => ({ x, y }), restore,
    };
    try {
      await expect(captureFullPageScreenshot(1, controller, { api: { getTab: api.getTab, captureVisibleTab }, wait })).rejects.toThrow("too large");
      expect(captureVisibleTab).toHaveBeenCalledOnce();
      expect(close).toHaveBeenCalledOnce(); expect(restore).toHaveBeenCalledOnce();
    } finally { vi.unstubAllGlobals(); }
  });
});
