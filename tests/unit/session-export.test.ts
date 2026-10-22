import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn(), download: vi.fn(), capture: vi.fn(), encode: vi.fn(), dataUrl: vi.fn() }));
vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: { permissions: { request: mocks.request }, downloads: { download: mocks.download } } }));
vi.mock("../../src/session/capture", () => ({ captureSession: mocks.capture }));
vi.mock("../../src/session/format", async importOriginal => ({ ...await importOriginal<typeof import("../../src/session/format")>(), encodeSession: mocks.encode }));
vi.mock("../../src/platform/downloads", () => ({ blobDataUrl: mocks.dataUrl }));
import { exportBorrowedSession, requestSessionAccess } from "../../src/session/export";
const origin = "https://shop.example.test";
const bundle = { cookies: [{ name: "synthetic" }], storage: [{ origin }], warnings: ["Synthetic warning"] };
beforeEach(() => {
  mocks.request.mockResolvedValue(true); mocks.download.mockResolvedValue(1);
  mocks.capture.mockResolvedValue(bundle); mocks.encode.mockResolvedValue("encrypted-fixture"); mocks.dataUrl.mockResolvedValue("data:application/json;base64,c3ludGhldGlj");
});
it("requests only cookies and approved origins without deferring the native request", () => {
  const permission = requestSessionAccess([origin]);
  expect(mocks.request).toHaveBeenCalledWith({ permissions: ["cookies"], origins: [origin + "/*"] });
  return expect(permission).resolves.toBe(true);
});
it("uses a popup-independent download URL and returns counts without session contents", async () => {
  const result = await exportBorrowedSession({ tabId: 7, origins: [origin], protection: "encrypted", passphrase: "fixture secret" });
  expect(mocks.capture).toHaveBeenCalledWith([origin], 7);
  expect(mocks.encode).toHaveBeenCalledWith(bundle, "fixture secret");
  expect(mocks.download).toHaveBeenCalledWith({ url: "data:application/json;base64,c3ludGhldGlj", filename: expect.stringMatching(/^scrapeyy-session-encrypted-\d+\.json$/), saveAs: true, conflictAction: "uniquify" });
  expect(result).toEqual({ cookieCount: 1, storageOriginCount: 1, warnings: ["Synthetic warning"] });
});
it("allows plaintext only when explicitly selected", async () => {
  await expect(exportBorrowedSession({ tabId: 7, origins: [origin], protection: "encrypted" })).rejects.toThrow("PIN");
  expect(mocks.capture).not.toHaveBeenCalled();
  await exportBorrowedSession({ tabId: 7, origins: [origin], protection: "plaintext" });
  expect(mocks.encode).toHaveBeenCalledWith(bundle, undefined);
  expect(mocks.download).toHaveBeenCalledWith(expect.objectContaining({ filename: expect.stringContaining("PLAINTEXT") }));
});
it("does not capture on invalid input or swallow download failures", async () => {
  await expect(exportBorrowedSession({ tabId: -1, origins: [origin], protection: "plaintext" })).rejects.toThrow("website");
  await expect(exportBorrowedSession({ tabId: 7, origins: [origin + "/orders"], protection: "plaintext" })).rejects.toThrow("origins");
  expect(mocks.capture).not.toHaveBeenCalled();
  mocks.download.mockRejectedValueOnce(new Error("Save cancelled"));
  await expect(exportBorrowedSession({ tabId: 7, origins: [origin], protection: "plaintext" })).rejects.toThrow("Save cancelled");
});
