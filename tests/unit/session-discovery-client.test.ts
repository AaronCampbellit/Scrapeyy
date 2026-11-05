import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ request: vi.fn(), contains: vi.fn(), send: vi.fn() }));
vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: {
  permissions: { request: api.request, contains: api.contains }, runtime: { sendMessage: api.send },
} }));
import { discoveryClient } from "../../src/session/discovery-client";
import { PERMISSION_WAIT_MS } from "../../src/session/discovery";
const origin = "https://www.lenovo.com";
const state = { id: "job", status: "waiting" };
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
beforeEach(() => {
  vi.useFakeTimers(); api.request.mockReset(); api.contains.mockReset(); api.send.mockReset();
  api.contains.mockResolvedValue(false); api.send.mockResolvedValue({ ok: true, state });
});
afterEach(() => { vi.useRealTimers(); });
it("requests permission in the click stack and follows confirmed grants when the native promise hangs", async () => {
  const prompt = deferred<boolean>(); api.request.mockReturnValue(prompt.promise);
  const result = discoveryClient.start(7, origin, false);
  expect(api.request).toHaveBeenCalledWith({ permissions: ["cookies", "tabs", "webNavigation"], origins: ["https://*.lenovo.com/*"] });
  expect(api.send).toHaveBeenCalledWith(expect.objectContaining({ action: "start", tabId: 7 }));
  await vi.advanceTimersByTimeAsync(250);
  api.contains.mockResolvedValue(true); await vi.advanceTimersByTimeAsync(250);
  await expect(result).resolves.toEqual(state);
  prompt.resolve(false); await vi.advanceTimersByTimeAsync(PERMISSION_WAIT_MS);
  expect(api.send.mock.calls.some(([message]) => message.action === "cancel")).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it("times out a hidden prompt, cancels only that attempt and ignores its late response after retry", async () => {
  const first = deferred<boolean>(); api.request.mockReturnValueOnce(first.promise).mockResolvedValueOnce(true);
  const result = discoveryClient.start(7, origin, false);
  const firstId = api.send.mock.calls[0]![0].requestId;
  const rejected = expect(result).rejects.toThrow("prompt may be behind Scrapeyy");
  await vi.advanceTimersByTimeAsync(PERMISSION_WAIT_MS); await rejected;
  expect(api.send).toHaveBeenCalledWith(expect.objectContaining({ action: "cancel", requestId: firstId, reason: "timeout" }));
  await expect(discoveryClient.start(7, origin, false)).resolves.toEqual(state);
  const calls = api.send.mock.calls.length;
  first.resolve(true); await vi.advanceTimersByTimeAsync(PERMISSION_WAIT_MS);
  expect(api.send).toHaveBeenCalledTimes(calls); expect(vi.getTimerCount()).toBe(0);
});
it("lets Stop cancel a pending prompt without waiting for its native response", async () => {
  api.request.mockReturnValue(new Promise(() => {})); const controller = new AbortController();
  const result = discoveryClient.start(7, origin, false, controller.signal);
  controller.abort(); await expect(result).rejects.toThrow("Discovery canceled");
  expect(api.send).toHaveBeenCalledWith(expect.objectContaining({ action: "cancel", reason: "canceled" }));
  expect(vi.getTimerCount()).toBe(0);
});
it("reports denial and redacts request errors, leaving both paths retryable", async () => {
  api.request.mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("SECRET browser error"));
  await expect(discoveryClient.start(7, origin, false)).rejects.toThrow("declined");
  await expect(discoveryClient.start(7, origin, false)).rejects.toThrow("could not finish");
  expect(JSON.stringify(api.send.mock.calls)).not.toContain("SECRET");
  expect(vi.getTimerCount()).toBe(0);
});
