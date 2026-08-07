import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  QuickCaptureRequest,
} from "../../src/features/picker/PickerApp";
import type { Recipe } from "../../src/contracts/models";
import { PickerApp } from "../../src/features/picker/PickerApp";

describe("PickerApp", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main>
        <article class="product-card">
          <h2>Alpha</h2>
          <a href="/alpha">View Alpha</a>
        </article>
        <article class="product-card">
          <h2>Beta</h2>
          <a href="/beta">View Beta</a>
        </article>
      </main>`;
  });

  it("uses a direct click followed by a compact capture choice", async () => {
    const user = userEvent.setup();
    const onQuickCapture = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PickerApp
        ownerDocument={document}
        variant="quick"
        projectId="project-1"
        projectName="Acme research"
        onQuickCapture={onQuickCapture}
      />,
    );

    expect(container.querySelector(".picker-root")).toHaveAttribute(
      "data-theme",
      "dark",
    );
    expect(
      screen.getByText("Drag to select · Click one element · Esc to cancel"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Capture Full Page" })).toBeVisible();
    expect(document.querySelector(".selection-highlight")).toBeNull();
    expect(document.documentElement.style.cursor).toBe("crosshair");
    expect(screen.queryByText("Fields")).toBeNull();
    expect(screen.queryByText("Pagination")).toBeNull();
    expect(screen.queryByText("Safety limits")).toBeNull();

    const target = document.querySelector(".product-card")!;
    fireEvent.pointerMove(target);
    fireEvent.click(target);

    expect(document.documentElement.style.cursor).toBe("");
    expect(screen.getByRole("group", { name: "Capture type" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Data" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Design" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Both" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reselect" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Both" }));
    await user.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() =>
      expect(onQuickCapture).toHaveBeenCalledWith({
        projectId: "project-1",
        mode: "both",
        containerSelector: "article.product-card",
        scope: "element",
      } satisfies QuickCaptureRequest),
    );
    expect(screen.getByText("Capture saved to the inbox.")).toBeVisible();
  });

  it("opens the same capture choice for the entire scrollable page", async () => {
    const user = userEvent.setup();
    const onQuickCapture = vi.fn().mockResolvedValue(undefined);
    render(
      <PickerApp
        ownerDocument={document}
        variant="quick"
        projectId="project-1"
        projectName="Acme research"
        onQuickCapture={onQuickCapture}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Capture Full Page" }));

    expect(screen.getByText("Entire scrollable page")).toBeVisible();
    expect(screen.getByRole("group", { name: "Capture type" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Both" }));
    await user.click(screen.getByRole("button", { name: "Capture" }));

    await waitFor(() =>
      expect(onQuickCapture).toHaveBeenCalledWith({
        projectId: "project-1",
        mode: "both",
        containerSelector: "html",
        scope: "full-page",
      } satisfies QuickCaptureRequest),
    );
  });

  it("keeps advanced options inside Create Recipe", async () => {
    const user = userEvent.setup();
    let recipe: Recipe | undefined;
    render(
      <PickerApp
        ownerDocument={document}
        variant="recipe"
        projectId="project-1"
        projectName="Acme research"
        onSaveRecipe={(value) => {
          recipe = value;
        }}
      />,
    );

    expect(screen.queryByText("Fields")).toBeNull();
    const target = document.querySelector(".product-card")!;
    fireEvent.pointerMove(target);
    fireEvent.click(target);

    expect(screen.getByRole("heading", { name: "Selection" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Fields" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Pagination" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Recipe name")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Project" })).toBeEnabled();
    expect(screen.getByText("Safety limits")).toBeVisible();
    expect(screen.getByText("Schedule")).toBeVisible();
    expect(screen.getByLabelText("Download after each run")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Review" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(recipe).toMatchObject({
      version: 1,
      name: "New recipe",
      mode: "both",
      containerSelector: "article.product-card",
      traversal: {
        kind: "next",
        nextSelector: "button.next",
        maxPages: 5,
        maxItems: 250,
      },
      destinations: { inbox: true, autoDownload: false },
    });
  });

  it("opens an existing recipe at its saved selection", () => {
    const existing: Recipe = {
      version: 1,
      id: "recipe-1",
      projectId: "project-1",
      name: "Existing cards",
      origin: "http://localhost",
      startUrl: "http://localhost/",
      mode: "data",
      containerSelector: "article.product-card",
      fields: [{ id: "title", name: "Title", kind: "text", selector: "h2" }],
      traversal: {
        kind: "none",
        maxPages: 1,
        maxItems: 100,
        delayMs: 0,
        timeoutMs: 10_000,
      },
      destinations: { inbox: true, autoDownload: true },
      schedule: null,
      createdAt: "2026-08-06T12:00:00.000Z",
      updatedAt: "2026-08-06T12:00:00.000Z",
    };

    render(
      <PickerApp
        ownerDocument={document}
        variant="recipe"
        projectId="project-1"
        projectName="Acme research"
        initialRecipe={existing}
      />,
    );

    expect(screen.getByText("Create Recipe")).toBeVisible();
    expect(screen.getByText("2 matches")).toBeVisible();
  });
});
