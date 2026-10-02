import JSZip from "jszip";

import type {
  CaptureRun,
  Project,
  Recipe,
} from "../contracts/models";
import type { DesignSnapshot } from "../design/snapshot";
import type { AssetReference } from "../design/assets";
import { videoMetadataForExport, type VideoInventory } from "../media/videos";
import { serializeCsv } from "./csv";
import { buildRunManifest, stableJson } from "./manifest";

export interface DownloadedAsset {
  url: string;
  filename: string;
  blob: Blob;
}

export interface RunBundleInput {
  project: Project;
  recipe: Recipe;
  run: CaptureRun;
  design?: DesignSnapshot;
  assets?: DownloadedAsset[];
  assetReferences?: AssetReference[];
  media?: VideoInventory;
}

const zipDate = new Date("1980-01-01T00:00:00.000Z");

export async function buildRunBundle(input: RunBundleInput): Promise<Blob> {
  const { project, recipe, run, design, assets = [], assetReferences, media } = input;
  const zip = new JSZip();
  const artifacts: string[] = [];
  const add = async (
    name: string,
    data: string | Blob | Uint8Array,
  ): Promise<void> => {
    const normalized =
      data instanceof Blob
        ? new Uint8Array(await data.arrayBuffer())
        : data;
    zip.file(name, normalized, { date: zipDate, createFolders: false });
    artifacts.push(name);
  };

  await add("data.json", stableJson(run.records));
  const tabularFields = recipe.fields.filter(
    (field) => field.kind !== "design",
  );
  if (tabularFields.length > 0) {
    await add("data.csv", serializeCsv(run.records, tabularFields));
  }
  if (design) {
    await add("snapshot.html", `${design.html}\n`);
    await add("styles.css", `${design.css}\n`);
    if (design.screenshot) {
      await add("screenshot.png", design.screenshot);
    }
  }
  if (design || assetReferences || assets.length > 0) {
    for (const asset of [...assets].sort((left, right) =>
      left.filename.localeCompare(right.filename),
    )) {
      await add(`assets/${asset.filename}`, asset.blob);
    }
    await add(
      "assets.json",
      stableJson({
        references: assetReferences ?? design?.assets ?? [],
        downloaded: assets.map(({ url, filename }) => ({ url, filename })),
      }),
    );
  }
  if (media?.videos.length) await add("media.json", stableJson(videoMetadataForExport(media)));

  const manifest = buildRunManifest(project, recipe, run, [
    "manifest.json",
    ...artifacts,
  ]);
  zip.file("manifest.json", stableJson(manifest), {
    date: zipDate,
    createFolders: false,
  });

  const bytes = await zip.generateAsync({
    type: "arraybuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    platform: "UNIX",
  });
  return new Blob([bytes], { type: "application/zip" });
}
