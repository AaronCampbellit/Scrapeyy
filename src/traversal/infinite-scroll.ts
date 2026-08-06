import type { AdvanceResult } from "./types";

export async function advanceInfiniteScroll(
  window: Window,
  stepPx: number,
  timeoutMs: number,
): Promise<AdvanceResult> {
  const document = window.document;
  const beforeHeight = document.documentElement.scrollHeight;
  const beforeY = window.scrollY;
  const atBottom =
    beforeY + window.innerHeight >= beforeHeight && beforeHeight > 0;

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
    });
    const timer = window.setTimeout(() => {
      const afterHeight = document.documentElement.scrollHeight;
      const afterY = window.scrollY;
      finish(
        atBottom && afterHeight === beforeHeight && afterY === beforeY
          ? "complete"
          : "timeout",
      );
    }, timeoutMs);
    window.scrollBy({ top: stepPx, behavior: "instant" });
  });
}
