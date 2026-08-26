import { where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { COLLECTIONS } from "../collection-names.js";
import { createRepository } from "../firestore-repository.js";

const repository = createRepository(COLLECTIONS.HOMEWORK_ASSIGNMENTS);

export const homeworkAssignmentsRepository = Object.freeze({
  ...repository,
  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId));
  },
});
