import type {
  CaptureRun,
  Project,
  Recipe,
} from "../contracts/models";

export function safePathSegment(value: string): string {
  const result = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/^\.+/, "")
    .replace(/-+/g, "-")
    .replace(/^[\s.-]+|[\s.-]+$/g, "")
    .slice(0, 80);
  return result || "Untitled";
}

function runTimestamp(run: CaptureRun): string {
  return new Date(run.startedAt)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/:/g, "-");
}

export function buildDownloadPath(
  project: Project,
  recipe: Recipe,
  run: CaptureRun,
  root = "Scrapeyy",
): string {
  return [
    ...root.split("/").map(safePathSegment),
    safePathSegment(project.name),
    safePathSegment(recipe.name),
    runTimestamp(run),
    "scrapeyy-run.zip",
  ].join("/");
}
