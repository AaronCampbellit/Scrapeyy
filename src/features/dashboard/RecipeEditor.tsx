import { useEffect, useState } from "react";

import type { CaptureMode, Project, Recipe } from "../../contracts/models";
import { ScheduleEditor } from "./ScheduleEditor";

interface RecipeEditorProps {
  recipe: Recipe;
  projects: Project[];
  onSave(recipe: Recipe): void | Promise<void>;
  onCancel(): void;
}

export function RecipeEditor({
  recipe,
  projects,
  onSave,
  onCancel,
}: RecipeEditorProps) {
  const [draft, setDraft] = useState(recipe);
  useEffect(() => setDraft(recipe), [recipe]);

  return (
    <form
      className="recipe-editor"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave({ ...draft, updatedAt: new Date().toISOString() });
      }}
    >
      <div className="panel-header">
        <div>
          <span className="kicker">Recipe builder</span>
          <h2>{recipe.name || "New recipe"}</h2>
        </div>
        <button className="icon-button" type="button" onClick={onCancel}>
          Close
        </button>
      </div>
      <div className="editor-grid">
        <label>
          Recipe name
          <input
            required
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label>
          Project
          <select
            value={draft.projectId}
            onChange={(event) =>
              setDraft({ ...draft, projectId: event.target.value })
            }
          >
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="span-two">
          Starting URL
          <input
            required
            className="mono"
            type="url"
            value={draft.startUrl}
            onChange={(event) => {
              const startUrl = event.target.value;
              let origin = draft.origin;
              try {
                origin = new URL(startUrl).origin;
              } catch {
                // Preserve the current valid origin while the user is typing.
              }
              setDraft({ ...draft, startUrl, origin });
            }}
          />
        </label>
        <label>
          Capture mode
          <select
            value={draft.mode}
            onChange={(event) =>
              setDraft({ ...draft, mode: event.target.value as CaptureMode })
            }
          >
            <option value="data">Data</option>
            <option value="design">Design</option>
            <option value="both">Both</option>
          </select>
        </label>
        <label>
          Item selector
          <input
            required
            className="mono"
            value={draft.containerSelector}
            onChange={(event) =>
              setDraft({ ...draft, containerSelector: event.target.value })
            }
          />
        </label>
      </div>
      <fieldset className="editor-fieldset">
        <legend>Fields</legend>
        {draft.fields.map((field, index) => (
          <div className="field-line" key={field.id}>
            <input
              aria-label={`Field ${index + 1} name`}
              value={field.name}
              onChange={(event) => {
                const fields = [...draft.fields];
                fields[index] = { ...field, name: event.target.value };
                setDraft({ ...draft, fields });
              }}
            />
            <select
              aria-label={`Field ${index + 1} type`}
              value={field.kind}
              onChange={(event) => {
                const fields = [...draft.fields];
                fields[index] = {
                  ...field,
                  kind: event.target.value as typeof field.kind,
                };
                setDraft({ ...draft, fields });
              }}
            >
              <option value="text">Text</option>
              <option value="link">Link</option>
              <option value="image">Image</option>
              <option value="attribute">Attribute</option>
              <option value="html">HTML</option>
            </select>
            <input
              aria-label={`Field ${index + 1} selector`}
              className="mono"
              value={field.selector}
              onChange={(event) => {
                const fields = [...draft.fields];
                fields[index] = { ...field, selector: event.target.value };
                setDraft({ ...draft, fields });
              }}
            />
          </div>
        ))}
      </fieldset>
      <ScheduleEditor
        value={draft.schedule}
        onChange={(schedule) => setDraft({ ...draft, schedule })}
      />
      <fieldset className="editor-fieldset">
        <legend>Destination</legend>
        <div className="check-grid">
          <label>
            <input
              type="checkbox"
              checked={draft.destinations.inbox}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  destinations: {
                    ...draft.destinations,
                    inbox: event.target.checked,
                  },
                })
              }
            />
            Keep in Capture Inbox
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.destinations.autoDownload}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  destinations: {
                    ...draft.destinations,
                    autoDownload: event.target.checked,
                  },
                })
              }
            />
            Download after each run
          </label>
        </div>
      </fieldset>
      <footer className="editor-actions">
        <button className="button" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="button button-primary" type="submit">
          Save recipe
        </button>
      </footer>
    </form>
  );
}
