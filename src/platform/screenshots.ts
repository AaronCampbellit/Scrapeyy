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
}

export interface FullPageCaptureController {
  prepare(): Promise<FullPageMetrics>;
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
      const sourceWidth = Math.min(
        image.width,
        Math.round((metrics.documentWidth - tile.x) * scaleX),
      );
      const sourceHeight = Math.min(
        image.height,
        Math.round((metrics.documentHeight - tile.y) * scaleY),
      );
      if (sourceWidth <= 0 || sourceHeight <= 0) return;
      context.drawImage(
        image,
        0,
        0,
        sourceWidth,
        sourceHeight,
        Math.round(tile.x * scaleX),
        Math.round(tile.y * scaleY),
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

function captureStops(documentSize: number, viewportSize: number): number[] {
  const stops: number[] = [];
  for (let position = 0; position < documentSize; position += viewportSize) {
    stops.push(position);
  }
  return stops.length > 0 ? stops : [0];
}

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
    const metrics = await controller.prepare();
    if (!validFullPageMetrics(metrics)) {
      throw new Error("The page reported invalid full-page dimensions");
    }
    if (
      metrics.documentWidth > MAX_CANVAS_DIMENSION ||
      metrics.documentHeight > MAX_CANVAS_DIMENSION ||
      metrics.documentWidth * metrics.documentHeight > MAX_CANVAS_PIXELS
    ) {
      throw new Error(
        "This page is too large for a single full-page screenshot. Capture a smaller region instead.",
      );
    }
    const tab = await api.getTab(tabId);
    const xStops = captureStops(metrics.documentWidth, metrics.viewportWidth);
    const yStops = captureStops(metrics.documentHeight, metrics.viewportHeight);
    const tiles: FullPageScreenshotTile[] = [];
    const capturedPositions = new Set<string>();
    let tileIndex = 0;
    for (const y of yStops) {
      for (const x of xStops) {
        const position = await controller.scrollTo(x, y, tileIndex);
        const key = `${position.x}:${position.y}`;
        if (capturedPositions.has(key)) continue;
        capturedPositions.add(key);
        if (tiles.length > 0) await wait(CAPTURE_INTERVAL_MS);
        tiles.push({
          dataUrl: await api.captureVisibleTab(tab.windowId),
          x: position.x,
          y: position.y,
        });
        tileIndex += 1;
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
    return await cropper.crop(dataUrl, bounds);
  } catch {
    return undefined;
  } finally {
    if (uiHidden) {
      await uiVisibility?.show().catch(() => undefined);
    }
  }
}
