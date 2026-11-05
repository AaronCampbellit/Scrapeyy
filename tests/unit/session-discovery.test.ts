import { beforeEach, expect, it, vi } from "vitest";
import { addCandidate, discoveryPermissions, inspectPageOrigins, safeOrigin, sameSite, type DiscoveryState } from "../../src/session/discovery";
vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: {} }));
import { createDiscoveryController } from "../../src/session/discovery-background";

const origin = "https://manage.example.co.uk";
const sender = { id: "extension", url: "chrome-extension://extension/popup.html" };
function fixture() {
  let stored: Record<string, unknown> = {};
  const api = {
    storage: { session: { get: vi.fn(async () => structuredClone(stored)), set: vi.fn(async value => { stored = structuredClone(value); }) } },
    runtime: { id: "extension", getURL: (path: string) => "chrome-extension://extension" + path },
    tabs: { get: vi.fn(async (id: number) => ({ id, url: origin + "/private?token=never-save" })), query: vi.fn(async () => [
      { id: 1, url: origin }, { id: 2, url: "https://accounts.example.co.uk" }, { id: 3, url: "https://other.example.co.uk" },
    ]) },
    cookies: { getAllCookieStores: vi.fn(async () => [{ id: "one", tabIds: [1, 2, 4] }, { id: "two", tabIds: [3, 5] }]),
      getAll: vi.fn(async () => [{ domain: ".auth.example.co.uk", value: "NEVER-STORE-COOKIE", secure: true },
        { domain: "partition.example.co.uk", value: "partition", secure: true, partitionKey: {} }]) },
    permissions: { contains: vi.fn(async (_permissions?: { permissions?: string[]; origins?: string[] }) => true) },
    webNavigation: { getAllFrames: vi.fn(async () => [{ frameId: 0, url: origin }]) },
    scripting: { executeScript: vi.fn(async (_args: { target: { tabId: number } }) => [{ result: { found: [
      { origin: "https://signin.example.co.uk", evidence: "page link" },
      { origin: "https://outside.test", evidence: "page link" },
    ] } }]) },
  };
  const controller = createDiscoveryController(api as never);
  const command = (action: string, extra = {}, tabId = 1) => controller.handle({ action, tabId, ...extra }, sender);
  const start = async (record = false) => {
    await command("start", { origin, record });
    await vi.waitFor(async () => {
      const state = (await command("get")).state;
      expect(state?.status).toBe(record ? "recording" : "ready");
      expect(state?.candidates.some(c => c.evidence.includes("cookie"))).toBe(true);
    });
    return (await command("get")).state!;
  };
  return { api, controller, command, start, stored: () => stored };
}
beforeEach(() => { vi.useRealTimers(); });
it("uses registrable sites including private suffixes, IPs and exact host boundaries", () => {
  expect(sameSite(origin, "https://idp.auth.example.co.uk")).toBe(true);
  expect(sameSite(origin, "https://other.co.uk")).toBe(false);
  expect(sameSite("https://alice.github.io", "https://bob.github.io")).toBe(false);
  expect(discoveryPermissions(origin, false).origins).toEqual(["https://*.example.co.uk/*"]);
  expect(discoveryPermissions("http://127.0.0.1:1234", false).origins).toEqual(["http://127.0.0.1/*"]);
  expect(safeOrigin("https://user:secret@example.com")).toBeUndefined();
  expect(safeOrigin("https://example.com/private?token=secret#code")).toBe("https://example.com");
});
it("extracts origins from links, forms and frames without returning credentials or paths", () => {
  document.body.innerHTML = '<a href="https://id.example.com/login?token=SECRET">login</a><form action="https://auth.example.com/post"></form><iframe src="https://frame.example.com/path"></iframe><a href="javascript:alert(1)">bad</a>';
  vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
  const result = inspectPageOrigins();
  expect(result.found).toEqual(expect.arrayContaining([{ origin: "https://id.example.com", evidence: "page link" }, { origin: "https://auth.example.com", evidence: "form" }, { origin: "https://frame.example.com", evidence: "frame" }]));
  expect(JSON.stringify(result)).not.toContain("SECRET");
});
it("scans only same-store related tabs, persists only metadata, and restores after worker recreation", async () => {
  const f = fixture(), state = await f.start();
  expect(state.selected).toContain("https://auth.example.co.uk");
  expect(state.selected).not.toContain("https://outside.test");
  expect(state.candidates.some(c => c.origin === "https://outside.test")).toBe(true);
  expect(state.selected).not.toContain("https://other.example.co.uk");
  expect(state.selected).not.toContain("https://partition.example.co.uk");
  expect(f.api.scripting.executeScript.mock.calls.every(([call]) => call.target.tabId !== 3)).toBe(true);
  const persisted = JSON.stringify(f.stored());
  expect(persisted).not.toMatch(/NEVER-STORE|never-save|private\?/);
  const restored = await createDiscoveryController(f.api as never).handle({ action: "get", tabId: 2 }, sender);
  expect(restored.state?.selected).toEqual(state.selected);
  expect((await f.command("get", {}, 3)).state).toBeUndefined();
});
it("records redirects and child windows, rejects other stores and preserves explicit exclusions", async () => {
  const f = fixture(); let state = await f.start(true);
  await f.controller.observe(1, "https://outside.test/login?code=SECRET", "redirect", true);
  state = (await f.command("get")).state!;
  expect(state.selected).toContain("https://outside.test");
  await f.command("update", { id: state.id, selected: [origin] });
  await f.controller.observe(1, "https://outside.test/callback", "navigation", true);
  await f.controller.trackTab(1, 4);
  await f.controller.observe(4, "https://identity.test/path", "navigation", true);
  await f.controller.trackTab(1, 5);
  await f.controller.observe(5, "https://foreign.test", "navigation", true);
  state = (await f.command("get")).state!;
  expect(state.selected).toContain("https://identity.test");
  expect(state.selected).not.toContain("https://outside.test");
  expect(state.candidates.some(c => c.origin === "https://foreign.test")).toBe(false);
  expect(JSON.stringify(f.stored())).not.toContain("SECRET");
});
it("requires the exact popup sender, ignores stale edits, stops recording and expires metadata", async () => {
  const f = fixture(); const state = await f.start(true);
  expect((await f.controller.handle({ action: "start", tabId: 1, origin }, { ...sender, url: origin, tab: { id: 1 } })).ok).toBe(false);
  expect((await f.command("update", { id: "old-id", selected: [origin] })).ok).toBe(false);
  await f.command("stop", { id: state.id });
  await vi.waitFor(async () => expect((await f.command("get")).state?.status).toBe("ready"));
  await f.controller.observe(1, "https://after-stop.test", "navigation", true);
  expect((await f.command("get")).state?.selected).not.toContain("https://after-stop.test");
  vi.spyOn(Date, "now").mockReturnValue(state.expiresAt + 1);
  expect((await f.command("get")).state).toBeUndefined();
  vi.restoreAllMocks();
});
it("cancels a denied pending permission request without replacing a newer scan", async () => {
  const f = fixture();
  f.api.permissions.contains.mockResolvedValue(false);
  const pending = f.command("start", { origin, requestId: "denied" });
  await f.command("cancel", { requestId: "denied" });
  f.api.permissions.contains.mockResolvedValue(true);
  const state = await f.start();
  await pending;
  expect((await f.command("get")).state?.id).toBe(state.id);
});
it("continues recording after worker recreation and stops at the recording deadline", async () => {
  const f = fixture(), state = await f.start(true);
  const restored = createDiscoveryController(f.api as never);
  await restored.observe(1, "https://restart.test/callback?code=SECRET", "redirect", true);
  expect((await f.command("get")).state?.selected).toContain("https://restart.test");
  vi.spyOn(Date, "now").mockReturnValue(state.recordUntil! + 1);
  await restored.observe(1, "https://too-late.test", "navigation", true);
  expect((await f.command("get")).state?.status).toBe("ready");
  expect((await f.command("get")).state?.selected).not.toContain("https://too-late.test");
  vi.restoreAllMocks();
});
it("caps candidates and selection with visible warnings", () => {
  const state = { candidates: [], selected: [], excluded: [], warnings: [] } as unknown as DiscoveryState;
  for (let i = 0; i < 300; i++) addCandidate(state, `https://site${i}.example.com`, "page link", true);
  expect(state.candidates).toHaveLength(250); expect(state.selected).toHaveLength(100);
  expect(state.warnings).toHaveLength(2);
});
it("stops a waiting scan without scanning or restarting when access arrives later", async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.api.permissions.contains.mockImplementation(async (permissions?: { permissions?: string[] }) => permissions?.permissions?.length === 1);
  const state = (await f.command("start", { origin })).state!;
  await vi.advanceTimersByTimeAsync(1);
  expect((await f.command("get")).state?.status).toBe("waiting");
  await f.command("stop", { id: state.id });
  f.api.permissions.contains.mockResolvedValue(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect((await f.command("get")).state?.status).toBe("ready");
  expect(f.api.scripting.executeScript).not.toHaveBeenCalled();
  vi.useRealTimers();
});
it("expires a missed permission prompt and keeps the timeout after grants arrive", async () => {
  vi.useFakeTimers();
  const f = fixture();
  f.api.permissions.contains.mockImplementation(async (permissions?: { permissions?: string[] }) => permissions?.permissions?.length === 1);
  await f.command("start", { origin });
  await vi.advanceTimersByTimeAsync(60_001);
  const state = (await f.command("get")).state!;
  expect(state.status).toBe("error");
  expect(state.warnings.join()).toContain("prompt may be behind Scrapeyy");
  f.api.permissions.contains.mockResolvedValue(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect((await f.command("get")).state?.status).toBe("error");
  expect(f.api.scripting.executeScript).not.toHaveBeenCalled();
  vi.useRealTimers();
});
