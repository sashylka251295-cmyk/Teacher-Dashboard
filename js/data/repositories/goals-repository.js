import { serverTimestamp, where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";

const repository = createRepository(COLLECTIONS.GOALS);

export const goalsRepository = Object.freeze({
  ...repository,
  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId));
  },
  listVisibleByStudent(studentId) {
    return repository.list(
      where("studentId", "==", studentId),
      where("studentVisible", "==", true),
    );
  },
  create(data) {
    return repository.create({ ...data, createdAt: serverTimestamp() });
  },
});

