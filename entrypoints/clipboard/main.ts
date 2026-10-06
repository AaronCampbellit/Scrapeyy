import { extensionBrowser } from "../../src/platform/browser-api";
import { CLIPBOARD_IMAGE_MESSAGE, CLIPBOARD_RESULT_MESSAGE, COPIED_NOTICE, writeClipboardImage } from "../../src/platform/image-clipboard";
import { CAPTURE_VERSION } from "../../src/platform/screenshot-messages";
import "./style.css";

const id = new URLSearchParams(location.search).get("copy");
void (async () => {
  if (!id) return;
  try {
    const value = await extensionBrowser.runtime.sendMessage({ type: CLIPBOARD_IMAGE_MESSAGE, id }) as { png?: string; version?: string };
    if (value?.version !== CAPTURE_VERSION || !value.png?.startsWith("data:image/png;base64,")) {
      throw new Error("No PNG screenshot is available to copy.");
    }
    const image = await fetch(value.png).then((response) => response.blob());
    const deadline = Date.now() + 2_000;
    while (!document.hasFocus() && Date.now() < deadline) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    await writeClipboardImage(image);
    const notice = document.querySelector('[role="status"]');
    if (notice) notice.textContent = COPIED_NOTICE;
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
    await extensionBrowser.runtime.sendMessage({ type: CLIPBOARD_RESULT_MESSAGE, id, status: "copied", version: CAPTURE_VERSION });
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : "Could not copy the screenshot.";
    const notice = document.querySelector('[role="status"]');
    if (notice) notice.textContent = error;
    try {
      await extensionBrowser.runtime.sendMessage({ type: CLIPBOARD_RESULT_MESSAGE, id, error });
    } catch { /* The background may have been reloaded during copying. */ }
  }
})();
