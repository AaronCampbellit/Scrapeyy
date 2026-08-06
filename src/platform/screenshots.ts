import { extensionBrowser } from "./browser-api";

export interface ElementBounds {
  left: number;
  top: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface ScreenshotApi {
  getTab(tabId: number): Promise<{ windowId?: number }>;
  captureVisibleTab(windowId?: number): Promise<string>;
}

export interface ImageCropper {
  crop(dataUrl: string, bounds: ElementBounds): Promise<Blob>;
}

const defaultApi: ScreenshotApi = {
  async getTab(tabId) {
    const tab = await extensionBrowser.tabs.get(tabId);
    return tab.windowId === undefined ? {} : { windowId: tab.windowId };
  },
  captureVisibleTab: (windowId) =>
    windowId === undefined
      ? extensionBrowser.tabs.captureVisibleTab({ format: "png" })
      : extensionBrowser.tabs.captureVisibleTab(windowId, { format: "png" }),
};

const offscreenCropper: ImageCropper = {
  async crop(dataUrl, bounds) {
    const source = await fetch(dataUrl).then((response) => response.blob());
    const image = await createImageBitmap(source);
    const scaleX = image.width / bounds.viewportWidth;
    const scaleY = image.height / bounds.viewportHeight;
    const sourceX = Math.max(0, Math.round(bounds.left * scaleX));
    const sourceY = Math.max(0, Math.round(bounds.top * scaleY));
    const sourceWidth = Math.min(
      image.width - sourceX,
      Math.round(bounds.width * scaleX),
    );
    const sourceHeight = Math.min(
      image.height - sourceY,
      Math.round(bounds.height * scaleY),
    );
    if (sourceWidth < 1 || sourceHeight < 1) {
      image.close();
      throw new Error("Selected element is outside the visible viewport");
    }
    const canvas = new OffscreenCanvas(sourceWidth, sourceHeight);
    const context = canvas.getContext("2d");
    if (!context) {
      image.close();
      throw new Error("Screenshot canvas is unavailable");
    }
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight,
    );
    image.close();
    return canvas.convertToBlob({ type: "image/png" });
  },
};

export async function captureElementScreenshot(
  tabId: number,
  bounds: ElementBounds,
  api: ScreenshotApi = defaultApi,
  cropper: ImageCropper = offscreenCropper,
): Promise<Blob | undefined> {
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    bounds.viewportWidth <= 0 ||
    bounds.viewportHeight <= 0
  ) {
    return undefined;
  }
  try {
    const tab = await api.getTab(tabId);
    const dataUrl = await api.captureVisibleTab(tab.windowId);
    return await cropper.crop(dataUrl, bounds);
  } catch {
    return undefined;
  }
}
