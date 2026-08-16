import { coursesRepository } from "../data/repositories/courses-repository.js";
import { createSlug } from "../domain/slug.js";
import { isNonEmptyText } from "../domain/validation.js";

export class CourseCreationError extends Error {}

export async function createCourseRecord({ name, level = "", active = true }) {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!isNonEmptyText(normalizedName)) {
    throw new CourseCreationError("Course name is required.");
  }

  const id = createSlug(normalizedName);
  if (!id) {
    throw new CourseCreationError("Unable to generate a course identifier.");
  }
  if (await coursesRepository.getById(id)) {
    throw new CourseCreationError(
      "A course with this name already exists. Select it from the list or choose a different name.",
    );
  }

  const course = {
    name: normalizedName,
    level: typeof level === "string" ? level.trim() : "",
    active: active !== false,
  };
  await coursesRepository.createWithId(id, course);
  return { id, ...course };
}
