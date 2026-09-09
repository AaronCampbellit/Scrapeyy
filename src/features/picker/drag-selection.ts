import { shouldIgnorePickerTarget } from "./selection-state";

export interface SelectionRectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function rectangleFromPoints(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): SelectionRectangle {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY),
  };
}

function sampleAxis(start: number, size: number): number[] {
  if (size <= 2) return [start + size / 2];
  return [start + 1, start + size / 2, start + size - 1];
}

function lowestSharedAncestor(elements: Element[]): Element | undefined {
  let candidate: Element | null = elements[0] ?? null;
  while (candidate && !elements.every((element) => candidate?.contains(element))) {
    candidate = candidate.parentElement;
  }
  return candidate ?? undefined;
}

export function findEnclosingElement(
  ownerDocument: Document,
  rectangle: SelectionRectangle,
  fallback?: Element,
): Element | undefined {
  const elementsFromPoint = ownerDocument.elementsFromPoint?.bind(ownerDocument);
  if (!elementsFromPoint) return fallback;

  const hits: Element[] = [];
  for (const x of sampleAxis(rectangle.left, rectangle.width)) {
    for (const y of sampleAxis(rectangle.top, rectangle.height)) {
      const hit = elementsFromPoint(x, y).find(
        (element) =>
          !shouldIgnorePickerTarget(element) &&
          element !== ownerDocument.body &&
          element !== ownerDocument.documentElement,
      );
      if (hit && !hits.includes(hit)) hits.push(hit);
    }
  }
  if (hits.length === 0) return fallback;

  const candidate = lowestSharedAncestor(hits);
  return candidate === ownerDocument.body ||
    candidate === ownerDocument.documentElement
    ? fallback
    : candidate ?? fallback;
}
