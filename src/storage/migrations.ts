import type {
  ConfigurationV1,
  Project,
} from "../contracts/models";
import { validateRecipe } from "../contracts/validation";

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
}

function project(input: unknown, index: number): Project {
  const value = object(input, `projects[${index}]`);
  return {
    id: requiredString(value.id, `projects[${index}].id`),
    name: requiredString(value.name, `projects[${index}].name`),
    ...(typeof value.description === "string" &&
    value.description.trim() !== ""
      ? { description: value.description.trim() }
      : {}),
    createdAt: requiredString(value.createdAt, `projects[${index}].createdAt`),
    updatedAt: requiredString(value.updatedAt, `projects[${index}].updatedAt`),
  };
}

export function migrateConfiguration(input: unknown): ConfigurationV1 {
  const value = object(input, "configuration");
  if (value.version !== 1) {
    throw new Error(`Unsupported configuration version: ${String(value.version)}`);
  }
  if (!Array.isArray(value.projects) || !Array.isArray(value.recipes)) {
    throw new Error("Configuration projects and recipes must be arrays");
  }
  return {
    version: 1,
    projects: value.projects.map(project),
    recipes: value.recipes.map(validateRecipe),
  };
}
