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
    Reflect.deleteProperty(document, "elementsFromPoint");
  });

  it("selects a short-clicked page element and blocks its page action", () => {
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

  it("selects the smallest shared container enclosing a dragged area", () => {
    const container = document.createElement("section");
    container.dataset.name = "container";
    const first = document.createElement("span");
    first.dataset.name = "first";
    const second = document.createElement("span");
    second.dataset.name = "second";
    container.append(first, second);
    document.body.append(container);
    vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 220,
      bottom: 120,
      width: 220,
      height: 120,
      toJSON: () => ({}),
    });
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: (x: number) =>
        x < 100
          ? [first, container, document.body, document.documentElement]
          : [second, container, document.body, document.documentElement],
    });
    render(<Harness />);

    fireEvent.pointerDown(first, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
    });
    fireEvent.pointerMove(second, {
      buttons: 1,
      clientX: 190,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerUp(second, {
      button: 0,
      clientX: 190,
      clientY: 100,
      pointerId: 1,
    });

    expect(screen.getByLabelText("phase")).toHaveTextContent("selected");
    expect(screen.getByLabelText("selected")).toHaveTextContent("container");
  });

  it("does not promote a middle-page drag to the whole page when samples hit whitespace", () => {
    const container = document.createElement("section");
    container.dataset.name = "middle-content";
    const first = document.createElement("span");
    const second = document.createElement("span");
    container.append(first, second);
    document.body.append(container);
    Object.defineProperty(document, "elementsFromPoint", {
      configurable: true,
      value: (x: number) =>
        x < 50
          ? [document.body, document.documentElement]
          : x < 150
            ? [first, container, document.body, document.documentElement]
            : [second, container, document.body, document.documentElement],
    });
    render(<Harness />);

    fireEvent.pointerDown(first, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
    });
    fireEvent.pointerMove(second, {
      buttons: 1,
      clientX: 190,
      clientY: 100,
      pointerId: 1,
    });
    fireEvent.pointerUp(second, {
      button: 0,
      clientX: 190,
      clientY: 100,
      pointerId: 1,
    });

    expect(screen.getByLabelText("selected")).toHaveTextContent("middle-content");
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
    expect(screen.getByLabelText("phase")).toHaveTextContent("selecting");
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
