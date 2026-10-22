import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ download: vi.fn(), search: vi.fn(), add: vi.fn(), remove: vi.fn(), dataUrl: vi.fn() }));
vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: {
  runtime: { id: "scrapeyy", getURL: (path: string) => "moz-extension://scrapeyy" + path },
  downloads: { download: mocks.download, search: mocks.search, onChanged: { addListener: mocks.add, removeListener: mocks.remove } },
} }));
vi.mock("../../src/platform/downloads", () => ({ blobDataUrl: mocks.dataUrl }));
import { handleSessionDownload } from "../../src/session/download";
const sender = { id: "scrapeyy", url: "moz-extension://scrapeyy/popup.html" };
const message = { type: "SCRAPEYY_DOWNLOAD_SESSION", text: '{"synthetic":"secret"}', protection: "plaintext" };
const create = vi.fn(() => "blob:background-owned"), revoke = vi.fn();
beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: create, revokeObjectURL: revoke }));
  mocks.download.mockResolvedValue(10); mocks.search.mockResolvedValue([{ state: "complete", exists: true }]);
  mocks.dataUrl.mockResolvedValue("data:application/json;base64,c3ludGhldGlj");
});
afterEach(() => vi.unstubAllGlobals());
it("uses a Firefox background Blob and retains it through Save As until completion", async () => {
  mocks.search.mockResolvedValue([{ state: "in_progress" }]);
  let finished = false;
  const pending = handleSessionDownload(message, sender).then(result => { finished = true; return result; });
  await vi.waitFor(() => expect(mocks.search).toHaveBeenCalled());
  expect(finished).toBe(false); expect(revoke).not.toHaveBeenCalled(); expect(mocks.dataUrl).not.toHaveBeenCalled();
  expect(mocks.download).toHaveBeenCalledWith({ url: "blob:background-owned", filename: expect.stringMatching(/^scrapeyy-session-PLAINTEXT-\d+\.json$/), saveAs: true, conflictAction: "uniquify" });
  const changed = mocks.add.mock.calls[0]![0] as (change: {id: number}) => void;
  changed({ id: 999 }); expect(mocks.search).toHaveBeenCalledTimes(1);
  mocks.search.mockResolvedValue([{ state: "complete", exists: true }]); changed({ id: 10 });
  await expect(pending).resolves.toEqual({ ok: true });
  expect(revoke).toHaveBeenCalledWith("blob:background-owned"); expect(mocks.remove).toHaveBeenCalledWith(changed);
});
it("handles completion before the listener attaches", async () => {
  await expect(handleSessionDownload(message, sender)).resolves.toEqual({ ok: true });
  expect(mocks.remove).toHaveBeenCalled(); expect(revoke).toHaveBeenCalled();
});
it.each(["interrupted", "missing"])("cleans up a %s download without reporting success", async state => {
  mocks.search.mockResolvedValue(state === "missing" ? [] : [{ state, error: "SYNTHETIC_SECRET" }]);
  await expect(handleSessionDownload(message, sender)).resolves.toEqual({ ok: false });
  expect(revoke).toHaveBeenCalled(); expect(mocks.remove).toHaveBeenCalled();
});
it("does not return browser exceptions containing file contents", async () => {
  mocks.download.mockRejectedValueOnce(new Error("Access denied: SYNTHETIC_SECRET"));
  await expect(handleSessionDownload(message, sender)).resolves.toEqual({ ok: false });
  expect(revoke).toHaveBeenCalled();
});
it("rejects website senders, other extensions and malformed requests before creating a file", async () => {
  for (const source of [{ ...sender, url: "https://shop.example.test" }, { ...sender, id: "foreign" }, {}]) {
    await expect(handleSessionDownload(message, source)).resolves.toEqual({ ok: false });
  }
  await expect(handleSessionDownload({ ...message, protection: "other" }, sender)).resolves.toEqual({ ok: false });
  await expect(handleSessionDownload({ ...message, text: "" }, sender)).resolves.toEqual({ ok: false });
  expect(create).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
});
it("supports the Chrome service worker without Blob URL APIs", async () => {
  vi.stubGlobal("URL", Object.assign(class extends URL {}, { createObjectURL: undefined }));
  await expect(handleSessionDownload({ ...message, protection: "encrypted" }, sender)).resolves.toEqual({ ok: true });
  expect(mocks.download).toHaveBeenCalledWith(expect.objectContaining({url:"data:application/json;base64,c3ludGhldGlj",filename:expect.stringContaining("encrypted")}));
  expect(revoke).not.toHaveBeenCalled();
});
