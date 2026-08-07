import type { Recipe } from "../../contracts/models";

interface SettingsViewProps {
  recipes: Recipe[];
  permissions: Record<string, boolean>;
  retentionLimit: number;
  disabled: boolean;
  onExportConfiguration(): void | Promise<void>;
  onImportConfiguration(input: unknown): void | Promise<void>;
  onRequestAccess(origin: string): void | Promise<void>;
  onRevokeAccess(origin: string): void | Promise<void>;
}

export function SettingsView({
  recipes,
  permissions,
  retentionLimit,
  disabled,
  onExportConfiguration,
  onImportConfiguration,
  onRequestAccess,
  onRevokeAccess,
}: SettingsViewProps) {
  const origins = [...new Set(recipes.map((recipe) => recipe.origin))];
  return (
    <section className="popup-view" aria-label="Settings">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Local configuration</span>
          <h2>Settings</h2>
        </div>
      </div>
      <div className="settings-block">
        <strong>Website access</strong>
        <small>Only grant origins needed by saved recipes and schedules.</small>
        {origins.length === 0 ? (
          <span className="muted">No recipe origins yet.</span>
        ) : (
          origins.map((origin) => {
            const allowed = permissions[origin] ?? false;
            return (
              <div className="permission-row" key={origin}>
                <code>{origin}</code>
                <span>{allowed ? "Allowed" : "One-time only"}</span>
                <button
                  disabled={disabled}
                  onClick={() =>
                    void (allowed
                      ? onRevokeAccess(origin)
                      : onRequestAccess(origin))
                  }
                  type="button"
                >
                  {allowed ? "Revoke access" : "Allow access"}
                </button>
              </div>
            );
          })
        )}
      </div>
      <div className="settings-block">
        <strong>Retention</strong>
        <span>Keep the latest {retentionLimit} runs</span>
        <small>Pinned runs are always kept.</small>
      </div>
      <div className="settings-block">
        <strong>Configuration backup</strong>
        <small>Export or import versioned projects and recipes.</small>
        <div className="settings-actions">
          <button disabled={disabled} onClick={() => void onExportConfiguration()} type="button">
            Export configuration
          </button>
          <label className="file-control">
            Import configuration
            <input
              accept=".json,.scrapeyy.json"
              disabled={disabled}
              type="file"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (!file) return;
                void file.text().then(JSON.parse).then(onImportConfiguration);
              }}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
