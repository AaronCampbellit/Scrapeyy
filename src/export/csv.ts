import type {
  CaptureRecord,
  FieldDefinition,
} from "../contracts/models";

function safeSpreadsheetValue(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function csvCell(value: string | null): string {
  if (value === null) {
    return "";
  }
  const safe = safeSpreadsheetValue(value);
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function serializeCsv(
  records: CaptureRecord[],
  fields: FieldDefinition[],
): string {
  const rows = [
    fields.map((field) => csvCell(field.name)).join(","),
    ...records.map((record) =>
      fields.map((field) => csvCell(record[field.id] ?? null)).join(","),
    ),
  ];
  return `${rows.join("\r\n")}\r\n`;
}
