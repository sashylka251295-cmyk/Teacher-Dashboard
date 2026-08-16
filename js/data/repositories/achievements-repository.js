import { where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";

const repository = createRepository(COLLECTIONS.ACHIEVEMENTS);

export const achievementsRepository = Object.freeze({
  ...repository,
  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId));
  },
});

