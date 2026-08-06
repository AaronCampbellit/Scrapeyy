import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PopupApp } from "../../src/features/popup/PopupApp";

describe("PopupApp", () => {
  it("shows and dispatches the three primary actions", async () => {
    const user = userEvent.setup();
    const onQuickCapture = vi.fn();
    const onRunRecipe = vi.fn();
    const onOpenDashboard = vi.fn();
    render(
      <PopupApp
        site={{ origin: "https://example.test", access: "one-time" }}
        recipes={[{ id: "recipe-1", name: "Product cards" }]}
        onQuickCapture={onQuickCapture}
        onRunRecipe={onRunRecipe}
        onOpenDashboard={onOpenDashboard}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Quick Capture" }));
    await user.click(screen.getByRole("button", { name: "Run Saved Recipe" }));
    await user.click(screen.getByRole("button", { name: "Open Dashboard" }));

    expect(onQuickCapture).toHaveBeenCalledOnce();
    expect(onRunRecipe).toHaveBeenCalledOnce();
    expect(onOpenDashboard).toHaveBeenCalledOnce();
  });
});
