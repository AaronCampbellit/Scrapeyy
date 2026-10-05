import type { CaptureRun } from "../../contracts/models";

export function captureText(run: CaptureRun): string {
  return run.records
    .map((record) => {
      if (record.text?.trim()) return record.text.trim();
      return Object.entries(record)
        .filter(
          ([key, value]) =>
            value?.trim() &&
            !["source_url", "links", "images", "element"].includes(key),
        )
        .map(([key, value]) => `${key.replaceAll("_", " ")}: ${value}`)
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}
