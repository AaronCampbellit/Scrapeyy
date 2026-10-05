import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  runtime: { getURL: vi.fn(() => "moz-extension://scrapeyy/preview.html") },
  windows: { create: vi.fn().mockResolvedValue({ id: 42 }) },
}));
vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: api }));

import { openCapturePreview } from "../../src/platform/preview-window";

it("opens a separate window carrying only the encoded capture ID and current view", async () => {
  await openCapturePreview("run & #? /", "screenshot");
  const options = api.windows.create.mock.calls[0]![0];
  const url = new URL(options.url);
  expect(url.pathname).toBe("/preview.html");
  expect(url.searchParams.get("run")).toBe("run & #? /");
  expect(url.searchParams.get("view")).toBe("screenshot");
  expect(options).toMatchObject({ type: "popup", width: 1100, height: 800 });
});

it("propagates window creation failures to the inbox", async () => {
  api.windows.create.mockRejectedValueOnce(new Error("Could not open window"));
  await expect(openCapturePreview("run-1", "text")).rejects.toThrow(
    "Could not open window",
  );
});
