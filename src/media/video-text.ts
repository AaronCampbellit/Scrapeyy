import { safePathSegment } from "../export/filename";
import { sanitizeCapturedUrl } from "../extraction/normalize";
import type { VideoCaption, VideoDetails, VideoInventory } from "./videos";

export type VideoTextFormat = "txt" | "vtt" | "srt";
export interface VideoTextRequest {
  videoKey: string;
  captionKey: string;
  format: VideoTextFormat;
}
type Cue = VideoCaption["cues"][number];
const MAX_TEXT_BYTES = 2_000_000;

export function videoTextKey(video: VideoDetails): string {
  return JSON.stringify([video.title, video.sources.find((source) => source.kind === "embed")?.url ?? video.sources[0]?.url ?? ""]);
}

export function captionTextKey(caption: VideoCaption): string {
  return JSON.stringify([caption.language, caption.url ?? caption.label]);
}

/** Caption markup is text, never executable HTML. Preserve line breaks and speaker names. */
export function captionPlainText(raw: string): string {
  return raw.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<v\s+([^>]+)>/g, "$1: ")
    .replace(/<[^>]*>/g, "").replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name: string) => {
      if (name.startsWith("#")) {
        const value = name[1]?.toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : entity;
      }
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " } as Record<string, string>)[name.toLowerCase()] ?? entity;
    }).replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").trim();
}

function seconds(raw: string): number | undefined {
  const match = raw.match(/^(?:(\d+):)?(\d{2}):(\d{2})[.,](\d{3})$/);
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) return undefined;
  return Number(match[1] ?? 0) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
}

/** Read WebVTT/SRT cues, skipping WebVTT headers, settings and non-caption blocks. */
export function parseCaptionText(raw: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split(/\n[\t ]*\n/)) {
    const lines = block.trim().split("\n");
    if (/^(WEBVTT|NOTE(?:\s|$)|STYLE$|REGION$)/.test(lines[0] ?? "")) continue;
    const index = lines.findIndex((line) => line.includes("-->"));
    if (index < 0 || index > 1) continue;
    const timing = lines[index]!.match(/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);
    if (!timing) continue;
    const start = seconds(timing[1]!), end = seconds(timing[2]!);
    const text = captionPlainText(lines.slice(index + 1).join("\n"));
    if (start !== undefined && end !== undefined && end > start && text) cues.push({ start, end, text });
    if (cues.length >= 50_000) throw new Error("This caption file contains too many entries.");
  }
  return cues;
}

function validCues(cues: Cue[]): Cue[] {
  return cues.filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.start >= 0 && cue.end > cue.start)
    .map((cue) => ({ ...cue, text: captionPlainText(cue.text) })).filter((cue) => cue.text);
}

function timestamp(value: number, separator: string): string {
  const ms = Math.round(value * 1000);
  return `${String(Math.floor(ms / 3_600_000)).padStart(2, "0")}:${String(Math.floor(ms / 60_000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}${separator}${String(ms % 1000).padStart(3, "0")}`;
}

export function formatCaptionText(cues: Cue[], format: "vtt" | "srt"): string {
  const entries = validCues(cues).map((cue, index) => {
    // Escape literal angle brackets/ampersands so players cannot interpret subtitle markup.
    const text = cue.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/-->/g, "--&gt;");
    const separator = format === "vtt" ? "." : ",";
    return `${format === "srt" ? `${index + 1}\n` : ""}${timestamp(cue.start, separator)} --> ${timestamp(cue.end, separator)}\n${text}`;
  });
  if (!entries.length) throw new Error("No timed captions are available for this track. Download its transcript instead.");
  return `${format === "vtt" ? "WEBVTT\n\n" : ""}${entries.join("\n\n")}\n`;
}

async function fetchCaptions(url: string, fetcher: typeof fetch): Promise<Cue[]> {
  const parsed = new URL(url);
  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) throw new Error("This caption URL is unsupported.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(parsed.href, { credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`Captions are unavailable (HTTP ${response.status}).`);
    if (Number(response.headers.get("content-length")) > MAX_TEXT_BYTES || !response.body) throw new Error("Caption file exceeded the size limit.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "", bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_TEXT_BYTES) throw new Error("Caption file exceeded the size limit.");
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    const cues = parseCaptionText(text);
    if (!cues.length) throw new Error("This track did not return readable VTT or SRT captions.");
    return cues;
  } catch (error) {
    if (error instanceof Error && /^(Captions|Caption file|This track|This caption)/.test(error.message)) throw error;
    throw new Error("Caption text could not be loaded. The site may restrict access; try opening the player on its own page.");
  } finally { clearTimeout(timer); }
}

/** Only export a track re-discovered on the current page; never accept an arbitrary fetch URL. */
export async function createVideoTextExport(inventory: VideoInventory, request: VideoTextRequest, fetcher: typeof fetch = fetch): Promise<{ blob: Blob; filename: string }> {
  if (!["txt", "vtt", "srt"].includes(request.format)) throw new Error("Choose TXT, VTT or SRT for the text export.");
  const video = inventory.videos.find((item) => videoTextKey(item) === request.videoKey);
  const caption = video?.captions.find((item) => captionTextKey(item) === request.captionKey);
  if (!video || !caption) throw new Error("This video or caption track is no longer on the page. Scan videos again.");
  let cues = validCues(caption.cues);
  // Wistia exposes a complete transcript in metadata, so TXT needs no subtitle/video transfer.
  const transcript = caption.text ? captionPlainText(caption.text) : "";
  let usedLoadedFallback = false;
  if (caption.url && (request.format !== "txt" || !transcript)) {
    try { cues = await fetchCaptions(caption.url, fetcher); }
    catch (error) {
      if (!cues.length) throw error;
      usedLoadedFallback = true;
    }
  }
  const body = request.format === "txt" ? transcript || cues.map((cue) => cue.text).filter((text, index, all) => !index || text !== all[index - 1]).join("\n") : formatCaptionText(cues, request.format);
  if (!body.trim()) throw new Error("No caption or transcript text is available for this track.");
  const partial = usedLoadedFallback || (caption.partial && !caption.url && !transcript);
  const content = request.format === "txt" ? `${video.title}\n${caption.label || caption.language || "Transcript"}\nSource: ${sanitizeCapturedUrl(inventory.pageUrl)}\n${partial ? "Loaded captions only; the transcript may be incomplete.\n" : ""}\n${body}\n` : body;
  const filename = `${safePathSegment(video.title).slice(0, 60)}-${safePathSegment(caption.language || "und").slice(0, 24)}${partial ? "-loaded" : ""}.${request.format}`;
  return { blob: new Blob([content], { type: request.format === "vtt" ? "text/vtt;charset=utf-8" : "text/plain;charset=utf-8" }), filename };
}
