import { describe, expect, it } from "vitest";
import { classifyVideoSource, collectVideos, videoMetadataForExport } from "../../src/media/videos";

describe("video discovery", () => {
  it("redacts authentication URL parameters in exports while retaining live download URLs", () => {
    const url = "https://cdn.test/movie.mp4?token=temporary&quality=hd";
    const live = { pageUrl: "https://site.test/?access_token=secret", notes: [], videos: [
      { title: "Demo", duration: null, width: 0, height: 0, captions: [],
        sources: [{ url, kind: "file" as const, type: "video/mp4" }] },
    ] };
    const exported = videoMetadataForExport(live);
    expect(exported.pageUrl).toBe("https://site.test/");
    expect(exported.videos[0]?.sources[0]?.url).toBe("https://cdn.test/movie.mp4?quality=hd");
    expect(live.videos[0]?.sources[0]?.url).toBe(url);
  });
  it("distinguishes downloadable files from streams and temporary playback URLs", () => {
    expect(classifyVideoSource("https://cdn.test/movie.mp4?token=example")).toBe("file");
    expect(classifyVideoSource("https://cdn.test/watch", "video/webm")).toBe("file");
    expect(classifyVideoSource("https://cdn.test/playlist.m3u8")).toBe("stream");
    expect(classifyVideoSource("https://cdn.test/watch", "application/dash+xml")).toBe("stream");
    expect(classifyVideoSource("blob:https://site.test/123")).toBe("blob");
    expect(classifyVideoSource("https://site.test/watch")).toBe("unknown");
  });

  it("collects source files, video metadata and available caption cues without starting playback", () => {
    document.body.innerHTML = '<video aria-label="Training" poster="/poster.png"><source src="/movie.mp4" type="video/mp4"><track src="/captions.vtt" srclang="en" label="English"></video><a href="/movie.mp4">Same video</a>';
    const video = document.querySelector("video")!;
    Object.defineProperties(video, {
      duration: { value: 120 }, videoWidth: { value: 1920 }, videoHeight: { value: 1080 },
      textTracks: { value: [{ kind: "captions", language: "en", label: "Live",
        cues: [{ startTime: 1, endTime: 2, text: "Welcome" }] }] },
    });
    const result = collectVideos(document.body);
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]).toMatchObject({ title: "Training", duration: 120, width: 1920,
      sources: [{ kind: "file", type: "video/mp4" }],
      captions: [{ cues: [{ start: 1, end: 2, text: "Welcome" }] }, { label: "English", cues: [] }] });
    expect(video.paused).toBe(true);
  });

  it("reports embedded players and streams without claiming a direct video download", () => {
    document.body.innerHTML = '<iframe src="https://www.youtube.com/embed/123" title="Demo"></iframe><video src="blob:https://site.test/123"></video><a href="javascript:alert(1)">bad</a>';
    const result = collectVideos(document.body);
    expect(result.videos.map((video) => video.sources[0]?.kind)).toEqual(["embed", "blob"]);
    expect(result.videos.every((video) => video.sources.every((source) => source.kind !== "file"))).toBe(true);
  });
});
