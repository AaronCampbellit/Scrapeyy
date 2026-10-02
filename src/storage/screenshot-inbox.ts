import type { CaptureRun } from "../contracts/models";
import { sanitizeCapturedUrl } from "../extraction/normalize";
import { CAPTURE_VERSION, type ScreenshotInboxSaved } from "../platform/screenshot-messages";
import type { CaptureDatabase } from "./capture-database";
import { applyRetention } from "./retention";

export async function saveScreenshotToInbox(
  image: Blob,
  screenshot: NonNullable<CaptureRun["screenshot"]>,
  database: CaptureDatabase,
): Promise<ScreenshotInboxSaved> {
  const now = new Date().toISOString();
  const run: CaptureRun = {
    id: crypto.randomUUID(), recipeId: "standalone-screenshot", projectId: "default-project",
    trigger: "manual", status: "success", startedAt: now, completedAt: now,
    recordCount: 0, records: [], errors: [], pinned: false, exportState: "none",
    screenshot: { ...screenshot, sourceUrl: sanitizeCapturedUrl(screenshot.sourceUrl) },
  };
  await database.putRunWithArtifacts(run, [{
    id: `${run.id}:screenshot`, runId: run.id, name: screenshot.filename, blob: image,
    sourceUrl: run.screenshot!.sourceUrl,
  }]);
  const expired = applyRetention(await database.listRuns(), 20);
  await Promise.all(expired.map((id) => database.deleteRun(id)));
  return { status: "saved", destination: "inbox", version: CAPTURE_VERSION, runId: run.id, filename: screenshot.filename };
}
