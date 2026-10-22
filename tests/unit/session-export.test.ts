import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ request: vi.fn(), send: vi.fn(), capture: vi.fn(), encode: vi.fn() }));
vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: { permissions: { request: mocks.request }, runtime: { sendMessage: mocks.send } } }));
vi.mock("../../src/session/capture", () => ({ captureSession: mocks.capture }));
vi.mock("../../src/session/format", async importOriginal => ({ ...await importOriginal<typeof import("../../src/session/format")>(), encodeSession: mocks.encode }));
import { exportBorrowedSession, requestSessionAccess } from "../../src/session/export";
import { SESSION_DOWNLOAD_ERROR } from "../../src/session/download";
const origin = "https://shop.example.test";
const bundle = { cookies: [{ name: "synthetic" }], storage: [{ origin }], warnings: ["Synthetic warning"] };
beforeEach(() => {
  mocks.request.mockResolvedValue(true); mocks.send.mockResolvedValue({ ok: true });
  mocks.capture.mockResolvedValue(bundle); mocks.encode.mockResolvedValue("encrypted-fixture");
});
it("requests only cookies and approved origins without deferring the native request", () => {
  const permission = requestSessionAccess([origin]);
  expect(mocks.request).toHaveBeenCalledWith({ permissions: ["cookies"], origins: [origin + "/*"] });
  return expect(permission).resolves.toBe(true);
});
it("hands the encoded file to the background without a passphrase and returns only counts", async () => {
  const result = await exportBorrowedSession({ tabId: 7, origins: [origin], protection: "encrypted", passphrase: "fixture secret" });
  expect(mocks.capture).toHaveBeenCalledWith([origin], 7);
  expect(mocks.encode).toHaveBeenCalledWith(bundle, "fixture secret");
  expect(mocks.send).toHaveBeenCalledWith({ type: "SCRAPEYY_DOWNLOAD_SESSION", text: "encrypted-fixture", protection: "encrypted" });
  expect(result).toEqual({ cookieCount: 1, storageOriginCount: 1, warnings: ["Synthetic warning"] });
});
it("allows plaintext only when explicitly selected", async () => {
  await expect(exportBorrowedSession({ tabId: 7, origins: [origin], protection: "encrypted" })).rejects.toThrow("PIN");
  expect(mocks.capture).not.toHaveBeenCalled();
  await exportBorrowedSession({ tabId: 7, origins: [origin], protection: "plaintext" });
  expect(mocks.encode).toHaveBeenCalledWith(bundle, undefined);
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ protection: "plaintext" }));
});
it("rejects invalid input without capture", async () => {
  await expect(exportBorrowedSession({ tabId: -1, origins: [origin], protection: "plaintext" })).rejects.toThrow("website");
  await expect(exportBorrowedSession({ tabId: 7, origins: [origin + "/orders"], protection: "plaintext" })).rejects.toThrow("origins");
  expect(mocks.capture).not.toHaveBeenCalled();
});
it("never exposes a browser error containing the exported session", async () => {
  mocks.send.mockRejectedValueOnce(new Error("Access denied for URL data:application/json;base64,SYNTHETIC_SECRET"));
  await expect(exportBorrowedSession({ tabId: 7, origins: [origin], protection: "plaintext" })).rejects.toThrow(SESSION_DOWNLOAD_ERROR);
  mocks.send.mockResolvedValueOnce({ ok: false });
  await expect(exportBorrowedSession({ tabId: 7, origins: [origin], protection: "plaintext" })).rejects.toThrow(SESSION_DOWNLOAD_ERROR);
});
