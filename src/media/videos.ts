import { sanitizeCapturedUrl } from "../extraction/normalize";

export interface VideoSource {
  url: string;
  kind: "file" | "stream" | "blob" | "embed" | "unknown";
  type: string;
}
export interface VideoCaption {
  language: string;
  label: string;
  url?: string;
  cues: Array<{ start: number; end: number; text: string }>;
}
export interface VideoDetails {
  title: string;
  poster?: string;
  duration: number | null;
  width: number;
  height: number;
  sources: VideoSource[];
  captions: VideoCaption[];
}
export interface VideoInventory {
  pageUrl: string;
  videos: VideoDetails[];
  notes: string[];
}

export function videoMetadataForExport(inventory: VideoInventory): VideoInventory {
  return {
    ...inventory,
    pageUrl: sanitizeCapturedUrl(inventory.pageUrl),
    videos: inventory.videos.map((video) => ({
      ...video,
      ...(video.poster ? { poster: sanitizeCapturedUrl(video.poster) } : {}),
      sources: video.sources.map((source) => ({ ...source, url: sanitizeCapturedUrl(source.url) })),
      captions: video.captions.map((caption) => ({
        ...caption, ...(caption.url ? { url: sanitizeCapturedUrl(caption.url) } : {}),
      })),
    })),
  };
}

function httpUrl(raw: string | null, base: string): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw, base);
    return /^https?:$/.test(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

export function classifyVideoSource(url: string, type = ""): VideoSource["kind"] {
  if (url.startsWith("blob:")) return "blob";
  let path: string;
  try { path = new URL(url).pathname; } catch { return "unknown"; }
  if (/\.(m3u8|mpd)$/i.test(path) || /mpegurl|dash\+xml/i.test(type)) return "stream";
  if (/\.(mp4|webm|ogv|mov|m4v)$/i.test(path) || /^video\/(mp4|webm|ogg|quicktime)(;|$)/i.test(type)) return "file";
  return "unknown";
}

/** Read exposed media only; does not start playback or change caption settings. */
export function collectVideos(root: Element): VideoInventory {
  const base = root.ownerDocument.baseURI;
  const elements = [root, ...root.querySelectorAll("video, iframe, a[href]")];
  const videos: VideoDetails[] = [];
  const seen = new Set<string>();
  for (const element of elements) {
    if (element instanceof HTMLVideoElement) {
      const sources = new Map<string, VideoSource>();
      const add = (raw: string | null, type = "") => {
        const url = raw?.startsWith("blob:") ? raw : httpUrl(raw, base);
        if (url) sources.set(url, { url, type, kind: classifyVideoSource(url, type) });
      };
      add(element.getAttribute("src"));
      for (const source of element.querySelectorAll("source")) add(source.getAttribute("src"), source.type);
      if (element.currentSrc && !sources.has(element.currentSrc)) add(element.currentSrc);
      const captions: VideoCaption[] = [];
      const trackElements = [...element.querySelectorAll("track")];
      for (const track of Array.from(element.textTracks ?? [])) {
        if (!["subtitles", "captions"].includes(track.kind)) continue;
        const node = trackElements.find((candidate) => candidate.track === track);
        const url = httpUrl(node?.getAttribute("src") ?? null, base);
        captions.push({
          language: track.language, label: track.label,
          ...(url ? { url } : {}),
          cues: Array.from(track.cues ?? []).filter((cue) => "text" in cue).map((cue) => ({
            start: cue.startTime, end: cue.endTime, text: String((cue as VTTCue).text),
          })),
        });
      }
      for (const node of trackElements) {
        if (!["subtitles", "captions"].includes(node.getAttribute("kind") || "subtitles")) continue;
        const url = httpUrl(node.getAttribute("src"), base);
        if (url && !captions.some((track) => track.url === url)) {
          captions.push({ language: node.srclang, label: node.label, url, cues: [] });
        }
      }
      const poster = httpUrl(element.getAttribute("poster"), base);
      videos.push({
        title: element.getAttribute("aria-label") || element.title || "Page video",
        ...(poster ? { poster } : {}),
        duration: Number.isFinite(element.duration) ? element.duration : null,
        width: element.videoWidth, height: element.videoHeight,
        sources: [...sources.values()], captions,
      });
      for (const url of sources.keys()) seen.add(url);
    } else if (element instanceof HTMLIFrameElement) {
      const url = httpUrl(element.getAttribute("src"), base);
      if (!url || !/^(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)$/.test(new URL(url).hostname)) continue;
      videos.push({ title: element.title || "Embedded video", duration: null, width: 0, height: 0,
        sources: [{ url, kind: "embed", type: "" }], captions: [] });
    }
  }
  for (const element of elements) {
    if (!(element instanceof HTMLAnchorElement)) continue;
    const url = httpUrl(element.getAttribute("href"), base);
    if (!url || seen.has(url) || classifyVideoSource(url) !== "file") continue;
    seen.add(url);
    videos.push({ title: element.textContent?.trim() || "Linked video", duration: null, width: 0, height: 0,
      sources: [{ url, kind: "file", type: "" }], captions: [] });
  }
  return { pageUrl: root.ownerDocument.location.href, videos, notes: [
    "Scans this page's exposed video sources and caption tracks. Embedded players may need to be opened on their own page.",
    "Captions contain currently loaded cues only. Blob URLs and streaming playlists need a separate site-specific downloader.",
  ] };
}
