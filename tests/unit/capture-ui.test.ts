import { describe, expect, it, vi } from "vitest";

import {
  createCaptureUiVisibility,
  findCaptureUiHost,
} from "../../src/platform/capture-ui";
import { captureElementScreenshot } from "../../src/platform/screenshots";

describe("capture UI visibility", () => {
  it("finds the currently mounted picker instead of relying on a stale UI instance", () => {
    const staleHost = document.createElement("scrapeyy-picker");
    const activeHost = document.createElement("scrapeyy-picker");
    document.body.replaceChildren(activeHost);

    expect(staleHost.isConnected).toBe(false);
    expect(findCaptureUiHost(document)).toBe(activeHost);
  });

  it("hides the picker host with important styles and restores its exact inline state", async () => {
    const before = document.createElement("div");
    const pickerHost = document.createElement("scrapeyy-picker");
    const after = document.createElement("div");
    pickerHost.style.setProperty("display", "block");
    pickerHost.style.setProperty("visibility", "visible", "important");
    document.body.replaceChildren(before, pickerHost, after);
    const waitForPaint = vi.fn().mockResolvedValue(undefined);
    const visibility = createCaptureUiVisibility(
      () => pickerHost,
      waitForPaint,
    );

    await visibility.hide();

    expect(pickerHost.isConnected).toBe(true);
    expect([...document.body.children]).toEqual([before, pickerHost, after]);
    expect(pickerHost.style.getPropertyValue("display")).toBe("none");
    expect(pickerHost.style.getPropertyPriority("display")).toBe("important");
    expect(pickerHost.style.getPropertyValue("visibility")).toBe("hidden");
    expect(pickerHost.style.getPropertyPriority("visibility")).toBe("important");
    expect(waitForPaint).toHaveBeenCalledOnce();

    await visibility.show();

    expect([...document.body.children]).toEqual([before, pickerHost, after]);
    expect(pickerHost.style.getPropertyValue("display")).toBe("block");
    expect(pickerHost.style.getPropertyPriority("display")).toBe("");
    expect(pickerHost.style.getPropertyValue("visibility")).toBe("visible");
    expect(pickerHost.style.getPropertyPriority("visibility")).toBe("important");
    expect(waitForPaint).toHaveBeenCalledTimes(2);
  });

  it("keeps the active picker hidden while the browser captures an element screenshot", async () => {
    const pickerHost = document.createElement("scrapeyy-picker");
    document.body.replaceChildren(pickerHost);
    const visibility = createCaptureUiVisibility(
      () => findCaptureUiHost(document),
      async () => undefined,
    );
    const statesAtCapture: Array<{ display: string; visibility: string }> = [];

    const screenshot = await captureElementScreenshot(
      42,
      {
        left: 0,
        top: 0,
        width: 320,
        height: 180,
        viewportWidth: 1_280,
        viewportHeight: 720,
      },
      {
        getTab: async () => ({ windowId: 7 }),
        captureVisibleTab: async () => {
          statesAtCapture.push({
            display: pickerHost.style.getPropertyValue("display"),
            visibility: pickerHost.style.getPropertyValue("visibility"),
          });
          return "data:image/png;base64,c2NyYXBleXk=";
        },
      },
      {
        crop: async () => new Blob(["clean"], { type: "image/png" }),
      },
      visibility,
    );

    expect(await screenshot?.text()).toBe("clean");
    expect(statesAtCapture).toEqual([
      { display: "none", visibility: "hidden" },
    ]);
    expect(pickerHost.style.getPropertyValue("display")).toBe("");
    expect(pickerHost.style.getPropertyValue("visibility")).toBe("");
  });
});
