export interface SelectorCandidate {
  selector: string;
  matches: number;
  score: number;
  reason: "id" | "semantic" | "class" | "structural";
}

const semanticAttributes = [
  "data-testid",
  "data-test",
  "data-qa",
  "data-product",
  "aria-label",
  "role",
  "name",
  "itemprop",
];

function escapeIdentifier(value: string): string {
  if (globalThis.CSS?.escape) {
    return globalThis.CSS.escape(value);
  }
  return value.replace(/(^-?\d)|[^a-zA-Z0-9_-]/g, (match, startsWithDigit) =>
    startsWithDigit ? `\\3${match} ` : `\\${match}`,
  );
}

function escapeAttribute(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function looksGenerated(value: string): boolean {
  return (
    /(?:^|[-_])(ember|react|vue|svelte|ng)[-_]?\d/i.test(value) ||
    /(?:^|[-_])\d{4,}(?:$|[-_])/i.test(value) ||
    /^[a-z]{0,3}[-_]?\d{4,}$/i.test(value) ||
    /^[a-f0-9]{12,}$/i.test(value)
  );
}

function candidate(
  root: ParentNode,
  selector: string,
  score: number,
  reason: SelectorCandidate["reason"],
): SelectorCandidate | undefined {
  try {
    const matches = root.querySelectorAll(selector).length;
    return matches > 0 ? { selector, matches, score, reason } : undefined;
  } catch {
    return undefined;
  }
}

function structuralSelector(element: Element): string {
  const parent = element.parentElement;
  const tag = element.tagName.toLowerCase();
  if (!parent || parent === document.body || parent === document.documentElement) {
    return tag;
  }
  const siblings = [...parent.children].filter(
    (sibling) => sibling.tagName === element.tagName,
  );
  const suffix =
    siblings.length > 1
      ? `:nth-of-type(${siblings.indexOf(element) + 1})`
      : "";
  const parentTag = parent.tagName.toLowerCase();
  return `${parentTag} > ${tag}${suffix}`;
}

export function rankSelectorCandidates(
  element: Element,
  root: ParentNode = element.ownerDocument,
): SelectorCandidate[] {
  const results: SelectorCandidate[] = [];
  const add = (
    selector: string,
    baseScore: number,
    reason: SelectorCandidate["reason"],
  ) => {
    const result = candidate(root, selector, baseScore, reason);
    if (result && !results.some((item) => item.selector === selector)) {
      results.push(result);
    }
  };

  if (element.id && !looksGenerated(element.id)) {
    add(`#${escapeIdentifier(element.id)}`, 1_000, "id");
  }

  for (const attribute of semanticAttributes) {
    const value = element.getAttribute(attribute);
    if (value && !looksGenerated(value)) {
      add(
        `[${attribute}="${escapeAttribute(value)}"]`,
        900,
        "semantic",
      );
    }
  }

  const stableClasses = [...element.classList].filter(
    (className) => !looksGenerated(className),
  );
  if (stableClasses.length > 0) {
    const selector = `${element.tagName.toLowerCase()}${stableClasses
      .slice(0, 3)
      .map((className) => `.${escapeIdentifier(className)}`)
      .join("")}`;
    add(selector, 700, "class");
  }

  add(structuralSelector(element), 100, "structural");

  return results.sort((left, right) => {
    const leftUnique = left.matches === 1 ? 50 : 0;
    const rightUnique = right.matches === 1 ? 50 : 0;
    return (
      right.score +
      rightUnique -
      (left.score + leftUnique) ||
      left.matches - right.matches ||
      left.selector.localeCompare(right.selector)
    );
  });
}
