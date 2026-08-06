import { useCallback, useEffect, useState } from "react";

function isScrapeyyUi(target: Element): boolean {
  return (
    target.closest("[data-scrapeyy-ui]") !== null ||
    target.closest("scrapeyy-picker") !== null
  );
}

export function useElementPicker(ownerDocument: Document) {
  const [hovered, setHovered] = useState<Element>();
  const [selected, setSelected] = useState<Element>();

  useEffect(() => {
    const onHover = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && !isScrapeyyUi(target)) {
        setHovered(target);
      }
    };
    ownerDocument.addEventListener("mouseover", onHover, true);
    return () => {
      ownerDocument.removeEventListener("mouseover", onHover, true);
    };
  }, [ownerDocument]);

  const selectHovered = useCallback(() => {
    if (hovered) {
      setSelected(hovered);
    }
  }, [hovered]);

  const selectParent = useCallback(() => {
    const parent = (selected ?? hovered)?.parentElement;
    if (parent && parent !== ownerDocument.body) {
      setSelected(parent);
      setHovered(parent);
    }
  }, [hovered, ownerDocument, selected]);

  return {
    hovered,
    selected,
    selectHovered,
    selectParent,
    clearSelection: () => setSelected(undefined),
  };
}
