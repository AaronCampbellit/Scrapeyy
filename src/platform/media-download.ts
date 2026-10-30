import { downloadBundle } from "./downloads";

/** Retrieve the file before creating a local download, so redirects cannot send
 * account credentials to an HTTP endpoint. Browser-managed remote downloads do
 * not expose a redirect policy. Large files can still be opened on their site. */
export async function downloadMediaFile(
  sourceUrl: string,
  filename: string,
  saveAs: boolean,
  fetcher: typeof fetch = fetch,
  save: typeof downloadBundle = downloadBundle,
): Promise<number> {
  const url = new URL(sourceUrl);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Unsupported video URL.");
  const upgraded = url.protocol === "http:";
  if (upgraded) url.protocol = "https:";
  url.hash = "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  const limit = 512 * 1024 * 1024;
  try {
    const response = await fetcher(url.href, {
      credentials: upgraded ? "omit" : "include", redirect: "error",
      referrerPolicy: "no-referrer", cache: "no-store", signal: controller.signal,
    });
    if (!response.ok || !response.body || response.redirected ||
        (response.url && new URL(response.url).protocol !== "https:")) throw new Error();
    if (Number(response.headers.get("content-length")) > limit) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let bytes = 0;
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > limit) throw new Error();
        chunks.push(new Uint8Array(part.value));
      }
    } finally { await reader.cancel().catch(() => {}); }
    const blob = new Blob(chunks, { type: response.headers.get("content-type") || "application/octet-stream" });
    return await save(blob, filename, saveAs);
  } catch {
    throw new Error("Video could not be saved directly over HTTPS (access, redirect, 512 MiB size or two-minute limit). Its link remains in the media details; use the site's download controls for this file.");
  } finally { clearTimeout(timer); }
}
