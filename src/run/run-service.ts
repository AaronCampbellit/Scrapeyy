import type {
  CaptureRecord,
  CaptureRun,
  Project,
  Recipe,
  RunError,
} from "../contracts/models";
import type { DesignSnapshot } from "../design/snapshot";
import { buildRunBundle } from "../export/bundle";
import { fingerprintRecord } from "../extraction/fingerprint";
import { runTraversal } from "../traversal/run-traversal";
import type { TraversalEnvironment } from "../traversal/types";

export interface PageCapture {
  selectorMatched: boolean;
  records: CaptureRecord[];
}

export interface RunPageAdapter extends TraversalEnvironment {
  capturePage(): Promise<PageCapture>;
  captureDesign(): Promise<DesignSnapshot | undefined>;
}

export interface RunServiceDependencies {
  now(): Date;
  createId(): string;
  saveRun(run: CaptureRun): Promise<void>;
}

export interface ExecuteRunInput {
  project: Project;
  recipe: Recipe;
  trigger: CaptureRun["trigger"];
  page: RunPageAdapter;
}

export interface ExecuteRunResult {
  run: CaptureRun;
  bundle: Blob;
  design?: DesignSnapshot;
}

export class RunService {
  readonly #dependencies: RunServiceDependencies;

  constructor(dependencies: RunServiceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ExecuteRunInput): Promise<ExecuteRunResult> {
    const { project, recipe, trigger, page } = input;
    const startedAt = this.#dependencies.now().toISOString();
    const errors: RunError[] = [];
    let capturedAtLeastOnePage = false;

    const traversal = await runTraversal(
      recipe.traversal,
      page,
      async () => {
        const capture = await page.capturePage();
        if (!capture.selectorMatched) {
          errors.push({
            code: "SELECTOR_CHANGED",
            message: capturedAtLeastOnePage
              ? "The item selector stopped matching on a later page."
              : "The configured item selector no longer matches this page.",
            recoverable: true,
            pageUrl: recipe.startUrl,
            selector: recipe.containerSelector,
          });
          return [];
        }
        capturedAtLeastOnePage = true;
        return capture.records;
      },
      (record) => fingerprintRecord(record, recipe.fields),
    );

    const design =
      recipe.mode === "data" ? undefined : await page.captureDesign();
    if (recipe.mode !== "data" && !design) {
      errors.push({
        code: "DESIGN_SNAPSHOT_UNAVAILABLE",
        message: "The selected element was unavailable for the design snapshot.",
        recoverable: true,
        pageUrl: recipe.startUrl,
        selector: recipe.containerSelector,
      });
    }
    const warnings = traversal.warnings;
    const status: CaptureRun["status"] =
      errors.length > 0
        ? traversal.records.length > 0
          ? "partial"
          : "failed"
        : warnings.length > 0
          ? "warning"
          : traversal.stopReason === "cancelled"
            ? "cancelled"
            : "success";
    const run: CaptureRun = {
      id: this.#dependencies.createId(),
      recipeId: recipe.id,
      projectId: project.id,
      trigger,
      status,
      startedAt,
      completedAt: this.#dependencies.now().toISOString(),
      recordCount: traversal.records.length,
      records: traversal.records,
      warnings,
      errors,
      pinned: false,
      exportState: "none",
    };
    await this.#dependencies.saveRun(run);
    const bundle = await buildRunBundle({
      project,
      recipe,
      run,
      ...(design ? { design } : {}),
    });
    return {
      run,
      bundle,
      ...(design ? { design } : {}),
    };
  }
}
