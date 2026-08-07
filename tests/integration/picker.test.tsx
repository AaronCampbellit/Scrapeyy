import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  PickerCapture,
  QuickCaptureRequest,
} from "../../src/features/picker/PickerApp";
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
    render(
      <PickerApp
        ownerDocument={document}
        variant="quick"
        projectId="project-1"
        projectName="Acme research"
        onQuickCapture={onQuickCapture}
      />,
    );

    expect(
      screen.getByText("Click content to select · Esc to cancel"),
    ).toBeVisible();
    expect(screen.queryByText("Fields")).toBeNull();
    expect(screen.queryByText("Pagination")).toBeNull();
    expect(screen.queryByText("Safety limits")).toBeNull();

    const target = document.querySelector(".product-card")!;
    fireEvent.pointerMove(target);
    fireEvent.click(target);

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
      } satisfies QuickCaptureRequest),
    );
    expect(screen.getByText("Capture saved to the inbox.")).toBeVisible();
  });

  it("keeps advanced options inside Create Recipe", async () => {
    const user = userEvent.setup();
    let recipe: PickerCapture | undefined;
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

    expect(screen.getByText("Fields")).toBeVisible();
    expect(screen.getByText("Pagination")).toBeVisible();
    expect(screen.getByText("Safety limits")).toBeVisible();
    expect(screen.getByText("2 matches")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Save recipe" }));
    expect(recipe).toMatchObject({
      mode: "both",
      containerSelector: "article.product-card",
      traversal: {
        kind: "next",
        nextSelector: "button.next",
        maxPages: 5,
        maxItems: 250,
      },
    });
  });
});
