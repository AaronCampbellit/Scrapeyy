import { describe, expect, it, vi } from "vitest";

import { createFullPageCaptureController } from "../../src/platform/full-page-controller";
import {
  createCaptureUiVisibility,
  findCaptureUiHost,
} from "../../src/platform/capture-ui";
import { captureFullPageScreenshot } from "../../src/platform/screenshots";

describe("full-page capture controller", () => {
  it("keeps the active picker hidden for every full-page screenshot tile", async () => {
    const pickerHost = document.createElement("scrapeyy-picker");
    document.body.replaceChildren(pickerHost);
    Object.defineProperties(document.documentElement, {
      scrollWidth: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 200 },
    });
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 100 },
      innerHeight: { configurable: true, value: 100 },
      scrollX: { configurable: true, writable: true, value: 0 },
      scrollY: { configurable: true, writable: true, value: 0 },
    });
    vi.spyOn(window, "scrollTo").mockImplementation((x: number | ScrollToOptions, y?: number) => {
      Object.defineProperty(window, "scrollX", {
        configurable: true,
        value: typeof x === "object" ? x.left : Number(x),
      });
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: typeof x === "object" ? x.top : Number(y),
      });
    });
    const visibility = createCaptureUiVisibility(
      () => findCaptureUiHost(document),
      async () => undefined,
    );
    const controller = createFullPageCaptureController(
      window,
      document,
      (hidden) => (hidden ? visibility.hide() : visibility.show()),
      async () => undefined,
    );
    const statesAtCapture: string[] = [];

    await captureFullPageScreenshot(42, controller, {
      api: {
        getTab: async () => ({ windowId: 7 }),
        captureVisibleTab: async () => {
          statesAtCapture.push(pickerHost.style.getPropertyValue("display"));
          return "data:image/png;base64,c2NyYXBleXk=";
        },
      },
      stitcher: {
        stitch: async () => new Blob(["full-page"], { type: "image/png" }),
      },
      wait: async () => undefined,
    });

    expect(statesAtCapture).toEqual(["none", "none"]);
    expect(pickerHost.style.getPropertyValue("display")).toBe("");
  });

  it("hides capture UI, suppresses repeated fixed content, and restores page state", async () => {
    const fixed = document.createElement("header");
    fixed.style.position = "fixed";
    fixed.style.visibility = "visible";
    document.body.append(fixed);
    Object.defineProperties(document.documentElement, {
      scrollWidth: { configurable: true, value: 900 },
      scrollHeight: { configurable: true, value: 1_800 },
    });
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 900 },
      innerHeight: { configurable: true, value: 600 },
      scrollX: { configurable: true, writable: true, value: 12 },
      scrollY: { configurable: true, writable: true, value: 34 },
    });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((x: number | ScrollToOptions, y?: number) => {
      Object.defineProperty(window, "scrollX", {
        configurable: true,
        writable: true,
        value: typeof x === "object" ? x.left : Number(x),
      });
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        writable: true,
        value: typeof x === "object" ? x.top : Number(y),
      });
    });
    const uiStates: boolean[] = [];
    const controller = createFullPageCaptureController(
      window,
      document,
      async (hidden) => {
        uiStates.push(hidden);
      },
      async () => undefined,
    );

    await expect(controller.prepare()).resolves.toEqual({
      documentWidth: 900,
      documentHeight: 1_800,
      viewportWidth: 900,
      viewportHeight: 600,
    });
    expect(uiStates).toEqual([true]);
    expect(fixed.style.visibility).toBe("visible");

    await controller.scrollTo(0, 0, 0);
    expect(document.documentElement.style.getPropertyValue("scroll-behavior")).toBe("auto");
    expect(document.documentElement.style.getPropertyValue("scroll-snap-type")).toBe("none");
    expect(fixed.style.visibility).toBe("visible");
    await controller.scrollTo(0, 600, 1);
    expect(fixed.style.visibility).toBe("hidden");

    await controller.restore();

    expect(fixed.style.visibility).toBe("visible");
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 12, top: 34, behavior: "instant" });
    expect(uiStates).toEqual([true, false]);
    expect(document.documentElement.style.getPropertyValue("scroll-behavior")).toBe("");
    expect(document.documentElement.style.getPropertyValue("scroll-snap-type")).toBe("");
  });
});
