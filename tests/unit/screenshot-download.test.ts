import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadScreenshot, type ScreenshotDownloadApi } from "../../src/platform/screenshot-download";

function setup(state = "in_progress") {
  let item = { state, filename: "C:/Downloads/page.png", exists: true, error: "" };
  const listeners = new Set<(change: { id: number }) => void>();
  const api: ScreenshotDownloadApi = {
    download: vi.fn().mockResolvedValue(10),
    search: vi.fn(async () => [item]),
    onChanged: { addListener: (fn) => { listeners.add(fn); }, removeListener: (fn) => { listeners.delete(fn); } },
  };
  const revoke = vi.fn();
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: () => "blob:test", revokeObjectURL: revoke }));
  return { api, listeners, revoke, change: (next: Partial<typeof item>) => {
    item = { ...item, ...next };
    listeners.forEach((fn) => fn({ id: 10 }));
  } };
}
afterEach(() => vi.unstubAllGlobals());

describe("screenshot file download", () => {
  it("waits for completion and keeps the image URL alive until the file is saved", async () => {
    const { api, listeners, revoke, change } = setup();
    let finished = false;
    const pending = downloadScreenshot(new Blob(["png"]), "page.png", false, api).then((result) => { finished = true; return result; });
    await vi.waitFor(() => expect(api.search).toHaveBeenCalled());
    expect(finished).toBe(false);
    expect(revoke).not.toHaveBeenCalled();
    change({ state: "complete" });
    expect(await pending).toMatchObject({ status: "saved", downloadId: 10, filename: "C:/Downloads/page.png" });
    expect(listeners.size).toBe(0);
    expect(revoke).toHaveBeenCalledWith("blob:test");
  });
  it("handles a file completing before the listener attaches", async () => {
    const { api, listeners } = setup("complete");
    await expect(downloadScreenshot(new Blob(), "page.png", true, api)).resolves.toMatchObject({ status: "saved" });
    expect(listeners.size).toBe(0);
  });
  it("reports cancelled or interrupted downloads without success", async () => {
    const { api, change, listeners } = setup();
    const pending = expect(downloadScreenshot(new Blob(), "page.png", true, api)).rejects.toThrow("USER_CANCELED");
    await vi.waitFor(() => expect(api.search).toHaveBeenCalled());
    change({ state: "interrupted", error: "USER_CANCELED" });
    await pending;
    expect(listeners.size).toBe(0);
  });
  it("does not report a completed download whose file is missing", async () => {
    const { api, change } = setup("complete");
    change({ exists: false });
    await expect(downloadScreenshot(new Blob(), "page.png", false, api)).rejects.toThrow("file removed");
  });
});
