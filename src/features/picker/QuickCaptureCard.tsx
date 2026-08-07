import { useState } from "react";

import type { CaptureMode } from "../../contracts/models";

interface QuickCaptureCardProps {
  description: string;
  busy: boolean;
  onCapture(mode: CaptureMode): void | Promise<void>;
  onCancel(): void;
  onReselect(): void;
}

export function QuickCaptureCard({
  description,
  busy,
  onCapture,
  onCancel,
  onReselect,
}: QuickCaptureCardProps) {
  const [mode, setMode] = useState<CaptureMode>("data");
  return (
    <aside className="quick-capture-card" aria-label="Quick Capture">
      <span className="picker-kicker">Selected content</span>
      <strong>{description}</strong>
      <div
        className="segmented"
        role="group"
        aria-label="Capture type"
      >
        {(["data", "design", "both"] as const).map((value) => (
          <button
            aria-pressed={mode === value}
            disabled={busy}
            key={value}
            onClick={() => setMode(value)}
            type="button"
          >
            {value[0]!.toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
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
