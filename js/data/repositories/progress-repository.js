import { serverTimestamp, where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";
import { calculateUnitProgress } from "../../domain/progress.js";

const repository = createRepository(COLLECTIONS.PROGRESS);

function withCalculatedProgress(data) {
  const unitProgress = calculateUnitProgress(data);
  if (unitProgress === null) {
    throw new Error("At least one progress skill is required.");
  }

  return {
    ...data,
    unitProgress,
    updatedAt: serverTimestamp(),
  };
}

export const progressRepository = Object.freeze({
  ...repository,
  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId));
  },
  createWithCalculatedProgress(data) {
    return repository.create(withCalculatedProgress(data));
  },
  updateWithCalculatedProgress(id, data) {
    return repository.update(id, withCalculatedProgress(data));
  },
  updatePartialWithCalculatedProgress(id, existingData, changes) {
    const mergedData = { ...existingData, ...changes };
    const unitProgress = calculateUnitProgress(mergedData);

    if (unitProgress === null) {
      throw new Error("At least one progress skill is required.");
    }

    return repository.update(id, {
      ...changes,
      unitProgress,
      updatedAt: serverTimestamp(),
    });
  },
});
