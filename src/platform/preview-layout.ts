export type PreviewType = "text" | "screenshot";

export function previewPaneWidth(imageWidth?: number, availableWidth = 800): number {
  const limit = Math.max(320, Math.min(780, availableWidth - 20));
  const desired = imageWidth && Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth + 32 : 720;
  return Math.min(limit, Math.max(420, desired));
}
