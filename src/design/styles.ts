import { isSafeCaptureElement } from "./sanitize";

export function collectComputedStyles(
  source: Element,
  sanitizedRoot: Element,
): string {
  const sources = [source, ...source.querySelectorAll("*")].filter(
    isSafeCaptureElement,
  );
  const targets = [sanitizedRoot, ...sanitizedRoot.querySelectorAll("*")];
  const rules: string[] = [];

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index]!;
    const sourceElement = sources[index];
    const nodeId = String(index + 1);
    target.setAttribute("data-scrapeyy-node", nodeId);
    if (!sourceElement) {
      continue;
    }
    const computed = getComputedStyle(sourceElement);
    const declarations: string[] = [];
    for (let propertyIndex = 0; propertyIndex < computed.length; propertyIndex += 1) {
      const property = computed.item(propertyIndex);
      const value = computed.getPropertyValue(property);
      if (property && value) {
        declarations.push(`${property}: ${value};`);
      }
    }
    if (declarations.length > 0) {
      rules.push(
        `[data-scrapeyy-node="${nodeId}"] { ${declarations.join(" ")} }`,
      );
    }
  }

  return rules.join("\n");
}
