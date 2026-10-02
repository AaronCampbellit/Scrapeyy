import { describe, expect, it, vi } from "vitest";

import { ensureContentScript } from "../../src/platform/content-injection";
import { CAPTURE_VERSION } from "../../src/platform/screenshot-messages";

describe("ensureContentScript", () => {
  it("injects the runtime content bundle once when the page bridge is absent", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Receiving end does not exist"))
      .mockResolvedValueOnce({ ok: true, version: CAPTURE_VERSION });
    const insertCSS = vi.fn().mockResolvedValue(undefined);
    const executeScript = vi.fn().mockResolvedValue([]);

    await ensureContentScript(42, { sendMessage, insertCSS, executeScript });

    expect(insertCSS).toHaveBeenCalledWith(42, "content-scripts/content.css");
    expect(executeScript).toHaveBeenCalledWith(
      42,
      "content-scripts/content.js",
    );
    expect(sendMessage).toHaveBeenLastCalledWith(42, {
      type: "SCRAPEYY_PING",
    });
  });

  it("does not reinject a bridge that is already responding", async () => {
    const api = {
      sendMessage: vi.fn().mockResolvedValue({ ok: true, version: CAPTURE_VERSION }),
      insertCSS: vi.fn(),
      executeScript: vi.fn(),
    };

    await ensureContentScript(42, api);

    expect(api.executeScript).not.toHaveBeenCalled();
    expect(api.insertCSS).not.toHaveBeenCalled();
  });

  it("replaces an older page bridge instead of trusting its unversioned ping", async () => {
    const api = {
      sendMessage: vi.fn().mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({ ok: true, version: CAPTURE_VERSION }),
      insertCSS: vi.fn(), executeScript: vi.fn(),
    };
    await ensureContentScript(42, api);
    expect(api.executeScript).toHaveBeenCalledTimes(1);
  });

  it("rejects a bridge that remains outdated after reinjection", async () => {
    const api = { sendMessage: vi.fn().mockResolvedValue({ ok: true }), insertCSS: vi.fn(), executeScript: vi.fn() };
    await expect(ensureContentScript(42, api)).rejects.toThrow("could not start");
  });
});
