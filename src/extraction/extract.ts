import type {
  CaptureRecord,
  FieldDefinition,
} from "../contracts/models";
import { normalizeWhitespace, resolveHttpUrl } from "./normalize";

function selectedElement(
  container: Element,
  selector: string,
): Element | null {
  return selector === ":scope" ? container : container.querySelector(selector);
}

function extractField(
  element: Element | null,
  field: FieldDefinition,
  baseUrl: string,
): string | null {
  if (!element) {
    return null;
  }
  if (field.kind === "text") {
    const value = normalizeWhitespace(element.textContent ?? "");
    return value === "" ? null : value;
  }
  if (field.kind === "link") {
    const value =
      element instanceof HTMLAnchorElement
        ? element.getAttribute("href")
        : element.getAttribute("href");
    return value ? resolveHttpUrl(value, baseUrl) : null;
  }
  if (field.kind === "image") {
    const value =
      element instanceof HTMLImageElement
        ? element.currentSrc || element.getAttribute("src")
        : element.getAttribute("src");
    return value ? resolveHttpUrl(value, baseUrl) : null;
  }
  if (field.kind === "attribute") {
    const value = element.getAttribute(field.attribute ?? "");
    if (value === null) {
      return null;
    }
    const normalized = normalizeWhitespace(value);
    return normalized === "" ? null : normalized;
  }
  if (field.kind === "html") {
    return element.outerHTML;
  }
  return null;
}

export function extractRecords(
  document: Document,
  containerSelector: string,
  fields: FieldDefinition[],
): CaptureRecord[] {
  return [...document.querySelectorAll(containerSelector)].map((container) =>
    Object.fromEntries(
      fields.map((field) => [
        field.id,
        extractField(
          selectedElement(container, field.selector),
          field,
          document.baseURI,
        ),
      ]),
    ),
  );
}
