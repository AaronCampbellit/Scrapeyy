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
    world: "MAIN";
    func: (
      references: PageAssetRequest[],
      maxAssetBytes: number,
    ) => Promise<PageAssetPayload>;
    args: [PageAssetRequest[], number];
  }): Promise<Array<{ result?: PageAssetPayload }>>;
}

async function fetchAssetsInPage(
  references: PageAssetRequest[],
  maxAssetBytes: number,
): Promise<PageAssetPayload> {
  const assets: PageAssetPayload["assets"] = [];
  const warnings: string[] = [];
  for (const reference of references) {
    const { url } = reference;
    try {
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (
        reference.kind === "image" &&
        blob.type &&
        !blob.type.startsWith("image/")
      ) {
        throw new Error(`unexpected content type ${blob.type}`);
      }
      if (blob.size > maxAssetBytes) throw new Error("file exceeds 25 MB");
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener(
          "load",
          () => {
            const result = String(reader.result ?? "");
            resolve(result.slice(result.indexOf(",") + 1));
          },
          { once: true },
        );
        reader.addEventListener(
          "error",
          () => reject(reader.error ?? new Error("could not read asset")),
          { once: true },
        );
        reader.readAsDataURL(blob);
      });
      assets.push({
        url,
        mimeType: blob.type,
        base64,
      });
    } catch (error) {
      warnings.push(
        `Could not download reference asset ${url}: ${
          error instanceof Error ? error.message : "download failed"
        }`,
      );
    }
  }
  return { assets, warnings };
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
    world: "MAIN",
    func: fetchAssetsInPage,
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
  for (const { url, mimeType, base64 } of result.assets) {
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
      filename: assetFilename(url, mimeType, assets.length + 1),
      blob: new Blob([decodeBase64(base64)], { type: mimeType }),
    });
  }
  return { assets, warnings };
}
