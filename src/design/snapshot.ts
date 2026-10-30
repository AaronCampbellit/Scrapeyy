import { collectAssetReferences, type AssetReference } from "./assets";
import { sanitizeElement } from "./sanitize";
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

function parseSanitizedRoot(html: string): Element {
  const template = document.createElement("template");
  template.innerHTML = html;
  const root = template.content.firstElementChild;
  if (!root) {
    throw new Error("The selected element could not be sanitized");
  }
  return root;
}

export async function createDesignSnapshot(
  element: Element,
): Promise<DesignSnapshot> {
  const root = parseSanitizedRoot(sanitizeElement(element));
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
