import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type {
  PopupServices,
  PopupWorkspaceData,
} from "../../src/features/popup/PopupApp";
import { PopupApp } from "../../src/features/popup/PopupApp";

const data: PopupWorkspaceData = {
  site: { origin: "https://example.test", access: "one-time" },
  projects: [
    {
      id: "project-1",
      name: "Research",
      createdAt: "2026-08-06T12:00:00.000Z",
      updatedAt: "2026-08-06T12:00:00.000Z",
    },
  ],
  recipes: [
    {
      version: 1,
      id: "recipe-1",
      projectId: "project-1",
      name: "Product cards",
      origin: "https://example.test",
      startUrl: "https://example.test/products",
      mode: "data",
      containerSelector: "article.card",
      fields: [{ id: "title", name: "Title", kind: "text", selector: "h2" }],
      traversal: {
        kind: "none",
        maxPages: 1,
        maxItems: 100,
        delayMs: 0,
        timeoutMs: 10_000,
      },
      destinations: { inbox: true, autoDownload: false },
      schedule: null,
      createdAt: "2026-08-06T12:00:00.000Z",
      updatedAt: "2026-08-06T12:00:00.000Z",
    },
  ],
  runs: [
    {
      id: "run-1",
      recipeId: "recipe-1",
      projectId: "project-1",
      trigger: "manual",
      status: "success",
      startedAt: "2026-08-06T12:05:00.000Z",
      completedAt: "2026-08-06T12:05:01.000Z",
      recordCount: 1,
      records: [{ title: "Alpha" }],
      errors: [],
      pinned: false,
      exportState: "none",
    },
  ],
  permissions: { "https://example.test": false },
  retentionLimit: 20,
};

function services(
  overrides: Partial<PopupServices> = {},
): PopupServices {
  return {
    load: vi.fn().mockResolvedValue(data),
    startQuickCapture: vi.fn(),
    startRecipeCapture: vi.fn(),
    runRecipe: vi.fn().mockResolvedValue(data.runs[0]),
    saveProject: vi.fn(),
    exportRun: vi.fn(),
    deleteRun: vi.fn(),
    pinRun: vi.fn(),
    requestOriginAccess: vi.fn(),
    revokeOriginAccess: vi.fn(),
    exportConfiguration: vi.fn(),
    importConfiguration: vi.fn(),
    ...overrides,
  };
}

describe("PopupApp", () => {
  it("starts simple and advanced capture without a dashboard action", async () => {
    const user = userEvent.setup();
    const api = services();
    render(<PopupApp services={api} />);

    expect(await screen.findByText("Current site")).toBeVisible();
    expect(screen.queryByText(/Open Dashboard/i)).toBeNull();
    expect(
      screen.getByText("Drag a region or capture the full page, then choose a type"),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Quick Capture" }));
    expect(api.startQuickCapture).toHaveBeenCalledOnce();

    await user.click(screen.getByRole("button", { name: "Create Recipe" }));
    expect(api.startRecipeCapture).toHaveBeenCalledWith();
  });

  it("contains recipes, inbox, and settings inside popup tabs", async () => {
    const user = userEvent.setup();
    const api = services();
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");

    await user.click(screen.getByRole("tab", { name: "Recipes" }));
    expect(screen.getByText("Product cards")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Run Product cards" }));
    expect(api.runRecipe).toHaveBeenCalledWith("recipe-1");

    await user.click(screen.getByRole("tab", { name: "Inbox" }));
    expect(screen.getByText("Data preview")).toBeVisible();
    expect(screen.getByText(/\"Alpha\"/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Export run" }));
    expect(api.exportRun).toHaveBeenCalledWith("run-1");

    await user.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByText("Website access")).toBeVisible();
    expect(screen.getByText("Keep the latest 20 runs")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Allow access" }));
    expect(api.requestOriginAccess).toHaveBeenCalledWith("https://example.test");
  });

  it("keeps the popup open and explains picker-start failures", async () => {
    const user = userEvent.setup();
    const api = services({
      startQuickCapture: vi
        .fn()
        .mockRejectedValue(new Error("Scrapeyy could not start on this page")),
    });
    render(<PopupApp services={api} />);
    await screen.findByText("Current site");

    await user.click(screen.getByRole("button", { name: "Quick Capture" }));

    await waitFor(() =>
      expect(
        screen.getByText("Scrapeyy could not start on this page"),
      ).toBeVisible(),
    );
  });
});
