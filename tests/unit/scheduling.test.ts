import { describe, expect, it, vi } from "vitest";

import type { CaptureRun, Recipe } from "../../src/contracts/models";
import { runRecipe, type RunRecipeDependencies } from "../../src/scheduling/runner";
import {
  nextOccurrence,
  shouldCatchUp,
} from "../../src/scheduling/schedule";

function recipe(): Recipe {
  return {
    version: 1,
    id: "recipe-1",
    projectId: "project-1",
    name: "Products",
    origin: "https://example.test",
    startUrl: "https://example.test/list",
    mode: "data",
    containerSelector: ".card",
    fields: [{ id: "title", name: "Title", kind: "text", selector: "h2" }],
    traversal: {
      kind: "none",
      maxPages: 1,
      maxItems: 100,
      delayMs: 0,
      timeoutMs: 10_000,
    },
    destinations: { inbox: true, autoDownload: false },
    schedule: {
      enabled: true,
      cadence: "interval",
      intervalMinutes: 60,
    },
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
  };
}

function dependencies(
  overrides: Partial<RunRecipeDependencies> = {},
): { dependencies: RunRecipeDependencies; saved: CaptureRun[] } {
  const saved: CaptureRun[] = [];
  return {
    saved,
    dependencies: {
      now: () => new Date("2026-08-06T12:00:00.000Z"),
      createId: () => "run-1",
      getRecipe: async () => recipe(),
      hasOriginAccess: async () => true,
      executeInTab: async () => ({
        records: [{ title: "Alpha" }],
        warnings: [],
      }),
      saveRun: async (run) => {
        saved.push(run);
      },
      ...overrides,
    },
  };
}

describe("scheduling", () => {
  it("calculates interval and daily occurrences after the reference time", () => {
    const after = new Date(2026, 7, 6, 9, 30, 0);

    expect(
      nextOccurrence(
        { enabled: true, cadence: "interval", intervalMinutes: 45 },
        after,
      ).getTime(),
    ).toBe(new Date(2026, 7, 6, 10, 15, 0).getTime());
    expect(
      nextOccurrence(
        { enabled: true, cadence: "daily", localTime: "09:00" },
        after,
      ).getTime(),
    ).toBe(new Date(2026, 7, 7, 9, 0, 0).getTime());
  });

  it("allows one catch-up after a missed due time", () => {
    const due = new Date("2026-08-06T08:00:00.000Z");
    const now = new Date("2026-08-06T10:00:00.000Z");

    expect(shouldCatchUp(due, undefined, now)).toBe(true);
    expect(
      shouldCatchUp(due, new Date("2026-08-06T09:59:00.000Z"), now),
    ).toBe(false);
  });

  it("records a missed run when persistent permission is absent", async () => {
    const fixture = dependencies({
      hasOriginAccess: async () => false,
      executeInTab: async () => {
        throw new Error("A tab must not open without permission");
      },
    });

    const result = await runRecipe(
      "recipe-1",
      "scheduled",
      fixture.dependencies,
    );

    expect(result.status).toBe("missed");
    expect(result.errors[0]).toMatchObject({
      code: "ORIGIN_PERMISSION_REQUIRED",
      recoverable: true,
    });
    expect(fixture.saved).toEqual([result]);
  });

  it("records successful page results", async () => {
    const executeInTab = vi.fn().mockResolvedValue({
      records: [{ title: "Alpha" }],
      warnings: [],
    });
    const fixture = dependencies({ executeInTab });

    const result = await runRecipe("recipe-1", "manual", fixture.dependencies);

    expect(result).toMatchObject({
      id: "run-1",
      status: "success",
      recordCount: 1,
      records: [{ title: "Alpha" }],
    });
    expect(fixture.saved).toEqual([result]);
    expect(executeInTab).toHaveBeenCalledWith(
      expect.objectContaining({ id: "recipe-1" }),
      "manual",
    );
  });

  it("requires persistent access for a manual background-tab run", async () => {
    const workerRecipe = { ...recipe(), manualRunInWorkerTab: true };
    const executeInTab = vi.fn();
    const fixture = dependencies({
      getRecipe: async () => workerRecipe,
      hasOriginAccess: async () => false,
      executeInTab,
    });

    const result = await runRecipe("recipe-1", "manual", fixture.dependencies);

    expect(result.status).toBe("missed");
    expect(result.errors[0]?.message).toMatch(/background worker tab/i);
    expect(executeInTab).not.toHaveBeenCalled();
  });
});
