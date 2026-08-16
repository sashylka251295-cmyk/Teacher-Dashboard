import { where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";

const repository = createRepository(COLLECTIONS.UNITS);

export const unitsRepository = Object.freeze({
  ...repository,
  async listByCourse(courseId) {
    const units = await repository.list(where("courseId", "==", courseId));
    return units.sort((first, second) => Number(first.order) - Number(second.order));
  },
});
