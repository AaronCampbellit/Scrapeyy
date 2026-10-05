import { StrictMode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import {
  PreviewApp,
  type PreviewCapture,
  type PreviewServices,
} from "../../src/features/preview/PreviewApp";

const capture: PreviewCapture = {
  title: "Screenshot · Example page",
  theme: "dark",
  screenshot: new Blob(["png"], { type: "image/png" }),
  run: {
    id: "run-1",
    recipeId: "recipe-1",
    projectId: "project-1",
    trigger: "manual",
    status: "success",
    startedAt: "2026-10-05T17:22:45.128Z",
    recordCount: 1,
    records: [{ text: "Saved article text <script>" }],
    errors: [],
    pinned: false,
    exportState: "none",
    screenshot: {
      kind: "full-page",
      title: "Example page",
      filename: "example.png",
      sourceUrl: "https://example.test",
    },
  },
};

function services(): PreviewServices {
  return {
    load: vi.fn().mockResolvedValue(capture),
    exportRun: vi.fn().mockResolvedValue(undefined),
  };
}

afterEach(() => vi.unstubAllGlobals());

it("loads the selected capture independently, zooms and exports, and revokes every image URL on close", async () => {
  const createObjectURL = vi
    .fn()
    .mockReturnValueOnce("blob:first")
    .mockReturnValue("blob:second");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
  const api = services();
  const user = userEvent.setup();
  const { unmount } = render(
    <StrictMode>
      <PreviewApp runId="run-1" initialView="screenshot" services={api} />
    </StrictMode>,
  );
  const image = await screen.findByAltText("Captured screenshot");
  expect(api.load).toHaveBeenCalledWith("run-1");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    capture.title,
  );
  Object.defineProperties(image, {
    naturalWidth: { value: 1600 },
    naturalHeight: { value: 5000 },
  });
  fireEvent.load(image);
  expect(screen.getByText("1600 × 5000 px")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Actual size" }));
  expect(image).toHaveStyle({ width: "1600px", maxWidth: "none" });
  await user.click(screen.getByRole("button", { name: "Zoom in" }));
  expect(image).toHaveStyle({ width: "2000px" });
  await user.click(screen.getByRole("button", { name: "Fit width" }));
  expect(image).toHaveStyle({ maxWidth: "100%" });
  await user.click(screen.getByRole("button", { name: "Text" }));
  expect(screen.getByText("Saved article text <script>")).toBeVisible();
  expect(document.querySelector("script")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Save PNG…" }));
  expect(api.exportRun).toHaveBeenCalledWith("run-1");
  expect(await screen.findByText("Screenshot saved to device.")).toBeVisible();
  unmount();
  expect(createObjectURL).toHaveBeenCalled();
  expect(revokeObjectURL.mock.calls.map(([url]) => url)).toEqual(
    createObjectURL.mock.results.map(({ value }) => value),
  );
});

it("explains expired captures and never creates an image URL for them", async () => {
  const api = services();
  vi.mocked(api.load).mockResolvedValue(undefined);
  render(
    <PreviewApp runId="missing" initialView="screenshot" services={api} />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "no longer in the Inbox",
  );
  expect(screen.queryByRole("button", { name: "Save PNG…" })).toBeNull();
});

it("shows capture-load failures and rejects a missing capture ID without querying storage", async () => {
  const api = services();
  vi.mocked(api.load).mockRejectedValue(new Error("Storage unavailable"));
  const { rerender } = render(
    <PreviewApp runId="run-1" initialView="text" services={api} />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Storage unavailable",
  );
  vi.mocked(api.load).mockClear();
  rerender(<PreviewApp runId={null} initialView="text" services={api} />);
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No capture was selected",
  );
  expect(api.load).not.toHaveBeenCalled();
});

it("handles text-only captures, unavailable screenshots and export failures", async () => {
  const api = services();
  const { screenshot: _screenshot, ...textRun } = capture.run;
  vi.mocked(api.load).mockResolvedValue({
    title: "Product cards",
    theme: "light",
    run: {
      ...textRun,
      records: [{ product_name: "Alpha", source_url: "https://example.test" }],
    },
  });
  vi.mocked(api.exportRun).mockRejectedValue(
    new Error("Capture run not found"),
  );
  const user = userEvent.setup();
  render(<PreviewApp runId="run-1" initialView="text" services={api} />);
  expect(await screen.findByText("product name: Alpha")).toBeVisible();
  await user.click(screen.getByRole("button", { name: /^Screenshot$/ }));
  expect(
    screen.getByText("No screenshot was captured for this run."),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: /^Export$/ }));
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Capture run not found",
  );
});

it("reports invalid image bytes instead of leaving a broken screenshot preview", async () => {
  vi.stubGlobal("URL", {
    createObjectURL: () => "blob:broken",
    revokeObjectURL: vi.fn(),
  });
  const api = services();
  render(<PreviewApp runId="run-1" initialView="screenshot" services={api} />);
  fireEvent.error(await screen.findByAltText("Captured screenshot"));
  expect(screen.getByRole("alert")).toHaveTextContent("could not be displayed");
});
