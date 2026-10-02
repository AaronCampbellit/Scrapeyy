import type { Project, Recipe } from "../../contracts/models";

interface RecipesViewProps {
  projects: Project[];
  recipes: Recipe[];
  disabled: boolean;
  onCreateProject(): void | Promise<void>;
  onEdit(recipeId: string): void | Promise<void>;
  onRun(recipeId: string): void | Promise<void>;
  onDelete(recipeId: string): void | Promise<void>;
}

export function RecipesView({
  projects,
  recipes,
  disabled,
  onCreateProject,
  onEdit,
  onRun,
  onDelete,
}: RecipesViewProps) {
  return (
    <section className="popup-view" aria-label="Recipes">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Automation library</span>
          <h2>Recipes</h2>
        </div>
        <button className="small-button" disabled={disabled} onClick={() => void onCreateProject()} type="button">
          New project
        </button>
      </div>
      {recipes.length === 0 ? (
        <div className="popup-empty">
          <strong>No saved recipes</strong>
          <span>Create one from the Capture tab.</span>
        </div>
      ) : (
        <div className="recipe-list">
          {recipes.map((recipe) => (
            <article className="recipe-card" key={recipe.id}>
              <div>
                <strong>{recipe.name}</strong>
                <small>
                  {projects.find((project) => project.id === recipe.projectId)?.name ??
                    "Local captures"}{" "}
                  · {recipe.mode === "data" ? "Content" : recipe.mode === "design" ? "Design & Code" : "Content + Design & Code"} ·{" "}
                  {recipe.schedule?.enabled ? "Scheduled" : "Manual"}
                </small>
              </div>
              <div className="row-actions">
                <button
                  aria-label={`Run ${recipe.name}`}
                  disabled={disabled}
                  onClick={() => void onRun(recipe.id)}
                  type="button"
                >
                  Run
                </button>
                <button
                  aria-label={`Edit ${recipe.name}`}
                  disabled={disabled}
                  onClick={() => void onEdit(recipe.id)}
                  type="button"
                >
                  Edit
                </button>
                <button
                  aria-label={`Delete ${recipe.name}`}
                  className="danger-link"
                  disabled={disabled}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete “${recipe.name}”? Scheduled runs for this recipe will also stop. This cannot be undone.`,
                      )
                    ) {
                      void onDelete(recipe.id);
                    }
                  }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
