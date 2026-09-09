import type {
  CaptureRecord,
  TraversalSettings,
} from "../contracts/models";
import type {
  AdvanceResult,
  StopReason,
  TraversalEnvironment,
  TraversalResult,
} from "./types";

function stableRecordKey(record: CaptureRecord): string {
  return JSON.stringify(
    Object.keys(record)
      .sort()
      .map((key) => [key, record[key] ?? null]),
  );
}

function stopReasonForAdvance(result: AdvanceResult): StopReason | undefined {
  if (result === "complete") {
    return "complete";
  }
  if (result === "missing") {
    return "control-missing";
  }
  if (result === "disabled") {
    return "control-disabled";
  }
  if (result === "timeout") {
    return "timeout";
  }
  return undefined;
}

export async function runTraversal(
  settings: TraversalSettings,
  environment: TraversalEnvironment,
  extractPage: () => Promise<CaptureRecord[]>,
  identify: (record: CaptureRecord) => string = stableRecordKey,
): Promise<TraversalResult> {
  const records: CaptureRecord[] = [];
  const seen = new Set<string>();
  let pagesVisited = 1;

  const addRecords = (pageRecords: CaptureRecord[]): number => {
    let added = 0;
    for (const record of pageRecords) {
      const key = identify(record);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      records.push(record);
      added += 1;
      if (records.length === settings.maxItems) {
        break;
      }
    }
    return added;
  };

  addRecords(await extractPage());
  if (records.length >= settings.maxItems) {
    return {
      records,
      pagesVisited,
      stopReason: "item-limit",
      warnings: [],
    };
  }
  if (settings.kind === "none") {
    return {
      records,
      pagesVisited,
      stopReason: "complete",
      warnings: [],
    };
  }

  while (true) {
    if (pagesVisited >= settings.maxPages) {
      return {
        records,
        pagesVisited,
        stopReason: "page-limit",
        warnings: [],
      };
    }
    if (environment.cancelled()) {
      return {
        records,
        pagesVisited,
        stopReason: "cancelled",
        warnings: [],
      };
    }

    await environment.wait(settings.delayMs);
    const advance =
      settings.kind === "next"
        ? await environment.advanceNext(
            settings.nextSelector,
            settings.nextMatchIndex,
            settings.timeoutMs,
          )
        : await environment.advanceScroll(
            settings.scrollStepPx,
            settings.timeoutMs,
          );
    const advanceStop = stopReasonForAdvance(advance);
    if (advanceStop) {
      return {
        records,
        pagesVisited,
        stopReason: advanceStop,
        warnings:
          advanceStop === "timeout"
            ? ["The page did not change before the traversal timeout."]
            : [],
      };
    }

    pagesVisited += 1;
    const added = addRecords(await extractPage());
    if (records.length >= settings.maxItems) {
      return {
        records,
        pagesVisited,
        stopReason: "item-limit",
        warnings: [],
      };
    }
    if (added === 0) {
      return {
        records,
        pagesVisited,
        stopReason: "no-new-records",
        warnings: [],
      };
    }
  }
}
