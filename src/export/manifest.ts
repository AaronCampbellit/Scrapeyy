import type {
  CaptureRun,
  Project,
  Recipe,
} from "../contracts/models";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
}

export function stableJson(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function buildRunManifest(
  project: Project,
  recipe: Recipe,
  run: CaptureRun,
  artifacts: string[],
): Record<string, unknown> {
  return {
    version: 1,
    exportedAt: run.completedAt ?? run.startedAt,
    source: {
      origin: recipe.origin,
      startUrl: recipe.startUrl,
    },
    project: {
      id: project.id,
      name: project.name,
    },
    recipe: {
      id: recipe.id,
      name: recipe.name,
      mode: recipe.mode,
      version: recipe.version,
    },
    run: {
      id: run.id,
      status: run.status,
      trigger: run.trigger,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? null,
      recordCount: run.recordCount,
      warnings: run.warnings ?? [],
      errors: run.errors,
    },
    artifacts,
  };
}
