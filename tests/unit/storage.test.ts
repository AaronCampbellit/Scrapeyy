// @vitest-environment node

import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type {
  CaptureRun,
  Project,
  Recipe,
} from "../../src/contracts/models";
import { CaptureDatabase } from "../../src/storage/capture-database";
import { migrateConfiguration } from "../../src/storage/migrations";
import { applyRetention } from "../../src/storage/retention";
import {
  createSettingsRepository,
  type StorageArea,
} from "../../src/storage/settings-repository";

function run(
  id: string,
  completedAt: string,
  overrides: Partial<CaptureRun> = {},
): CaptureRun {
  return {
    id,
    recipeId: "recipe-1",
    projectId: "project-1",
    trigger: "manual",
    status: "success",
    startedAt: completedAt,
    completedAt,
    recordCount: 1,
    records: [{ id }],
    errors: [],
    pinned: false,
    exportState: "none",
    ...overrides,
  };
}

class MemoryStorageArea implements StorageArea {
  values: Record<string, unknown> = {};

  async get(key: string): Promise<Record<string, unknown>> {
    return key in this.values ? { [key]: this.values[key] } : {};
  }

  async set(values: Record<string, unknown>): Promise<void> {
    Object.assign(this.values, values);
  }
}

describe("local repositories", () => {
  const databases: CaptureDatabase[] = [];

  afterEach(async () => {
    await Promise.all(databases.map((database) => database.delete()));
    databases.length = 0;
  });

  it("round-trips settings repository values", async () => {
    const area = new MemoryStorageArea();
    const repository = createSettingsRepository<Project>(area, "projects");
    const project: Project = {
      id: "project-1",
      name: "Acme",
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    };

    await repository.put(project);

    expect(await repository.get(project.id)).toEqual(project);
    expect(await repository.list()).toEqual([project]);
    await repository.remove(project.id);
    expect(await repository.get(project.id)).toBeUndefined();
  });

  it("round-trips capture runs and binary artifacts through IndexedDB", async () => {
    const database = new CaptureDatabase(`scrapeyy-test-${crypto.randomUUID()}`);
    databases.push(database);
    const captureRun = run("run-1", "2026-08-06T12:00:00.000Z");
    const artifact = new Blob(["snapshot"], { type: "text/html" });

    await database.putRun(captureRun);
    await database.putArtifact({
      id: "run-1:snapshot",
      runId: "run-1",
      name: "snapshot.html",
      blob: artifact,
    });

    expect(await database.getRun("run-1")).toEqual(captureRun);
    expect(await (await database.getArtifact("run-1:snapshot"))?.blob.text()).toBe(
      "snapshot",
    );
  });

  it("retains the twenty newest unpinned runs plus protected runs", () => {
    const runs = Array.from({ length: 24 }, (_, index) =>
      run(
        `run-${index + 1}`,
        new Date(Date.UTC(2026, 7, 6, 0, index)).toISOString(),
        index === 0
          ? { pinned: true }
          : index === 1
            ? { exportState: "queued" }
            : {},
      ),
    );

    const deletions = applyRetention(runs, 20);

    expect(deletions).toHaveLength(2);
    expect(deletions).not.toContain("run-1");
    expect(deletions).not.toContain("run-2");
  });

  it("migrates a version-one configuration idempotently", () => {
    const input = {
      version: 1,
      projects: [
        {
          id: "project-1",
          name: "Acme",
          createdAt: "2026-08-06T00:00:00.000Z",
          updatedAt: "2026-08-06T00:00:00.000Z",
        },
      ],
      recipes: [] as Recipe[],
    };

    const migrated = migrateConfiguration(input);

    expect(migrateConfiguration(migrated)).toEqual(migrated);
    expect(() => migrateConfiguration({ version: 99 })).toThrow(
      "Unsupported configuration version",
    );
  });
});
