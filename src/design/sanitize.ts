import DOMPurify from "dompurify";

const forbiddenTags = new Set([
  "SCRIPT",
  "IFRAME",
  "FRAME",
  "OBJECT",
  "EMBED",
  "PORTAL",
  "SCRAPEYY-PICKER",
  "SCRAPEYY-SCREENSHOT",
]);
const secretNamePattern =
  /(?:csrf|xsrf|token|nonce|password|passwd|secret|authorization|session)/i;

export function isSafeCaptureElement(element: Element): boolean {
  if (element.closest("[data-scrapeyy-ui], scrapeyy-picker, scrapeyy-screenshot")) return false;
  if (forbiddenTags.has(element.tagName)) {
    return false;
  }
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (type === "password") {
      return false;
    }
    if (
      type === "hidden" &&
      secretNamePattern.test(
        `${element.name} ${element.id} ${element.getAttribute("autocomplete") ?? ""}`,
      )
    ) {
      return false;
    }
  }
  return true;
}

function scrubElement(element: Element): void {
  for (const attribute of [...element.attributes]) {
    const name = attribute.name.toLowerCase();
    if (
      name.startsWith("on") ||
      name === "nonce" ||
      name === "integrity" ||
      secretNamePattern.test(name)
    ) {
      element.removeAttribute(attribute.name);
    }
  }

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    element.removeAttribute("value");
    element.removeAttribute("checked");
    element.removeAttribute("selected");
  }
  if (element instanceof HTMLTextAreaElement) {
    element.textContent = "";
  }
  for (const name of ["href", "src", "action", "formaction", "poster"]) {
    const value = element.getAttribute(name)?.trim() ?? "";
    if (/^(?:javascript|vbscript|data):/i.test(value)) {
      element.removeAttribute(name);
    }
  }
}

export function sanitizeElement(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  for (const candidate of [clone, ...clone.querySelectorAll("*")]) {
    if (!isSafeCaptureElement(candidate)) {
      candidate.remove();
      continue;
    }
    scrubElement(candidate);
  }

  return DOMPurify.sanitize(clone.outerHTML, {
    FORBID_TAGS: [...forbiddenTags].map((tag) => tag.toLowerCase()),
    FORBID_ATTR: ["srcdoc"],
    ALLOW_DATA_ATTR: true,
  });
}
