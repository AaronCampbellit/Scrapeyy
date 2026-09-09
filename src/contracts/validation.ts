import type {
  CaptureMode,
  FieldDefinition,
  FieldKind,
  Recipe,
  Schedule,
  TraversalSettings,
} from "./models";

const captureModes = new Set<CaptureMode>(["data", "design", "both"]);
const fieldKinds = new Set<FieldKind>([
  "text",
  "link",
  "image",
  "attribute",
  "html",
  "design",
]);

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, label: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value as number;
}

function isoDate(value: unknown, label: string): string {
  const result = string(value, label);
  if (Number.isNaN(Date.parse(result))) {
    throw new Error(`${label} must be an ISO date`);
  }
  return result;
}

function url(value: unknown, label: string): URL {
  const raw = string(value, label);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${label} must use http or https`);
  }
  return parsed;
}

function validateField(input: unknown, index: number): FieldDefinition {
  const value = record(input, `fields[${index}]`);
  const kind = string(value.kind, `fields[${index}].kind`);
  if (!fieldKinds.has(kind as FieldKind)) {
    throw new Error(`fields[${index}].kind is unsupported`);
  }
  const attribute =
    kind === "attribute"
      ? string(value.attribute, `fields[${index}].attribute`)
      : undefined;
  return {
    id: string(value.id, `fields[${index}].id`),
    name: string(value.name, `fields[${index}].name`),
    kind: kind as FieldKind,
    selector: string(value.selector, `fields[${index}].selector`),
    ...(typeof value.sourceId === "string" && value.sourceId.trim() !== ""
      ? { sourceId: value.sourceId.trim() }
      : {}),
    ...(attribute === undefined ? {} : { attribute }),
    ...(typeof value.identity === "boolean" ? { identity: value.identity } : {}),
  };
}

function validateTraversal(input: unknown): TraversalSettings {
  const value = record(input, "traversal");
  const kind = string(value.kind, "traversal.kind");
  const limits = {
    maxPages: positiveInteger(value.maxPages, "traversal.maxPages"),
    maxItems: positiveInteger(value.maxItems, "traversal.maxItems"),
    delayMs: nonNegativeInteger(value.delayMs, "traversal.delayMs"),
    timeoutMs: positiveInteger(value.timeoutMs, "traversal.timeoutMs"),
  };
  if (kind === "none") {
    return { kind, ...limits };
  }
  if (kind === "next") {
    return {
      kind,
      nextSelector: string(value.nextSelector, "traversal.nextSelector"),
      ...(value.nextMatchIndex === undefined
        ? {}
        : {
            nextMatchIndex: nonNegativeInteger(
              value.nextMatchIndex,
              "traversal.nextMatchIndex",
            ),
          }),
      ...limits,
    };
  }
  if (kind === "infinite") {
    return {
      kind,
      scrollStepPx: positiveInteger(
        value.scrollStepPx,
        "traversal.scrollStepPx",
      ),
      ...limits,
    };
  }
  throw new Error("traversal.kind is unsupported");
}

function validateSchedule(input: unknown): Schedule | null {
  if (input === null) {
    return null;
  }
  const value = record(input, "schedule");
  if (typeof value.enabled !== "boolean") {
    throw new Error("schedule.enabled must be a boolean");
  }
  const cadence = string(value.cadence, "schedule.cadence");
  if (cadence === "interval") {
    return {
      enabled: value.enabled,
      cadence,
      intervalMinutes: positiveInteger(
        value.intervalMinutes,
        "schedule.intervalMinutes",
      ),
    };
  }
  if (cadence === "daily") {
    const localTime = string(value.localTime, "schedule.localTime");
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(localTime)) {
      throw new Error("schedule.localTime must use HH:MM");
    }
    return { enabled: value.enabled, cadence, localTime };
  }
  throw new Error("schedule.cadence is unsupported");
}

export function validateRecipe(input: unknown): Recipe {
  const value = record(input, "recipe");
  if (value.version !== 1) {
    throw new Error("version must be 1");
  }
  const mode = string(value.mode, "mode");
  if (!captureModes.has(mode as CaptureMode)) {
    throw new Error("mode is unsupported");
  }
  if (!Array.isArray(value.fields) || value.fields.length === 0) {
    throw new Error("fields must contain at least one field");
  }
  const fields = value.fields.map(validateField);
  if (new Set(fields.map((field) => field.id)).size !== fields.length) {
    throw new Error("field ids must be unique");
  }
  const startUrl = url(value.startUrl, "startUrl");
  const origin = url(value.origin, "origin");
  if (origin.origin !== startUrl.origin) {
    throw new Error("origin must match startUrl");
  }
  const destinations = record(value.destinations, "destinations");
  if (
    typeof destinations.inbox !== "boolean" ||
    typeof destinations.autoDownload !== "boolean"
  ) {
    throw new Error("destinations must use boolean values");
  }
  const extraction = value.extraction === undefined
    ? undefined
    : record(value.extraction, "extraction");
  if (extraction && extraction.kind !== "smart") {
    throw new Error("extraction.kind is unsupported");
  }
  return {
    version: 1,
    id: string(value.id, "id"),
    projectId: string(value.projectId, "projectId"),
    name: string(value.name, "name"),
    ...(typeof value.description === "string" &&
    value.description.trim() !== ""
      ? { description: value.description.trim() }
      : {}),
    origin: origin.origin,
    startUrl: startUrl.href,
    mode: mode as CaptureMode,
    containerSelector: string(value.containerSelector, "containerSelector"),
    ...(extraction
      ? {
          extraction: {
            kind: "smart" as const,
            datasetKey: string(extraction.datasetKey, "extraction.datasetKey"),
          },
        }
      : {}),
    fields,
    traversal: validateTraversal(value.traversal),
    destinations: {
      inbox: destinations.inbox as boolean,
      autoDownload: destinations.autoDownload as boolean,
    },
    ...(typeof value.manualRunInWorkerTab === "boolean"
      ? { manualRunInWorkerTab: value.manualRunInWorkerTab }
      : {}),
    schedule: validateSchedule(value.schedule),
    createdAt: isoDate(value.createdAt, "createdAt"),
    updatedAt: isoDate(value.updatedAt, "updatedAt"),
  };
}
