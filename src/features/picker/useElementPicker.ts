import { useCallback, useEffect, useRef, useState } from "react";

import {
  blockSelectionEvent,
  shouldIgnorePickerTarget,
  type SelectionPhase,
} from "./selection-state";

export function useElementPicker(
  ownerDocument: Document,
  onCancel?: () => void,
) {
  const [phase, setPhase] = useState<SelectionPhase>("hovering");
  const [hovered, setHovered] = useState<Element>();
  const [selected, setSelected] = useState<Element>();
  const phaseRef = useRef<SelectionPhase>("hovering");
  const cancelRef = useRef(onCancel);

  useEffect(() => {
    cancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    const onHover = (event: Event) => {
      if (
        phaseRef.current !== "hovering" ||
        shouldIgnorePickerTarget(event.target)
      ) return;
      setHovered(event.target as Element);
    };
    const select = (target: EventTarget | null, event: Event) => {
      if (
        phaseRef.current !== "hovering" ||
        shouldIgnorePickerTarget(target)
      ) return;
      blockSelectionEvent(event);
      const element = target as Element;
      phaseRef.current = "selected";
      setHovered(element);
      setSelected(element);
      setPhase("selected");
    };
    const onClick = (event: MouseEvent) => select(event.target, event);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        blockSelectionEvent(event);
        cancelRef.current?.();
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        select(ownerDocument.activeElement, event);
      }
    };
    ownerDocument.addEventListener("pointermove", onHover, true);
    ownerDocument.addEventListener("mouseover", onHover, true);
    ownerDocument.addEventListener("click", onClick, true);
    ownerDocument.addEventListener("keydown", onKeyDown, true);
    return () => {
      ownerDocument.removeEventListener("pointermove", onHover, true);
      ownerDocument.removeEventListener("mouseover", onHover, true);
      ownerDocument.removeEventListener("click", onClick, true);
      ownerDocument.removeEventListener("keydown", onKeyDown, true);
    };
  }, [ownerDocument]);

  const selectHovered = useCallback(() => {
    if (hovered) {
      phaseRef.current = "selected";
      setPhase("selected");
      setSelected(hovered);
    }
  }, [hovered]);

  const selectParent = useCallback(() => {
    const parent = (selected ?? hovered)?.parentElement;
    if (parent && parent !== ownerDocument.body) {
      phaseRef.current = "selected";
      setPhase("selected");
      setSelected(parent);
      setHovered(parent);
    }
  }, [hovered, ownerDocument, selected]);

  const reselect = useCallback(() => {
    phaseRef.current = "hovering";
    setPhase("hovering");
    setSelected(undefined);
    setHovered(undefined);
  }, []);

  return {
    phase,
    hovered,
    selected,
    reselect,
    selectHovered,
    selectParent,
    clearSelection: reselect,
  };
}
