import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { CaptureMode } from "../../src/contracts/models";
import { CaptureOptions } from "../../src/features/shared/CaptureOptions";
import { CaptureView } from "../../src/features/popup/CaptureView";
import { selectionBounds } from "../../src/features/picker/ScreenshotSelection";
import { DEFAULT_APP_SETTINGS } from "../../src/storage/app-settings";

describe("capture tools", () => {
  it("allows either capture purpose or both and always keeps one selected", async () => {
    function Harness() {
      const [mode, setMode] = useState<CaptureMode>("both");
      return <CaptureOptions mode={mode} onChange={setMode} />;
    }
    render(<Harness />);
    const user = userEvent.setup();
    const content = screen.getByRole("checkbox", { name: "Content" });
    const design = screen.getByRole("checkbox", { name: "Design & Code" });
    await user.click(design);
    expect(content).toBeChecked();
    expect(content).toBeDisabled();
    expect(design).not.toBeChecked();
    await user.click(design);
    await user.click(content);
    expect(design).toBeChecked();
    expect(design).toBeDisabled();
    expect(content).not.toBeChecked();
  });

  it("routes all three screenshot actions independently of capture", async () => {
    const screenshot = vi.fn();
    render(<CaptureView settings={DEFAULT_APP_SETTINGS} onScreenshotDestinationChange={vi.fn()} disabled={false} site={{ origin: "https://example.test", access: "one-time" }}
      onScreenshot={screenshot} onCreateRecipe={vi.fn()} onQuickCapture={vi.fn()}
      onInspectVideos={vi.fn()} onDownloadVideo={vi.fn()} onExportVideoDetails={vi.fn()} />);
    const user = userEvent.setup();
    for (const name of ["Visible page", "Full page", "Draw selection"]) await user.click(screen.getByRole("button", { name }));
    expect(screenshot.mock.calls).toEqual([["visible"], ["full-page"], ["selection"]]);
  });

  it("only offers downloads for exposed direct video files", () => {
    render(<CaptureView settings={DEFAULT_APP_SETTINGS} onScreenshotDestinationChange={vi.fn()} disabled={false} site={{ origin: "https://example.test", access: "one-time" }}
      onScreenshot={vi.fn()} onCreateRecipe={vi.fn()} onQuickCapture={vi.fn()}
      onInspectVideos={vi.fn()} onDownloadVideo={vi.fn()} onExportVideoDetails={vi.fn()}
      videos={{ pageUrl: "https://example.test", notes: [], videos: [{
        title: "Demo", width: 0, height: 0, duration: null, captions: [], sources: [
          { url: "https://cdn.test/demo.mp4", kind: "file", type: "" },
          { url: "https://cdn.test/demo.m3u8", kind: "stream", type: "" },
        ],
      }] }} />);
    expect(screen.getAllByRole("button", { name: "Download video" })).toHaveLength(1);
    expect(screen.getByText("Streaming playlist")).toBeVisible();
  });

  it("normalizes reverse drawing and clamps the selection to the viewport", () => {
    expect(selectionBounds({ x: 500, y: 400 }, { x: -20, y: 100 }, 800, 600)).toEqual({
      left: 0, top: 100, width: 500, height: 300, viewportWidth: 800, viewportHeight: 600,
    });
  });
});
