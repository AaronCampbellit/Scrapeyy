import type { Schedule } from "../../contracts/models";

interface ScheduleEditorProps {
  value: Schedule | null;
  onChange(value: Schedule | null): void;
}

export function ScheduleEditor({ value, onChange }: ScheduleEditorProps) {
  const enabled = Boolean(value?.enabled);
  return (
    <fieldset className="editor-fieldset">
      <legend>Schedule</legend>
      <label className="toggle-line">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) =>
            onChange(
              event.target.checked
                ? {
                    enabled: true,
                    cadence: "daily",
                    localTime: "09:00",
                  }
                : null,
            )
          }
        />
        <span>
          <strong>Run automatically</strong>
          <small>Requires persistent access and a running browser.</small>
        </span>
      </label>
      {value?.enabled ? (
        <div className="inline-fields">
          <label>
            Cadence
            <select
              value={value.cadence}
              onChange={(event) => {
                const cadence = event.target.value as Schedule["cadence"];
                onChange(
                  cadence === "interval"
                    ? { enabled: true, cadence, intervalMinutes: 60 }
                    : { enabled: true, cadence, localTime: "09:00" },
                );
              }}
            >
              <option value="daily">Daily</option>
              <option value="interval">Every interval</option>
            </select>
          </label>
          {value.cadence === "daily" ? (
            <label>
              Local time
              <input
                type="time"
                value={value.localTime ?? "09:00"}
                onChange={(event) =>
                  onChange({ ...value, localTime: event.target.value })
                }
              />
            </label>
          ) : (
            <label>
              Minutes
              <input
                type="number"
                min="5"
                value={value.intervalMinutes ?? 60}
                onChange={(event) =>
                  onChange({
                    ...value,
                    intervalMinutes: Number(event.target.value),
                  })
                }
              />
            </label>
          )}
        </div>
      ) : null}
    </fieldset>
  );
}
