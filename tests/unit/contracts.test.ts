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
        maxPages: 3,
        maxItems: 100,
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
    });

    expect(recipe.traversal.maxItems).toBe(100);
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
});
