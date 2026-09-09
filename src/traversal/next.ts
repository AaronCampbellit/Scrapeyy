import type { AdvanceResult } from "./types";

export interface NextControlOptions {
  /** Zero-based position when the saved selector matches more than one control. */
  matchIndex?: number;
  /** Content that must change before the next page is considered ready. */
  changeSelector?: string;
  /**
   * Returns a signature only when freshly extracted records are present.
   * While provided, cosmetic DOM changes and page counters are ignored.
   */
  readySignature?: () => string | undefined;
  pollIntervalMs?: number;
  /** Quiet period after the watched content changes. */
  settleMs?: number;
}

function isDisabled(element: Element): boolean {
  return (
    (element instanceof HTMLButtonElement && element.disabled) ||
    (element instanceof HTMLInputElement && element.disabled) ||
    element.getAttribute("aria-disabled") === "true" ||
    element.hasAttribute("disabled") ||
    element.closest('[aria-disabled="true"], [disabled]') !== null
  );
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function contentSignature(document: Document, selector?: string): string {
  const elements = selector
    ? [...document.querySelectorAll(selector)]
    : [document.body ?? document.documentElement];
  return JSON.stringify(
    elements.map((element) => ({
      tag: element.tagName,
      text: normalizeText(element.textContent),
      childCount: element.childElementCount,
    })),
  );
}

function resolveControl(
  document: Document,
  selector: string,
  matchIndex?: number,
): Element | undefined {
  try {
    const matches = [...document.querySelectorAll(selector)];
    if (matchIndex !== undefined) {
      return matches[matchIndex];
    }
    // Recipes saved before match indexes were recorded often used a shared
    // pager class. Prefer the last enabled match so a preceding Previous
    // control is not mistaken for Next on later pages.
    return matches.findLast((element) => !isDisabled(element)) ?? matches[0];
  } catch {
    return undefined;
  }
}

export async function advanceNextControl(
  document: Document,
  selector: string,
  timeoutMs: number,
  options: NextControlOptions = {},
): Promise<AdvanceResult> {
  const matchIndex = options.matchIndex;
  const control = resolveControl(document, selector, matchIndex);
  if (!control) {
    return "missing";
  }
  if (isDisabled(control)) {
    return "disabled";
  }

  const beforeUrl = document.location?.href;
  const beforeContent = contentSignature(document, options.changeSelector);

  return new Promise((resolve) => {
    let finished = false;
    let settleTimer: number | undefined;
    let lastChangedSignature: string | undefined;
    const finish = (result: AdvanceResult) => {
      if (finished) {
        return;
      }
      finished = true;
      observer.disconnect();
      clearTimeout(timer);
      clearInterval(poller);
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      resolve(result);
    };
    const scheduleAdvance = (signature: string) => {
      if (signature === lastChangedSignature && settleTimer !== undefined) {
        return;
      }
      lastChangedSignature = signature;
      if (settleTimer !== undefined) clearTimeout(settleTimer);
      settleTimer = window.setTimeout(
        () => finish("advanced"),
        options.settleMs ?? 150,
      );
    };
    const checkForAdvance = () => {
      if (options.readySignature) {
        const signature = options.readySignature();
        if (signature !== undefined) {
          scheduleAdvance(`records:${signature}`);
          return;
        }
        const currentControl = resolveControl(document, selector, matchIndex);
        if (currentControl && isDisabled(currentControl)) {
          finish("complete");
        }
        return;
      }
      if (document.location?.href !== beforeUrl) {
        scheduleAdvance(`url:${document.location?.href}`);
        return;
      }
      const currentContent = contentSignature(document, options.changeSelector);
      if (currentContent !== beforeContent) {
        scheduleAdvance(currentContent);
        return;
      }
      const currentControl = resolveControl(document, selector, matchIndex);
      if (currentControl && isDisabled(currentControl)) {
        finish("complete");
      }
    };
    const observer = new MutationObserver(checkForAdvance);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    const poller = window.setInterval(
      checkForAdvance,
      options.pollIntervalMs ?? 50,
    );
    const timer = window.setTimeout(() => finish("timeout"), timeoutMs);
    (control as HTMLElement).click();
  });
}
