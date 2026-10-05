import type { FullPageCaptureController } from "./screenshots";

type SendTabMessage = (
  tabId: number,
  message: Record<string, unknown>,
) => Promise<unknown>;

export function createTabFullPageCaptureController(
  tabId: number,
  sendMessage: SendTabMessage,
): FullPageCaptureController {
  return {
    async measure() {
      return (await sendMessage(tabId, { type: "SCRAPEYY_MEASURE_FULL_PAGE_CAPTURE" })) as Awaited<ReturnType<FullPageCaptureController["prepare"]>>;
    },
    async prepare() {
      return (await sendMessage(tabId, {
        type: "SCRAPEYY_PREPARE_FULL_PAGE_CAPTURE",
      })) as Awaited<ReturnType<FullPageCaptureController["prepare"]>>;
    },
    async scrollTo(x, y, tileIndex) {
      return (await sendMessage(tabId, {
        type: "SCRAPEYY_SCROLL_FULL_PAGE_CAPTURE",
        x,
        y,
        tileIndex,
      })) as Awaited<ReturnType<FullPageCaptureController["scrollTo"]>>;
    },
    async restore() {
      await sendMessage(tabId, {
        type: "SCRAPEYY_RESTORE_FULL_PAGE_CAPTURE",
      });
    },
  };
}
