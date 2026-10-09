import type { VideoDetails, VideoInventory, VideoSource } from "./videos";
import { safePathSegment } from "../export/filename";

const MEDIA_ID = /^[a-z0-9]{10}$/i;
const MAX_METADATA_BYTES = 1_000_000;

/** Accept only Wistia embed/share URLs, never a lookalike host. */
export function wistiaMediaId(raw: string): string | undefined {
  try {
    const url = new URL(raw);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password ||
        !/^(?:[a-z0-9-]+\.)?wistia\.(?:com|net)$/i.test(url.hostname)) return undefined;
    const match = url.pathname.match(/^\/(?:embed\/(?:iframe\/|medias\/)?|medias\/)([a-z0-9]{10})(?:\.(?:json|jsonp|js|m3u8))?\/?$/i);
    return match?.[1]?.toLowerCase();
  } catch { return undefined; }
}

export function wistiaEmbedUrl(id: string): string {
  return `https://fast.wistia.net/embed/iframe/${id}`;
}

export function wistiaElementId(element: Element): string | undefined {
  const mediaId = element.localName === "wistia-player" ? element.getAttribute("media-id") : null;
  if (mediaId && MEDIA_ID.test(mediaId)) return mediaId.toLowerCase();
  const classId = element.getAttribute("class")?.match(/(?:^|\s)wistia_async_([a-z0-9]{10})(?=\s|$)/i)?.[1];
  if (classId) return classId.toLowerCase();
  if (["iframe", "script"].includes(element.localName)) {
    const src = element.getAttribute("src");
    if (src) {
      try { return wistiaMediaId(new URL(src, element.ownerDocument.baseURI).href); } catch { /* Ignore malformed embeds. */ }
    }
  }
  return undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function deliveryUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !/^(?:embed(?:-ssl|-fastly|-cloudfront)?|fast)\.wistia\.(?:com|net)$/.test(url.hostname) ||
        !url.pathname.startsWith("/deliveries/")) return undefined;
    return url.href;
  } catch { return undefined; }
}

/** Parse public playback assets; originals, images, audio-only tracks and streams are not downloads. */
export function parseWistiaMedia(payload: unknown, expectedId: string): VideoDetails {
  const media = record(record(payload)?.media);
  if (!media || media.hashedId !== expectedId || media.mediaType !== "Video") {
    throw new Error("Wistia returned unexpected video details.");
  }
  if (media.protected === true || media.protected === "true") {
    throw new Error("This Wistia video requires access through its player.");
  }
  const title = typeof media.name === "string" && media.name.trim() ? media.name.trim().slice(0, 200) : "Wistia video";
  const sources: VideoSource[] = [];
  let poster: string | undefined;
  for (const value of Array.isArray(media.assets) ? media.assets.slice(0, 100) : []) {
    const asset = record(value);
    if (!asset) continue;
    const url = deliveryUrl(asset.url);
    if (!url) continue;
    if (asset.type === "still_image") { poster ??= url; continue; }
    if (typeof asset.type !== "string" || !/_video$/.test(asset.type) ||
        !(asset.container === "mp4" || asset.contentType === "video/mp4") ||
        !number(asset.width) || !number(asset.height) || sources.some((source) => source.url === url)) continue;
    const width = number(asset.width), height = number(asset.height), size = number(asset.size);
    sources.push({ url, kind: "file", type: "video/mp4", width, height, size,
      filename: `${safePathSegment(title).slice(0, 60)}-${height}p.mp4`,
      note: `Wistia MP4 · ${height}p${size ? ` · ${(size / 1_000_000).toFixed(1)} MB` : ""}` });
  }
  sources.sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.width ?? 0) - (a.width ?? 0));
  if (!sources.length) throw new Error("This Wistia player exposes no downloadable MP4 files.");
  return { title, duration: number(media.duration) || null, width: sources[0]!.width ?? 0,
    height: sources[0]!.height ?? 0, ...(poster ? { poster } : {}), sources, captions: [] };
}

async function fetchMedia(id: string, fetcher: typeof fetch): Promise<VideoDetails> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(`https://fast.wistia.net/embed/medias/${id}.json`, {
      credentials: "omit", referrerPolicy: "no-referrer", redirect: "error", cache: "no-store", signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Wistia video details are unavailable (HTTP ${response.status}).`);
    if (Number(response.headers.get("content-length")) > MAX_METADATA_BYTES || !response.body) {
      throw new Error("Wistia returned unsupported video details.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = "", bytes = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_METADATA_BYTES) throw new Error("Wistia video details exceeded the size limit.");
        text += decoder.decode(chunk.value, { stream: true });
      }
      text += decoder.decode();
    } finally { await reader.cancel().catch(() => {}); }
    return parseWistiaMedia(JSON.parse(text), id);
  } finally { clearTimeout(timer); }
}

/** Enrich an explicit video scan using public, CORS-enabled player metadata. */
export async function resolveWistiaVideos(inventory: VideoInventory, fetcher: typeof fetch = fetch): Promise<VideoInventory> {
  const ids = [...new Set(inventory.videos.flatMap((video) => video.sources.map((source) => wistiaMediaId(source.url)).filter((id): id is string => !!id)))];
  const resolved = new Map<string, VideoDetails>();
  const notes = [...inventory.notes];
  // Bound external work and keep failed embeds visible without failing other videos.
  for (let offset = 0; offset < Math.min(ids.length, 20); offset += 4) {
    await Promise.all(ids.slice(offset, Math.min(offset + 4, 20)).map(async (id) => {
      try { resolved.set(id, await fetchMedia(id, fetcher)); }
      catch (error) {
        const reason = error instanceof Error && /^(Wistia|This Wistia)/.test(error.message)
          ? error.message : "Wistia video details could not be loaded. Try scanning again.";
        notes.push(reason);
      }
    }));
  }
  if (ids.length > 20) notes.push("Only the first 20 Wistia videos were resolved on this scan.");
  return { ...inventory, notes: [...new Set(notes)], videos: inventory.videos.map((video) => {
    const id = video.sources.map((source) => wistiaMediaId(source.url)).find((id) => id && resolved.has(id));
    const media = id ? resolved.get(id) : undefined;
    if (!media) return video;
    return { ...video, ...media, captions: video.captions,
      sources: [...media.sources, ...video.sources.filter((source) => !media.sources.some((asset) => asset.url === source.url))] };
  }) };
}
