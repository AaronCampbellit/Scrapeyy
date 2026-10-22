import { extensionBrowser } from "../platform/browser-api";
import { blobDataUrl } from "../platform/downloads";
import { MAX_BYTES } from "./format";

export const SESSION_DOWNLOAD_ERROR = "The session file could not be saved. Try exporting again and complete the browser's Save As dialog.";

// Called only by the background process. Its Blob URL must outlive the popup.
export async function handleSessionDownload(
  message: Record<string, unknown>,
  sender: { id?: string; url?: string },
): Promise<{ ok: boolean }> {
  if (sender.id !== extensionBrowser.runtime.id || sender.url !== extensionBrowser.runtime.getURL("/popup.html") ||
      typeof message.text !== "string" || !message.text.length ||
      new TextEncoder().encode(message.text).length > MAX_BYTES * 2 ||
      (message.protection !== "encrypted" && message.protection !== "plaintext")) return { ok: false };

  let objectUrl: string | undefined;
  try {
    const blob = new Blob([message.text], { type: "application/json" });
    // Firefox MV2 has a background document; Chrome MV3's service worker does not.
    const url = typeof URL.createObjectURL === "function"
      ? (objectUrl = URL.createObjectURL(blob)) : await blobDataUrl(blob);
    const api = extensionBrowser.downloads;
    const id = await api.download({ url,
      filename: `scrapeyy-session-${message.protection === "encrypted" ? "encrypted" : "PLAINTEXT"}-${Date.now()}.json`,
      saveAs: true, conflictAction: "uniquify" });
    if (!Number.isInteger(id)) return { ok: false };
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (success: boolean) => {
        if (settled) return;
        settled = true;
        api.onChanged.removeListener(changed);
        if (success) resolve(); else reject(new Error(SESSION_DOWNLOAD_ERROR));
      };
      const check = async () => {
        try {
          const [item] = await api.search({ id });
          if (!item || item.state === "interrupted") finish(false);
          else if (item.state === "complete") finish(item.exists !== false);
        } catch { finish(false); }
      };
      const changed = (delta: { id: number }) => { if (delta.id === id) void check(); };
      api.onChanged.addListener(changed);
      // Also handles completion before download() resolved or the listener was attached.
      void check();
    });
    return { ok: true };
  } catch {
    // Browser errors can echo the entire URL, including plaintext session secrets.
    return { ok: false };
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}
