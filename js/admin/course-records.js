import { coursesRepository } from "../data/repositories/courses-repository.js";
import { createSlug } from "../domain/slug.js";
import { isNonEmptyText } from "../domain/validation.js";

export class CourseCreationError extends Error {}

export function courseIdForName(name) {
  return createSlug(typeof name === "string" ? name.trim() : "");
}

export async function createCourseRecord({
  name,
  edition = "",
  level = "",
  ageRange = "",
  defaultStartingPoint = "",
  frequency = "",
  description = "",
  generalGoal = "",
  active = true,
  coverImagePath = "",
  coverImageUrl = "",
}) {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  if (!isNonEmptyText(normalizedName)) {
    throw new CourseCreationError("Course name is required.");
  }

  const id = courseIdForName(normalizedName);
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
    edition: typeof edition === "string" ? edition.trim() : "",
    level: typeof level === "string" ? level.trim() : "",
    ageRange: typeof ageRange === "string" ? ageRange.trim() : "",
    defaultStartingPoint: typeof defaultStartingPoint === "string"
      ? defaultStartingPoint.trim()
      : "",
    frequency: typeof frequency === "string" ? frequency.trim() : "",
    description: typeof description === "string" ? description.trim() : "",
    generalGoal: typeof generalGoal === "string" ? generalGoal.trim() : "",
    active: active !== false,
    coverImagePath: typeof coverImagePath === "string" ? coverImagePath : "",
    coverImageUrl: typeof coverImageUrl === "string" ? coverImageUrl : "",
  };
  await coursesRepository.createWithId(id, course);
  return { id, ...course };
}
