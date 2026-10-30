import { fetchReferenceAssets } from "./asset-transfer";
import type { AssetReference } from "../design/assets";
import type { DownloadedAsset } from "../export/bundle";
import {
  assetFilename,
  MAX_ASSET_BYTES,
  type AssetDownloadResult,
} from "./asset-download";
import { extensionBrowser } from "./browser-api";

interface PageAssetPayload {
  assets: Array<{
    url: string;
    mimeType: string;
    base64: string;
    rendered?: boolean;
  }>;
  warnings: string[];
}

interface PageAssetRequest {
  url: string;
  kind: AssetReference["kind"];
}

interface PageAssetScriptingApi {
  executeScript(details: {
    target: { tabId: number };
    world: "ISOLATED";
    func: (
      references: PageAssetRequest[],
      maxAssetBytes: number,
    ) => Promise<PageAssetPayload>;
    args: [PageAssetRequest[], number];
  }): Promise<Array<{ result?: PageAssetPayload }>>;
}

const defaultApi: PageAssetScriptingApi = {
  executeScript: (details) =>
    extensionBrowser.scripting.executeScript(
      details as Parameters<
        typeof extensionBrowser.scripting.executeScript
      >[0],
    ) as Promise<Array<{ result?: PageAssetPayload }>>,
};

function decodeBase64(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = Uint8Array.from(
    binary,
    (character) => character.charCodeAt(0),
  );
  return bytes.buffer as ArrayBuffer;
}

export async function downloadReferencedAssetsFromPage(
  tabId: number,
  references: AssetReference[],
  api: PageAssetScriptingApi = defaultApi,
): Promise<AssetDownloadResult> {
  const unique = [
    ...new Map(references.map((reference) => [reference.url, reference])).values(),
  ].sort((left, right) => left.url.localeCompare(right.url));
  if (unique.length === 0) return { assets: [], warnings: [] };

  const [{ result } = {}] = await api.executeScript({
    target: { tabId },
    world: "ISOLATED",
    func: fetchReferenceAssets,
    args: [unique, MAX_ASSET_BYTES],
  });
  if (!result) {
    return {
      assets: [],
      warnings: ["Could not download reference assets from the page."],
    };
  }
  const referencesByUrl = new Map(unique.map((reference) => [
    reference.url,
    reference,
  ]));
  const assets: DownloadedAsset[] = [];
  const warnings = [...result.warnings];
  for (const { url, mimeType, base64, rendered } of result.assets) {
    if (
      referencesByUrl.get(url)?.kind === "image" &&
      mimeType &&
      !mimeType.startsWith("image/")
    ) {
      warnings.push(
        `Could not download reference asset ${url}: unexpected content type ${mimeType}`,
      );
      continue;
    }
    assets.push({
      url,
      filename: rendered
        ? `${String(assets.length + 1).padStart(3, "0")}-loaded-image.png`
        : assetFilename(url, mimeType, assets.length + 1),
      blob: new Blob([decodeBase64(base64)], { type: mimeType }),
    });
  }
  return { assets, warnings };
}
