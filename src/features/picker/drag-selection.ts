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

function enclosesRectangle(
  element: Element,
  rectangle: SelectionRectangle,
): boolean {
  const bounds = element.getBoundingClientRect();
  return (
    bounds.width > 0 &&
    bounds.height > 0 &&
    bounds.left <= rectangle.left + 1 &&
    bounds.top <= rectangle.top + 1 &&
    bounds.right >= rectangle.left + rectangle.width - 1 &&
    bounds.bottom >= rectangle.top + rectangle.height - 1
  );
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
        (element) => !shouldIgnorePickerTarget(element),
      );
      if (hit && !hits.includes(hit)) hits.push(hit);
    }
  }
  if (hits.length === 0) return fallback;

  let candidate: Element | null = lowestSharedAncestor(hits) ?? null;
  while (
    candidate &&
    candidate !== ownerDocument.documentElement &&
    !enclosesRectangle(candidate, rectangle)
  ) {
    candidate = candidate.parentElement;
  }
  return candidate ?? fallback;
}
