import type {
  CaptureRecord,
  FieldDefinition,
} from "../contracts/models";

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function fingerprintRecord(
  record: CaptureRecord,
  fields: FieldDefinition[],
): string {
  const identityFields = fields.filter((field) => field.identity);
  const selected = identityFields.length > 0 ? identityFields : fields;
  const serialized = JSON.stringify(
    selected.map((field) => [field.id, record[field.id] ?? null]),
  );
  return fnv1a(serialized);
}
