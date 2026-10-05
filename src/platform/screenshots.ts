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

export interface ScreenshotUiVisibility {
  hide(): Promise<void>;
  show(): Promise<void>;
}

export interface FullPageMetrics {
  documentWidth: number;
  documentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
}

export interface FullPageScreenshotTile {
  dataUrl: string;
  x: number;
  y: number;
  clipLeft?: number;
  clipTop?: number;
}

export interface FullPageCaptureController {
  prepare(): Promise<FullPageMetrics>;
  measure?(): Promise<FullPageMetrics>;
  scrollTo(
    x: number,
    y: number,
    tileIndex: number,
  ): Promise<{ x: number; y: number }>;
  restore(): Promise<void>;
}

export interface FullPageImageStitcher {
  stitch(
    metrics: FullPageMetrics,
    tiles: FullPageScreenshotTile[],
  ): Promise<Blob>;
}

interface FullPageScreenshotDependencies {
  api?: ScreenshotApi;
  stitcher?: FullPageImageStitcher;
  wait?: (delayMs: number) => Promise<void>;
}

const MAX_CANVAS_DIMENSION = 32_767;
const MAX_CANVAS_PIXELS = 268_000_000;
const CAPTURE_INTERVAL_MS = 550;

const defaultApi: ScreenshotApi = {
  async getTab(tabId) {
    const tab = await extensionBrowser.tabs.get(tabId);
    if (!tab.active) throw new Error("Keep the page selected until the screenshot finishes.");
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

const offscreenStitcher: FullPageImageStitcher = {
  async stitch(metrics, tiles) {
    if (tiles.length === 0) {
      throw new Error("No screenshot tiles were captured");
    }
    const firstSource = await fetch(tiles[0]!.dataUrl).then((response) =>
      response.blob(),
    );
    const firstImage = await createImageBitmap(firstSource);
    const scaleX = firstImage.width / metrics.viewportWidth;
    const scaleY = firstImage.height / metrics.viewportHeight;
    const canvasWidth = Math.round(metrics.documentWidth * scaleX);
    const canvasHeight = Math.round(metrics.documentHeight * scaleY);
    if (
      canvasWidth > MAX_CANVAS_DIMENSION ||
      canvasHeight > MAX_CANVAS_DIMENSION ||
      canvasWidth * canvasHeight > MAX_CANVAS_PIXELS
    ) {
      firstImage.close();
      throw new Error(
        "This page is too large for a single full-page screenshot. Capture a smaller region instead.",
      );
    }
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext("2d");
    if (!context) {
      firstImage.close();
      throw new Error("Screenshot canvas is unavailable");
    }

    const drawTile = (image: ImageBitmap, tile: FullPageScreenshotTile) => {
      const sourceX = Math.round((tile.clipLeft ?? 0) * scaleX);
      const sourceY = Math.round((tile.clipTop ?? 0) * scaleY);
      const sourceWidth = Math.min(
        image.width - sourceX,
        Math.round((metrics.documentWidth - tile.x) * scaleX) - sourceX,
      );
      const sourceHeight = Math.min(
        image.height - sourceY,
        Math.round((metrics.documentHeight - tile.y) * scaleY) - sourceY,
      );
      if (sourceWidth <= 0 || sourceHeight <= 0) return;
      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        Math.round(tile.x * scaleX) + sourceX,
        Math.round(tile.y * scaleY) + sourceY,
        sourceWidth,
        sourceHeight,
      );
    };

    drawTile(firstImage, tiles[0]!);
    firstImage.close();
    for (const tile of tiles.slice(1)) {
      const source = await fetch(tile.dataUrl).then((response) =>
        response.blob(),
      );
      const image = await createImageBitmap(source);
      try {
        drawTile(image, tile);
      } finally {
        image.close();
      }
    }
    return canvas.convertToBlob({ type: "image/png" });
  },
};

function validFullPageMetrics(metrics: FullPageMetrics): boolean {
  return Object.values(metrics).every(
    (value) => Number.isFinite(value) && value > 0,
  );
}

export async function captureFullPageScreenshot(
  tabId: number,
  controller: FullPageCaptureController,
  dependencies: FullPageScreenshotDependencies = {},
): Promise<Blob> {
  const api = dependencies.api ?? defaultApi;
  const stitcher = dependencies.stitcher ?? offscreenStitcher;
  const wait =
    dependencies.wait ??
    ((delayMs: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, delayMs)));
  let prepared = false;
  try {
    prepared = true;
    let metrics = await controller.prepare();
    if (!validFullPageMetrics(metrics)) {
      throw new Error("The page reported invalid full-page dimensions");
    }
    let scaleX = 1;
    let scaleY = 1;
    const checkSize = () => {
      if (metrics.documentWidth * scaleX > MAX_CANVAS_DIMENSION ||
          metrics.documentHeight * scaleY > MAX_CANVAS_DIMENSION ||
          metrics.documentWidth * scaleX * metrics.documentHeight * scaleY > MAX_CANVAS_PIXELS) {
        throw new Error("This page is too large for a single full-page screenshot. Capture a smaller region instead.");
      }
    };
    const measure = async () => {
      if (controller.measure) {
        const next = await controller.measure();
        if (!validFullPageMetrics(next) || next.viewportWidth !== metrics.viewportWidth || next.viewportHeight !== metrics.viewportHeight ||
            next.documentWidth + 1 < metrics.documentWidth || next.documentHeight + 1 < metrics.documentHeight) {
          throw new Error("The page layout changed during the screenshot. Keep the window size unchanged and try again.");
        }
        metrics = next;
      }
      checkSize();
    };
    checkSize();
    await api.getTab(tabId);
    const tiles: FullPageScreenshotTile[] = [];
    let tileIndex = 0;
    for (let y = 0; y < metrics.documentHeight; y += metrics.viewportHeight) {
      for (let x = 0; x < metrics.documentWidth; x += metrics.viewportWidth) {
        if (tileIndex >= 100) throw new Error("This page keeps growing or needs too many screenshot tiles. Capture a smaller region instead.");
        let position = await controller.scrollTo(x, y, tileIndex);
        if (tiles.length > 0) await wait(CAPTURE_INTERVAL_MS);
        await measure();
        let expectedX = Math.min(x, Math.max(0, metrics.documentWidth - metrics.viewportWidth));
        let expectedY = Math.min(y, Math.max(0, metrics.documentHeight - metrics.viewportHeight));
        // Loading content can move the bottom boundary after the browser clamps
        // a scroll. Retry against the refreshed dimensions before rejecting it.
        for (let attempt = 0; attempt < 2 &&
             (Math.abs(position.x - expectedX) > 1 || Math.abs(position.y - expectedY) > 1); attempt++) {
          position = await controller.scrollTo(x, y, tileIndex);
          await measure();
          expectedX = Math.min(x, Math.max(0, metrics.documentWidth - metrics.viewportWidth));
          expectedY = Math.min(y, Math.max(0, metrics.documentHeight - metrics.viewportHeight));
        }
        if (!Number.isFinite(position.x) || !Number.isFinite(position.y) ||
            Math.abs(position.x - expectedX) > 1 || Math.abs(position.y - expectedY) > 1) {
          throw new Error("The page could not scroll to all its content. Full-page screenshot was stopped to avoid saving an incomplete image.");
        }
        const tab = await api.getTab(tabId);
        const dataUrl = await api.captureVisibleTab(tab.windowId);
        await api.getTab(tabId);
        // Check high-DPI canvas limits after tile one, before capturing the rest.
        if (tiles.length === 0 && !dependencies.stitcher) {
          const image = await createImageBitmap(await fetch(dataUrl).then((response) => response.blob()));
          scaleX = image.width / metrics.viewportWidth;
          scaleY = image.height / metrics.viewportHeight;
          image.close();
          checkSize();
        }
        tiles.push({
          dataUrl,
          x: position.x,
          y: position.y,
          ...(x > position.x ? { clipLeft: x - position.x } : {}),
          ...(y > position.y ? { clipTop: y - position.y } : {}),
        });
        tileIndex += 1;
        await measure();
      }
    }
    return await stitcher.stitch(metrics, tiles);
  } finally {
    if (prepared) await controller.restore();
  }
}

export async function captureElementScreenshot(
  tabId: number,
  bounds: ElementBounds,
  api: ScreenshotApi = defaultApi,
  cropper: ImageCropper = offscreenCropper,
  uiVisibility?: ScreenshotUiVisibility,
): Promise<Blob | undefined> {
  if (
    !Number.isFinite(bounds.left) ||
    !Number.isFinite(bounds.top) ||
    !Number.isFinite(bounds.viewportWidth) ||
    !Number.isFinite(bounds.viewportHeight) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    bounds.viewportWidth <= 0 ||
    bounds.viewportHeight <= 0
  ) {
    return undefined;
  }
  let uiHidden = false;
  try {
    const tab = await api.getTab(tabId);
    if (uiVisibility) {
      await uiVisibility.hide();
      uiHidden = true;
    }
    const dataUrl = await api.captureVisibleTab(tab.windowId);
    await api.getTab(tabId);
    return await cropper.crop(dataUrl, bounds);
  } catch {
    return undefined;
  } finally {
    if (uiHidden) {
      await uiVisibility?.show().catch(() => undefined);
    }
  }
}

export async function captureVisibleScreenshot(
  tabId: number,
  uiVisibility?: ScreenshotUiVisibility,
  api: ScreenshotApi = defaultApi,
): Promise<Blob> {
  let hidden = false;
  try {
    if (uiVisibility) { await uiVisibility.hide(); hidden = true; }
    const tab = await api.getTab(tabId);
    const url = await api.captureVisibleTab(tab.windowId);
    await api.getTab(tabId);
    return await fetch(url).then((response) => response.blob());
  } finally {
    if (hidden) await uiVisibility?.show();
  }
}
