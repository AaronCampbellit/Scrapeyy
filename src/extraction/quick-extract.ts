import type {
  CaptureRecord,
  FieldDefinition,
} from "../contracts/models";
import {
  normalizeWhitespace,
  resolveHttpUrl,
  sanitizeCapturedUrl,
} from "./normalize";

export interface QuickExtractionResult {
  strategy: "table" | "repeated" | "dashboard" | "generic";
  fields: FieldDefinition[];
  records: CaptureRecord[];
}

export interface QuickDataset {
  key: string;
  name: string;
  strategy: QuickExtractionResult["strategy"];
  fields: FieldDefinition[];
  records: CaptureRecord[];
}

const SKIPPED_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "SCRAPEYY-PICKER",
]);
const STRUCTURAL_CONTAINER = "table, [role='table'], [role='grid']";

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

function isHidden(element: Element): boolean {
  if (
    element.hasAttribute("hidden") ||
    element.hasAttribute("inert") ||
    element.getAttribute("aria-hidden") === "true"
  ) {
    return true;
  }
  const html = element as HTMLElement;
  if (
    html.style?.display === "none" ||
    html.style?.visibility === "hidden" ||
    html.style?.contentVisibility === "hidden"
  ) {
    return true;
  }
  try {
    const view = element.ownerDocument.defaultView;
    const style = view?.getComputedStyle(element);
    return (
      style?.display === "none" ||
      style?.visibility === "hidden" ||
      style?.contentVisibility === "hidden"
    );
  } catch {
    return false;
  }
}

function childNodesIncludingOpenRoots(element: Element): Node[] {
  const nodes: Node[] = [...element.childNodes];
  if (element.shadowRoot) nodes.push(...element.shadowRoot.childNodes);
  if (element instanceof HTMLIFrameElement) {
    try {
      if (element.contentDocument?.documentElement) {
        nodes.push(element.contentDocument.documentElement);
      }
    } catch {
      // Cross-origin frames are intentionally inaccessible to page scripts.
    }
  }
  return nodes;
}

function readableText(element: Element): string | null {
  const parts: string[] = [];
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = normalizeWhitespace(node.nodeValue ?? "");
      if (value) parts.push(value);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const child = node as Element;
    if (SKIPPED_TAGS.has(child.tagName) || isHidden(child)) return;
    const accessible =
      child.matches("canvas, img, [role='img']") &&
      normalizeWhitespace(
        child.getAttribute("aria-label") ?? child.getAttribute("alt") ?? "",
      );
    if (accessible) parts.push(accessible);
    childNodesIncludingOpenRoots(child).forEach(visit);
  };
  visit(element);
  return normalizeWhitespace(parts.join(" ")) || null;
}

function deepElements(root: Element): Element[] {
  const result: Element[] = [];
  const seen = new Set<Node>();
  const visit = (node: Node) => {
    if (seen.has(node)) return;
    seen.add(node);
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    if (element !== root) result.push(element);
    if (SKIPPED_TAGS.has(element.tagName) || isHidden(element)) return;
    childNodesIncludingOpenRoots(element).forEach(visit);
  };
  visit(root);
  return result;
}

function deepMatches(root: Element, selector: string): Element[] {
  return [root, ...deepElements(root)].filter((element) =>
    element.matches(selector),
  );
}

function cellValue(element: Element, baseUrl: string): string | null {
  const text = readableText(element);
  const urls = deepMatches(element, "a[href], img[src]")
    .map((target) =>
      resolveHttpUrl(
        target.getAttribute(target.matches("a") ? "href" : "src") ?? "",
        baseUrl,
      ),
    )
    .filter((value): value is string => Boolean(value));
  const additions = [...new Set(urls)].filter((url) => !text?.includes(url));
  return [text, ...additions].filter(Boolean).join(" — ") || null;
}

function nativeTableRows(table: HTMLTableElement): HTMLTableRowElement[] {
  return [...table.rows].filter((row) => row.closest("table") === table);
}

function ariaRowCells(row: Element): Element[] {
  return [...row.querySelectorAll("[role='columnheader'], [role='rowheader'], [role='cell'], [role='gridcell']")]
    .filter((cell) => cell.closest("[role='row']") === row);
}

function tableData(
  table: Element,
  baseUrl: string,
): { names: string[]; ids: string[]; records: CaptureRecord[] } | undefined {
  const rows = table instanceof HTMLTableElement
    ? nativeTableRows(table)
    : deepMatches(table, "[role='row']").filter(
        (row) => row.closest(STRUCTURAL_CONTAINER) === table,
      );
  if (rows.length === 0) return undefined;
  const cells = (row: Element): Element[] =>
    row instanceof HTMLTableRowElement ? [...row.cells] : ariaRowCells(row);
  const headerRow = rows.find((row) =>
    cells(row).some((cell) =>
      cell.matches("th, [role='columnheader']"),
    ),
  );
  const columnCount = Math.max(0, ...rows.map((row) => cells(row).length));
  if (columnCount === 0) return undefined;
  const headerCells = headerRow ? cells(headerRow) : [];
  const names = Array.from({ length: columnCount }, (_, index) => {
    const headerCell = headerCells[index];
    return (headerCell ? readableText(headerCell) : null) || `Column ${index + 1}`;
  });
  const ids = uniqueIds(names);
  const dataRows = rows.filter((row) => row !== headerRow);
  if (dataRows.length === 0) return undefined;
  return {
    names,
    ids,
    records: dataRows.map((row) => {
      const rowCells = cells(row);
      return Object.fromEntries(
        ids.map((id, index) => [
          id,
          rowCells[index] ? cellValue(rowCells[index]!, baseUrl) : null,
        ]),
      );
    }),
  };
}

function extractTable(
  table: Element,
  baseUrl: string,
): QuickExtractionResult {
  const data = tableData(table, baseUrl);
  if (!data) return extractGeneric(table, baseUrl);
  return {
    strategy: "table",
    fields: fields(data.ids.map((id, index) => ({ id, name: data.names[index]! }))),
    records: data.records,
  };
}

function childSignature(element: Element): string {
  const role = element.getAttribute("role") ?? "";
  return `${element.tagName.toLowerCase()}[${role}].${[...element.classList]
    .sort()
    .join(".")}`;
}

function repeatedChildren(selected: Element): Element[] {
  const children = [...selected.children].filter((child) => !isHidden(child));
  if (children.length < 2) return [];
  const groups = new Map<string, Element[]>();
  for (const child of children) {
    const signature = childSignature(child);
    groups.set(signature, [...(groups.get(signature) ?? []), child]);
  }
  return [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
}

function commonCount(items: Element[], selector: string): number {
  return items.filter((item) => deepMatches(item, selector).length > 0).length;
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
    inferred.push({ id: "link", name: "Link", kind: "link", selector: "a[href]" });
  }
  if (commonCount(items, "img[src]") >= threshold) {
    inferred.push({ id: "image", name: "Image", kind: "image", selector: "img[src]" });
  }
  if (inferred.length === 0) return undefined;
  if (!inferred.some((field) => field.kind === "text")) {
    inferred.unshift({ id: "text", name: "Text", kind: "text", selector: ":scope" });
  }
  return {
    strategy: "repeated",
    fields: inferred.map(({ id, name, kind, selector }) => ({ id, name, kind, selector })),
    records: items.map((item) =>
      Object.fromEntries(
        inferred.map((field) => {
          const target = field.selector === ":scope"
            ? item
            : deepMatches(item, field.selector)[0];
          if (!target) return [field.id, null];
          if (field.kind === "link") {
            return [field.id, resolveHttpUrl(target.getAttribute("href") ?? "", baseUrl)];
          }
          if (field.kind === "image") {
            return [field.id, resolveHttpUrl(target.getAttribute("src") ?? "", baseUrl)];
          }
          return [field.id, readableText(target)];
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

function sectionLabel(element: Element): string | null {
  if (element instanceof HTMLTableElement) {
    const caption = readableText(element.caption ?? element);
    if (element.caption && caption) return caption.slice(0, 120);
  }
  let current: Element | null = element;
  for (let depth = 0; current && depth < 5; depth += 1) {
    const ariaLabel = normalizeWhitespace(current.getAttribute("aria-label") ?? "");
    if (ariaLabel && ariaLabel.length <= 120) return ariaLabel;
    const heading = [...current.children].find((child) =>
      child.matches("h1, h2, h3, h4, h5, h6, [role='heading']"),
    );
    const headingText = heading ? readableText(heading) : null;
    if (headingText && headingText.length <= 120) return headingText;
    current = current.parentElement;
  }
  return element.ownerDocument.title || null;
}

function isMetricValue(value: string): boolean {
  return value.length <= 80 && /\d/.test(value);
}

function isMetricLabel(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 100 &&
    /[a-z]/i.test(value) &&
    !/\d/.test(value) &&
    value.split(/\s+/).length <= 14
  );
}

function metricRecords(root: Element): CaptureRecord[] {
  const records: CaptureRecord[] = [];
  const seen = new Set<string>();
  for (const parent of [root, ...deepElements(root)]) {
    if (
      parent.matches("nav, header, footer, menu, table, [role='table'], [role='grid'], [role='row']") ||
      parent.closest("nav, header, footer, menu, table, [role='table'], [role='grid']")
    ) continue;
    const children = [...parent.children].filter((child) => !isHidden(child));
    if (children.length < 2 || children.length > 10) continue;
    const parts = children
      .map((child) => ({ child, text: readableText(child) }))
      .filter((part): part is { child: Element; text: string } =>
        Boolean(part.text && part.text.length <= 120),
      );
    if (parts.length < 2) continue;
    for (let index = 0; index < parts.length; index += 1) {
      const valuePart = parts[index]!;
      if (!isMetricValue(valuePart.text)) continue;
      const neighbors = [parts[index - 1], parts[index + 1]].filter(
        (part): part is { child: Element; text: string } => Boolean(part),
      );
      const labelPart = neighbors.find((part) => isMetricLabel(part.text));
      if (!labelPart) continue;
      const section = sectionLabel(parent);
      const key = `${section ?? ""}\u0000${labelPart.text}\u0000${valuePart.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const context = parts
        .filter((part) => part !== valuePart && part !== labelPart)
        .map((part) => part.text)
        .filter((text) => text.length <= 80)
        .slice(0, 2)
        .join(" · ");
      records.push({
        record_type: "metric",
        section,
        label: labelPart.text,
        value: valuePart.text,
        context: context || null,
      });
    }
  }
  return records;
}

function genericRecord(selected: Element, baseUrl: string): CaptureRecord {
  const linkLines = deepMatches(selected, "a[href]")
    .map((link) => {
      const url = resolveHttpUrl(link.getAttribute("href") ?? "", baseUrl);
      if (!url) return undefined;
      const label = readableText(link) || "Link";
      return `${label} — ${url}`;
    })
    .filter((value): value is string => Boolean(value));
  const imageLines = deepMatches(selected, "img[src]")
    .map((image) => {
      const url = resolveHttpUrl(image.getAttribute("src") ?? "", baseUrl);
      if (!url) return undefined;
      const label = normalizeWhitespace(image.getAttribute("alt") ?? "") || "Image";
      return `${label} — ${url}`;
    })
    .filter((value): value is string => Boolean(value));
  return {
    text: readableText(selected),
    links: [...new Set(linkLines)].join("\n") || null,
    images: [...new Set(imageLines)].join("\n") || null,
    source_url: sanitizeCapturedUrl(baseUrl),
    element: descriptor(selected),
  };
}

function fieldName(id: string): string {
  const known: Record<string, string> = {
    record_type: "Record Type",
    section: "Section",
    label: "Label",
    value: "Value",
    context: "Context",
    text: "Text",
    links: "Links",
    images: "Images",
    source_url: "Source URL",
    element: "Element",
  };
  return known[id] ?? id.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function fieldsFromRecords(records: CaptureRecord[]): FieldDefinition[] {
  const ids = [...new Set(records.flatMap((record) => Object.keys(record)))];
  return fields(ids.map((id) => ({
    id,
    name: fieldName(id),
    kind: id === "source_url" ? "link" as const : "text" as const,
  })));
}

function extractDashboard(
  selected: Element,
  baseUrl: string,
): QuickExtractionResult | undefined {
  const records: CaptureRecord[] = [];
  const tables = deepMatches(selected, STRUCTURAL_CONTAINER).filter(
    (table, index, all) => !all.some((other, otherIndex) =>
      otherIndex !== index && other.contains(table),
    ),
  );
  for (const table of tables) {
    const data = tableData(table, baseUrl);
    if (!data) continue;
    const section = sectionLabel(table);
    records.push(...data.records.map((record) => ({
      record_type: "table_row",
      section,
      ...record,
    })));
  }
  records.push(...metricRecords(selected));
  if (records.length === 0) return undefined;
  records.push({
    record_type: "page_text",
    section: selected.ownerDocument.title || null,
    ...genericRecord(selected, baseUrl),
  });
  return {
    strategy: "dashboard",
    fields: fieldsFromRecords(records),
    records,
  };
}

function extractGeneric(
  selected: Element,
  baseUrl: string,
): QuickExtractionResult {
  const record = genericRecord(selected, baseUrl);
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
  if (
    selected instanceof HTMLTableElement ||
    selected.matches("[role='table'], [role='grid']")
  ) {
    return extractTable(selected, baseUrl);
  }
  return (
    extractRepeated(selected, baseUrl) ??
    extractDashboard(selected, baseUrl) ??
    extractGeneric(selected, baseUrl)
  );
}

function datasetFields(
  records: CaptureRecord[],
  available: FieldDefinition[],
): FieldDefinition[] {
  const ids = [...new Set(records.flatMap((record) => Object.keys(record)))];
  return ids.map((id) =>
    available.find((field) => field.id === id) ?? {
      id,
      name: fieldName(id),
      kind: id === "source_url" ? "link" : "text",
      selector: ":scope",
    },
  );
}

export function detectQuickDatasets(
  selected: Element,
  baseUrl = selected.ownerDocument.baseURI,
): QuickDataset[] {
  const result = extractQuickData(selected, baseUrl);
  if (result.strategy !== "dashboard") {
    return [{
      key: result.strategy,
      name:
        result.strategy === "table"
          ? "Table rows"
          : result.strategy === "repeated"
            ? "Repeated items"
            : "Visible page content",
      strategy: result.strategy,
      fields: result.fields,
      records: result.records,
    }];
  }

  const groups = new Map<string, { name: string; records: CaptureRecord[] }>();
  for (const record of result.records) {
    const type = record.record_type ?? "content";
    const section = record.section ?? selected.ownerDocument.title ?? "Page";
    const key = type === "page_text"
      ? "page-text"
      : `${type}:${slug(section, "page")}`;
    const name = type === "metric"
      ? `${section} — Metrics`
      : type === "table_row"
        ? `${section} — Table`
        : "Complete visible page text";
    const group = groups.get(key) ?? { name, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }

  const datasets: QuickDataset[] = [...groups].map(([key, group]) => ({
    key,
    name: group.name,
    strategy: "dashboard",
    fields: datasetFields(group.records, result.fields),
    records: group.records,
  }));
  return [
    {
      key: "all",
      name: "All detected data",
      strategy: "dashboard",
      fields: result.fields,
      records: result.records,
    },
    ...datasets,
  ];
}
