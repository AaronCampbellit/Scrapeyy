import { describe, expect, it } from "vitest";

import {
  hasOriginAccess,
  requestOriginAccess,
  revokeOriginAccess,
  type PermissionApi,
} from "../../src/platform/permissions";
import {
  captureElementScreenshot,
  captureFullPageScreenshot,
  type FullPageCaptureController,
  type FullPageImageStitcher,
  type ImageCropper,
  type ScreenshotApi,
} from "../../src/platform/screenshots";
import { createTabFullPageCaptureController } from "../../src/platform/tab-full-page-controller";

class MemoryPermissionApi implements PermissionApi {
  readonly origins = new Set<string>();
  readonly requested: string[] = [];

  async contains(request: { origins: string[] }): Promise<boolean> {
    return request.origins.every((origin) => this.origins.has(origin));
  }

  async request(request: { origins: string[] }): Promise<boolean> {
    this.requested.push(...request.origins);
    request.origins.forEach((origin) => this.origins.add(origin));
    return true;
  }

  async remove(request: { origins: string[] }): Promise<boolean> {
    request.origins.forEach((origin) => this.origins.delete(origin));
    return true;
  }
}

describe("origin permissions", () => {
  it("requests only the normalized selected origin", async () => {
    const api = new MemoryPermissionApi();

    expect(
      await requestOriginAccess("https://example.test/catalog?page=1", api),
    ).toBe(true);

    expect(api.requested).toEqual(["https://example.test/*"]);
    expect(await hasOriginAccess("https://example.test", api)).toBe(true);
  });

  it("revokes the selected origin without changing other origins", async () => {
    const api = new MemoryPermissionApi();
    await requestOriginAccess("https://example.test", api);
    await requestOriginAccess("https://other.test", api);

    await revokeOriginAccess("https://example.test", api);

    expect(await hasOriginAccess("https://example.test", api)).toBe(false);
    expect(await hasOriginAccess("https://other.test", api)).toBe(true);
  });

  it("rejects non-web origins", async () => {
    const api = new MemoryPermissionApi();

    await expect(requestOriginAccess("file:///tmp/private", api)).rejects.toThrow(
      "http or https",
    );
    expect(api.requested).toEqual([]);
  });

  it("captures and crops an element screenshot in the tab window", async () => {
    const api: ScreenshotApi = {
      getTab: async () => ({ windowId: 7 }),
      captureVisibleTab: async (windowId) =>
        windowId === 7 ? "data:image/png;base64,c2NyYXBleXk=" : "",
    };
    const cropper: ImageCropper = {
      crop: async (_dataUrl, bounds) =>
        new Blob([`${bounds.width}x${bounds.height}`], { type: "image/png" }),
    };

    const screenshot = await captureElementScreenshot(
      42,
      {
        left: 10,
        top: 20,
        width: 320,
        height: 180,
        viewportWidth: 1_280,
        viewportHeight: 720,
      },
      api,
      cropper,
    );

    expect(await screenshot?.text()).toBe("320x180");
  });

  it("hides extension UI before screenshot capture and restores it afterward", async () => {
    const events: string[] = [];
    let uiHidden = false;
    const api: ScreenshotApi = {
      getTab: async () => ({ windowId: 7 }),
      captureVisibleTab: async () => {
        events.push(`capture:${uiHidden}`);
        return "data:image/png;base64,c2NyYXBleXk=";
      },
    };
    const cropper: ImageCropper = {
      crop: async () => {
        events.push(`crop:${uiHidden}`);
        return new Blob(["clean"], { type: "image/png" });
      },
    };

    await captureElementScreenshot(
      42,
      {
        left: 10,
        top: 20,
        width: 320,
        height: 180,
        viewportWidth: 1_280,
        viewportHeight: 720,
      },
      api,
      cropper,
      {
        hide: async () => {
          uiHidden = true;
          events.push("hide");
        },
        show: async () => {
          uiHidden = false;
          events.push("show");
        },
      },
    );

    expect(events).toEqual(["hide", "capture:true", "crop:true", "show"]);
    expect(uiHidden).toBe(false);
  });

  it("captures every viewport tile and stitches the full scrollable document", async () => {
    const events: string[] = [];
    const api: ScreenshotApi = {
      getTab: async () => ({ windowId: 7 }),
      captureVisibleTab: async () => {
        events.push("capture");
        return `tile-${events.filter((event) => event === "capture").length}`;
      },
    };
    const controller: FullPageCaptureController = {
      prepare: async () => {
        events.push("prepare");
        return {
          documentWidth: 100,
          documentHeight: 250,
          viewportWidth: 100,
          viewportHeight: 100,
        };
      },
      scrollTo: async (x, y, tileIndex) => {
        const actualY = y === 200 ? 150 : y;
        events.push(`scroll:${x},${actualY}:${tileIndex}`);
        return { x, y: actualY };
      },
      restore: async () => {
        events.push("restore");
      },
    };
    const stitcher: FullPageImageStitcher = {
      stitch: async (metrics, tiles) => {
        expect(metrics).toEqual({
          documentWidth: 100,
          documentHeight: 250,
          viewportWidth: 100,
          viewportHeight: 100,
        });
        expect(tiles).toEqual([
          { dataUrl: "tile-1", x: 0, y: 0 },
          { dataUrl: "tile-2", x: 0, y: 100 },
          { dataUrl: "tile-3", x: 0, y: 150, clipTop: 50 },
        ]);
        events.push("stitch");
        return new Blob(["full-page"], { type: "image/png" });
      },
    };

    const screenshot = await captureFullPageScreenshot(42, controller, {
      api,
      stitcher,
      wait: async () => undefined,
    });

    expect(await screenshot.text()).toBe("full-page");
    expect(events).toEqual([
      "prepare",
      "scroll:0,0:0",
      "capture",
      "scroll:0,100:1",
      "capture",
      "scroll:0,150:2",
      "capture",
      "stitch",
      "restore",
    ]);
  });

  it("restores the page when a full-page capture fails", async () => {
    let restored = false;
    const controller: FullPageCaptureController = {
      prepare: async () => ({
        documentWidth: 100,
        documentHeight: 200,
        viewportWidth: 100,
        viewportHeight: 100,
      }),
      scrollTo: async (x, y) => ({ x, y }),
      restore: async () => {
        restored = true;
      },
    };

    await expect(
      captureFullPageScreenshot(42, controller, {
        api: {
          getTab: async () => ({ windowId: 7 }),
          captureVisibleTab: async () => {
            throw new Error("capture unavailable");
          },
        },
        wait: async () => undefined,
      }),
    ).rejects.toThrow("capture unavailable");
    expect(restored).toBe(true);
  });

  it("coordinates full-page capture state with the content script", async () => {
    const messages: unknown[] = [];
    const controller = createTabFullPageCaptureController(42, async (tabId, message) => {
      expect(tabId).toBe(42);
      messages.push(message);
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: string }).type === "SCRAPEYY_PREPARE_FULL_PAGE_CAPTURE"
      ) {
        return {
          documentWidth: 900,
          documentHeight: 1_800,
          viewportWidth: 900,
          viewportHeight: 600,
        };
      }
      if (
        typeof message === "object" &&
        message !== null &&
        (message as { type?: string }).type === "SCRAPEYY_SCROLL_FULL_PAGE_CAPTURE"
      ) {
        return { x: 0, y: 600 };
      }
      return { ok: true };
    });

    await controller.prepare();
    await controller.scrollTo(0, 600, 1);
    await controller.restore();

    expect(messages).toEqual([
      { type: "SCRAPEYY_PREPARE_FULL_PAGE_CAPTURE" },
      {
        type: "SCRAPEYY_SCROLL_FULL_PAGE_CAPTURE",
        x: 0,
        y: 600,
        tileIndex: 1,
      },
      { type: "SCRAPEYY_RESTORE_FULL_PAGE_CAPTURE" },
    ]);
  });
});
