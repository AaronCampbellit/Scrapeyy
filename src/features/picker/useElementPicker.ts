import { useCallback, useEffect, useRef, useState } from "react";

import {
  blockSelectionEvent,
  shouldIgnorePickerTarget,
  type SelectionPhase,
} from "./selection-state";
import {
  findEnclosingElement,
  rectangleFromPoints,
  type SelectionRectangle,
} from "./drag-selection";

const DRAG_THRESHOLD_PX = 8;

interface PointerSelection {
  pointerId: number;
  startX: number;
  startY: number;
  startTarget: Element;
}

export function useElementPicker(
  ownerDocument: Document,
  onCancel?: () => void,
  initialSelected?: Element,
) {
  const initialPhase: SelectionPhase = initialSelected ? "selected" : "selecting";
  const [phase, setPhase] = useState<SelectionPhase>(initialPhase);
  const [selected, setSelected] = useState<Element | undefined>(initialSelected);
  const [hovered, setHovered] = useState<Element | undefined>();
  const [scope, setScope] = useState<"element" | "full-page">("element");
  const [dragRect, setDragRect] = useState<SelectionRectangle>();
  const phaseRef = useRef<SelectionPhase>(initialPhase);
  const pointerRef = useRef<PointerSelection | undefined>(undefined);
  const suppressNextClickRef = useRef(false);
  const cancelRef = useRef(onCancel);

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const commitSelection = (element: Element, selectionScope = "element" as const) => {
      phaseRef.current = "selected";
      setPhase("selected");
      setSelected(element);
      setHovered(undefined);
      setScope(selectionScope);
      setDragRect(undefined);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (
        phaseRef.current !== "selecting" ||
        event.button !== 0 ||
        shouldIgnorePickerTarget(event.target)
      ) return;
      blockSelectionEvent(event);
      pointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startTarget: event.target as Element,
      };
    };
    const onPointerMove = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer) {
        if (phaseRef.current === "selecting") {
          setHovered(
            shouldIgnorePickerTarget(event.target)
              ? undefined
              : (event.target as Element),
          );
        }
        return;
      }
      if (pointer.pointerId !== event.pointerId) return;
      blockSelectionEvent(event);
      const rectangle = rectangleFromPoints(
        pointer.startX,
        pointer.startY,
        event.clientX,
        event.clientY,
      );
      if (
        rectangle.width >= DRAG_THRESHOLD_PX ||
        rectangle.height >= DRAG_THRESHOLD_PX
      ) {
        setDragRect(rectangle);
      }
    };
    const onPointerUp = (event: PointerEvent) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      blockSelectionEvent(event);
      pointerRef.current = undefined;
      suppressNextClickRef.current = true;
      const rectangle = rectangleFromPoints(
        pointer.startX,
        pointer.startY,
        event.clientX,
        event.clientY,
      );
      const isDrag =
        rectangle.width >= DRAG_THRESHOLD_PX ||
        rectangle.height >= DRAG_THRESHOLD_PX;
      const target = isDrag
        ? findEnclosingElement(ownerDocument, rectangle, pointer.startTarget)
        : shouldIgnorePickerTarget(event.target)
          ? pointer.startTarget
          : (event.target as Element);
      if (target) commitSelection(target);
    };
    const select = (target: EventTarget | null, event: Event) => {
      if (suppressNextClickRef.current) {
        suppressNextClickRef.current = false;
        if (!shouldIgnorePickerTarget(target)) blockSelectionEvent(event);
        return;
      }
      if (phaseRef.current !== "selecting" || shouldIgnorePickerTarget(target)) {
        return;
      }
      blockSelectionEvent(event);
      commitSelection(target as Element);
    };
    const onClick = (event: MouseEvent) => select(event.target, event);
    const onKeyDown = (event: KeyboardEvent) => {
      if (ownerDocument.querySelector("scrapeyy-screenshot")) return;
      if (event.key === "Escape") {
        blockSelectionEvent(event);
        cancelRef.current?.();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        select(ownerDocument.activeElement, event);
      }
    };
    ownerDocument.addEventListener("pointerdown", onPointerDown, true);
    ownerDocument.addEventListener("pointermove", onPointerMove, true);
    ownerDocument.addEventListener("pointerup", onPointerUp, true);
    ownerDocument.addEventListener("click", onClick, true);
    ownerDocument.addEventListener("keydown", onKeyDown, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", onPointerDown, true);
      ownerDocument.removeEventListener("pointermove", onPointerMove, true);
      ownerDocument.removeEventListener("pointerup", onPointerUp, true);
      ownerDocument.removeEventListener("click", onClick, true);
      ownerDocument.removeEventListener("keydown", onKeyDown, true);
    };
  }, [ownerDocument]);

  const selectFullPage = useCallback(() => {
    phaseRef.current = "selected";
    setPhase("selected");
    setSelected(ownerDocument.documentElement);
    setHovered(undefined);
    setScope("full-page");
    setDragRect(undefined);
  }, [ownerDocument]);

  const reselect = useCallback(() => {
    phaseRef.current = "selecting";
    setPhase("selecting");
    setSelected(undefined);
    setHovered(undefined);
    setScope("element");
    setDragRect(undefined);
    pointerRef.current = undefined;
  }, []);

  return {
    phase,
    selected,
    hovered,
    scope,
    dragRect,
    reselect,
    selectFullPage,
    clearSelection: reselect,
  };
}
