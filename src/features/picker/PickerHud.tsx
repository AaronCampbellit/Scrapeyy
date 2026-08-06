interface PickerHudProps {
  canSelect: boolean;
  onSelect(): void;
  onParent(): void;
  onCancel(): void;
}

export function PickerHud({
  canSelect,
  onSelect,
  onParent,
  onCancel,
}: PickerHudProps) {
  return (
    <div className="picker-hud" aria-label="Element picker controls">
      <div className="picker-hud-actions">
        <button
          className="button button-primary"
          disabled={!canSelect}
          onClick={onSelect}
          type="button"
        >
          Select element
        </button>
        <button className="button button-dark" onClick={onParent} type="button">
          Parent
        </button>
        <button className="button button-dark" onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
      <p>
        Press <kbd>Esc</kbd> to cancel
      </p>
    </div>
  );
}
