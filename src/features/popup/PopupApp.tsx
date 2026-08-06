import { useMemo, useState } from "react";

import "../shared/theme.css";
import "./popup.css";

export interface PopupRecipe {
  id: string;
  name: string;
}

export interface PopupSite {
  origin: string;
  access: "one-time" | "persistent" | "unavailable";
}

export interface PopupAppProps {
  site?: PopupSite;
  recipes?: PopupRecipe[];
  onQuickCapture?: () => void | Promise<void>;
  onRunRecipe?: (recipeId: string) => void | Promise<void>;
  onOpenDashboard?: () => void | Promise<void>;
  onTogglePersistentAccess?: (
    origin: string,
    enable: boolean,
  ) => void | Promise<void>;
}

export function PopupApp({
  site,
  recipes = [],
  onQuickCapture,
  onRunRecipe,
  onOpenDashboard,
  onTogglePersistentAccess,
}: PopupAppProps) {
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [busy, setBusy] = useState<string>();
  const accessLabel = useMemo(() => {
    if (!site || site.access === "unavailable") return "Unavailable on this page";
    return site.access === "persistent"
      ? "Always allowed"
      : "Allowed for this visit";
  }, [site]);

  const perform = async (name: string, action?: () => void | Promise<void>) => {
    if (!action) return;
    setBusy(name);
    try {
      await action();
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div className="brand-mark" aria-hidden="true">
          S
        </div>
        <div>
          <h1>Scrapeyy</h1>
          <p>Capture data and design references</p>
        </div>
      </header>

      <section className="site-card" aria-label="Current site access">
        <div>
          <span className="eyebrow">Current site</span>
          <strong className="site-origin">{site?.origin ?? "Open a website"}</strong>
        </div>
        <span className={`status-dot status-${site?.access ?? "unavailable"}`}>
          {accessLabel}
        </span>
        {site && site.access !== "unavailable" ? (
          <label className="toggle-row">
            <span>Allow scheduled captures</span>
            <input
              type="checkbox"
              checked={site.access === "persistent"}
              onChange={(event) =>
                void perform("permission", () =>
                  onTogglePersistentAccess?.(site.origin, event.target.checked),
                )
              }
            />
          </label>
        ) : null}
      </section>

      <button
        className="popup-action popup-action-primary"
        type="button"
        aria-label="Quick Capture"
        disabled={!site || site.access === "unavailable" || Boolean(busy)}
        onClick={() => void perform("capture", onQuickCapture)}
      >
        <span className="action-icon" aria-hidden="true">
          +
        </span>
        <span>
          <strong>Quick Capture</strong>
          <small>Pick content from this page</small>
        </span>
      </button>

      <section className="saved-run">
        <label htmlFor="popup-recipe">Saved recipe</label>
        <select
          id="popup-recipe"
          value={recipeId}
          onChange={(event) => setRecipeId(event.target.value)}
          disabled={recipes.length === 0}
        >
          {recipes.length === 0 ? (
            <option value="">No recipe for this site</option>
          ) : (
            recipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))
          )}
        </select>
        <button
          className="popup-action"
          type="button"
          aria-label="Run Saved Recipe"
          disabled={!recipeId || Boolean(busy)}
          onClick={() =>
            void perform("recipe", () => onRunRecipe?.(recipeId))
          }
        >
          <span className="action-icon action-icon-play" aria-hidden="true">
            ▶
          </span>
          <span>
            <strong>Run Saved Recipe</strong>
            <small>Capture using the selected setup</small>
          </span>
        </button>
      </section>

      <button
        className="dashboard-link"
        type="button"
        disabled={Boolean(busy)}
        onClick={() => void perform("dashboard", onOpenDashboard)}
      >
        Open Dashboard <span aria-hidden="true">→</span>
      </button>

      <p className="privacy-note">Captured content stays in this browser.</p>
    </main>
  );
}
