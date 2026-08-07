import type {
  FullPageCaptureController,
} from "./screenshots";

type StyledElement = Element & ElementCSSInlineStyle;

function defaultWaitForPaint(ownerWindow: Window): Promise<void> {
  return new Promise((resolve) => {
    ownerWindow.requestAnimationFrame(() => {
      ownerWindow.requestAnimationFrame(() => resolve());
    });
  });
}

function documentDimensions(
  ownerWindow: Window,
  ownerDocument: Document,
) {
  const root = ownerDocument.documentElement;
  const body = ownerDocument.body;
  return {
    documentWidth: Math.max(
      root.scrollWidth,
      root.offsetWidth,
      root.clientWidth,
      body?.scrollWidth ?? 0,
      body?.offsetWidth ?? 0,
      body?.clientWidth ?? 0,
    ),
    documentHeight: Math.max(
      root.scrollHeight,
      root.offsetHeight,
      root.clientHeight,
      body?.scrollHeight ?? 0,
      body?.offsetHeight ?? 0,
      body?.clientHeight ?? 0,
    ),
    viewportWidth: ownerWindow.innerWidth,
    viewportHeight: ownerWindow.innerHeight,
  };
}

export function createFullPageCaptureController(
  ownerWindow: Window,
  ownerDocument: Document,
  setUiHidden: (hidden: boolean) => Promise<void>,
  waitForPaint: () => Promise<void> = () => defaultWaitForPaint(ownerWindow),
): FullPageCaptureController {
  let originalScroll = { x: 0, y: 0 };
  let uiHidden = false;
  let repeatedElementsHidden = false;
  let fixedElements: Array<{
    element: StyledElement;
    visibility: string;
  }> = [];

  const setRepeatedElementsHidden = (hidden: boolean) => {
    if (repeatedElementsHidden === hidden) return;
    for (const item of fixedElements) {
      item.element.style.visibility = hidden ? "hidden" : item.visibility;
    }
    repeatedElementsHidden = hidden;
  };

  return {
    async prepare() {
      originalScroll = { x: ownerWindow.scrollX, y: ownerWindow.scrollY };
      await setUiHidden(true);
      uiHidden = true;
      fixedElements = [...ownerDocument.querySelectorAll("*")]
        .filter(
          (element): element is StyledElement =>
            "style" in element &&
            element.closest("[data-scrapeyy-ui], scrapeyy-picker") === null &&
            ["fixed", "sticky"].includes(
              ownerWindow.getComputedStyle(element).position,
            ),
        )
        .map((element) => ({
          element,
          visibility: element.style.visibility,
        }));
      return documentDimensions(ownerWindow, ownerDocument);
    },

    async scrollTo(x, y, tileIndex) {
      setRepeatedElementsHidden(tileIndex > 0);
      ownerWindow.scrollTo(x, y);
      await waitForPaint();
      return { x: ownerWindow.scrollX, y: ownerWindow.scrollY };
    },

    async restore() {
      setRepeatedElementsHidden(false);
      ownerWindow.scrollTo(originalScroll.x, originalScroll.y);
      await waitForPaint();
      if (uiHidden) {
        await setUiHidden(false);
        uiHidden = false;
      }
      fixedElements = [];
    },
  };
}
