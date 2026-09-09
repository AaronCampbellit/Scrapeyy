import type { TraversalSettings } from "../contracts/models";

export const DEFAULT_TRAVERSAL_PAGES = 50;
export const DEFAULT_TRAVERSAL_ITEMS = 10_000;

export function traversalForExecution(
  traversal: TraversalSettings,
): TraversalSettings {
  if (traversal.kind === "none" || traversal.maxPages > 1) {
    return traversal;
  }
  // Early recipe builds kept one-page defaults after traversal was selected.
  // A one-page traversal can never advance, so repair only that impossible
  // legacy combination while preserving every explicitly bounded recipe.
  return {
    ...traversal,
    maxPages: DEFAULT_TRAVERSAL_PAGES,
    maxItems:
      traversal.maxItems <= 500
        ? DEFAULT_TRAVERSAL_ITEMS
        : traversal.maxItems,
  };
}
