// @vitest-environment node
import "fake-indexeddb/auto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_APP_SETTINGS } from "../../src/storage/app-settings";
import type { VideoInventory } from "../../src/media/videos";
import { captionTextKey, videoTextKey } from "../../src/media/video-text";
import { parseWistiaMedia } from "../../src/media/wistia";

const state = vi.hoisted(() => ({ listener: undefined as undefined | ((message: unknown, sender: object) => unknown),
  download: vi.fn(), send: vi.fn(), fetch: vi.fn<typeof fetch>() }));
vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: {
  runtime: { onInstalled: { addListener: vi.fn() }, onStartup: { addListener: vi.fn() },
    onMessage: { addListener: (listener: typeof state.listener) => { state.listener = listener; } } },
  storage: { local: { get: async () => ({ appSettings: DEFAULT_APP_SETTINGS }), set: vi.fn() } },
  alarms: { onAlarm: { addListener: vi.fn() } },
  tabs: { get: async () => ({ id: 1, active: true, url: "https://community.kaseya.com/webinar" }), sendMessage: state.send },
  downloads: { download: state.download },
} }));
vi.mock("../../src/platform/content-injection", () => ({ ensureContentScript: vi.fn() }));

const assetUrl = "https://embed-ssl.wistia.com/deliveries/webinar.bin";
const inventory: VideoInventory = { pageUrl: "https://community.kaseya.com/webinar", notes: [], videos: [{
  title: "Webinar Video", duration: null, width: 0, height: 0, captions: [],
  sources: [{ url: "https://fast.wistia.net/embed/iframe/i0vm82gvvs", kind: "embed", type: "" }],
}] };
const metadata = { media: { hashedId: "i0vm82gvvs", name: "IT Glue webinar", mediaType: "Video", protected: false,
  assets: [{ type: "hd_mp4_video", container: "mp4", width: 1920, height: 1080, size: 241474840, url: assetUrl }] } };
beforeAll(async () => {
  vi.stubGlobal("defineBackground", (main: () => void) => main());
  await import("../../entrypoints/background");
});
beforeEach(() => {
  state.download.mockReset().mockResolvedValue(27);
  state.send.mockReset().mockResolvedValue(inventory);
  state.fetch.mockReset().mockImplementation(async (url) => new Response(String(url) === assetUrl ? "video bytes" : JSON.stringify(metadata)));
  vi.stubGlobal("fetch", state.fetch);
});

describe("background video tools", () => {
  it("returns a full transcript for copying without creating a browser download", async () => {
    const payload = { media: { ...metadata.media, captions: [{ language: "eng", text: "Full webinar transcript." }] } };
    state.fetch.mockImplementation(async () => new Response(JSON.stringify(payload)));
    const video = parseWistiaMedia(payload, "i0vm82gvvs");
    video.sources.push(inventory.videos[0]!.sources[0]!);
    const text = await state.listener!({ type: "SCRAPEYY_READ_VIDEO_TEXT", tabId: 1,
      videoKey: videoTextKey(video), captionKey: captionTextKey(video.captions[0]!), format: "txt" }, {});
    expect(text).toContain("Full webinar transcript.");
    expect(state.fetch).toHaveBeenCalledTimes(1);
    expect(state.download).not.toHaveBeenCalled();
  });

  it("exports full TXT from current public metadata without requesting video or subtitle bytes", async () => {
    const payload = { media: { ...metadata.media, captions: [{ language: "eng", text: "Full webinar transcript.\n\nClosing remarks." }] } };
    state.fetch.mockImplementation(async () => new Response(JSON.stringify(payload)));
    const video = parseWistiaMedia(payload, "i0vm82gvvs");
    video.sources.push(inventory.videos[0]!.sources[0]!);
    let exported: Blob | undefined;
    vi.useFakeTimers();
    const create = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => { exported = blob as Blob; return "blob:export"; });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    try {
      await expect(state.listener!({ type: "SCRAPEYY_EXPORT_VIDEO_TEXT", tabId: 1,
        videoKey: videoTextKey(video), captionKey: captionTextKey(video.captions[0]!), format: "txt" }, {})).resolves.toBe(27);
      expect(state.fetch).toHaveBeenCalledTimes(1);
      expect(state.fetch.mock.calls[0]![0]).toBe("https://fast.wistia.net/embed/medias/i0vm82gvvs.json");
      expect(await exported!.text()).toContain("Full webinar transcript.\n\nClosing remarks.");
      expect(state.download).toHaveBeenCalledWith({ url: "blob:export", filename: "Scrapeyy/Transcripts/IT Glue webinar-eng.txt", saveAs: true, conflictAction: "uniquify" });
    } finally { vi.runAllTimers(); vi.useRealTimers(); create.mockRestore(); revoke.mockRestore(); }
  });

  it("rejects a forged text track before requesting captions or creating a download", async () => {
    await expect(state.listener!({ type: "SCRAPEYY_EXPORT_VIDEO_TEXT", tabId: 1,
      videoKey: "made up video", captionKey: "https://evil.test/other.vtt", format: "vtt" }, {})).rejects.toThrow("no longer on the page");
    expect(state.fetch).toHaveBeenCalledTimes(1); // Revalidates only the actual provider metadata.
    expect(state.download).not.toHaveBeenCalled();
  });

  it("resolves a Wistia iframe during the popup scan", async () => {
    const result = await state.listener!({ type: "SCRAPEYY_INSPECT_VIDEOS", tabId: 1 }, {}) as VideoInventory;
    expect(state.send).toHaveBeenCalledWith(1, { type: "SCRAPEYY_INSPECT_VIDEOS" });
    expect(result.videos[0]?.sources[0]).toMatchObject({ kind: "file", url: assetUrl, height: 1080 });
    expect(state.download).not.toHaveBeenCalled();
  });

  it("revalidates a provider asset against the current page and saves it as mp4", async () => {
    vi.useFakeTimers();
    try {
      await expect(state.listener!({ type: "SCRAPEYY_DOWNLOAD_VIDEO", tabId: 1, url: assetUrl }, {})).resolves.toBe(27);
      expect(state.fetch).toHaveBeenCalledTimes(2);
      expect(state.fetch).toHaveBeenLastCalledWith(assetUrl, expect.objectContaining({ redirect: "error" }));
      expect(state.download).toHaveBeenCalledWith({ url: expect.stringMatching(/^blob:/),
        filename: DEFAULT_APP_SETTINGS.downloadSubfolder + "/Videos/IT Glue webinar-1080p.mp4",
        saveAs: DEFAULT_APP_SETTINGS.downloadBehavior === "ask", conflictAction: "uniquify" });
    } finally { vi.runAllTimers(); vi.useRealTimers(); }
  });

  it("rejects an arbitrary file URL that the current scan did not expose", async () => {
    await expect(state.listener!({ type: "SCRAPEYY_DOWNLOAD_VIDEO", tabId: 1, url: "https://evil.test/other.mp4" }, {}))
      .rejects.toThrow("no longer on the page");
    expect(state.download).not.toHaveBeenCalled();
  });

  it("rejects a stale provider download after the embed is removed", async () => {
    state.send.mockResolvedValue({ ...inventory, videos: [] });
    await expect(state.listener!({ type: "SCRAPEYY_DOWNLOAD_VIDEO", tabId: 1, url: assetUrl }, {}))
      .rejects.toThrow("no longer on the page");
    expect(state.fetch).not.toHaveBeenCalled();
    expect(state.download).not.toHaveBeenCalled();
  });

  it("does not download a protected provider asset even when its URL is supplied", async () => {
    state.fetch.mockImplementation(async () => new Response(JSON.stringify({ media: { ...metadata.media, protected: true } })));
    await expect(state.listener!({ type: "SCRAPEYY_DOWNLOAD_VIDEO", tabId: 1, url: assetUrl }, {}))
      .rejects.toThrow("no longer on the page");
    expect(state.download).not.toHaveBeenCalled();
  });
});
