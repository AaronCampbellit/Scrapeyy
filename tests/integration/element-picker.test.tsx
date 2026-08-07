import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useElementPicker } from "../../src/features/picker/useElementPicker";

function Harness({ onCancel = () => undefined }: { onCancel?: () => void }) {
  const picker = useElementPicker(document, onCancel);
  const [, renderAgain] = useState(0);
  return (
    <div data-scrapeyy-ui>
      <output aria-label="phase">{picker.phase}</output>
      <output aria-label="selected">
        {picker.selected?.getAttribute("data-name") ?? "none"}
      </output>
      <button type="button" onClick={picker.reselect}>
        Reselect
      </button>
      <button type="button" onClick={() => renderAgain((value) => value + 1)}>
        Render
      </button>
    </div>
  );
}

describe("useElementPicker", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("selects a clicked page element and blocks its page action", () => {
    const pageAction = vi.fn();
    const target = document.createElement("a");
    target.href = "https://example.test/next";
    target.dataset.name = "target";
    target.addEventListener("click", pageAction);
    document.body.append(target);
    render(<Harness />);

    fireEvent.pointerMove(target);
    fireEvent.click(target);

    expect(pageAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText("phase")).toHaveTextContent("selected");
    expect(screen.getByLabelText("selected")).toHaveTextContent("target");
  });

  it("ignores extension UI and supports reselect and Escape", () => {
    const onCancel = vi.fn();
    const target = document.createElement("article");
    target.dataset.name = "article";
    document.body.append(target);
    render(<Harness onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Render" }));
    expect(screen.getByLabelText("selected")).toHaveTextContent("none");

    fireEvent.pointerMove(target);
    fireEvent.click(target);
    fireEvent.click(screen.getByRole("button", { name: "Reselect" }));
    expect(screen.getByLabelText("phase")).toHaveTextContent("hovering");
    expect(screen.getByLabelText("selected")).toHaveTextContent("none");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("selects the focused page element with Enter", () => {
    const target = document.createElement("button");
    target.dataset.name = "keyboard";
    document.body.append(target);
    render(<Harness />);
    target.focus();

    fireEvent.keyDown(document, { key: "Enter" });

    expect(screen.getByLabelText("phase")).toHaveTextContent("selected");
    expect(screen.getByLabelText("selected")).toHaveTextContent("keyboard");
  });
});
