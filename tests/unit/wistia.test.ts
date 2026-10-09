import { describe, expect, it, vi } from "vitest";
import { collectVideos } from "../../src/media/videos";
import { parseWistiaMedia, resolveWistiaVideos, wistiaMediaId } from "../../src/media/wistia";

const id = "i0vm82gvvs";
const asset = (quality: number, fields = {}) => ({ type: "hd_mp4_video", container: "mp4", codec: "h264",
  width: quality * 16 / 9, height: quality, size: 100_000_000,
  url: `https://embed-ssl.wistia.com/deliveries/asset-${quality}.bin`, ...fields });
const payload = (fields = {}) => ({ media: { hashedId: id, name: "IT Glue Q3 product innovation update",
  mediaType: "Video", protected: false, duration: 3582.73, assets: [asset(360), asset(1080), asset(720)], ...fields } });

describe("Wistia videos", () => {
  it("recognizes the actual cross-origin webinar iframe before playback", () => {
    document.body.innerHTML = `<iframe src="https://fast.wistia.net/embed/iframe/${id}" title="Webinar Video"></iframe>`;
    const inventory = collectVideos(document.body);
    expect(inventory.videos).toHaveLength(1);
    expect(inventory.videos[0]?.sources).toEqual([{ url: `https://fast.wistia.net/embed/iframe/${id}`, type: "", kind: "embed" }]);
  });

  it("combines iframe, legacy, Aurora and script references for the same media", () => {
    document.body.innerHTML = `<iframe src="https://fast.wistia.net/embed/iframe/${id}?videoFoam=true"></iframe>
      <div class="wistia_embed wistia_async_${id}"></div><wistia-player media-id="${id}"></wistia-player>
      <script src="https://fast.wistia.com/embed/medias/${id}.jsonp"></script>
      <script src="https://fast.wistia.com/embed/${id}.js"></script>`;
    expect(collectVideos(document.body).videos).toHaveLength(1);
  });

  it("merges an inline hydrated blob player with its embed identity", () => {
    document.body.innerHTML = `<div class="wistia_embed wistia_async_${id}"><video aria-label="Webinar" src="blob:https://site.test/live"></video></div>`;
    const inventory = collectVideos(document.body);
    expect(inventory.videos).toHaveLength(1);
    expect(inventory.videos[0]?.sources.map((source) => source.kind)).toEqual(["embed", "blob"]);
    expect(document.querySelector("video")?.paused).toBe(true);
  });

  it("rejects lookalike hosts and invalid IDs", () => {
    expect(wistiaMediaId(`https://fast.wistia.net.evil.test/embed/iframe/${id}`)).toBeUndefined();
    expect(wistiaMediaId(`https://evil.test/embed/iframe/${id}`)).toBeUndefined();
    expect(wistiaMediaId("https://fast.wistia.net/embed/iframe/short")).toBeUndefined();
    expect(wistiaMediaId(`https://user:secret@fast.wistia.net/embed/iframe/${id}`)).toBeUndefined();
  });

  it("offers complete MP4 assets by descending quality with readable .mp4 filenames", () => {
    const video = parseWistiaMedia(payload(), id);
    expect(video).toMatchObject({ title: "IT Glue Q3 product innovation update", duration: 3582.73, height: 1080 });
    expect(video.sources.map((source) => source.height)).toEqual([1080, 720, 360]);
    expect(video.sources[0]).toMatchObject({ kind: "file", type: "video/mp4", size: 100_000_000,
      filename: "IT Glue Q3 product innovation update-1080p.mp4", note: "Wistia MP4 · 1080p · 100.0 MB" });
  });

  it("excludes originals, images, audio-only assets and streaming playlists", () => {
    const video = parseWistiaMedia(payload({ assets: [asset(720), asset(1080, { type: "original" }),
      asset(360, { type: "still_image" }), asset(0, { type: "mp4_audio" }),
      asset(540, { container: "m3u8", url: "https://fast.wistia.com/deliveries/stream.m3u8" })] }), id);
    expect(video.sources).toHaveLength(1);
    expect(video.sources[0]?.height).toBe(720);
  });

  it("rejects protected, mismatched and non-video metadata", () => {
    expect(() => parseWistiaMedia(payload({ protected: true }), id)).toThrow("requires access");
    expect(() => parseWistiaMedia(payload({ hashedId: "abcdefghij" }), id)).toThrow("unexpected");
    expect(() => parseWistiaMedia(payload({ mediaType: "Audio" }), id)).toThrow("unexpected");
  });

  it("rejects asset redirects to unrelated or local hosts and unsafe protocols", () => {
    for (const url of ["http://embed-ssl.wistia.com/deliveries/a.bin", "https://localhost/deliveries/a.bin",
      "https://embed-ssl.wistia.com.evil.test/deliveries/a.bin", "https://embed-ssl.wistia.com:123/deliveries/a.bin",
      "https://user:secret@embed-ssl.wistia.com/deliveries/a.bin", "javascript:alert(1)"]) {
      expect(() => parseWistiaMedia(payload({ assets: [asset(720, { url })] }), id)).toThrow("no downloadable");
    }
  });

  it("preserves the mp4 extension for very long or invalid titles", () => {
    const source = parseWistiaMedia(payload({ name: "../../" + "Long webinar ".repeat(30) }), id).sources[0]!;
    expect(source.filename).toMatch(/-1080p\.mp4$/);
    expect(source.filename!.length).toBeLessThanOrEqual(80);
    expect(source.filename).not.toMatch(/[\\/]/);
  });

  it("enriches an explicit scan with one credential-free request and preserves the embed", async () => {
    document.body.innerHTML = `<iframe src="https://fast.wistia.net/embed/iframe/${id}" title="Webinar"></iframe>`;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(payload())));
    const inventory = collectVideos(document.body);
    const result = await resolveWistiaVideos(inventory, fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(`https://fast.wistia.net/embed/medias/${id}.json`, expect.objectContaining({
      credentials: "omit", referrerPolicy: "no-referrer", redirect: "error" }));
    expect(result.videos[0]?.sources.map((source) => source.kind)).toEqual(["file", "file", "file", "embed"]);
    expect(inventory.videos[0]?.sources).toHaveLength(1);
  });

  it("keeps failed embeds visible while other video files remain usable", async () => {
    document.body.innerHTML = `<iframe src="https://fast.wistia.net/embed/iframe/${id}"></iframe><video src="https://cdn.test/clip.mp4"></video>`;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("not found", { status: 404 }));
    const result = await resolveWistiaVideos(collectVideos(document.body), fetcher);
    expect(result.videos).toHaveLength(2);
    expect(result.notes).toContain("Wistia video details are unavailable (HTTP 404).");
    expect(result.videos.flatMap((video) => video.sources).filter((source) => source.kind === "file")).toHaveLength(1);
  });

  it("bounds response size and handles malformed metadata without exposing raw errors", async () => {
    document.body.innerHTML = `<wistia-player media-id="${id}"></wistia-player>`;
    for (const response of [new Response("x".repeat(1_000_001)), new Response("invalid JSON")]) {
      const result = await resolveWistiaVideos(collectVideos(document.body), vi.fn<typeof fetch>().mockResolvedValue(response));
      expect(result.videos[0]?.sources).toHaveLength(1);
      expect(result.notes.length).toBeGreaterThan(2);
    }
  });

  it("does not fetch external data for ordinary videos or unsupported embeds", async () => {
    document.body.innerHTML = '<video src="https://cdn.test/clip.mp4"></video><iframe src="https://www.youtube.com/embed/123"></iframe>';
    const fetcher = vi.fn<typeof fetch>();
    await resolveWistiaVideos(collectVideos(document.body), fetcher);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
