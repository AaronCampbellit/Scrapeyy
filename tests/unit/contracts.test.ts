import { describe, expect, it } from "vitest";

import { validateRecipe } from "../../src/contracts/validation";

describe("validateRecipe", () => {
  it("accepts a bounded list recipe", () => {
    const recipe = validateRecipe({
      version: 1,
      id: "recipe-1",
      projectId: "project-1",
      name: "Cards",
      origin: "https://example.test",
      startUrl: "https://example.test/list",
      mode: "data",
      containerSelector: ".card",
      fields: [
        {
          id: "title",
          name: "Title",
          kind: "text",
          selector: "h2",
        },
      ],
      traversal: {
        kind: "next",
        nextSelector: "button.next",
        nextMatchIndex: 1,
        maxPages: 3,
        maxItems: 100,
        delayMs: 750,
        timeoutMs: 10_000,
      },
      destinations: {
        inbox: true,
        autoDownload: false,
      },
      manualRunInWorkerTab: true,
      schedule: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    });

    expect(recipe.traversal).toMatchObject({
      maxItems: 100,
      nextMatchIndex: 1,
    });
    expect(recipe.manualRunInWorkerTab).toBe(true);
  });

  it("rejects an unbounded recipe", () => {
    const input = {
      version: 1,
      id: "recipe-1",
      projectId: "project-1",
      name: "Cards",
      origin: "https://example.test",
      startUrl: "https://example.test/list",
      mode: "data",
      containerSelector: ".card",
      fields: [
        {
          id: "title",
          name: "Title",
          kind: "text",
          selector: "h2",
        },
      ],
      traversal: {
        kind: "none",
        maxPages: 1,
        maxItems: 0,
        delayMs: 750,
        timeoutMs: 10_000,
      },
      destinations: {
        inbox: true,
        autoDownload: false,
      },
      schedule: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    };

    expect(() => validateRecipe(input)).toThrow("maxItems");
  });

  it("preserves smart extraction metadata and renamed source fields", () => {
    const recipe = validateRecipe({
      version: 1,
      id: "recipe-smart",
      projectId: "project-1",
      name: "Smart cards",
      origin: "https://example.test",
      startUrl: "https://example.test/list",
      mode: "data",
      containerSelector: ".card",
      extraction: { kind: "smart", datasetKey: "generic" },
      fields: [{
        id: "text",
        sourceId: "text",
        name: "Description",
        kind: "text",
        selector: ":scope",
      }],
      traversal: {
        kind: "none",
        maxPages: 1,
        maxItems: 500,
        delayMs: 0,
        timeoutMs: 10_000,
      },
      destinations: { inbox: true, autoDownload: false },
      schedule: null,
      createdAt: "2026-08-06T00:00:00.000Z",
      updatedAt: "2026-08-06T00:00:00.000Z",
    });

    expect(recipe.extraction).toEqual({ kind: "smart", datasetKey: "generic" });
    expect(recipe.fields[0]).toMatchObject({
      id: "text",
      sourceId: "text",
      name: "Description",
    });
  });
});
