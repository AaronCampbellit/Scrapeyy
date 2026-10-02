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
    expect(screen.getByText("Click an element, drag a region, or use the full page")).toBeVisible();
    expect(document.documentElement.style.cursor).toBe("crosshair");
    expect(screen.queryByText("Fields")).toBeNull();
    expect(screen.queryByText("Pagination")).toBeNull();
    expect(screen.queryByText("Safety limits")).toBeNull();

    expect(screen.getByRole("button", { name: "Capture Full Page" })).toBeVisible();
    expect(document.documentElement.style.cursor).toBe("crosshair");

    const target = document.querySelector(".product-card")!;
    fireEvent.pointerMove(target);
    fireEvent.click(target);

    expect(document.documentElement.style.cursor).toBe("");
    expect(screen.getByRole("group", { name: "Capture options" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Content" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Design & Code" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Reselect" })).toBeVisible();

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
    expect(await screen.findByText("Entire scrollable page")).toBeVisible();
    expect(screen.getByRole("group", { name: "Capture options" })).toBeVisible();
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

  it("builds and tests a smart recipe without requiring selectors", async () => {
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

    expect(screen.getByRole("region", { name: "Detected data" })).toBeVisible();
    expect(screen.getByText("2 matching regions")).toBeVisible();
    expect(screen.getByText("2 records · 5 fields")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Detected dataset" })).toHaveValue("generic");
    expect(screen.getByLabelText("Include Text")).toBeChecked();
    expect(screen.getByLabelText("Rename Text")).toHaveValue("Text");
    expect(screen.queryByLabelText("Container selector")).toBeNull();

    await user.clear(screen.getByLabelText("Rename Text"));
    await user.type(screen.getByLabelText("Rename Text"), "Content");
    await user.click(screen.getByLabelText("Include Images"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "How many pages?" })).toBeVisible();
    expect(screen.getByRole("button", { name: /Current page/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Next button selector")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Recipe name")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Project" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Save recipe" })).toBeDisabled();

    await user.clear(screen.getByLabelText("Recipe name"));
    await user.type(screen.getByLabelText("Recipe name"), "Product cards");
    await user.click(screen.getByText("Automation and downloads"));
    await user.click(screen.getByLabelText("Run manual captures in a background tab"));
    await user.click(screen.getByRole("button", { name: "Run test" }));
    expect(await screen.findByText("Test passed · 2 records found")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(recipe).toMatchObject({
      version: 1,
      name: "Product cards",
      mode: "both",
      containerSelector: "article.product-card",
      extraction: { kind: "smart", datasetKey: "generic" },
      fields: expect.arrayContaining([
        expect.objectContaining({ id: "text", sourceId: "text", name: "Content" }),
        expect.objectContaining({ id: "links", sourceId: "links" }),
      ]),
      traversal: {
        kind: "none",
        maxPages: 1,
        maxItems: 10_000,
      },
      destinations: { inbox: true, autoDownload: false },
      manualRunInWorkerTab: true,
    });
    expect(recipe?.fields.some((field) => field.id === "images")).toBe(false);
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

    expect(screen.getByRole("heading", { name: "Edit Recipe" })).toBeVisible();
    expect(screen.getByText("2 matching regions")).toBeVisible();
    expect(screen.getByText(/older recipe uses CSS selectors/i)).toBeVisible();
  });

  it("minimizes without closing the recipe draft", async () => {
    const user = userEvent.setup();
    const onMinimize = vi.fn();
    render(
      <PickerApp
        ownerDocument={document}
        variant="recipe"
        projectId="project-1"
        projectName="Acme research"
        onMinimize={onMinimize}
      />,
    );
    fireEvent.click(document.querySelector(".product-card")!);
    await user.clear(screen.getByLabelText("Rename Text"));
    await user.type(screen.getByLabelText("Rename Text"), "Saved content");

    await user.click(screen.getByRole("button", { name: "Minimize Recipe Builder" }));

    expect(onMinimize).toHaveBeenCalledOnce();
    expect(screen.getByLabelText("Rename Text")).toHaveValue("Saved content");
  });

  it("lets the user identify an undetected Next button directly on the page", async () => {
    const user = userEvent.setup();
    let recipe: Recipe | undefined;
    const previousButton = document.createElement("button");
    previousButton.className = "pager-forward";
    previousButton.disabled = true;
    previousButton.textContent = "Previous results";
    const nextButton = document.createElement("button");
    nextButton.className = "pager-forward";
    nextButton.textContent = "Continue results";
    nextButton.addEventListener("click", () => {
      document.querySelector(".product-card h2")!.textContent = "Gamma";
    });
    document.body.append(previousButton, nextButton);
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
    fireEvent.click(document.querySelector(".product-card")!);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /Next button/ }));
    expect(screen.getByText("No next button was detected.")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Choose Next button on page" }));
    expect(screen.queryByLabelText("Create Recipe")).toBeNull();
    expect(screen.getByText("Click the page control that loads the next results")).toBeVisible();
    fireEvent.pointerDown(nextButton, { button: 0 });
    fireEvent.click(nextButton);

    expect(await screen.findByText(/Next control verified/)).toBeVisible();
    expect(screen.getByLabelText("Next button selector")).toHaveValue(
      "button.pager-forward",
    );
    expect(screen.getByText(/match 2 of 2/i)).toBeVisible();
    expect(await screen.findByText(/Test passed — the button loaded the next page/i)).toBeVisible();
    expect(screen.getByLabelText("Maximum pages")).toHaveValue(50);
    expect(screen.getByLabelText("Maximum records")).toHaveValue(10_000);

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Run test" }));
    expect(await screen.findByText(/Test passed/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(recipe?.traversal).toMatchObject({
      kind: "next",
      nextSelector: "button.pager-forward",
      nextMatchIndex: 1,
      maxPages: 50,
      maxItems: 10_000,
    });
  });

  it("hands a complete draft to the navigation-safe Next button test", async () => {
    const user = userEvent.setup();
    const nextButton = document.createElement("button");
    nextButton.setAttribute("aria-label", "Next results");
    const pageClick = vi.fn();
    nextButton.addEventListener("click", pageClick);
    document.body.append(nextButton);
    const onTestNext = vi.fn().mockResolvedValue("advanced");

    render(
      <PickerApp
        ownerDocument={document}
        variant="recipe"
        projectId="project-1"
        projectName="Acme research"
        onTestNext={onTestNext}
      />,
    );
    fireEvent.click(document.querySelector(".product-card")!);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: /Next button/ }));
    await user.click(screen.getByRole("button", { name: "Test Next button" }));

    await waitFor(() => expect(onTestNext).toHaveBeenCalledOnce());
    expect(pageClick).not.toHaveBeenCalled();
    expect(onTestNext).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-1",
        startUrl: expect.any(String),
        containerSelector: "article.product-card",
        extraction: { kind: "smart", datasetKey: "generic" },
        fields: expect.arrayContaining([
          expect.objectContaining({ id: "text", sourceId: "text" }),
        ]),
        traversal: expect.objectContaining({
          kind: "next",
          nextSelector: '[aria-label="Next results"]',
          nextMatchIndex: 0,
        }),
      }),
    );
    expect(await screen.findByText(/Test passed — the button loaded the next page/i)).toBeVisible();
  });

  it("restores a navigated recipe draft at the verified Traversal step", () => {
    const nextButton = document.createElement("button");
    nextButton.setAttribute("aria-label", "Next results");
    document.body.append(nextButton);
    const draft: Recipe = {
      version: 1,
      id: "draft-1",
      projectId: "project-1",
      name: "Unfinished product scrape",
      origin: "http://localhost",
      startUrl: "http://localhost/products?page=1",
      mode: "data",
      containerSelector: "article.product-card",
      extraction: { kind: "smart", datasetKey: "generic" },
      fields: [{
        id: "text",
        sourceId: "text",
        name: "Product content",
        kind: "text",
        selector: ":scope",
      }],
      traversal: {
        kind: "next",
        nextSelector: 'button[aria-label="Next results"]',
        nextMatchIndex: 0,
        maxPages: 25,
        maxItems: 2_500,
        delayMs: 750,
        timeoutMs: 10_000,
      },
      destinations: { inbox: true, autoDownload: false },
      schedule: null,
      createdAt: "2026-08-13T12:00:00.000Z",
      updatedAt: "2026-08-13T12:00:00.000Z",
    };

    render(
      <PickerApp
        ownerDocument={document}
        variant="recipe"
        projectId="project-1"
        projectName="Acme research"
        initialRecipe={draft}
        initialStep={1}
        initialNextVerified
        initialNotice="Next button verified after navigation. Your recipe draft was restored."
        resumedDraft
      />,
    );

    expect(screen.getByRole("heading", { name: "Create Recipe" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "How many pages?" })).toBeVisible();
    expect(screen.getByText("Next control verified")).toBeVisible();
    expect(screen.getByLabelText("Maximum pages")).toHaveValue(25);
    expect(screen.getByLabelText("Maximum records")).toHaveValue(2_500);
    expect(screen.getByText(/recipe draft was restored/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });
});
