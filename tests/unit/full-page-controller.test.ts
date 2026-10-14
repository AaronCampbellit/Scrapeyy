import { describe, expect, it, vi } from "vitest";

import { createFullPageCaptureController } from "../../src/platform/full-page-controller";
import {
  createCaptureUiVisibility,
  findCaptureUiHost,
} from "../../src/platform/capture-ui";
import { captureFullPageScreenshot } from "../../src/platform/screenshots";

describe("full-page capture controller", () => {
  function webmailPane(reversed = false) {
    document.documentElement.style.overflowY = 'hidden';
    document.body.innerHTML = '<div id="list" role="listbox" style="overflow-y:auto"></div><main id="email" style="overflow-y:auto;position:fixed"><article role="document"></article></main>';
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 1000 }, innerHeight: { configurable: true, value: 700 },
      scrollX: { configurable: true, value: 0 }, scrollY: { configurable: true, value: 0 },
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 1400 });
    const email = document.querySelector<HTMLElement>('#email')!;
    for (const [element, width, left, height] of [[document.querySelector('#list')!, 550, 0, 8400], [email, 350, 650, 1850]] as const) {
      Object.defineProperties(element, {
        clientWidth: { configurable: true, value: width }, clientHeight: { configurable: true, value: 600 },
        scrollWidth: { configurable: true, value: width }, scrollHeight: { configurable: true, value: height },
      });
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ left, top: 60, right: left + width, bottom: 660, width, height: 600, x: left, y: 60, toJSON: () => ({}) });
    }
    let top = reversed ? -340 : 340;
    Object.defineProperty(email, 'scrollTop', { configurable: true, get: () => top,
      set: (value: number) => { top = reversed ? Math.max(-1250, Math.min(0, value)) : Math.min(1250, Math.max(0, value)); } });
    return email;
  }

  it('normalizes negative conversation offsets and restores the original position after failure', async () => {
    const email = webmailPane(true);
    const ui = vi.fn(async () => undefined);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const controller = createFullPageCaptureController(window, document, ui, async () => undefined);
    try {
      await controller.prepare();
      expect(email.scrollTop).toBe(-1250);
      await expect(controller.scrollTo(0, 600, 1)).resolves.toEqual({ x: 0, y: 600 });
      expect(email.scrollTop).toBe(-650);
      await expect(controller.scrollTo(0, 1800, 2)).resolves.toEqual({ x: 0, y: 1250 });
      expect(email.scrollTop).toBe(0);
      await controller.restore();
      expect(email.scrollTop).toBe(-340);
      await expect(captureFullPageScreenshot(1, controller, {
        api: { getTab: async () => ({ windowId: 1 }), captureVisibleTab: async () => { throw new Error('Capture interrupted'); } },
        wait: async () => undefined,
      })).rejects.toThrow('Capture interrupted');
      expect(email.scrollTop).toBe(-340);
    } finally { await controller.restore(); scroll.mockRestore(); document.documentElement.style.overflowY = ''; }
  });

  it('scrolls the email pane instead of the larger list or unscrollable root, and restores it', async () => {
    const email = webmailPane();
    const ui = vi.fn(async () => undefined);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const controller = createFullPageCaptureController(window, document, ui, async () => undefined);
    const before = email.style.cssText;
    try {
      await expect(controller.prepare()).resolves.toMatchObject({ documentWidth: 350, documentHeight: 1850, viewportWidth: 350, viewportHeight: 600, captureBounds: { left: 650, top: 60, width: 350, height: 600, viewportWidth: 1000, viewportHeight: 700 } });
      await expect(controller.scrollTo(0, 600, 1)).resolves.toEqual({ x: 0, y: 600 });
      expect(scroll).not.toHaveBeenCalled();
      expect(email.style.visibility).toBe('');
      expect(email.style.position).toBe('fixed');
      await controller.restore();
      expect(email.scrollTop).toBe(340);
      expect(email.style.cssText).toBe(before);
      expect(ui.mock.calls).toEqual([[true], [false]]);
    } finally { await controller.restore(); scroll.mockRestore(); document.documentElement.style.overflowY = ''; }
  });

  it('rejects a moved or replaced email pane and restores state after capture failure', async () => {
    const email = webmailPane();
    const ui = vi.fn(async () => undefined);
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const controller = createFullPageCaptureController(window, document, ui, async () => undefined);
    const before = email.style.cssText;
    try {
      await expect(captureFullPageScreenshot(1, controller, {
        api: { getTab: async () => ({ windowId: 1 }), captureVisibleTab: async () => { throw new Error('Tab capture failed'); } },
        wait: async () => undefined,
      })).rejects.toThrow('Tab capture failed');
      expect(email.scrollTop).toBe(340);
      expect(email.style.cssText).toBe(before);
      expect(ui.mock.calls).toEqual([[true], [false]]);
      await controller.prepare();
      vi.mocked(email.getBoundingClientRect).mockReturnValue({ left: 640, top: 60, right: 990, bottom: 660, width: 350, height: 600, x: 640, y: 60, toJSON: () => ({}) });
      await expect(controller.measure!()).rejects.toThrow('moved');
      email.remove();
      await expect(controller.measure!()).rejects.toThrow('changed');
      await controller.restore();
    } finally { await controller.restore(); scroll.mockRestore(); document.documentElement.style.overflowY = ''; }
  });

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
