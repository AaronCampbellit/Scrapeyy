import { describe, expect, it } from "vitest";
import { assertSelectionReady, CAPTURE_VERSION, screenshotSaved } from "../../src/platform/screenshot-messages";

describe("screenshot acknowledgements", () => {
  it.each([undefined, null, 12, { ok: true }, { status: "saved", version: "old" }])(
    "never reports success for an empty, legacy, or mismatched response: %j", (response) => {
      expect(() => screenshotSaved(response)).toThrow("Reload");
      expect(() => assertSelectionReady(response)).toThrow("Reload");
    });
  it("accepts a ready overlay separately from a saved file", () => {
    const ready = { status: "selection-ready", version: CAPTURE_VERSION };
    expect(() => assertSelectionReady(ready)).not.toThrow();
    expect(() => screenshotSaved(ready)).toThrow();
    const saved = { status: "saved", version: CAPTURE_VERSION, downloadId: 2, filename: "C:/Downloads/test.png" };
    expect(screenshotSaved(saved)).toEqual(saved);
  });
  it("accepts inbox receipts only with a stored run ID", () => {
    const saved = { status: "saved", version: CAPTURE_VERSION, destination: "inbox", runId: "png-1", filename: "test.png" };
    expect(screenshotSaved(saved)).toEqual(saved);
    expect(() => screenshotSaved({ ...saved, runId: undefined })).toThrow();
  });
  it("requires a distinct confirmed clipboard receipt", () => {
    const copied = { status: "copied", destination: "clipboard", version: CAPTURE_VERSION, filename: "page.png" };
    expect(screenshotSaved(copied)).toEqual(copied);
    expect(() => screenshotSaved({ ...copied, status: "saved" })).toThrow();
    expect(() => screenshotSaved({ ...copied, version: "old" })).toThrow();
    expect(() => screenshotSaved({ status: "saved", destination: "unknown", version: CAPTURE_VERSION, filename: "page.png", downloadId: 1 })).toThrow();
  });
});
