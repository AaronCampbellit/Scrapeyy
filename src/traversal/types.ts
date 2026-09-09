import type { CaptureRecord } from "../contracts/models";

export type AdvanceResult =
  | "advanced"
  | "complete"
  | "missing"
  | "disabled"
  | "timeout";

export type StopReason =
  | "complete"
  | "page-limit"
  | "item-limit"
  | "no-new-records"
  | "control-missing"
  | "control-disabled"
  | "timeout"
  | "cancelled";

export interface TraversalEnvironment {
  cancelled(): boolean;
  wait(delayMs: number): Promise<void>;
  advanceNext(
    selector: string,
    matchIndex: number | undefined,
    timeoutMs: number,
  ): Promise<AdvanceResult>;
  advanceScroll(stepPx: number, timeoutMs: number): Promise<AdvanceResult>;
}

export interface TraversalResult {
  records: CaptureRecord[];
  pagesVisited: number;
  stopReason: StopReason;
  warnings: string[];
}
