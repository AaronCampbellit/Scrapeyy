import { describe, expect, it, vi } from "vitest";

import {
  advanceAcrossNavigation,
  type TabUpdatedEvent,
} from "../../src/platform/tab-navigation";

describe("advanceAcrossNavigation", () => {
  it("continues after a Next link replaces the page and destroys the sender", async () => {
    let listener:
      | ((tabId: number, changeInfo: { status?: string; url?: string }) => void)
      | undefined;
    const onUpdated: TabUpdatedEvent = {
      addListener: vi.fn((value) => {
        listener = value;
      }),
      removeListener: vi.fn(),
    };
    const afterNavigation = vi.fn().mockResolvedValue(undefined);
    const onResult = vi.fn();
    const resultPromise = advanceAcrossNavigation({
      tabId: 17,
      timeoutMs: 500,
      onUpdated,
      sendAdvance: async () => {
        throw new Error("The page navigated and the content-script port closed");
      },
      afterNavigation,
      onResult,
    });

    listener?.(17, { status: "loading", url: "https://example.test/page/2" });
    listener?.(17, { status: "complete" });

    await expect(resultPromise).resolves.toBe("advanced");
    expect(afterNavigation).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledWith("navigation", "advanced");
    expect(onUpdated.removeListener).toHaveBeenCalled();
  });

  it("uses the in-page result when pagination updates without navigation", async () => {
    const onUpdated: TabUpdatedEvent = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    const onResult = vi.fn();
    await expect(
      advanceAcrossNavigation({
        tabId: 17,
        timeoutMs: 500,
        onUpdated,
        sendAdvance: async () => "advanced",
        afterNavigation: vi.fn(),
        onResult,
      }),
    ).resolves.toBe("advanced");
    expect(onResult).toHaveBeenCalledWith("page", "advanced");
    expect(onUpdated.removeListener).toHaveBeenCalled();
  });
});
