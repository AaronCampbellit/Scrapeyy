import type { AdvanceResult } from "../traversal/types";

export interface TabUpdatedEvent {
  addListener(
    listener: (
      tabId: number,
      changeInfo: { status?: string; url?: string },
    ) => void,
  ): void;
  removeListener(
    listener: (
      tabId: number,
      changeInfo: { status?: string; url?: string },
    ) => void,
  ): void;
}

interface NavigationSafeAdvanceOptions {
  tabId: number;
  timeoutMs: number;
  onUpdated: TabUpdatedEvent;
  sendAdvance(): Promise<AdvanceResult>;
  afterNavigation(): Promise<void>;
  onResult?(source: "page" | "navigation", result: AdvanceResult): void;
}

/** Keeps a Next-button advance alive when clicking it destroys the page context. */
export async function advanceAcrossNavigation({
  tabId,
  timeoutMs,
  onUpdated,
  sendAdvance,
  afterNavigation,
  onResult,
}: NavigationSafeAdvanceOptions): Promise<AdvanceResult> {
  let finished = false;
  let navigationStarted = false;
  let resolveNavigation!: (result: AdvanceResult) => void;
  let timer: ReturnType<typeof setTimeout>;
  const cleanup = () => {
    onUpdated.removeListener(listener);
    clearTimeout(timer);
  };
  const finishNavigation = (result: AdvanceResult) => {
    if (finished) return;
    finished = true;
    cleanup();
    resolveNavigation(result);
  };
  const listener = (
    updatedTabId: number,
    changeInfo: { status?: string; url?: string },
  ) => {
    if (updatedTabId !== tabId) return;
    if (changeInfo.status === "loading" || changeInfo.url) {
      navigationStarted = true;
    }
    if (navigationStarted && changeInfo.status === "complete") {
      finishNavigation("advanced");
    }
  };
  const navigation = new Promise<AdvanceResult>((resolve) => {
    resolveNavigation = resolve;
  });
  onUpdated.addListener(listener);
  timer = setTimeout(
    () => finishNavigation("timeout"),
    timeoutMs + 1_000,
  );

  const pageAdvance = sendAdvance().catch(
    () => new Promise<AdvanceResult>(() => {}),
  );
  const winner = await Promise.race([
    pageAdvance.then((result) => ({ source: "page" as const, result })),
    navigation.then((result) => ({ source: "navigation" as const, result })),
  ]);
  onResult?.(winner.source, winner.result);
  if (winner.source === "page") cleanup();
  if (winner.source === "navigation" && winner.result === "advanced") {
    await afterNavigation();
  }
  return winner.result;
}
