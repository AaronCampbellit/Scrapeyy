import { describe, expect, it, vi } from "vitest";

import { ensureContentScript } from "../../src/platform/content-injection";

describe("ensureContentScript", () => {
  it("injects the runtime content bundle once when the page bridge is absent", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error("Receiving end does not exist"))
      .mockResolvedValueOnce({ ok: true });
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
      sendMessage: vi.fn().mockResolvedValue({ ok: true }),
      insertCSS: vi.fn(),
      executeScript: vi.fn(),
    };

    await ensureContentScript(42, api);

    expect(api.executeScript).not.toHaveBeenCalled();
    expect(api.insertCSS).not.toHaveBeenCalled();
  });
});
