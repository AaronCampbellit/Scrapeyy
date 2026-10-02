export type CaptureMode = "data" | "design" | "both";

export type RunStatus =
  | "success"
  | "warning"
  | "partial"
  | "missed"
  | "failed"
  | "cancelled";

export type FieldKind =
  | "text"
  | "link"
  | "image"
  | "attribute"
  | "html"
  | "design";

export interface FieldDefinition {
  id: string;
  name: string;
  kind: FieldKind;
  selector: string;
  sourceId?: string;
  attribute?: string;
  identity?: boolean;
}

export interface SmartExtractionSettings {
  kind: "smart";
  datasetKey: string;
}

export interface TraversalLimits {
  maxPages: number;
  maxItems: number;
  delayMs: number;
  timeoutMs: number;
}

export interface NoTraversalSettings extends TraversalLimits {
  kind: "none";
}

export interface NextTraversalSettings extends TraversalLimits {
  kind: "next";
  nextSelector: string;
  /** Zero-based position when a selector intentionally matches several controls. */
  nextMatchIndex?: number;
}

export interface InfiniteTraversalSettings extends TraversalLimits {
  kind: "infinite";
  scrollStepPx: number;
}

export type TraversalSettings =
  | NoTraversalSettings
  | NextTraversalSettings
  | InfiniteTraversalSettings;

export interface Schedule {
  enabled: boolean;
  cadence: "interval" | "daily";
  intervalMinutes?: number;
  localTime?: string;
}

export interface CaptureDestinations {
  inbox: boolean;
  autoDownload: boolean;
}

export interface QuickCaptureRequest {
  projectId: string;
  mode: CaptureMode;
  containerSelector: string;
  scope: "element" | "full-page";
}

export interface Recipe {
  version: 1;
  id: string;
  projectId: string;
  name: string;
  description?: string;
  origin: string;
  startUrl: string;
  mode: CaptureMode;
  containerSelector: string;
  extraction?: SmartExtractionSettings;
  fields: FieldDefinition[];
  traversal: TraversalSettings;
  destinations: CaptureDestinations;
  /** Run manual captures in a temporary inactive tab that is closed afterward. */
  manualRunInWorkerTab?: boolean;
  schedule: Schedule | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export type CaptureValue = string | null;
export type CaptureRecord = Record<string, CaptureValue>;

export interface RunError {
  code: string;
  message: string;
  recoverable: boolean;
  pageUrl?: string;
  selector?: string;
}

export interface CaptureRun {
  id: string;
  recipeId: string;
  projectId: string;
  trigger: "manual" | "scheduled" | "catch-up";
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  recordCount: number;
  records: CaptureRecord[];
  warnings?: string[];
  errors: RunError[];
  pinned: boolean;
  exportState: "none" | "queued" | "complete" | "failed";
  screenshot?: {
    kind: "visible" | "full-page" | "selection";
    title: string;
    filename: string;
    sourceUrl: string;
  };
}

export interface Repository<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(value: T): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface ConfigurationV1 {
  version: 1;
  projects: Project[];
  recipes: Recipe[];
}
