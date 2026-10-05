import { extensionBrowser } from "./browser-api";

export type PreviewType = "text" | "screenshot";

export async function openCapturePreview(
  runId: string,
  preview: PreviewType,
): Promise<void> {
  const url = new URL(extensionBrowser.runtime.getURL("/preview.html"));
  url.searchParams.set("run", runId);
  url.searchParams.set("view", preview);
  await extensionBrowser.windows.create({
    url: url.href,
    type: "popup",
    width: 1100,
    height: 800,
  });
}
