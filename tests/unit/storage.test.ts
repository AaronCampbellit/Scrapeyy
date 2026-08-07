// @vitest-environment node

import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import type {
  CaptureRun,
  Project,
  Recipe,
} from "../../src/contracts/models";
import { CaptureDatabase } from "../../src/storage/capture-database";
import {
  captureReferenceAssets,
  loadReferenceAssets,
} from "../../src/storage/reference-assets";
import { migrateConfiguration } from "../../src/storage/migrations";
import { applyRetention } from "../../src/storage/retention";
import {
  createAppSettingsStore,
  DEFAULT_APP_SETTINGS,
} from "../../src/storage/app-settings";
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

  it("defaults app settings to dark mode and always asks where to save", async () => {
    const store = createAppSettingsStore(new MemoryStorageArea());

    expect(await store.get()).toEqual({
      theme: "dark",
      downloadBehavior: "ask",
      downloadSubfolder: "Scrapeyy",
    });
  });

  it("persists app settings and normalizes an automatic download subfolder", async () => {
    const area = new MemoryStorageArea();
    const store = createAppSettingsStore(area);

    const saved = await store.set({
      ...DEFAULT_APP_SETTINGS,
      theme: "light",
      downloadBehavior: "automatic",
      downloadSubfolder: "  Client Reports / August:2026  ",
    });

    expect(saved).toEqual({
      theme: "light",
      downloadBehavior: "automatic",
      downloadSubfolder: "Client Reports/August-2026",
    });
    expect(await store.get()).toEqual(saved);
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
      sourceUrl: "https://example.test/snapshot",
    });
    await database.putArtifact({
      id: "run-2:snapshot",
      runId: "run-2",
      name: "snapshot.html",
      blob: new Blob(["other"]),
    });

    expect(await database.getRun("run-1")).toEqual(captureRun);
    expect(await (await database.getArtifact("run-1:snapshot"))?.blob.text()).toBe(
      "snapshot",
    );
    const artifacts = await database.listArtifacts("run-1");
    expect(artifacts).toHaveLength(1);
    expect(artifacts[0]?.sourceUrl).toBe("https://example.test/snapshot");
  });

  it("downloads reference images at capture time and reloads them for export", async () => {
    const database = new CaptureDatabase(`scrapeyy-test-${crypto.randomUUID()}`);
    databases.push(database);

    const warnings = await captureReferenceAssets(
      "run-assets",
      [
        { kind: "image", url: "https://example.test/hero.png" },
        { kind: "image", url: "https://example.test/missing.png" },
      ],
      database,
      async (url) =>
        String(url).includes("missing")
          ? new Response("missing", { status: 404 })
          : new Response("image-bytes", {
              headers: { "content-type": "image/png" },
            }),
    );
    const assets = await loadReferenceAssets("run-assets", database);

    expect(warnings).toHaveLength(1);
    expect(assets).toHaveLength(1);
    expect(assets[0]?.filename).toBe("001-hero.png");
    expect(assets[0]?.url).toBe("https://example.test/hero.png");
    expect(await assets[0]?.blob.text()).toBe("image-bytes");
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
