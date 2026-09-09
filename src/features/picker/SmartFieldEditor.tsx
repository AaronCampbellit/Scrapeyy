import type { CaptureRecord, FieldDefinition } from "../../contracts/models";

interface SmartFieldEditorProps {
  available: FieldDefinition[];
  enabled: FieldDefinition[];
  records: CaptureRecord[];
  onChange(fields: FieldDefinition[]): void;
}

function configuredField(field: FieldDefinition): FieldDefinition {
  return {
    ...field,
    sourceId: field.id,
    selector: ":scope",
  };
}

export function SmartFieldEditor({
  available,
  enabled,
  records,
  onChange,
}: SmartFieldEditorProps) {
  const enabledFor = (sourceId: string) =>
    enabled.find((field) => (field.sourceId ?? field.id) === sourceId);
  const sampleFor = (sourceId: string) =>
    records.find((record) => record[sourceId]?.trim())?.[sourceId] ?? "No sample value";

  return (
    <div className="smart-field-list">
      {available.map((sourceField) => {
        const field = enabledFor(sourceField.id);
        return (
          <div className={`smart-field${field ? " is-enabled" : ""}`} key={sourceField.id}>
            <label className="smart-field-toggle">
              <input
                aria-label={`Include ${sourceField.name}`}
                checked={Boolean(field)}
                type="checkbox"
                onChange={(event) =>
                  onChange(
                    event.currentTarget.checked
                      ? [...enabled, configuredField(sourceField)]
                      : enabled.filter(
                          (candidate) =>
                            (candidate.sourceId ?? candidate.id) !== sourceField.id,
                        ),
                  )
                }
              />
              <span>{sourceField.name}</span>
            </label>
            {field ? (
              <label className="smart-field-name">
                <span className="sr-only">Rename {sourceField.name}</span>
                <input
                  aria-label={`Rename ${sourceField.name}`}
                  value={field.name}
                  onChange={(event) =>
                    onChange(
                      enabled.map((candidate) =>
                        candidate.id === field.id
                          ? { ...candidate, name: event.currentTarget.value }
                          : candidate,
                      ),
                    )
                  }
                />
              </label>
            ) : null}
            <small>{sampleFor(sourceField.id)}</small>
          </div>
        );
      })}
    </div>
  );
}
