import type { FullPageCaptureController } from "./screenshots";

type StyledElement = Element & ElementCSSInlineStyle;
type SavedProperty = { value: string; priority: string };

function defaultWaitForPaint(ownerWindow: Window): Promise<void> {
  return new Promise((resolve) => {
    const timeout = ownerWindow.setTimeout(resolve, 500);
    ownerWindow.requestAnimationFrame(() => ownerWindow.requestAnimationFrame(() => {
      ownerWindow.clearTimeout(timeout);
      ownerWindow.setTimeout(resolve, 150);
    }));
  });
}

function documentDimensions(ownerWindow: Window, ownerDocument: Document) {
  const root = ownerDocument.documentElement;
  const body = ownerDocument.body;
  return {
    documentWidth: Math.max(root.scrollWidth, root.offsetWidth, root.clientWidth,
      body?.scrollWidth ?? 0, body?.offsetWidth ?? 0, body?.clientWidth ?? 0),
    documentHeight: Math.max(root.scrollHeight, root.offsetHeight, root.clientHeight,
      body?.scrollHeight ?? 0, body?.offsetHeight ?? 0, body?.clientHeight ?? 0),
    viewportWidth: ownerWindow.innerWidth,
    viewportHeight: ownerWindow.innerHeight,
  };
}

function pageElements(root: Document | ShadowRoot): StyledElement[] {
  const elements: StyledElement[] = [];
  for (const element of root.querySelectorAll("*")) {
    if (element.matches("[data-scrapeyy-ui], scrapeyy-picker, scrapeyy-screenshot") ||
        element.closest("[data-scrapeyy-ui], scrapeyy-picker, scrapeyy-screenshot")) continue;
    if ("style" in element) elements.push(element as StyledElement);
    if (element.shadowRoot) elements.push(...pageElements(element.shadowRoot));
  }
  return elements;
}

function parentElement(element: Element): Element | null {
  return element.parentElement ?? (element.getRootNode() as ShadowRoot).host ?? null;
}

export function createFullPageCaptureController(
  ownerWindow: Window,
  ownerDocument: Document,
  setUiHidden: (hidden: boolean) => Promise<void>,
  waitForPaint: () => Promise<void> = () => defaultWaitForPaint(ownerWindow),
): FullPageCaptureController {
  let originalScroll = { x: 0, y: 0 };
  let uiHidden = false;
  const styles = new Map<StyledElement, Map<string, SavedProperty>>();
  let fixedElements: StyledElement[] = [];
  let expanded: Array<{ element: StyledElement; x: number; y: number }> = [];

  const setStyle = (element: StyledElement, property: string, value: string) => {
    let saved = styles.get(element);
    if (!saved) { saved = new Map(); styles.set(element, saved); }
    if (!saved.has(property)) saved.set(property, {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    });
    element.style.setProperty(property, value, "important");
  };

  return {
    async prepare() {
      originalScroll = { x: ownerWindow.scrollX, y: ownerWindow.scrollY };
      uiHidden = true;
      await setUiHidden(true);
      const elements = pageElements(ownerDocument);
      // Expand substantial page panels, leaving small widgets alone. Viewport
      // capture can then include their complete contents and the surrounding page.
      const panels = elements.filter((element) => {
        if (element === ownerDocument.documentElement || element === ownerDocument.body) return false;
        const rect = element.getBoundingClientRect();
        const overflow = ownerWindow.getComputedStyle(element).overflowY;
        return /^(auto|scroll)$/.test(overflow) && element.scrollHeight > element.clientHeight + 1 &&
          rect.width >= ownerWindow.innerWidth * 0.5 && rect.height >= ownerWindow.innerHeight * 0.4 &&
          rect.bottom > 0 && rect.top < ownerWindow.innerHeight;
      });
      expanded = panels.map((element) => ({ element, x: element.scrollLeft, y: element.scrollTop }));
      const heights = panels.map((element) => element.scrollHeight + element.getBoundingClientRect().height - element.clientHeight);
      for (let index = 0; index < panels.length; index++) {
        const panel = panels[index]!;
        for (let node: Element | null = panel; node; node = parentElement(node)) {
          if (!("style" in node)) continue;
          const styled = node as StyledElement;
          const computed = ownerWindow.getComputedStyle(node);
          if (computed.position === "fixed" || computed.position === "absolute") {
            setStyle(styled, "width", node.getBoundingClientRect().width + "px");
            setStyle(styled, "position", "relative");
            for (const side of ["top", "right", "bottom", "left"]) setStyle(styled, side, "auto");
          }
          setStyle(styled, "max-height", "none");
          setStyle(styled, "height", node === panel ? heights[index] + "px" : "auto");
          setStyle(styled, "overflow-x", "visible");
          setStyle(styled, "overflow-y", "visible");
          setStyle(styled, "contain", "none");
          setStyle(styled, "content-visibility", "visible");
          setStyle(styled, "flex-shrink", "0");
        }
        setStyle(panel, "box-sizing", "border-box");
        panel.scrollTop = 0;
        panel.scrollLeft = 0;
      }
      for (const element of [ownerDocument.documentElement, ownerDocument.body]) {
        if (!element) continue;
        setStyle(element, "scroll-behavior", "auto");
        setStyle(element, "scroll-snap-type", "none");
        setStyle(element, "overflow-x", "visible");
        setStyle(element, "overflow-y", "visible");
      }
      fixedElements = [];
      for (const element of elements) {
        const position = ownerWindow.getComputedStyle(element).position;
        // Sticky sections belong at their natural place, even below tile one.
        if (position === "sticky") setStyle(element, "position", "static");
        else if (position === "fixed") fixedElements.push(element);
      }
      await waitForPaint();
      return documentDimensions(ownerWindow, ownerDocument);
    },

    async measure() { return documentDimensions(ownerWindow, ownerDocument); },

    async scrollTo(x, y, tileIndex) {
      if (tileIndex > 0) for (const element of fixedElements) setStyle(element, "visibility", "hidden");
      ownerWindow.scrollTo(x, y);
      await waitForPaint();
      return { x: ownerWindow.scrollX, y: ownerWindow.scrollY };
    },

    async restore() {
      try {
        for (const [element, properties] of [...styles].reverse()) {
          for (const [property, saved] of [...properties].reverse()) {
            if (saved.value) element.style.setProperty(property, saved.value, saved.priority);
            else element.style.removeProperty(property);
          }
        }
        for (const { element, x, y } of expanded) { element.scrollLeft = x; element.scrollTop = y; }
        ownerWindow.scrollTo({ left: originalScroll.x, top: originalScroll.y, behavior: "instant" });
        await waitForPaint();
      } finally {
        styles.clear(); fixedElements = []; expanded = [];
        if (uiHidden) { uiHidden = false; await setUiHidden(false); }
      }
    },
  };
}
