import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";

const repository = createRepository(COLLECTIONS.COURSE_PROGRAM_PRIVATE);

export const courseProgramPrivateRepository = Object.freeze({
  ...repository,
  courseId(courseId) {
    return `course_${courseId}`;
  },
  unitId(unitId) {
    return `unit_${unitId}`;
  },
});
