import { fetchReferenceAssets } from "./asset-transfer";
import type { AssetReference } from "../design/assets";
import type { DownloadedAsset } from "../export/bundle";

type AssetFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface AssetDownloadResult {
  assets: DownloadedAsset[];
  warnings: string[];
}

export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

const contentTypeExtensions: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "font/otf": "otf",
  "font/ttf": "ttf",
  "font/woff": "woff",
  "font/woff2": "woff2",
};

export function assetFilename(
  url: string,
  contentType: string,
  index: number,
): string {
  const pathname = new URL(url).pathname;
  const rawName = decodeURIComponent(pathname.split("/").pop() || "asset");
  const extensionMatch = rawName.match(/\.([a-z0-9]{1,10})$/i);
  const extension =
    extensionMatch?.[1]?.toLowerCase() ??
    contentTypeExtensions[contentType.toLowerCase()] ??
    "bin";
  const rawStem = extensionMatch
    ? rawName.slice(0, -extensionMatch[0].length)
    : rawName;
  const stem =
    rawStem
      .normalize("NFKD")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "asset";
  return `${String(index).padStart(3, "0")}-${stem}.${extension}`;
}

export async function downloadReferencedAssets(
  references: AssetReference[],
  fetchAsset: AssetFetch = fetch,
): Promise<AssetDownloadResult> {
  const unique = [...new Map(references.map(reference => [reference.url, reference])).values()]
    .sort((left, right) => left.url.localeCompare(right.url));
  const result = await fetchReferenceAssets(unique, MAX_ASSET_BYTES, fetchAsset as typeof fetch, undefined);
  return {
    assets: result.assets.map((asset, index) => ({
      url: asset.url,
      filename: asset.rendered ? `${String(index + 1).padStart(3, "0")}-loaded-image.png` : assetFilename(asset.url, asset.mimeType, index + 1),
      blob: new Blob([Uint8Array.from(atob(asset.base64), char => char.charCodeAt(0))], { type: asset.mimeType }),
    })),
    warnings: result.warnings,
  };
}
