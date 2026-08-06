import type { FieldDefinition, FieldKind } from "../../contracts/models";

interface FieldEditorProps {
  fields: FieldDefinition[];
  onChange(fields: FieldDefinition[]): void;
}

const fieldKinds: Array<{ value: FieldKind; label: string }> = [
  { value: "text", label: "Text" },
  { value: "link", label: "Link" },
  { value: "image", label: "Image" },
  { value: "attribute", label: "Attribute" },
  { value: "html", label: "HTML" },
];

export function FieldEditor({ fields, onChange }: FieldEditorProps) {
  const update = (
    index: number,
    change: Partial<FieldDefinition>,
  ): void => {
    onChange(
      fields.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...change } : field,
      ),
    );
  };

  return (
    <div className="field-editor">
      {fields.map((field, index) => (
        <div className="field-row" key={field.id}>
          <span className="drag-handle" aria-hidden="true">
            ⋮⋮
          </span>
          <label>
            <span className="sr-only">Field name</span>
            <input
              aria-label={`Field ${index + 1} name`}
              value={field.name}
              onChange={(event) =>
                update(index, { name: event.currentTarget.value })
              }
            />
          </label>
          <label>
            <span className="sr-only">Field type</span>
            <select
              aria-label={`Field ${index + 1} type`}
              value={field.kind}
              onChange={(event) =>
                update(index, {
                  kind: event.currentTarget.value as FieldKind,
                })
              }
            >
              {fieldKinds.map((kind) => (
                <option key={kind.value} value={kind.value}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Field selector</span>
            <input
              aria-label={`Field ${index + 1} selector`}
              className="mono"
              value={field.selector}
              onChange={(event) =>
                update(index, { selector: event.currentTarget.value })
              }
            />
          </label>
          <button
            aria-label={`Remove ${field.name} field`}
            className="icon-button"
            onClick={() =>
              onChange(fields.filter((_, fieldIndex) => fieldIndex !== index))
            }
            type="button"
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="button button-small"
        onClick={() =>
          onChange([
            ...fields,
            {
              id: `field-${crypto.randomUUID()}`,
              name: `Field ${fields.length + 1}`,
              kind: "text",
              selector: ":scope",
            },
          ])
        }
        type="button"
      >
        + Add field
      </button>
    </div>
  );
}
