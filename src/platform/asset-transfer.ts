/** Serializable result shared by extension and injected page asset acquisition. */
export interface AssetPayload {
  assets: Array<{ url: string; mimeType: string; base64: string; rendered?: boolean }>;
  warnings: string[];
}

/**
 * Keep this function self-contained: scripting.executeScript serializes its body.
 * It never fetches HTTP. HTTP references can be upgraded or recovered from pixels
 * already decoded by the page, without assigning an image src or reloading it.
 */
export async function fetchReferenceAssets(
  references: Array<{ url: string; kind: "image" | "font" }>,
  maxAssetBytes: number,
  fetchAsset: typeof fetch = fetch,
  pageDocument: Document | undefined = typeof document === "undefined" ? undefined : document,
): Promise<AssetPayload> {
  const assets: AssetPayload["assets"] = [];
  const warnings: string[] = [];
  const deadline = Date.now() + 60_000;
  let totalBytes = 0;
  const maxTotalBytes = 50 * 1024 * 1024;
  const encode = (bytes: Uint8Array) => {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
  };
  const loadedImage = (url: string): string | undefined => {
    if (!pageDocument) return;
    const image = Array.from(pageDocument.images).find(image =>
      (image.currentSrc || image.src) === url && image.complete && image.naturalWidth > 0);
    if (!image || image.naturalWidth * image.naturalHeight > 16_000_000) return;
    try {
      const canvas = pageDocument.createElement("canvas");
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(image, 0, 0);
      // Cross-origin/tainted images throw; never reload them with different flags.
      return canvas.toDataURL("image/png").split(",")[1];
    } catch { return; }
  };
  for (const [index, reference] of references.entries()) {
    if (index >= 100 || Date.now() > deadline || totalBytes >= maxTotalBytes) {
      warnings.push("Remaining assets were omitted after the capture size/time limit; references and page content are retained.");
      break;
    }
    let original: URL;
    try {
      original = new URL(reference.url);
      if (!/^https?:$/.test(original.protocol) || original.username || original.password) throw new Error();
    } catch {
      warnings.push(`Asset ${index + 1}: unsupported URL or embedded credentials; reference retained.`);
      continue;
    }
    const requestUrl = new URL(original.href);
    requestUrl.hash = "";
    const upgraded = requestUrl.protocol === "http:";
    if (upgraded) requestUrl.protocol = "https:";
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(15_000, Math.max(1, deadline - Date.now())));
    try {
      const response = await fetchAsset(requestUrl.href, {
        credentials: upgraded ? "omit" : "include", referrerPolicy: "no-referrer",
        redirect: "error", cache: "no-store", signal: controller.signal,
      });
      if (!response.ok || response.redirected || (response.url && new URL(response.url).protocol !== "https:")) throw new Error("unavailable or redirected");
      const mimeType = (response.headers.get("content-type") ?? "").split(";")[0]!.trim();
      if (reference.kind === "image" && mimeType && !mimeType.startsWith("image/")) throw new Error("not an image");
      const limit = Math.min(maxAssetBytes, maxTotalBytes - totalBytes);
      if (Number(response.headers.get("content-length")) > limit || !response.body) throw new Error("size limit");
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > limit) throw new Error("size limit");
          chunks.push(part.value);
        }
      } finally { await reader.cancel().catch(() => {}); }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      totalBytes += size;
      assets.push({ url: reference.url, mimeType, base64: encode(bytes) });
      if (upgraded) warnings.push(`Asset ${index + 1}: downloaded over HTTPS; original HTTP reference retained.`);
    } catch {
      const rendered = upgraded && reference.kind === "image" ? loadedImage(original.href) : undefined;
      const size = rendered ? Math.floor(rendered.length * 3 / 4) : 0;
      if (rendered && size <= maxAssetBytes && totalBytes + size <= maxTotalBytes) {
        assets.push({ url: reference.url, mimeType: "image/png", base64: rendered, rendered: true });
        totalBytes += size;
        warnings.push(`Asset ${index + 1}: saved already-loaded pixels as PNG, not the original file; animation/vector data is not retained.`);
      } else {
        // Avoid echoing signed URLs or remote error bodies into stored warnings.
        warnings.push(`Asset ${index + 1} (${original.origin}): original unavailable over HTTPS or exceeds capture limits; reference retained. HTTP-page text, structure and screenshots remain available.`);
      }
    } finally { clearTimeout(timer); }
  }
  return { assets, warnings };
}
