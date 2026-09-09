import { describe, expect, it } from "vitest";

import type { CaptureRecord, TraversalSettings } from "../../src/contracts/models";
import type {
  AdvanceResult,
  TraversalEnvironment,
} from "../../src/traversal/types";
import { advanceNextControl } from "../../src/traversal/next";
import { traversalForExecution } from "../../src/traversal/settings";
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
  it("repairs legacy one-page traversal defaults", () => {
    expect(
      traversalForExecution(
        nextSettings({ maxPages: 1, maxItems: 500 }),
      ),
    ).toMatchObject({ maxPages: 50, maxItems: 10_000 });
  });

  it("captures a ScalePad-sized 1,444-record result across 29 pages", async () => {
    const pages = Array.from({ length: 29 }, (_, page) =>
      Array.from(
        { length: page === 28 ? 44 : 50 },
        (_, item) => `asset-${page * 50 + item + 1}`,
      ),
    );
    const fixture = environment(pages, [
      ...Array.from({ length: 28 }, () => "advanced" as const),
      "disabled",
    ]);

    const result = await runTraversal(
      nextSettings({ maxPages: 50, maxItems: 10_000 }),
      fixture.environment,
      fixture.extract,
    );

    expect(result.pagesVisited).toBe(29);
    expect(result.stopReason).toBe("control-disabled");
    expect(result.records).toHaveLength(1_444);
    expect(result.records[0]).toEqual({ id: "asset-1" });
    expect(result.records.at(-1)).toEqual({ id: "asset-1444" });
  });

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

describe("advanceNextControl", () => {
  it("recovers legacy shared selectors that did not store a match index", async () => {
    document.body.innerHTML = `
      <div id="results">Page one</div>
      <button class="shared-arrow" disabled>Previous</button>
      <button class="shared-arrow">Next</button>`;
    const [previous, next] = document.querySelectorAll<HTMLButtonElement>(
      "button.shared-arrow",
    );
    let page = 1;
    next!.addEventListener("click", () => {
      previous!.disabled = false;
      page += 1;
      document.querySelector("#results")!.textContent = `Page ${page}`;
    });

    await expect(
      advanceNextControl(document, "button.shared-arrow", 500, {
        changeSelector: "#results",
        pollIntervalMs: 1,
        settleMs: 1,
      }),
    ).resolves.toBe("advanced");
    await expect(
      advanceNextControl(document, "button.shared-arrow", 500, {
        changeSelector: "#results",
        pollIntervalMs: 1,
        settleMs: 1,
      }),
    ).resolves.toBe("advanced");
    expect(document.querySelector("#results")).toHaveTextContent("Page 3");
  });

  it("collects every page from an in-place JavaScript table", async () => {
    document.body.innerHTML = `
      <table id="results"><tbody><tr data-id="a"><td>Alpha</td></tr></tbody></table>
      <div class="pager">
        <button class="arrow" disabled>Previous</button>
        <button class="arrow">Next</button>
      </div>`;
    const pages = [
      { id: "b", name: "Beta" },
      { id: "c", name: "Gamma" },
    ];
    let page = 0;
    const next = document.querySelectorAll<HTMLButtonElement>("button.arrow")[1]!;
    next.addEventListener("click", () => {
      document.body.dataset.loading = "true";
      document.querySelector("tbody")!.innerHTML = "";
      window.setTimeout(() => {
        const record = pages[page++];
        if (!record) {
          next.disabled = true;
          return;
        }
        document.querySelector("tbody")!.innerHTML =
          `<tr data-id="${record.id}"><td>${record.name}</td></tr>`;
        if (page === pages.length) next.disabled = true;
      }, 5);
    });

    const result = await runTraversal(
      nextSettings({
        nextSelector: "button.arrow",
        nextMatchIndex: 1,
        maxPages: 50,
        maxItems: 10_000,
      }),
      {
        cancelled: () => false,
        wait: async () => {},
        advanceNext: (selector, matchIndex, timeoutMs) =>
          advanceNextControl(document, selector, timeoutMs, {
            ...(matchIndex === undefined ? {} : { matchIndex }),
            changeSelector: "#results",
            pollIntervalMs: 1,
            settleMs: 10,
          }),
        advanceScroll: async () => "complete",
      },
      async () =>
        [...document.querySelectorAll<HTMLTableRowElement>("tbody tr")].map(
          (row) => ({ id: row.dataset.id ?? null, name: row.textContent }),
        ),
      (record) => record.id ?? "",
    );

    expect(result).toMatchObject({
      pagesVisited: 3,
      stopReason: "control-disabled",
      records: [
        { id: "a", name: "Alpha" },
        { id: "b", name: "Beta" },
        { id: "c", name: "Gamma" },
      ],
    });
  });

  it("clicks the exact selected match when controls share a selector", async () => {
    document.body.innerHTML = `
      <div id="results">Page one</div>
      <div class="pager">
        <button class="arrow" disabled>Previous</button>
        <button class="arrow">Next</button>
      </div>`;
    const controls = document.querySelectorAll<HTMLButtonElement>("button.arrow");
    controls[1]!.addEventListener("click", () => {
      document.querySelector("#results")!.textContent = "Page two";
    });

    const result = await advanceNextControl(document, "button.arrow", 500, {
      matchIndex: 1,
      changeSelector: "#results",
      pollIntervalMs: 1,
      settleMs: 1,
    });

    expect(result).toBe("advanced");
    expect(document.querySelector("#results")).toHaveTextContent("Page two");
  });

  it("ignores unrelated mutations until the selected content changes", async () => {
    document.body.innerHTML = `
      <div id="results">Page one</div>
      <div id="status"></div>
      <button class="next">Next</button>`;
    document.querySelector("button")!.addEventListener("click", () => {
      document.querySelector("#status")!.textContent = "Loading";
      window.setTimeout(() => {
        document.querySelector("#results")!.textContent = "Page two";
      }, 10);
    });

    const result = await advanceNextControl(document, "button.next", 500, {
      changeSelector: "#results",
      pollIntervalMs: 1,
      settleMs: 20,
    });

    expect(result).toBe("advanced");
    expect(document.querySelector("#results")).toHaveTextContent("Page two");
  });

  it("ignores an early page-counter change until genuinely new rows arrive", async () => {
    document.body.innerHTML = `
      <div id="counter">1–50</div>
      <table><tbody><tr data-id="a"><td>Alpha</td></tr></tbody></table>
      <button class="next">Next</button>`;
    document.querySelector("button")!.addEventListener("click", () => {
      document.querySelector("#counter")!.textContent = "51–100";
      window.setTimeout(() => {
        document.querySelector("tbody")!.innerHTML =
          '<tr data-id="b"><td>Beta</td></tr>';
      }, 20);
    });

    const result = await advanceNextControl(document, "button.next", 500, {
      readySignature: () => {
        const ids = [...document.querySelectorAll("tbody tr")]
          .map((row) => row.getAttribute("data-id"));
        return ids.includes("b") ? JSON.stringify(ids) : undefined;
      },
      pollIntervalMs: 1,
      settleMs: 5,
    });

    expect(result).toBe("advanced");
    expect(document.querySelector("#counter")).toHaveTextContent("51–100");
    expect(document.querySelector("tbody")).toHaveTextContent("Beta");
  });

  it("completes when the control disables without adding another page", async () => {
    document.body.innerHTML = `
      <div id="results">Last page</div>
      <button class="next">Next</button>`;
    const control = document.querySelector<HTMLButtonElement>("button")!;
    control.addEventListener("click", () => {
      control.disabled = true;
    });

    await expect(
      advanceNextControl(document, "button.next", 500, {
        changeSelector: "#results",
        pollIntervalMs: 1,
        settleMs: 1,
      }),
    ).resolves.toBe("complete");
  });
});
