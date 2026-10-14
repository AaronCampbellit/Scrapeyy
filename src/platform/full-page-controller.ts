import type { FullPageCaptureController, FullPageMetrics } from "./screenshots";

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
  let scrollPanel: StyledElement | undefined;
  let initialPanelMetrics: FullPageMetrics | undefined;
  let reversedPanelY = false;

  const setStyle = (element: StyledElement, property: string, value: string) => {
    let saved = styles.get(element);
    if (!saved) { saved = new Map(); styles.set(element, saved); }
    if (!saved.has(property)) saved.set(property, {
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    });
    element.style.setProperty(property, value, "important");
  };

  const panelMetrics = (): FullPageMetrics => {
    if (!scrollPanel?.isConnected) throw new Error("The scrolling content changed during capture. Try again.");
    const rect = scrollPanel.getBoundingClientRect();
    const bounds = {
      left: rect.left + scrollPanel.clientLeft, top: rect.top + scrollPanel.clientTop,
      width: scrollPanel.clientWidth, height: scrollPanel.clientHeight,
      viewportWidth: ownerWindow.innerWidth, viewportHeight: ownerWindow.innerHeight,
    };
    if (bounds.width <= 0 || bounds.height <= 0 || bounds.left < -1 || bounds.top < -1 ||
        bounds.left + bounds.width > ownerWindow.innerWidth + 1 || bounds.top + bounds.height > ownerWindow.innerHeight + 1 ||
        (initialPanelMetrics && JSON.stringify(bounds) !== JSON.stringify(initialPanelMetrics.captureBounds))) {
      throw new Error("The scrolling content moved during capture. Keep the pane fully visible and try again.");
    }
    return { documentWidth: Math.max(scrollPanel.scrollWidth, bounds.width),
      documentHeight: Math.max(scrollPanel.scrollHeight, bounds.height),
      viewportWidth: bounds.width, viewportHeight: bounds.height, captureBounds: bounds };
  };

  return {
    async prepare() {
      originalScroll = { x: ownerWindow.scrollX, y: ownerWindow.scrollY };
      uiHidden = true;
      await setUiHidden(true);
      const elements = pageElements(ownerDocument);
      // Viewport-constrained apps (including webmail) must keep their layout.
      // Expanding their flex/fixed panels can leave a tall but unscrollable root.
      const root = ownerDocument.scrollingElement ?? ownerDocument.documentElement;
      const constrained = [ownerDocument.documentElement, ownerDocument.body].some(element => element &&
        /^(hidden|clip)$/.test(ownerWindow.getComputedStyle(element).overflowY));
      const hasViewportContainer = (element: Element) => {
        for (let node: Element | null = element; node && node !== ownerDocument.body && node !== ownerDocument.documentElement; node = parentElement(node)) {
          const style = ownerWindow.getComputedStyle(node);
          const bounds = node.getBoundingClientRect();
          if ((/^(hidden|clip)$/.test(style.overflowY) || style.position === "fixed") &&
              bounds.height > 0 && bounds.height <= ownerWindow.innerHeight + 1) return true;
        }
        return false;
      };
      {
        const candidates = elements.filter(element => {
          if (element === ownerDocument.documentElement || element === ownerDocument.body) return false;
          const rect = element.getBoundingClientRect();
          return /^(auto|scroll)$/.test(ownerWindow.getComputedStyle(element).overflowY) &&
            element.scrollHeight > element.clientHeight + 1 && element.clientWidth >= ownerWindow.innerWidth * .3 &&
            element.clientHeight >= ownerWindow.innerHeight * .4 && rect.left >= 0 && rect.top >= 0 &&
            rect.right <= ownerWindow.innerWidth + 1 && rect.bottom <= ownerWindow.innerHeight + 1 &&
            (constrained || root.scrollHeight <= ownerWindow.innerHeight + 1 || hasViewportContainer(element));
        });
        const contentScore = (element: StyledElement) => {
          // Prefer an email/document pane to a virtualized message list.
          const documentContent = element.matches('[role="document"], article') || !!element.querySelector('[role="document"], article');
          const listContent = element.matches('[role="listbox"], [role="grid"]') || !!element.querySelector('[role="listbox"], [role="grid"]');
          return (documentContent ? 4 : 0) + (element.contains(ownerDocument.activeElement) && ownerDocument.activeElement !== ownerDocument.body ? 2 : 0) - (listContent ? 1 : 0);
        };
        candidates.sort((a, b) => contentScore(b) - contentScore(a) ||
          b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight ||
          b.getBoundingClientRect().left - a.getBoundingClientRect().left);
        scrollPanel = candidates[0];
        if (scrollPanel) {
          expanded = [{ element: scrollPanel, x: scrollPanel.scrollLeft, y: scrollPanel.scrollTop }];
          for (const [property, value] of [['scroll-behavior', 'auto'], ['scroll-snap-type', 'none'], ['overflow-anchor', 'none']] as const) {
            setStyle(scrollPanel, property, value);
          }
          // Reversed flex conversations have zero at the bottom and negative
          // offsets above it. Probe the real scroll range instead of assuming a
          // CSS class or flex direction, then give the stitcher top-based offsets.
          scrollPanel.scrollTop = -1;
          reversedPanelY = scrollPanel.scrollTop < 0;
          fixedElements = [];
          for (const element of elements.filter(element => element !== scrollPanel && scrollPanel!.contains(element))) {
            const position = ownerWindow.getComputedStyle(element).position;
            if (position === 'sticky') setStyle(element, 'position', 'static');
            else if (position === 'fixed') fixedElements.push(element);
          }
          scrollPanel.scrollLeft = 0;
          scrollPanel.scrollTop = reversedPanelY ? -(scrollPanel.scrollHeight - scrollPanel.clientHeight) : 0;
          await waitForPaint();
          initialPanelMetrics = panelMetrics();
          return initialPanelMetrics;
        }
      }
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

    async measure() { return scrollPanel ? panelMetrics() : documentDimensions(ownerWindow, ownerDocument); },

    async scrollTo(x, y, tileIndex) {
      if (tileIndex > 0) for (const element of fixedElements) setStyle(element, "visibility", "hidden");
      if (scrollPanel) {
        scrollPanel.scrollLeft = x;
        scrollPanel.scrollTop = reversedPanelY ? y - (scrollPanel.scrollHeight - scrollPanel.clientHeight) : y;
      }
      else ownerWindow.scrollTo(x, y);
      await waitForPaint();
      return scrollPanel ? { x: scrollPanel.scrollLeft,
        y: scrollPanel.scrollTop + (reversedPanelY ? scrollPanel.scrollHeight - scrollPanel.clientHeight : 0) }
        : { x: ownerWindow.scrollX, y: ownerWindow.scrollY };
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
        styles.clear(); fixedElements = []; expanded = []; scrollPanel = undefined; initialPanelMetrics = undefined; reversedPanelY = false;
        if (uiHidden) { uiHidden = false; await setUiHidden(false); }
      }
    },
  };
}
