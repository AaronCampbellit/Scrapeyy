import type { CaptureMode } from "../../contracts/models";

export function CaptureOptions({
  mode, onChange, disabled = false,
}: {
  mode: CaptureMode;
  onChange(mode: CaptureMode): void;
  disabled?: boolean;
}) {
  const content = mode !== "design";
  const design = mode !== "data";
  return (
    <div className="capture-options" role="group" aria-label="Capture options">
      <label>
        <input type="checkbox" aria-label="Content" checked={content}
          disabled={disabled || !design}
          onChange={() => onChange(content ? "design" : "both")} />
        <span><strong>Content</strong><small>Text, tables, images, and media details</small></span>
      </label>
      <label>
        <input type="checkbox" aria-label="Design & Code" checked={design}
          disabled={disabled || !content}
          onChange={() => onChange(design ? "data" : "both")} />
        <span><strong>Design &amp; Code</strong><small>Appearance, styles, and page structure</small></span>
      </label>
    </div>
  );
}
