import type {
  CaptureRecord,
  CaptureRun,
  Recipe,
  RunError,
} from "../contracts/models";

export interface PageExecutionResult {
  records: CaptureRecord[];
  warnings: string[];
  errors?: RunError[];
}

export interface RunRecipeDependencies {
  now(): Date;
  createId(): string;
  getRecipe(id: string): Promise<Recipe | undefined>;
  hasOriginAccess(origin: string): Promise<boolean>;
  executeInTab(recipe: Recipe): Promise<PageExecutionResult>;
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
  if (
    trigger !== "manual" &&
    !(await dependencies.hasOriginAccess(recipe.origin))
  ) {
    const missed: CaptureRun = {
      ...base,
      status: "missed",
      completedAt: dependencies.now().toISOString(),
      recordCount: 0,
      records: [],
      errors: [
        {
          code: "ORIGIN_PERMISSION_REQUIRED",
          message: `Grant persistent access to ${recipe.origin} to run this schedule.`,
          recoverable: true,
          pageUrl: recipe.startUrl,
        },
      ],
    };
    await dependencies.saveRun(missed);
    return missed;
  }
  try {
    const result = await dependencies.executeInTab(recipe);
    const run: CaptureRun = {
      ...base,
      status: statusFor(result),
      completedAt: dependencies.now().toISOString(),
      recordCount: result.records.length,
      records: result.records,
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
