import type { AssetReference } from "../design/assets";
import type { DownloadedAsset } from "../export/bundle";
import { downloadReferencedAssets } from "../platform/asset-download";
import type { CaptureDatabase } from "./capture-database";

type AssetFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export async function captureReferenceAssets(
  runId: string,
  references: AssetReference[],
  database: CaptureDatabase,
  fetchAsset?: AssetFetch,
): Promise<string[]> {
  const result = fetchAsset
    ? await downloadReferencedAssets(references, fetchAsset)
    : await downloadReferencedAssets(references);
  await storeReferenceAssets(runId, result.assets, database);
  return result.warnings;
}

export async function storeReferenceAssets(
  runId: string,
  assets: DownloadedAsset[],
  database: CaptureDatabase,
): Promise<void> {
  await Promise.all(
    assets.map((asset) =>
      database.putArtifact({
        id: `${runId}:asset:${asset.filename}`,
        runId,
        name: `assets/${asset.filename}`,
        sourceUrl: asset.url,
        blob: asset.blob,
      }),
    ),
  );
}

export async function loadReferenceAssets(
  runId: string,
  database: CaptureDatabase,
): Promise<DownloadedAsset[]> {
  return (await database.listArtifacts(runId))
    .filter(
      (artifact) =>
        artifact.name.startsWith("assets/") &&
        typeof artifact.sourceUrl === "string",
    )
    .map((artifact) => ({
      url: artifact.sourceUrl!,
      filename: artifact.name.slice("assets/".length),
      blob: artifact.blob,
    }))
    .sort((left, right) => left.filename.localeCompare(right.filename));
}
