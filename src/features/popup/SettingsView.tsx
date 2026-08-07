import { useEffect, useState } from "react";

import type { Recipe } from "../../contracts/models";
import type { AppSettings } from "../../storage/app-settings";

interface SettingsViewProps {
  recipes: Recipe[];
  permissions: Record<string, boolean>;
  retentionLimit: number;
  disabled: boolean;
  settings: AppSettings;
  onExportConfiguration(): void | Promise<void>;
  onImportConfiguration(input: unknown): void | Promise<void>;
  onRequestAccess(origin: string): void | Promise<void>;
  onRevokeAccess(origin: string): void | Promise<void>;
  onUpdateSettings(settings: AppSettings): void | Promise<void>;
}

export function SettingsView({
  recipes,
  permissions,
  retentionLimit,
  disabled,
  settings,
  onExportConfiguration,
  onImportConfiguration,
  onRequestAccess,
  onRevokeAccess,
  onUpdateSettings,
}: SettingsViewProps) {
  const origins = [...new Set(recipes.map((recipe) => recipe.origin))];
  const [downloadSubfolder, setDownloadSubfolder] = useState(
    settings.downloadSubfolder,
  );
  useEffect(() => {
    setDownloadSubfolder(settings.downloadSubfolder);
  }, [settings.downloadSubfolder]);
  return (
    <section className="popup-view" aria-label="Settings">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Local configuration</span>
          <h2>Settings</h2>
        </div>
      </div>
      <div className="settings-block">
        <strong>Appearance</strong>
        <label className="setting-toggle">
          <span>
            Dark mode
            <small>Use the dark theme in the popup and capture tools.</small>
          </span>
          <input
            aria-label="Dark mode"
            checked={settings.theme === "dark"}
            disabled={disabled}
            onChange={(event) =>
              void onUpdateSettings({
                ...settings,
                theme: event.currentTarget.checked ? "dark" : "light",
              })
            }
            role="switch"
            type="checkbox"
          />
        </label>
      </div>
      <div className="settings-block">
        <strong>Downloads</strong>
        <label className="settings-field">
          <span>Download behavior</span>
          <select
            aria-label="Download behavior"
            disabled={disabled}
            value={settings.downloadBehavior}
            onChange={(event) =>
              void onUpdateSettings({
                ...settings,
                downloadBehavior:
                  event.currentTarget.value === "automatic"
                    ? "automatic"
                    : "ask",
              })
            }
          >
            <option value="ask">Always ask where to save</option>
            <option value="automatic">Auto-save to Downloads</option>
          </select>
        </label>
        {settings.downloadBehavior === "automatic" ? (
          <>
            <label className="settings-field">
              <span>Subfolder inside Downloads</span>
              <input
                aria-label="Download subfolder"
                disabled={disabled}
                onChange={(event) =>
                  setDownloadSubfolder(event.currentTarget.value)
                }
                type="text"
                value={downloadSubfolder}
              />
            </label>
            <small>
              Files will save under Downloads/{downloadSubfolder || "Scrapeyy"}.
            </small>
            <button
              className="settings-save"
              disabled={disabled || downloadSubfolder.trim() === ""}
              onClick={() =>
                void onUpdateSettings({
                  ...settings,
                  downloadSubfolder,
                })
              }
              type="button"
            >
              Save download location
            </button>
          </>
        ) : (
          <small>The browser will show its Save As dialog for every export.</small>
        )}
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
