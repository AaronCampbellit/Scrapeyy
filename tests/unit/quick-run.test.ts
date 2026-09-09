import { describe, expect, it } from "vitest";

import type { Project } from "../../src/contracts/models";
import { createQuickCaptureResult } from "../../src/run/quick-run";

const project: Project = {
  id: "project-1",
  name: "Local captures",
  createdAt: "2026-08-06T12:00:00.000Z",
  updatedAt: "2026-08-06T12:00:00.000Z",
};

describe("createQuickCaptureResult", () => {
  it("creates an inbox-only run and artifact recipe from inferred data", () => {
    const result = createQuickCaptureResult({
      request: {
        projectId: project.id,
        mode: "data",
        containerSelector: "#prices",
        scope: "element",
      },
      project,
      startUrl: "https://example.test/prices",
      execution: {
        strategy: "table",
        fields: [
          {
            id: "plan",
            name: "Plan",
            kind: "text",
            selector: ":scope",
          },
        ],
        records: [{ plan: "Basic" }],
        warnings: [],
        errors: [],
      },
      id: "run-1",
      recipeId: "quick-1",
      now: "2026-08-06T12:01:00.000Z",
    });

    expect(result.recipe).toMatchObject({
      id: "quick-1",
      name: "Quick capture · example.test",
      fields: [expect.objectContaining({ id: "plan" })],
      traversal: { kind: "none", maxPages: 1 },
      destinations: { inbox: true, autoDownload: false },
      schedule: null,
    });
    expect(result.run).toMatchObject({
      id: "run-1",
      recipeId: "quick-1",
      status: "success",
      recordCount: 1,
      records: [{ plan: "Basic" }],
      exportState: "none",
    });
  });

  it("persists warning details on warning runs", () => {
    const result = createQuickCaptureResult({
      request: {
        projectId: project.id,
        mode: "both",
        containerSelector: "article",
        scope: "element",
      },
      project,
      startUrl: "https://example.test/post",
      execution: {
        strategy: "generic",
        fields: [],
        records: [{ text: "Useful text" }],
        warnings: ["Could not download the referenced image."],
        errors: [],
      },
      id: "run-warning",
      recipeId: "quick-warning",
      now: "2026-08-06T12:01:00.000Z",
    });

    expect(result.run).toMatchObject({
      status: "warning",
      warnings: ["Could not download the referenced image."],
    });
  });

  it("removes authentication parameters from stored quick-capture URLs", () => {
    const result = createQuickCaptureResult({
      request: {
        projectId: project.id,
        mode: "data",
        containerSelector: "html",
        scope: "full-page",
      },
      project,
      startUrl: "https://example.test/overview?range=90d&code=secret&session_state=private#access_token",
      execution: {
        strategy: "generic",
        fields: [],
        records: [{ text: "Overview" }],
        warnings: [],
        errors: [],
      },
      id: "safe-run",
      recipeId: "safe-recipe",
      now: "2026-08-06T12:01:00.000Z",
    });

    expect(result.recipe.startUrl).toBe("https://example.test/overview?range=90d");
  });
});
