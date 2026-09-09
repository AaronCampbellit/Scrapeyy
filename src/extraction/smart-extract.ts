import type { CaptureRecord, FieldDefinition } from "../contracts/models";
import {
  detectQuickDatasets,
  type QuickDataset,
} from "./quick-extract";

export interface SmartExtractionResult {
  dataset?: QuickDataset;
  records: CaptureRecord[];
}

function mergeDatasets(datasets: QuickDataset[]): QuickDataset[] {
  const merged = new Map<string, QuickDataset>();
  for (const dataset of datasets) {
    const current = merged.get(dataset.key);
    if (!current) {
      merged.set(dataset.key, {
        ...dataset,
        fields: [...dataset.fields],
        records: [...dataset.records],
      });
      continue;
    }
    const knownFields = new Set(current.fields.map((field) => field.id));
    current.fields.push(
      ...dataset.fields.filter((field) => !knownFields.has(field.id)),
    );
    current.records.push(...dataset.records);
  }
  return [...merged.values()];
}

/**
 * Detects datasets using every element matched by the saved container selector.
 * This is what turns a click on one card/row into a recipe for the whole list.
 */
export function detectRecipeDatasets(
  ownerDocument: Document,
  containerSelector: string,
  baseUrl = ownerDocument.baseURI,
): QuickDataset[] {
  const containers = [...ownerDocument.querySelectorAll(containerSelector)];
  return mergeDatasets(
    containers.flatMap((container) => detectQuickDatasets(container, baseUrl)),
  );
}

export function extractSmartRecords(
  ownerDocument: Document,
  containerSelector: string,
  datasetKey: string,
  fields: FieldDefinition[],
  baseUrl = ownerDocument.baseURI,
): SmartExtractionResult {
  const datasets = detectRecipeDatasets(
    ownerDocument,
    containerSelector,
    baseUrl,
  );
  const dataset = datasets.find((candidate) => candidate.key === datasetKey);
  if (!dataset) return { records: [] };
  return {
    dataset,
    records: dataset.records.map((record) =>
      Object.fromEntries(
        fields.map((field) => [
          field.id,
          record[field.sourceId ?? field.id] ?? null,
        ]),
      ),
    ),
  };
}
