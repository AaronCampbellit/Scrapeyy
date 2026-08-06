import type { Project, Recipe } from "../../contracts/models";

interface ProjectsViewProps {
  projects: Project[];
  recipes: Recipe[];
  selectedProjectId?: string | undefined;
  onSelect(projectId: string): void;
  onCreate(): void;
}

export function ProjectsView({
  projects,
  recipes,
  selectedProjectId,
  onSelect,
  onCreate,
}: ProjectsViewProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <span className="kicker">Workspace</span>
          <h2>Projects</h2>
        </div>
        <button className="button button-primary" type="button" onClick={onCreate}>
          New project
        </button>
      </div>
      <div className="project-grid">
        {projects.map((project) => (
          <button
            className={`project-card ${
              project.id === selectedProjectId ? "is-selected" : ""
            }`}
            type="button"
            key={project.id}
            onClick={() => onSelect(project.id)}
          >
            <span className="project-glyph" aria-hidden="true">
              {project.name.slice(0, 1).toUpperCase()}
            </span>
            <strong>{project.name}</strong>
            <small>
              {recipes.filter((recipe) => recipe.projectId === project.id).length}{" "}
              recipes
            </small>
          </button>
        ))}
      </div>
    </section>
  );
}
