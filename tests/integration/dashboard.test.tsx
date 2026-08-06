import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { CaptureRun, Project, Recipe } from "../../src/contracts/models";
import {
  DashboardApp,
  type DashboardServices,
} from "../../src/features/dashboard/DashboardApp";

const project: Project = {
  id: "project-1",
  name: "Market research",
  createdAt: "2026-08-06T12:00:00.000Z",
  updatedAt: "2026-08-06T12:00:00.000Z",
};

const recipe: Recipe = {
  version: 1,
  id: "recipe-1",
  projectId: project.id,
  name: "Product cards",
  origin: "https://example.test",
  startUrl: "https://example.test/products",
  mode: "both",
  containerSelector: "article.product",
  fields: [{ id: "title", name: "Title", kind: "text", selector: "h2" }],
  traversal: {
    kind: "none",
    maxPages: 1,
    maxItems: 100,
    delayMs: 750,
    timeoutMs: 10_000,
  },
  destinations: { inbox: true, autoDownload: false },
  schedule: null,
  createdAt: "2026-08-06T12:00:00.000Z",
  updatedAt: "2026-08-06T12:00:00.000Z",
};

const partialRun: CaptureRun = {
  id: "run-1",
  recipeId: recipe.id,
  projectId: project.id,
  trigger: "manual",
  status: "partial",
  startedAt: "2026-08-06T12:00:00.000Z",
  completedAt: "2026-08-06T12:01:00.000Z",
  recordCount: 2,
  records: [{ title: "Alpha" }, { title: "Beta" }],
  errors: [
    {
      code: "SELECTOR_CHANGED",
      message: "The item selector stopped matching on page 2.",
      recoverable: true,
    },
  ],
  pinned: false,
  exportState: "none",
};

describe("DashboardApp", () => {
  it("preserves partial runs and lets the user export them", async () => {
    const user = userEvent.setup();
    const exportRun = vi.fn().mockResolvedValue(undefined);
    const services: DashboardServices = {
      load: vi.fn().mockResolvedValue({
        projects: [project],
        recipes: [recipe],
        runs: [partialRun],
        permissions: { "https://example.test": false },
      }),
      exportRun,
      runRecipe: vi.fn(),
      saveProject: vi.fn(),
      saveRecipe: vi.fn(),
      deleteRun: vi.fn(),
      pinRun: vi.fn(),
      syncSchedules: vi.fn(),
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      requestOriginAccess: vi.fn(),
      revokeOriginAccess: vi.fn(),
    };

    render(<DashboardApp services={services} />);
    await user.click(
      await screen.findByRole("tab", { name: "Capture Inbox" }),
    );

    expect(screen.getAllByText("Partial")).toHaveLength(2);
    const exportButton = screen.getByRole("button", { name: "Export run" });
    expect(exportButton).toBeEnabled();
    await user.click(exportButton);
    expect(exportRun).toHaveBeenCalledWith("run-1");
  });

  it("reports a failed manual run without claiming capture success", async () => {
    const user = userEvent.setup();
    const services: DashboardServices = {
      load: vi.fn().mockResolvedValue({
        projects: [project],
        recipes: [recipe],
        runs: [],
        permissions: { "https://example.test": false },
      }),
      runRecipe: vi.fn().mockResolvedValue({
        ...partialRun,
        status: "failed",
        recordCount: 0,
        records: [],
      }),
      exportRun: vi.fn(),
      saveProject: vi.fn(),
      saveRecipe: vi.fn(),
      deleteRun: vi.fn(),
      pinRun: vi.fn(),
      syncSchedules: vi.fn(),
      exportConfiguration: vi.fn(),
      importConfiguration: vi.fn(),
      requestOriginAccess: vi.fn(),
      revokeOriginAccess: vi.fn(),
    };

    render(<DashboardApp services={services} />);
    await user.click(await screen.findByRole("tab", { name: "Recipes" }));
    await user.click(screen.getAllByRole("button", { name: "Run" })[0]!);

    expect(await screen.findByText("Capture failed. Review the inbox.")).toBeVisible();
  });
});
