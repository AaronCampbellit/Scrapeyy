import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import type { PickerCapture } from "../../src/features/picker/PickerApp";
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

  it("selects a repeated container and previews named fields", async () => {
    const user = userEvent.setup();
    render(
      <PickerApp
        ownerDocument={document}
        projectId="project-1"
        projectName="Acme research"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Repeated list" }));
    fireEvent.mouseOver(document.querySelector(".product-card")!);
    await user.click(screen.getByRole("button", { name: "Select element" }));

    expect(screen.getByText("2 matches")).toBeVisible();
    const preview = within(screen.getByRole("table"));
    expect(preview.getByText("Alpha")).toBeVisible();
    expect(preview.getByText("Beta")).toBeVisible();
  });

  it("emits the selected mode, selector, fields, and traversal limits", async () => {
    const user = userEvent.setup();
    let capture: PickerCapture | undefined;
    render(
      <PickerApp
        ownerDocument={document}
        projectId="project-1"
        projectName="Acme research"
        onCapture={(value) => {
          capture = value;
        }}
      />,
    );

    fireEvent.mouseOver(document.querySelector(".product-card")!);
    await user.click(screen.getByRole("button", { name: "Select element" }));
    await user.click(screen.getByRole("button", { name: "Both" }));
    await user.click(screen.getByRole("button", { name: "Capture now" }));

    expect(capture).toMatchObject({
      mode: "both",
      containerSelector: "article.product-card",
      fields: [
        { id: "title", kind: "text", selector: "h2" },
        { id: "url", kind: "link", selector: "a" },
      ],
      traversal: {
        kind: "next",
        nextSelector: "button.next",
        maxPages: 5,
        maxItems: 250,
      },
    });
  });
});
