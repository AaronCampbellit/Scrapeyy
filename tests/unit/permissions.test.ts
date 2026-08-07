import { describe, expect, it } from "vitest";

import {
  hasOriginAccess,
  requestOriginAccess,
  revokeOriginAccess,
  type PermissionApi,
} from "../../src/platform/permissions";
import {
  captureElementScreenshot,
  type ImageCropper,
  type ScreenshotApi,
} from "../../src/platform/screenshots";

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
});
