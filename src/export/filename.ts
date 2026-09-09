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

export function siteShorthand(startUrl: string): string {
  try {
    const labels = new URL(startUrl).hostname
      .toLowerCase()
      .split(".")
      .filter(Boolean);
    const withoutSuffix = labels.length > 1 ? labels.slice(0, -1) : labels;
    while (
      withoutSuffix.length > 1 &&
      ["www", "app"].includes(withoutSuffix[0] ?? "")
    ) {
      withoutSuffix.shift();
    }
    return safePathSegment(withoutSuffix.join("-")).toLowerCase();
  } catch {
    return "site-capture";
  }
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
    `${siteShorthand(recipe.startUrl)}.zip`,
  ].join("/");
}
