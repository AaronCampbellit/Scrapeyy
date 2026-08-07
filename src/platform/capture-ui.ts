import type { ScreenshotUiVisibility } from "./screenshots";

export function findCaptureUiHost(
  ownerDocument: Document,
): HTMLElement | undefined {
  return (
    ownerDocument.querySelector<HTMLElement>("scrapeyy-picker") ?? undefined
  );
}

export function createCaptureUiVisibility(
  getHost: () => HTMLElement | undefined,
  waitForPaint: () => Promise<void>,
): ScreenshotUiVisibility {
  let hidden:
    | {
        host: HTMLElement;
        display: { value: string; priority: string };
        visibility: { value: string; priority: string };
      }
    | undefined;

  const restoreProperty = (
    host: HTMLElement,
    property: string,
    original: { value: string; priority: string },
  ) => {
    if (original.value) {
      host.style.setProperty(property, original.value, original.priority);
    } else {
      host.style.removeProperty(property);
    }
  };

  return {
    async hide() {
      if (hidden) return;
      const host = getHost();
      if (!host) return;
      hidden = {
        host,
        display: {
          value: host.style.getPropertyValue("display"),
          priority: host.style.getPropertyPriority("display"),
        },
        visibility: {
          value: host.style.getPropertyValue("visibility"),
          priority: host.style.getPropertyPriority("visibility"),
        },
      };
      host.style.setProperty("display", "none", "important");
      host.style.setProperty("visibility", "hidden", "important");
      await waitForPaint();
    },

    async show() {
      if (!hidden) return;
      const { host, display, visibility } = hidden;
      hidden = undefined;
      restoreProperty(host, "display", display);
      restoreProperty(host, "visibility", visibility);
      await waitForPaint();
    },
  };
}
