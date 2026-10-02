import { resolveHttpUrl } from "../extraction/normalize";

export interface AssetReference {
  kind: "image" | "font";
  url: string;
}

function srcsetUrls(value: string): string[] {
  return value
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0] ?? "")
    .filter(Boolean);
}

function cssUrls(value: string): string[] {
  return [...value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)].map(
    (match) => match[2] ?? "",
  );
}

export function collectAssetReferences(element: Element): AssetReference[] {
  const assets = new Map<string, AssetReference>();
  const add = (kind: AssetReference["kind"], rawUrl: string) => {
    const url = resolveHttpUrl(rawUrl, element.ownerDocument.baseURI);
    if (url && !assets.has(url)) {
      assets.set(url, { kind, url });
    }
  };

  for (const candidate of [element, ...element.querySelectorAll("*")]) {
    if (candidate.closest("[data-scrapeyy-ui], scrapeyy-picker, scrapeyy-screenshot")) continue;
    if (candidate instanceof HTMLImageElement) {
      add("image", candidate.currentSrc || candidate.getAttribute("src") || "");
      for (const url of srcsetUrls(candidate.getAttribute("srcset") ?? "")) {
        add("image", url);
      }
    } else if (candidate instanceof HTMLSourceElement) {
      for (const url of srcsetUrls(candidate.getAttribute("srcset") ?? "")) {
        add("image", url);
      }
    } else if (candidate instanceof HTMLVideoElement) {
      add("image", candidate.getAttribute("poster") ?? "");
    }

    const style = getComputedStyle(candidate);
    for (const url of cssUrls(style.backgroundImage)) {
      add("image", url);
    }
  }

  return [...assets.values()];
}
