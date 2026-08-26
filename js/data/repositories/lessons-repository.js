import { where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";

const repository = createRepository(COLLECTIONS.LESSONS);

export const lessonsRepository = Object.freeze({
  ...repository,
  async listByCourse(courseId) {
    const lessons = await repository.list(where("courseId", "==", courseId));
    return lessons.sort(
      (first, second) => Number(first.order ?? first.number) - Number(second.order ?? second.number),
    );
  },
  async listByUnit(unitId) {
    const lessons = await repository.list(where("unitId", "==", unitId));
    return lessons.sort(
      (first, second) => Number(first.order ?? first.number) - Number(second.order ?? second.number),
    );
  },
});
