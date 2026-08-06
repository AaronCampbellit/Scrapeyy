import { describe, expect, it } from "vitest";

import type { CaptureRecord, TraversalSettings } from "../../src/contracts/models";
import type {
  AdvanceResult,
  TraversalEnvironment,
} from "../../src/traversal/types";
import { runTraversal } from "../../src/traversal/run-traversal";

function nextSettings(
  overrides: Partial<TraversalSettings> = {},
): TraversalSettings {
  return {
    kind: "next",
    nextSelector: "button.next",
    maxPages: 10,
    maxItems: 100,
    delayMs: 0,
    timeoutMs: 1_000,
    ...overrides,
  } as TraversalSettings;
}

function environment(
  pages: string[][],
  advanceResults: AdvanceResult[] = [],
): {
  environment: TraversalEnvironment;
  extract: () => Promise<CaptureRecord[]>;
} {
  let page = 0;
  return {
    environment: {
      cancelled: () => false,
      wait: async () => {},
      advanceNext: async () => {
        const result = advanceResults.shift() ?? "advanced";
        if (result === "advanced") {
          page += 1;
        }
        return result;
      },
      advanceScroll: async () => {
        const result = advanceResults.shift() ?? "advanced";
        if (result === "advanced") {
          page += 1;
        }
        return result;
      },
    },
    extract: async () =>
      (pages[page] ?? []).map((id) => ({ id })),
  };
}

describe("runTraversal", () => {
  it("stops after a page adds no new records", async () => {
    const fixture = environment([["a"], ["a"], ["b"]]);

    const result = await runTraversal(
      nextSettings(),
      fixture.environment,
      fixture.extract,
    );

    expect(result.stopReason).toBe("no-new-records");
    expect(result.pagesVisited).toBe(2);
    expect(result.records).toEqual([{ id: "a" }]);
  });

  it("never exceeds the configured page limit", async () => {
    const fixture = environment([["a"], ["b"], ["c"]]);

    const result = await runTraversal(
      nextSettings({ maxPages: 2 }),
      fixture.environment,
      fixture.extract,
    );

    expect(result.stopReason).toBe("page-limit");
    expect(result.pagesVisited).toBe(2);
    expect(result.records).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("truncates to the configured item limit", async () => {
    const fixture = environment([["a", "b"], ["c", "d"]]);

    const result = await runTraversal(
      nextSettings({ maxItems: 3 }),
      fixture.environment,
      fixture.extract,
    );

    expect(result.stopReason).toBe("item-limit");
    expect(result.records).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });

  it.each([
    ["missing", "control-missing"],
    ["disabled", "control-disabled"],
    ["timeout", "timeout"],
  ] as const)("maps a %s advance to %s", async (advance, stopReason) => {
    const fixture = environment([["a"]], [advance]);

    const result = await runTraversal(
      nextSettings(),
      fixture.environment,
      fixture.extract,
    );

    expect(result.stopReason).toBe(stopReason);
    expect(result.records).toEqual([{ id: "a" }]);
  });

  it("stops before advancing when cancelled", async () => {
    const fixture = environment([["a"], ["b"]]);
    fixture.environment.cancelled = () => true;

    const result = await runTraversal(
      nextSettings(),
      fixture.environment,
      fixture.extract,
    );

    expect(result.stopReason).toBe("cancelled");
    expect(result.pagesVisited).toBe(1);
  });
});
