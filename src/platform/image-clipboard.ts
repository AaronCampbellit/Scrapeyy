import { extensionBrowser } from "./browser-api";
import { blobDataUrl } from "./downloads";
import { CAPTURE_VERSION } from "./screenshot-messages";

export const CLIPBOARD_IMAGE_MESSAGE = "SCRAPEYY_CLIPBOARD_IMAGE";
export const CLIPBOARD_RESULT_MESSAGE = "SCRAPEYY_CLIPBOARD_RESULT";
export const COPIED_NOTICE = "Screenshot copied — ready to paste.";

interface ImageClipboardApi {
  clipboard?: { setImageData(image: ArrayBuffer, type: "png"): Promise<void> };
  windows?: {
    create(options: { url: string; type: "popup"; focused: boolean; width: number; height: number }): Promise<{ id?: number | undefined } | undefined>;
    remove(windowId: number): Promise<void>;
  };
  runtime: {
    getURL?(path: string): string;
    onMessage?: {
      addListener(listener: (message: unknown) => Promise<unknown> | undefined): void;
      removeListener(listener: (message: unknown) => Promise<unknown> | undefined): void;
    };
    sendMessage(message: unknown): Promise<unknown>;
  };
}

let pendingCopy: Promise<void> = Promise.resolve();

function assertPng(image: Blob): void {
  if (image.type !== "image/png" || image.size === 0) {
    throw new Error("No PNG screenshot is available to copy.");
  }
}

/** Writes encoded PNG data from Firefox or a focused Chrome extension document. */
export async function writeClipboardImage(
  image: Blob,
  api: ImageClipboardApi = extensionBrowser,
): Promise<void> {
  assertPng(image);
  if (api.clipboard?.setImageData) {
    await api.clipboard.setImageData(await image.arrayBuffer(), "png");
    return;
  }
  if (typeof navigator === "undefined" || !navigator.clipboard?.write ||
      typeof ClipboardItem === "undefined") {
    throw new Error("Image copying is unavailable in this browser. Save the PNG instead.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": image })]);
}

/** Chrome's async clipboard requires focus; a short-lived window needs no extra click. */
export function copyScreenshotToClipboard(
  image: Blob,
  api: ImageClipboardApi = extensionBrowser,
): Promise<void> {
  const copy = async () => {
    assertPng(image);
    if (api.clipboard?.setImageData || typeof document !== "undefined") {
      await writeClipboardImage(image, api);
      return;
    }
    const messages = api.runtime.onMessage;
    if (!api.windows || !messages || !api.runtime.getURL) {
      throw new Error("Reload Scrapeyy to enable image copying.");
    }
    const id = crypto.randomUUID();
    const png = await blobDataUrl(image);
    let resolveCopy!: () => void;
    let rejectCopy!: (error: Error) => void;
    const complete = new Promise<void>((resolve, reject) => {
      resolveCopy = resolve;
      rejectCopy = reject;
    });
    // The window may be closed before it loads; attach a handler immediately.
    void complete.catch(() => {});
    const listener = (message: unknown): Promise<unknown> | undefined => {
      if (!message || typeof message !== "object") return undefined;
      const value = message as Record<string, unknown>;
      if (value.id !== id) return undefined;
      if (value.type === CLIPBOARD_IMAGE_MESSAGE) return Promise.resolve({ png, version: CAPTURE_VERSION });
      if (value.type !== CLIPBOARD_RESULT_MESSAGE) return undefined;
      if (value.status === "copied" && value.version === CAPTURE_VERSION) resolveCopy();
      else rejectCopy(new Error(typeof value.error === "string" ? value.error : "The browser did not confirm the image copy."));
      return Promise.resolve({ received: true });
    };
    messages.addListener(listener);
    const timeout = setTimeout(() => rejectCopy(new Error("The image copy did not finish. Try again and keep the copy window open.")), 15_000);
    let windowId: number | undefined;
    try {
      const url = new URL(api.runtime.getURL("/clipboard.html"));
      url.searchParams.set("copy", id);
      const created = await api.windows.create({ url: url.href, type: "popup", focused: true, width: 420, height: 180 });
      if (created?.id === undefined) throw new Error("The browser could not open the image copy window.");
      windowId = created.id;
      await complete;
    } finally {
      clearTimeout(timeout);
      messages.removeListener(listener);
      // Closing an already-dismissed window must not replace the copy result.
      if (windowId !== undefined) await api.windows.remove(windowId).catch(() => {});
    }
  };
  const result = pendingCopy.then(copy);
  pendingCopy = result.catch(() => {});
  return result;
}
