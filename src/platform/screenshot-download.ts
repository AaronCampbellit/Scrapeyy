import { extensionBrowser } from "./browser-api";
import { CAPTURE_VERSION, type ScreenshotSaved } from "./screenshot-messages";
import { blobDataUrl, type DownloadApi } from "./downloads";

interface DownloadItem {
  state: string;
  filename: string;
  error?: string | undefined;
  exists?: boolean | undefined;
}
type DownloadListener = (change: { id: number }) => void;
export interface ScreenshotDownloadApi extends DownloadApi {
  search(query: { id: number }): Promise<DownloadItem[]>;
  onChanged: {
    addListener(listener: DownloadListener): void;
    removeListener(listener: DownloadListener): void;
  };
}

export async function downloadScreenshot(
  image: Blob,
  filename: string,
  saveAs: boolean,
  api: ScreenshotDownloadApi = extensionBrowser.downloads,
): Promise<ScreenshotSaved> {
  const objectUrlSupported = typeof URL.createObjectURL === "function";
  const url = objectUrlSupported ? URL.createObjectURL(image) : await blobDataUrl(image);
  try {
    const downloadId = await api.download({ url, filename, saveAs, conflictAction: "uniquify" });
    if (!Number.isInteger(downloadId)) throw new Error("The browser did not start the screenshot download.");
    const saved = await new Promise<DownloadItem>((resolve, reject) => {
      let settled = false;
      const finish = (item?: DownloadItem, error?: Error) => {
        if (settled) return;
        settled = true;
        api.onChanged.removeListener(changed);
        if (error) reject(error);
        else resolve(item!);
      };
      const check = async () => {
        try {
          const [item] = await api.search({ id: downloadId });
          if (!item) finish(undefined, new Error("The screenshot download is no longer available. Try again."));
          else if (item.state === "interrupted" || (item.state === "complete" && item.exists === false)) {
            finish(undefined, new Error(`Screenshot was not saved: ${item.error || "download cancelled or file removed"}.`));
          } else if (item.state === "complete") finish(item);
        } catch (error) {
          finish(undefined, error instanceof Error ? error : new Error("Unable to confirm the screenshot download."));
        }
      };
      const changed: DownloadListener = (change) => { if (change.id === downloadId) void check(); };
      api.onChanged.addListener(changed);
      // Also covers a download that completed before the listener was registered.
      void check();
    });
    return { status: "saved", version: CAPTURE_VERSION, downloadId, filename: saved.filename };
  } finally {
    if (objectUrlSupported) URL.revokeObjectURL(url);
  }
}
