import { collectAssetReferences, type AssetReference } from "./assets";
import { sanitizeElementFragment } from "./sanitize";
import { collectComputedStyles } from "./styles";

export interface DesignSnapshot {
  html: string;
  css: string;
  width: number;
  height: number;
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
  assets: AssetReference[];
  screenshot?: Blob;
}

export async function createDesignSnapshot(
  element: Element,
): Promise<DesignSnapshot> {
  const root = sanitizeElementFragment(element).firstElementChild;
  if (!root) throw new Error("The selected element could not be sanitized");
  const css = collectComputedStyles(element, root);
  const bounds = element.getBoundingClientRect();
  return {
    html: root.outerHTML,
    css,
    width: bounds.width,
    height: bounds.height,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
    },
    assets: collectAssetReferences(element),
  };
}
