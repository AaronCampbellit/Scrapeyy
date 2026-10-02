import type {
  CaptureRecord,
  CaptureRun,
  Recipe,
  RunError,
} from "../contracts/models";
import type { DesignSnapshot } from "../design/snapshot";
import type { AssetReference } from "../design/assets";
import type { VideoInventory } from "../media/videos";
import type { ElementBounds } from "../platform/screenshots";

export interface PageExecutionResult {
  records: CaptureRecord[];
  warnings: string[];
  errors?: RunError[];
  design?: DesignSnapshot;
  assetReferences?: AssetReference[];
  media?: VideoInventory;
  designBounds?: ElementBounds;
}

export interface RunRecipeDependencies {
  now(): Date;
  createId(): string;
  getRecipe(id: string): Promise<Recipe | undefined>;
  hasOriginAccess(origin: string): Promise<boolean>;
  executeInTab(
    recipe: Recipe,
    trigger: CaptureRun["trigger"],
  ): Promise<PageExecutionResult>;
  saveRun(run: CaptureRun): Promise<void>;
}

function statusFor(result: PageExecutionResult): CaptureRun["status"] {
  if ((result.errors?.length ?? 0) > 0) {
    return result.records.length > 0 ? "partial" : "failed";
  }
  return result.warnings.length > 0 ? "warning" : "success";
}

export async function runRecipe(
  recipeId: string,
  trigger: CaptureRun["trigger"],
  dependencies: RunRecipeDependencies,
): Promise<CaptureRun> {
  const recipe = await dependencies.getRecipe(recipeId);
  if (!recipe) {
    throw new Error(`Recipe not found: ${recipeId}`);
  }
  const startedAt = dependencies.now().toISOString();
  const base = {
    id: dependencies.createId(),
    recipeId,
    projectId: recipe.projectId,
    trigger,
    startedAt,
    pinned: false,
    exportState: "none" as const,
  };
  const needsPersistentAccess =
    trigger !== "manual" || recipe.manualRunInWorkerTab === true;
  if (
    needsPersistentAccess &&
    !(await dependencies.hasOriginAccess(recipe.origin))
  ) {
    const missed: CaptureRun = {
      ...base,
      status: "missed",
      completedAt: dependencies.now().toISOString(),
      recordCount: 0,
      records: [],
      warnings: [],
      errors: [
        {
          code: "ORIGIN_PERMISSION_REQUIRED",
          message: recipe.manualRunInWorkerTab && trigger === "manual"
            ? `Grant persistent access to ${recipe.origin} to use a background worker tab.`
            : `Grant persistent access to ${recipe.origin} to run this schedule.`,
          recoverable: true,
          pageUrl: recipe.startUrl,
        },
      ],
    };
    await dependencies.saveRun(missed);
    return missed;
  }
  try {
    const result = await dependencies.executeInTab(recipe, trigger);
    const run: CaptureRun = {
      ...base,
      status: statusFor(result),
      completedAt: dependencies.now().toISOString(),
      recordCount: result.records.length,
      records: result.records,
      warnings: result.warnings,
      errors: result.errors ?? [],
    };
    await dependencies.saveRun(run);
    return run;
  } catch (error) {
    const failed: CaptureRun = {
      ...base,
      status: "failed",
      completedAt: dependencies.now().toISOString(),
      recordCount: 0,
      records: [],
      warnings: [],
      errors: [
        {
          code: "PAGE_EXECUTION_FAILED",
          message: error instanceof Error ? error.message : "Page execution failed",
          recoverable: true,
          pageUrl: recipe.startUrl,
        },
      ],
    };
    await dependencies.saveRun(failed);
    return failed;
  }
}
