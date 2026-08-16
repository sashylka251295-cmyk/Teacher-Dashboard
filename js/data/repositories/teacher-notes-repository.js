import {
  serverTimestamp,
  Timestamp,
  where,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";

const repository = createRepository(COLLECTIONS.TEACHER_NOTES);

export const teacherNotesRepository = Object.freeze({
  ...repository,
  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId));
  },
  create(data) {
    return repository.create({ ...data, createdAt: serverTimestamp() });
  },
  createWithDate(data, date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      throw new Error("A valid observation date is required.");
    }

    return repository.create({ ...data, createdAt: Timestamp.fromDate(date) });
  },
});
