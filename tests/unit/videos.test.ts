import { describe, expect, it } from "vitest";
import { classifyVideoSource, collectVideos, videoMetadataForExport } from "../../src/media/videos";

describe("video discovery", () => {
  it("finds nested shadow videos and combines Reddit player metadata without duplicate entries", () => {
    document.body.innerHTML = '<shreddit-post content-type="video" content-href="https://v.redd.it/abc" post-title="A Reddit clip"><shreddit-player-2 src="https://v.redd.it/abc/DASHPlaylist.mpd"></shreddit-player-2></shreddit-post>';
    const player = document.querySelector("shreddit-player-2")!;
    player.setAttribute("packaged-media-json", JSON.stringify({ playbackMedia: { fallback_url: "https://v.redd.it/abc/DASH_720.mp4", audio: { url: "https://v.redd.it/abc/DASH_AUDIO_128.mp4" } } }));
    const shadow = player.attachShadow({ mode: "open" });
    shadow.innerHTML = '<video src="blob:https://reddit.com/test"><track src="https://v.redd.it/abc/captions.vtt" kind="captions"></video>';
    const result = collectVideos(document.body);
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]?.title).toBe("A Reddit clip");
    expect(result.videos[0]?.sources.map((source) => source.kind)).toEqual(["embed", "stream", "file", "blob"]);
    expect(result.videos[0]?.sources.find((source) => source.kind === "file")?.note).toContain("audio may be separate");
    expect(result.videos[0]?.captions[0]?.url).toBe("https://v.redd.it/abc/captions.vtt");
    expect(shadow.querySelector("video")?.paused).toBe(true);
  });

  it("detects a player with closed or unhydrated content through exposed attributes", () => {
    document.body.innerHTML = '<shreddit-player src="https://v.redd.it/closed/HLSPlaylist.m3u8" caption-url="https://v.redd.it/closed/en.vtt"></shreddit-player>';
    const player = document.querySelector("shreddit-player")!;
    player.attachShadow({ mode: "closed" }).innerHTML = '<video src="blob:https://reddit.com/closed"></video>';
    player.setAttribute("packaged-media-json", "malformed");
    const result = collectVideos(document.body);
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]?.sources[0]?.kind).toBe("stream");
    expect(result.videos[0]?.captions[0]?.url).toContain("en.vtt");
  });

  it("walks nested generic shadow roots and same-origin frame documents", () => {
    document.body.innerHTML = '<custom-card></custom-card><iframe></iframe>';
    const shadow = document.querySelector("custom-card")!.attachShadow({ mode: "open" });
    shadow.innerHTML = '<custom-player></custom-player>';
    shadow.querySelector("custom-player")!.attachShadow({ mode: "open" }).innerHTML = '<video src="https://cdn.test/shadow.mp4"></video>';
    document.querySelector("iframe")!.contentDocument!.body.innerHTML = '<video src="https://cdn.test/frame.webm"></video>';
    const urls = collectVideos(document.body).videos.flatMap((video) => video.sources.map((source) => source.url));
    expect(urls).toEqual(["https://cdn.test/shadow.mp4", "https://cdn.test/frame.webm"]);
  });

  it("finds extensionless Reddit and external-player links plus streaming links", () => {
    document.body.innerHTML = '<a href="https://v.redd.it/linked">Reddit clip</a><a href="https://youtu.be/abc">YouTube clip</a><a href="https://cdn.test/master.m3u8">Stream</a><a href="https://youtube.com/">Not a video</a>';
    expect(collectVideos(document.body).videos.map((video) => video.sources[0]?.kind)).toEqual(["embed", "embed", "stream"]);
  });

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
