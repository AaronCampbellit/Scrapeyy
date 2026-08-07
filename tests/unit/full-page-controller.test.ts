import { describe, expect, it, vi } from "vitest";

import { createFullPageCaptureController } from "../../src/platform/full-page-controller";

describe("full-page capture controller", () => {
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
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation((x, y) => {
      Object.defineProperty(window, "scrollX", {
        configurable: true,
        writable: true,
        value: Number(x),
      });
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        writable: true,
        value: Number(y),
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
    expect(fixed.style.visibility).toBe("visible");
    await controller.scrollTo(0, 600, 1);
    expect(fixed.style.visibility).toBe("hidden");

    await controller.restore();

    expect(fixed.style.visibility).toBe("visible");
    expect(scrollTo).toHaveBeenLastCalledWith(12, 34);
    expect(uiStates).toEqual([true, false]);
  });
});
