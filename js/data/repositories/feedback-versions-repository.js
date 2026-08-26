import { serverTimestamp, where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { COLLECTIONS } from "../collection-names.js";
import { createRepository } from "../firestore-repository.js";

const repository = createRepository(COLLECTIONS.FEEDBACK_VERSIONS);

export const feedbackVersionsRepository = Object.freeze({
  ...repository,
  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId));
  },
  listPublishedByStudent(studentId) {
    return repository.list(
      where("studentId", "==", studentId),
      where("status", "==", "published"),
    );
  },
  publishQuick({ studentId, courseId, unitId, lessonId, text }) {
    return repository.create({
      studentId,
      courseId,
      unitId,
      lessonId,
      sourceObservationIds: [],
      content: {
        message: String(text ?? "").trim(),
        whatWentWell: "",
        whatToPractise: "",
        nextStep: "",
      },
      status: "published",
      versionNumber: 1,
      source: "quick_update",
      publishedAt: serverTimestamp(),
    });
  },
});
