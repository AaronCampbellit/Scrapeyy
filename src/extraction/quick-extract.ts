import type {
  CaptureRecord,
  FieldDefinition,
} from "../contracts/models";
import { normalizeWhitespace, resolveHttpUrl } from "./normalize";

export interface QuickExtractionResult {
  strategy: "table" | "repeated" | "generic";
  fields: FieldDefinition[];
  records: CaptureRecord[];
}

function slug(value: string, fallback: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || fallback;
}

function uniqueIds(names: string[]): string[] {
  const counts = new Map<string, number>();
  return names.map((name, index) => {
    const base = slug(name, `column_${index + 1}`);
    const count = (counts.get(base) ?? 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}

function fields(
  entries: Array<{
    id: string;
    name: string;
    kind?: FieldDefinition["kind"];
  }>,
): FieldDefinition[] {
  return entries.map(({ id, name, kind = "text" }) => ({
    id,
    name,
    kind,
    selector: ":scope",
  }));
}

function extractTable(
  table: HTMLTableElement,
  baseUrl: string,
): QuickExtractionResult {
  const rows = [...table.rows];
  const headerRow =
    table.tHead?.rows[0] ??
    rows.find((row) => row.querySelector("th") !== null);
  const columnCount = Math.max(
    0,
    ...rows.map((row) => row.cells.length),
  );
  const names = Array.from({ length: columnCount }, (_, index) => {
    const label = normalizeWhitespace(
      headerRow?.cells[index]?.textContent ?? "",
    );
    return label || `Column ${index + 1}`;
  });
  const ids = uniqueIds(names);
  const dataRows = rows.filter(
    (row) => row !== headerRow && row.closest("table") === table,
  );
  return {
    strategy: "table",
    fields: fields(ids.map((id, index) => ({ id, name: names[index]! }))),
    records: dataRows.map((row) =>
      Object.fromEntries(
        ids.map((id, index) => [
          id,
          normalizeWhitespace(row.cells[index]?.textContent ?? "") || null,
        ]),
      ),
    ),
  };
}

function childSignature(element: Element): string {
  return `${element.tagName.toLowerCase()}.${[...element.classList]
    .sort()
    .join(".")}`;
}

function repeatedChildren(selected: Element): Element[] {
  const children = [...selected.children];
  if (children.length < 2) return [];
  const groups = new Map<string, Element[]>();
  for (const child of children) {
    const signature = childSignature(child);
    groups.set(signature, [...(groups.get(signature) ?? []), child]);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
}

function commonCount(
  items: Element[],
  selector: string,
): number {
  return items.filter((item) => item.querySelector(selector) !== null).length;
}

function extractRepeated(
  selected: Element,
  baseUrl: string,
): QuickExtractionResult | undefined {
  const items = repeatedChildren(selected);
  if (items.length < 2) return undefined;
  const threshold = Math.ceil(items.length / 2);
  const inferred: Array<{
    id: string;
    name: string;
    kind: FieldDefinition["kind"];
    selector: string;
  }> = [];
  if (commonCount(items, "h1, h2, h3, h4, h5, h6") >= threshold) {
    inferred.push({
      id: "title",
      name: "Title",
      kind: "text",
      selector: "h1, h2, h3, h4, h5, h6",
    });
  }
  if (commonCount(items, "a[href]") >= threshold) {
    inferred.push({
      id: "link",
      name: "Link",
      kind: "link",
      selector: "a[href]",
    });
  }
  if (commonCount(items, "img[src]") >= threshold) {
    inferred.push({
      id: "image",
      name: "Image",
      kind: "image",
      selector: "img[src]",
    });
  }
  if (inferred.length === 0) return undefined;
  if (!inferred.some((field) => field.kind === "text")) {
    inferred.unshift({
      id: "text",
      name: "Text",
      kind: "text",
      selector: ":scope",
    });
  }
  return {
    strategy: "repeated",
    fields: inferred.map(({ id, name, kind, selector }) => ({
      id,
      name,
      kind,
      selector,
    })),
    records: items.map((item) =>
      Object.fromEntries(
        inferred.map((field) => {
          const target =
            field.selector === ":scope"
              ? item
              : item.querySelector(field.selector);
          if (!target) return [field.id, null];
          if (field.kind === "link") {
            return [
              field.id,
              resolveHttpUrl(target.getAttribute("href") ?? "", baseUrl),
            ];
          }
          if (field.kind === "image") {
            return [
              field.id,
              resolveHttpUrl(target.getAttribute("src") ?? "", baseUrl),
            ];
          }
          return [
            field.id,
            normalizeWhitespace(target.textContent ?? "") || null,
          ];
        }),
      ),
    ),
  };
}

function descriptor(element: Element): string {
  const id = element.id ? `#${element.id}` : "";
  const classes = [...element.classList]
    .slice(0, 2)
    .map((value) => `.${value}`)
    .join("");
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

function extractGeneric(
  selected: Element,
  baseUrl: string,
): QuickExtractionResult {
  const linkLines = [...selected.querySelectorAll("a[href]")]
    .map((link) => {
      const url = resolveHttpUrl(link.getAttribute("href") ?? "", baseUrl);
      if (!url) return undefined;
      const label = normalizeWhitespace(link.textContent ?? "") || "Link";
      return `${label} — ${url}`;
    })
    .filter((value): value is string => Boolean(value));
  const imageLines = [...selected.querySelectorAll("img[src]")]
    .map((image) => {
      const url = resolveHttpUrl(image.getAttribute("src") ?? "", baseUrl);
      if (!url) return undefined;
      const label =
        normalizeWhitespace(image.getAttribute("alt") ?? "") || "Image";
      return `${label} — ${url}`;
    })
    .filter((value): value is string => Boolean(value));
  const record: CaptureRecord = {
    text: normalizeWhitespace(selected.textContent ?? "") || null,
    links: linkLines.join("\n") || null,
    images: imageLines.join("\n") || null,
    source_url: baseUrl,
    element: descriptor(selected),
  };
  return {
    strategy: "generic",
    fields: fields([
      { id: "text", name: "Text" },
      { id: "links", name: "Links" },
      { id: "images", name: "Images" },
      { id: "source_url", name: "Source URL", kind: "link" },
      { id: "element", name: "Element" },
    ]),
    records: [record],
  };
}

export function extractQuickData(
  selected: Element,
  baseUrl = selected.ownerDocument.baseURI,
): QuickExtractionResult {
  if (selected instanceof HTMLTableElement) {
    return extractTable(selected, baseUrl);
  }
  return (
    extractRepeated(selected, baseUrl) ?? extractGeneric(selected, baseUrl)
  );
}
