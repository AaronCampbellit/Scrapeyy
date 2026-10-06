// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { copyScreenshotToClipboard, writeClipboardImage } from "../../src/platform/image-clipboard";
import { CAPTURE_VERSION } from "../../src/platform/screenshot-messages";

vi.mock("../../src/platform/browser-api", () => ({ extensionBrowser: {} }));
afterEach(() => vi.unstubAllGlobals());
const png = () => new Blob(["png bytes"], { type: "image/png" });
const runtime = () => ({ sendMessage: vi.fn(async () => ({ status: "copied", version: CAPTURE_VERSION })) });

it("writes encoded PNG bytes through Firefox's native image clipboard API", async () => {
  const setImageData = vi.fn(async (_image: ArrayBuffer, _type: "png") => {});
  await copyScreenshotToClipboard(png(), { clipboard: { setImageData }, runtime: runtime() });
  expect(new TextDecoder().decode(setImageData.mock.calls[0]![0])).toBe("png bytes");
  expect(setImageData).toHaveBeenCalledWith(expect.any(ArrayBuffer), "png");
});

it("copies a PNG ClipboardItem from an extension document", async () => {
  const write = vi.fn(async () => {});
  const items: Record<string, Blob>[] = [];
  vi.stubGlobal("navigator", { clipboard: { write } });
  vi.stubGlobal("ClipboardItem", class { constructor(value: Record<string, Blob>) { items.push(value); } });
  vi.stubGlobal("document", {});
  const image = png();
  await copyScreenshotToClipboard(image, { runtime: runtime() });
  expect(items).toEqual([{ "image/png": image }]);
  expect(write).toHaveBeenCalledTimes(1);
});

function windowApi(results: Record<string, unknown>[] = [{ status: "copied", version: CAPTURE_VERSION }]) {
  const events: string[] = [];
  let listener: ((message: unknown) => Promise<unknown> | undefined) | undefined;
  const api = {
    windows: {
      create: vi.fn(async ({ url }: { url: string }) => {
        events.push("open");
        const id = new URL(url).searchParams.get("copy");
        const image = await listener!({ type: "SCRAPEYY_CLIPBOARD_IMAGE", id }) as { png: string };
        expect(image.png).toBe("data:image/png;base64,cG5nIGJ5dGVz");
        events.push("write");
        void listener!({ type: "SCRAPEYY_CLIPBOARD_RESULT", id, ...(results.shift() ?? { status: "copied", version: CAPTURE_VERSION }) });
        return { id: 10 };
      }),
      remove: vi.fn(async () => { events.push("close"); }),
    },
    runtime: {
      ...runtime(),
      getURL: () => "chrome-extension://scrapeyy/clipboard.html",
      onMessage: {
        addListener: vi.fn((value: typeof listener) => { listener = value; }),
        removeListener: vi.fn(() => { listener = undefined; }),
      },
    },
  };
  return { api, events };
}

it("serializes Chrome background writes and closes each copy window after confirmation", async () => {
  const { api, events } = windowApi();
  await Promise.all([copyScreenshotToClipboard(png(), api), copyScreenshotToClipboard(png(), api)]);
  expect(events).toEqual(["open", "write", "close", "open", "write", "close"]);
  expect(api.windows.create).toHaveBeenCalledWith(expect.objectContaining({ focused: true, type: "popup" }));
  expect(api.runtime.onMessage.removeListener).toHaveBeenCalledTimes(2);
});

it("reports a denied write, cleans up, and allows the next copy to succeed", async () => {
  const { api } = windowApi([{ error: "Clipboard access denied" }]);
  await expect(copyScreenshotToClipboard(png(), api)).rejects.toThrow("Clipboard access denied");
  expect(api.windows.remove).toHaveBeenCalledTimes(1);
  await expect(copyScreenshotToClipboard(png(), api)).resolves.toBeUndefined();
});

it("rejects empty, non-PNG, unavailable, and unconfirmed clipboard writes", async () => {
  await expect(writeClipboardImage(new Blob(), { runtime: runtime() })).rejects.toThrow("No PNG");
  await expect(writeClipboardImage(new Blob(["jpeg"], { type: "image/jpeg" }), { runtime: runtime() })).rejects.toThrow("No PNG");
  await expect(writeClipboardImage(png(), { runtime: runtime() })).rejects.toThrow("unavailable");
  const { api } = windowApi([{ status: "copied", version: "old" }]);
  await expect(copyScreenshotToClipboard(png(), api)).rejects.toThrow("did not confirm");
  expect(api.windows.remove).toHaveBeenCalledOnce();
});
