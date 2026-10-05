import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ElementBounds } from "../../platform/screenshots";

export function selectionBounds(start: { x: number; y: number }, end: { x: number; y: number },
  viewportWidth: number, viewportHeight: number): ElementBounds {
  const x1 = Math.max(0, Math.min(viewportWidth, start.x));
  const x2 = Math.max(0, Math.min(viewportWidth, end.x));
  const y1 = Math.max(0, Math.min(viewportHeight, start.y));
  const y2 = Math.max(0, Math.min(viewportHeight, end.y));
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1), viewportWidth, viewportHeight };
}

export function ScreenshotSelection({ onCapture, onClose }: {
  onCapture(bounds: ElementBounds): Promise<void>;
  onClose(): void;
}) {
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const [bounds, setBounds] = useState<ElementBounds>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Drag to select an area. Escape to cancel.");
  const layer = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = layer.current;
    if (!dialog) return;
    // z-index cannot outrank native dialogs/popovers or escape transformed
    // ancestors. A modal dialog puts the entire overlay in the browser top layer.
    dialog.showModal();
    const ownerDocument = dialog.ownerDocument;
    const raise = () => {
      if (!dialog.isConnected || !dialog.open) return;
      dialog.close();
      dialog.showModal();
    };
    const toggle = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target !== dialog &&
          (target.matches("dialog[open]") || target.matches(":popover-open"))) raise();
    };
    // A site can open another top-layer menu after selection starts. Re-promote
    // our dialog when that happens without changing or closing the site's UI.
    ownerDocument.addEventListener("toggle", toggle, true);
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.target instanceof Element &&
          record.target !== dialog && record.target.matches("dialog[open]"))) raise();
    });
    observer.observe(ownerDocument.documentElement, { subtree: true, attributes: true, attributeFilter: ["open"] });
    return () => {
      ownerDocument.removeEventListener("toggle", toggle, true);
      observer.disconnect();
      if (dialog.open) dialog.close();
    };
  }, []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); if (!busy) onClose(); }
      if ([" ", "PageDown", "PageUp", "Home", "End", "ArrowDown", "ArrowUp"].includes(event.key)) event.preventDefault();
    };
    const prevent = (event: Event) => event.preventDefault();
    const resize = () => { if (!busy) onClose(); };
    window.addEventListener("keydown", key, true);
    window.addEventListener("wheel", prevent, { passive: false, capture: true });
    window.addEventListener("touchmove", prevent, { passive: false, capture: true });
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("wheel", prevent, true);
      window.removeEventListener("touchmove", prevent, true);
      window.removeEventListener("resize", resize);
    };
  }, [onClose, busy]);
  const point = (event: React.PointerEvent) => ({ x: event.clientX, y: event.clientY });
  const capture = async () => {
    if (!bounds || busy) return;
    setBusy(true);
    if (layer.current) layer.current.style.visibility = "hidden";
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    try {
      await onCapture(bounds);
      onClose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Screenshot failed. Try again.");
      if (layer.current) layer.current.style.visibility = "visible";
      setBusy(false);
    }
  };
  return (
    <dialog ref={layer} data-scrapeyy-ui className="screenshot-selection" aria-label="Draw screenshot selection"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      onPointerDown={(event) => {
        if (busy || event.button !== 0 || (event.target as Element).closest("button")) return;
        event.preventDefault();
        start.current = point(event);
        setBounds(undefined);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (start.current && !busy) setBounds(selectionBounds(start.current, point(event), innerWidth, innerHeight));
      }}
      onPointerCancel={() => { start.current = undefined; setBounds(undefined); }}
      onPointerUp={(event) => {
        if (!start.current || busy) return;
        const area = selectionBounds(start.current, point(event), innerWidth, innerHeight);
        start.current = undefined;
        if (area.width < 3 || area.height < 3) { setNotice("Draw a larger area to capture."); return; }
        setBounds(area);
        setNotice(`${Math.round(area.width)} × ${Math.round(area.height)} px. Capture or drag again to redraw.`);
      }}>
      <div className="screenshot-instructions" role="status">
        <span>{notice}</span>
        {bounds && bounds.width >= 3 && bounds.height >= 3 ?
          <button type="button" disabled={busy} onClick={() => { void capture(); }}>Capture</button> : null}
        <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
      {bounds ? <div className="screenshot-area" style={{
        left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height,
      }} /> : null}
    </dialog>
  );
}
