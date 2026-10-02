// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureDatabase } from "../../src/storage/capture-database";
import { DEFAULT_APP_SETTINGS } from "../../src/storage/app-settings";
import { CAPTURE_VERSION } from "../../src/platform/screenshot-messages";

const state = vi.hoisted(() => ({
  settings: {} as Record<string, unknown>,
  listener: undefined as undefined | ((message: unknown, sender: { tab?: { id: number } }) => unknown),
  download: vi.fn(),
}));
vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: {
  runtime: {
    onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() },
    onMessage: { addListener: (listener: typeof state.listener) => { state.listener = listener; } },
  },
  storage: { local: { get: async () => ({ appSettings: state.settings }), set: vi.fn() } },
  alarms: { onAlarm: { addListener: vi.fn() } },
  tabs: { get: async () => ({ id: 1, active: true, url: "https://example.test/page", title: "Example page" }), sendMessage: vi.fn() },
} }));
vi.mock("../../src/platform/content-injection", () => ({ ensureContentScript: vi.fn() }));
vi.mock("../../src/platform/screenshots", () => ({
  captureVisibleScreenshot: async () => new Blob(["visible"], { type: "image/png" }),
  captureFullPageScreenshot: async () => new Blob(["full-page"], { type: "image/png" }),
  captureElementScreenshot: async () => new Blob(["selection"], { type: "image/png" }),
}));
vi.mock("../../src/platform/screenshot-download", () => ({ downloadScreenshot: state.download }));

const database = new CaptureDatabase();
beforeAll(async () => {
  vi.stubGlobal("defineBackground", (main: () => void) => main());
  await import("../../entrypoints/background");
});
beforeEach(async () => {
  for (const run of await database.listRuns()) await database.deleteRun(run.id);
  state.settings = { ...DEFAULT_APP_SETTINGS, screenshotSubfolder: "My pictures" };
  state.download.mockReset().mockImplementation(async (_image, filename) => ({ status: "saved", version: CAPTURE_VERSION, downloadId: 10, filename }));
});

describe("background screenshot destinations", () => {
  for (const destination of ["automatic", "ask", "inbox"] as const) {
    it.each(["visible", "full-page", "selection"] as const)(`routes %s screenshots to ${destination}`, async (kind) => {
      state.settings.screenshotDestination = destination;
      const response = await state.listener!(kind === "selection" ? {
        type: "SCRAPEYY_SAVE_SCREENSHOT_SELECTION",
        bounds: { left: 0, top: 0, width: 20, height: 20, viewportWidth: 100, viewportHeight: 100 },
      } : { type: "SCRAPEYY_SCREENSHOT", tabId: 1, kind }, { tab: { id: 1 } });
      expect(response).toMatchObject({ status: "saved", version: CAPTURE_VERSION });
      const runs = await database.listRuns();
      if (destination === "inbox") {
        expect(state.download).not.toHaveBeenCalled();
        expect(runs).toHaveLength(1);
        expect(runs[0]?.screenshot).toMatchObject({ kind, title: "Example page" });
        expect(await (await database.getArtifact(`${runs[0]!.id}:screenshot`))?.blob.text()).toBe(kind);
        await state.listener!({ type: "SCRAPEYY_EXPORT_RUN", runId: runs[0]!.id }, {});
        expect(state.download).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^My pictures\/.*\.png$/), true);
      } else {
        expect(runs).toHaveLength(0);
        expect(state.download).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/^My pictures\/.*\.png$/), destination === "ask");
      }
    });
  }
});
