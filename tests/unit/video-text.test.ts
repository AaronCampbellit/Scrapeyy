// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { captionPlainText, captionTextKey, createVideoTextExport, formatCaptionText, parseCaptionText, videoTextKey } from "../../src/media/video-text";
import type { VideoCaption, VideoInventory } from "../../src/media/videos";

const vtt = `WEBVTT\n\nNOTE a comment\nnot a cue\n\none\n00:00:00.250 --> 00:00:02.000 align:start\n<v Elise>Hello &amp; welcome.</v>\n\n00:02.000 --> 00:04.125\n<b>Second</b> line.\n`;
const fixture = (fields: Partial<VideoCaption> = {}) => {
  const caption: VideoCaption = { language: "eng", label: "English", cues: [], url: "https://fast.wistia.net/embed/captions/i0vm82gvvs.vtt?language=eng", ...fields };
  const inventory: VideoInventory = { pageUrl: "https://site.test/webinar?token=secret", notes: [], videos: [{ title: "Webinar", duration: 4, width: 0, height: 0,
    sources: [{ url: "https://fast.wistia.net/embed/iframe/i0vm82gvvs", kind: "embed", type: "" }], captions: [caption] }] };
  return { inventory, request: { videoKey: videoTextKey(inventory.videos[0]!), captionKey: captionTextKey(caption), format: "txt" as const } };
};

describe("captions and transcript exports", () => {
  it("parses VTT timing/settings and speaker markup while skipping comments", () => {
    expect(parseCaptionText(vtt)).toEqual([
      { start: 0.25, end: 2, text: "Elise: Hello & welcome." }, { start: 2, end: 4.125, text: "Second line." },
    ]);
  });

  it("converts between VTT and SRT without losing timings", () => {
    const cues = parseCaptionText(vtt);
    const srt = formatCaptionText(cues, "srt");
    expect(srt).toContain("1\n00:00:00,250 --> 00:00:02,000\nElise: Hello &amp; welcome.");
    expect(parseCaptionText(srt)).toEqual(cues);
    expect(parseCaptionText(formatCaptionText(cues, "vtt"))).toEqual(cues);
  });

  it("rejects invalid intervals/empty cues and rounds across minute/hour boundaries", () => {
    const cues = parseCaptionText("WEBVTT\n\n00:00:02.000 --> 00:00:01.000\nBackwards\n\n00:61:00.000 --> 00:62:00.000\nInvalid\n\n00:00:00.000 --> 00:00:02.000\n<b></b>");
    expect(cues).toEqual([]);
    expect(() => formatCaptionText(cues, "vtt")).toThrow("No timed captions");
    expect(formatCaptionText([{ start: 3599.9996, end: 3602, text: "New hour" }], "srt")).toContain("01:00:00,000 --> 01:00:02,000");
  });

  it("decodes numeric entities and removes caption markup as text", () => {
    expect(captionPlainText('<c.yellow>A&#39;s</c><br>B&nbsp;&amp; &#x1F600;')).toBe("A's\nB & 😀");
  });

  it("exports a complete provider transcript without fetching subtitles or video", async () => {
    const { inventory, request } = fixture({ text: "First paragraph.\n\nSecond paragraph." });
    const fetcher = vi.fn<typeof fetch>();
    const result = await createVideoTextExport(inventory, request, fetcher);
    expect(result.filename).toBe("Webinar-eng.txt");
    const text = await result.blob.text();
    expect(text).toContain("First paragraph.\n\nSecond paragraph.");
    expect(text).not.toContain("secret");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fetches only the selected caption file for timed exports", async () => {
    const { inventory, request } = fixture({ text: "Full transcript." });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(vtt));
    const result = await createVideoTextExport(inventory, { ...request, format: "srt" }, fetcher);
    expect(result.filename).toBe("Webinar-eng.srt");
    expect(await result.blob.text()).toContain("00:00:00,250 --> 00:00:02,000");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(inventory.videos[0]!.captions[0]!.url, expect.objectContaining({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" }));
  });

  it("derives a transcript from a complete SRT/VTT track instead of partial loaded cues", async () => {
    const { inventory, request } = fixture({ partial: true, cues: [{ start: 0, end: 1, text: "Old loaded fragment" }] });
    const result = await createVideoTextExport(inventory, request, vi.fn<typeof fetch>().mockResolvedValue(new Response(vtt)));
    expect(await result.blob.text()).toContain("Elise: Hello & welcome.\nSecond line.");
    expect(await result.blob.text()).not.toContain("Old loaded fragment");
  });

  it("clearly labels exports that have only loaded browser cues", async () => {
    const { inventory, request } = fixture({ url: "", partial: true, cues: [{ start: 0, end: 1, text: "Loaded fragment" }] });
    const fetcher = vi.fn<typeof fetch>();
    const result = await createVideoTextExport(inventory, request, fetcher);
    expect(result.filename).toBe("Webinar-eng-loaded.txt");
    expect(await result.blob.text()).toContain("transcript may be incomplete");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not invent subtitle timings for a transcript-only track", async () => {
    const { inventory, request } = fixture({ url: "", text: "Transcript without timings" });
    await expect(createVideoTextExport(inventory, { ...request, format: "vtt" })).rejects.toThrow("No timed captions");
  });

  it("rejects stale/forged selections before making any external request", async () => {
    const { inventory, request } = fixture();
    const fetcher = vi.fn<typeof fetch>();
    await expect(createVideoTextExport(inventory, { ...request, captionKey: "https://evil.test/track.vtt" }, fetcher)).rejects.toThrow("no longer on the page");
    await expect(createVideoTextExport({ ...inventory, videos: [] }, request, fetcher)).rejects.toThrow("no longer on the page");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("bounds caption size and rejects HTML/error responses instead of exporting empty text", async () => {
    const { inventory, request } = fixture();
    for (const response of [new Response("x".repeat(2_000_001)), new Response("<html>Access denied</html>"), new Response("Forbidden", { status: 403 })]) {
      await expect(createVideoTextExport(inventory, request, vi.fn<typeof fetch>().mockResolvedValue(response))).rejects.toThrow(/size limit|readable|HTTP 403/);
    }
  });
});

it("upgrades HTTP captions and preserves loaded cues when HTTPS is unavailable", async () => {
  const { inventory, request } = fixture({ url: "http://site.test/captions.vtt", cues: [{start: 0, end: 1, text: "Already loaded"}] });
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("HTTPS unavailable"));
  const result = await createVideoTextExport(inventory, request, fetcher);
  expect(fetcher).toHaveBeenCalledWith("https://site.test/captions.vtt", expect.objectContaining({ credentials: "omit", redirect: "error" }));
  expect(await result.blob.text()).toContain("Already loaded");
  expect(result.filename).toContain("-loaded");
  expect(await result.blob.text()).toContain("may be incomplete");
});
