import type {
  CaptureRecord,
  CaptureRun,
  FieldDefinition,
  Project,
  QuickCaptureRequest,
  Recipe,
  RunError,
} from "../contracts/models";
import type { DesignSnapshot } from "../design/snapshot";
import type { AssetReference } from "../design/assets";
import type { VideoInventory } from "../media/videos";
import type { QuickExtractionResult } from "../extraction/quick-extract";
import { sanitizeCapturedUrl } from "../extraction/normalize";

export interface QuickPageExecutionResult {
  strategy: QuickExtractionResult["strategy"];
  fields: FieldDefinition[];
  records: CaptureRecord[];
  warnings: string[];
  errors: RunError[];
  design?: DesignSnapshot;
  assetReferences?: AssetReference[];
  media?: VideoInventory;
  designBounds?: {
    left: number;
    top: number;
    width: number;
    height: number;
    viewportWidth: number;
    viewportHeight: number;
  };
}

interface CreateQuickCaptureResultInput {
  request: QuickCaptureRequest;
  project: Project;
  startUrl: string;
  execution: QuickPageExecutionResult;
  id: string;
  recipeId: string;
  now: string;
}

export function createQuickCaptureResult({
  request,
  project,
  startUrl,
  execution,
  id,
  recipeId,
  now,
}: CreateQuickCaptureResultInput): {
  recipe: Recipe;
  run: CaptureRun;
} {
  const safeStartUrl = sanitizeCapturedUrl(startUrl);
  const url = new URL(safeStartUrl);
  const recipe: Recipe = {
    version: 1,
    id: recipeId,
    projectId: request.projectId || project.id,
    name: `Quick capture · ${url.hostname}`,
    origin: url.origin,
    startUrl: safeStartUrl,
    mode: request.mode,
    containerSelector: request.containerSelector,
    fields: execution.fields,
    traversal: {
      kind: "none",
      maxPages: 1,
      maxItems: Math.max(1, execution.records.length),
      delayMs: 0,
      timeoutMs: 10_000,
    },
    destinations: { inbox: true, autoDownload: false },
    schedule: null,
    createdAt: now,
    updatedAt: now,
  };
  const status: CaptureRun["status"] =
    execution.errors.length > 0
      ? execution.records.length > 0 || execution.design
        ? "partial"
        : "failed"
      : execution.warnings.length > 0
        ? "warning"
        : "success";
  const run: CaptureRun = {
    id,
    recipeId,
    projectId: project.id,
    trigger: "manual",
    status,
    startedAt: now,
    completedAt: now,
    recordCount: execution.records.length,
    records: execution.records,
    warnings: execution.warnings,
    errors: execution.errors,
    pinned: false,
    exportState: "none",
  };
  return { recipe, run };
}
