import type { CaptureRun } from "../contracts/models";

function protectedRun(run: CaptureRun): boolean {
  return run.pinned || run.exportState === "queued";
}

export function applyRetention(runs: CaptureRun[], limit: number): string[] {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Retention limit must be a positive integer");
  }
  const byRecipe = Map.groupBy(runs, (run) => run.recipeId);
  const deletions: string[] = [];
  for (const recipeRuns of byRecipe.values()) {
    const removable = recipeRuns
      .filter((run) => !protectedRun(run))
      .sort((left, right) => {
        const leftTime = Date.parse(left.completedAt ?? left.startedAt);
        const rightTime = Date.parse(right.completedAt ?? right.startedAt);
        return rightTime - leftTime;
      });
    deletions.push(...removable.slice(limit).map((run) => run.id));
  }
  return deletions;
}
