import type { AdvanceResult } from "./types";

function isDisabled(element: Element): boolean {
  return (
    (element instanceof HTMLButtonElement && element.disabled) ||
    (element instanceof HTMLInputElement && element.disabled) ||
    element.getAttribute("aria-disabled") === "true"
  );
}

export async function advanceNextControl(
  document: Document,
  selector: string,
  timeoutMs: number,
): Promise<AdvanceResult> {
  const control = document.querySelector(selector);
  if (!control) {
    return "missing";
  }
  if (isDisabled(control)) {
    return "disabled";
  }

  return new Promise((resolve) => {
    let finished = false;
    const finish = (result: AdvanceResult) => {
      if (finished) {
        return;
      }
      finished = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(result);
    };
    const observer = new MutationObserver(() => finish("advanced"));
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    const timer = window.setTimeout(() => finish("timeout"), timeoutMs);
    (control as HTMLElement).click();
  });
}
