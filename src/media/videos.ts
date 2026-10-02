import { sanitizeCapturedUrl } from "../extraction/normalize";

export interface VideoSource {
  url: string;
  kind: "file" | "stream" | "blob" | "embed" | "unknown";
  type: string;
  note?: string;
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

function redditPlayer(element: Element): boolean {
  return /^shreddit-player(?:-|$)/.test(element.localName) || element.localName === "reddit-video";
}

function composedParent(element: Element): Element | null {
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  return "host" in root ? (root as ShadowRoot).host : null;
}

function redditPost(element: Element): Element | undefined {
  for (let parent: Element | null = element; parent; parent = composedParent(parent)) {
    if (parent.localName === "shreddit-post") return parent;
  }
  return undefined;
}

function embeddedVideoUrl(url: string): boolean {
  const { hostname, pathname, searchParams } = new URL(url);
  return hostname === "v.redd.it" || hostname === "youtu.be" ||
    (/^(www\.)?(youtube\.com|youtube-nocookie\.com)$/.test(hostname) &&
      (/^\/(embed|shorts)\//.test(pathname) || (pathname === "/watch" && searchParams.has("v")))) ||
    (/^(player\.)?vimeo\.com$/.test(hostname) && /^\/(video\/)?\d+/.test(pathname)) ||
    (hostname === "streamable.com" && /^\/(e\/)?[a-z0-9]+\/?$/i.test(pathname));
}

function mediaIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "v.redd.it" ? `${parsed.origin}/${parsed.pathname.split("/")[1]}` : url;
  } catch { return url; }
}

/** Read exposed DOM, open shadow roots and accessible frames; never starts playback. */
export function collectVideos(root: Element): VideoInventory {
  const elements: Element[] = [];
  const visited = new Set<Element>();
  const pending = [root];
  let inaccessibleFrames = false;
  while (pending.length) {
    const element = pending.pop()!;
    if (visited.has(element) || element.localName.startsWith("scrapeyy-")) continue;
    visited.add(element);
    elements.push(element);
    pending.push(...Array.from(element.children).reverse());
    if (element.shadowRoot) pending.push(...Array.from(element.shadowRoot.children).reverse());
    if (element.localName === "iframe") {
      try {
        const frameRoot = (element as HTMLIFrameElement).contentDocument?.documentElement;
        if (frameRoot) pending.push(frameRoot);
        else inaccessibleFrames = true;
      } catch { inaccessibleFrames = true; }
    }
  }
  const videos: VideoDetails[] = [];
  const owners = new Map<Element, VideoDetails>();
  const addVideo = (video: VideoDetails, owner?: Element) => {
    const identities = new Set(video.sources.map((source) => mediaIdentity(source.url)));
    const existing = (owner ? owners.get(owner) : undefined) || videos.find((item) => item.sources.some((source) => identities.has(mediaIdentity(source.url))));
    if (owner) owners.set(owner, existing || video);
    if (!existing) { videos.push(video); return; }
    if (["Page video", "Reddit video", "Embedded video", "Linked video"].includes(existing.title)) existing.title = video.title;
    for (const source of video.sources) if (!existing.sources.some((item) => item.url === source.url)) existing.sources.push(source);
    for (const caption of video.captions) if (!existing.captions.some((item) => caption.url ? item.url === caption.url : item.language === caption.language && item.label === caption.label)) existing.captions.push(caption);
    if (!existing.poster && video.poster) existing.poster = video.poster;
    existing.duration ??= video.duration;
    existing.width ||= video.width;
    existing.height ||= video.height;
  };
  const source = (raw: string | null, base: string, type = ""): VideoSource | undefined => {
    const url = raw?.startsWith("blob:") ? raw : httpUrl(raw, base);
    if (!url) return undefined;
    if (/^https?:\/\/v\.redd\.it\/[^/]+\/DASH_AUDIO[^/?]*\.mp4/i.test(url)) return undefined;
    const kind = classifyVideoSource(url, type);
    const videoOnly = /^https?:\/\/v\.redd\.it\/[^/]+\/DASH_[^/?]+\.mp4/i.test(url);
    return { url, type, kind: kind === "unknown" && embeddedVideoUrl(url) ? "embed" : kind,
      ...(videoOnly ? { note: "Reddit video track; audio may be separate." } : {}) };
  };
  for (const element of elements) {
    const base = element.ownerDocument.baseURI;
    if (element.localName === "video") {
      const video = element as HTMLVideoElement;
      const sources = new Map<string, VideoSource>();
      const add = (raw: string | null, type = "") => {
        const found = source(raw, base, type);
        if (found) sources.set(found.url, found);
      };
      add(element.getAttribute("src"));
      for (const source of element.querySelectorAll("source")) add(source.getAttribute("src"), source.type);
      if (video.currentSrc && !sources.has(video.currentSrc)) add(video.currentSrc);
      const post = redditPost(element);
      if (post) add(post.getAttribute("content-href"));
      const captions: VideoCaption[] = [];
      const trackElements = [...element.querySelectorAll("track")];
      for (const track of Array.from(video.textTracks ?? [])) {
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
      let owner = element;
      for (let parent = composedParent(element); parent; parent = composedParent(parent)) {
        if (redditPlayer(parent)) { owner = parent; break; }
      }
      addVideo({
        title: post?.getAttribute("post-title") || element.getAttribute("aria-label") || video.title || "Page video",
        ...(poster ? { poster } : {}),
        duration: Number.isFinite(video.duration) ? video.duration : null,
        width: video.videoWidth, height: video.videoHeight,
        sources: [...sources.values()], captions,
      }, owner);
    } else if (element.localName === "iframe") {
      const url = httpUrl(element.getAttribute("src"), base);
      if (!url || !embeddedVideoUrl(url)) continue;
      addVideo({ title: element.getAttribute("title") || "Embedded video", duration: null, width: 0, height: 0,
        sources: [{ url, kind: "embed", type: "" }], captions: [] });
    } else if (redditPlayer(element) || (element.localName === "shreddit-post" && element.getAttribute("content-type") === "video")) {
      const sources = new Map<string, VideoSource>();
      const add = (raw: string | null) => {
        const found = source(raw, base);
        if (found) sources.set(found.url, found);
      };
      for (const name of ["src", "content-href", "dash-url", "hls-url", "fallback-url"]) add(element.getAttribute(name));
      const post = redditPost(element);
      if (post) add(post.getAttribute("content-href"));
      // Reddit can expose playback URLs before its shadow player has hydrated.
      for (const name of ["packaged-media-json", "playback-media-json"]) {
        const raw = element.getAttribute(name);
        if (!raw || raw.length > 200_000) continue;
        try {
          const queue: Array<{ value: unknown; depth: number }> = [{ value: JSON.parse(raw), depth: 0 }];
          let inspected = 0;
          while (queue.length && inspected++ < 2000) {
            const { value, depth } = queue.pop()!;
            if (!value || typeof value !== "object" || depth > 8) continue;
            for (const [key, child] of Object.entries(value)) {
              if (typeof child === "string" && /^(url|src|fallback_?url|dash_?url|hls_?url|content_?url)$/i.test(key)) {
                const found = source(child, base);
                if (found && found.kind !== "unknown") sources.set(found.url, found);
              } else if (child && typeof child === "object") queue.push({ value: child, depth: depth + 1 });
            }
          }
        } catch { /* An unhydrated or malformed player must not abort the scan. */ }
      }
      const poster = httpUrl(element.getAttribute("poster"), base);
      const caption = httpUrl(element.getAttribute("caption-url"), base);
      addVideo({ title: post?.getAttribute("post-title") || element.getAttribute("video-title") || element.getAttribute("aria-label") || "Reddit video",
        duration: null, width: 0, height: 0, ...(poster ? { poster } : {}),
        sources: [...sources.values()], captions: caption ? [{ label: "Captions", language: "", url: caption, cues: [] }] : [] }, element);
    }
  }
  for (const element of elements) {
    if (element.localName !== "a") continue;
    const found = source(element.getAttribute("href"), element.ownerDocument.baseURI);
    if (!found || !["file", "stream", "embed"].includes(found.kind)) continue;
    addVideo({ title: element.textContent?.trim() || "Linked video", duration: null, width: 0, height: 0,
      sources: [found], captions: [] });
  }
  return { pageUrl: root.ownerDocument.location.href, videos, notes: [
    "Scans loaded page content, open shadow players, accessible frames, and exposed Reddit player metadata.",
    ...(inaccessibleFrames ? ["Some frames are inaccessible from this page. Open an embedded player on its own page to scan it."] : []),
    ...(!videos.length ? ["No video is exposed yet. Scroll the video into view or start playback, then scan again."] : []),
    "Captions contain currently loaded cues only. Blob URLs and streaming playlists need a separate site-specific downloader.",
  ] };
}
