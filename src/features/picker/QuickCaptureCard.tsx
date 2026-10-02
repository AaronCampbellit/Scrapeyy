import type { CaptureMode } from "../../contracts/models";
import { CaptureOptions } from "../shared/CaptureOptions";

interface QuickCaptureCardProps {
  description: string;
  busy: boolean;
  mode: CaptureMode;
  onModeChange(mode: CaptureMode): void;
  onCapture(mode: CaptureMode): void | Promise<void>;
  onCancel(): void;
  onReselect(): void;
}

export function QuickCaptureCard({
  description,
  busy,
  mode,
  onModeChange,
  onCapture,
  onCancel,
  onReselect,
}: QuickCaptureCardProps) {
  return (
    <aside className="quick-capture-card" aria-label="Quick Capture">
      <span className="picker-kicker">Selected content</span>
      <strong>{description}</strong>
      <CaptureOptions mode={mode} onChange={onModeChange} disabled={busy} />
      <button
        className="button button-primary quick-confirm"
        disabled={busy}
        onClick={() => void onCapture(mode)}
        type="button"
      >
        {busy ? "Capturing…" : "Capture"}
      </button>
      <div className="quick-secondary-actions">
        <button className="text-button" disabled={busy} onClick={onReselect} type="button">
          Reselect
        </button>
        <button className="text-button" disabled={busy} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </aside>
  );
}
