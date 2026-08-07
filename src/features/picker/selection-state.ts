export type SelectionPhase = "hovering" | "selected";

export function shouldIgnorePickerTarget(
  target: EventTarget | null,
): boolean {
  return (
    !(target instanceof Element) ||
    target.closest("[data-scrapeyy-ui]") !== null ||
    target.closest("scrapeyy-picker") !== null
  );
}

export function blockSelectionEvent(event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}
