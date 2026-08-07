import type { PopupSite } from "./PopupApp";

interface CaptureViewProps {
  site?: PopupSite | undefined;
  disabled: boolean;
  onCreateRecipe(): void | Promise<void>;
  onQuickCapture(): void | Promise<void>;
}

export function CaptureView({
  site,
  disabled,
  onCreateRecipe,
  onQuickCapture,
}: CaptureViewProps) {
  const available = site && site.access !== "unavailable";
  return (
    <section className="popup-view capture-view" aria-label="Capture">
      <div className="site-card">
        <div>
          <span className="eyebrow">Current site</span>
          <strong className="site-origin">{site?.origin ?? "Open a website"}</strong>
        </div>
        <span className={`status-dot status-${site?.access ?? "unavailable"}`}>
          {!available
            ? "Unavailable on this page"
            : site.access === "persistent"
              ? "Always allowed"
              : "Allowed for this visit"}
        </span>
      </div>
      <button
        aria-label="Quick Capture"
        className="capture-primary"
        disabled={!available || disabled}
        onClick={() => void onQuickCapture()}
        type="button"
      >
        <span className="capture-icon" aria-hidden="true">+</span>
        <span>
          <strong>Quick Capture</strong>
          <small>Click a region, choose Data, Design, or Both</small>
        </span>
      </button>
      <button
        aria-label="Create Recipe"
        className="capture-secondary"
        disabled={!available || disabled}
        onClick={() => void onCreateRecipe()}
        type="button"
      >
        <span>
          <strong>Create Recipe</strong>
          <small>Add fields, pagination, schedules, and delivery</small>
        </span>
        <span aria-hidden="true">→</span>
      </button>
      <div className="local-note">
        <span aria-hidden="true">●</span>
        Captures stay in this browser.
      </div>
    </section>
  );
}
