import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { getFirestoreClient } from "../../core/firebase-client.js";
import { COLLECTIONS } from "../collection-names.js";

function progressDocumentId(studentId, unitId, objectiveId) {
  return [studentId, unitId, objectiveId].map(encodeURIComponent).join("__");
}

export async function saveLearningUpdate({
  studentId,
  courseId,
  unitId,
  groupId = "",
  lessonId = "",
  objectiveChanges,
  homeworkToCreate,
  homeworkChanges,
  lessonDate,
  observation,
  physicalJourney = null,
  physicalChange = null,
  workedOnObjectives = [],
}) {
  const firestore = getFirestoreClient();
  const batch = writeBatch(firestore);
  const updatedAt = serverTimestamp();

  for (const change of objectiveChanges) {
    const progressRef = doc(
      firestore,
      COLLECTIONS.OBJECTIVE_PROGRESS,
      progressDocumentId(studentId, unitId, change.objectiveId),
    );
    batch.set(
      progressRef,
      {
        studentId,
        courseId,
        unitId,
        objectiveId: change.objectiveId,
        category: change.category,
        status: change.status,
        updatedAt,
      },
      { merge: true },
    );
  }

  let historyId = "";
  if (objectiveChanges.length > 0 || workedOnObjectives.length > 0 || physicalJourney) {
    const historyRef = doc(collection(firestore, COLLECTIONS.PROGRESS_HISTORY));
    historyId = historyRef.id;
    const historyEntry = {
      studentId,
      courseId,
      unitId,
      groupId,
      lessonId,
      lessonDate: Timestamp.fromDate(lessonDate),
      changes: objectiveChanges.map(({ objectiveId, category, previousStatus, status }) => ({
        objectiveId,
        category,
        previousStatus: previousStatus ?? "not_assessed",
        status,
      })),
      workedOnObjectives: workedOnObjectives.map(({ id, objectiveId, title, category }) => ({
        objectiveId: objectiveId ?? id,
        title,
        category,
      })),
      observation: observation || "",
      createdAt: updatedAt,
    };
    if (physicalChange) {
      historyEntry.completeLesson = physicalChange.completeLesson === true;
      historyEntry.previousLessonCompleted = physicalChange.previousLessonCompleted === true;
    }
    batch.set(historyRef, historyEntry);
  }

  if (physicalJourney) {
    const studentRef = doc(firestore, COLLECTIONS.STUDENTS, studentId);
    batch.set(studentRef, {
      courseJourney: {
        ...physicalJourney,
        currentLearningTargets: workedOnObjectives.map(({ id, objectiveId, title, category }) => ({
          id: objectiveId ?? id,
          title,
          category,
          categories: [category],
        })),
        updatedAt,
      },
    }, { merge: true });
  }

  if (homeworkToCreate) {
    const homeworkRef = doc(collection(firestore, COLLECTIONS.HOMEWORK_ASSIGNMENTS));
    batch.set(homeworkRef, {
      studentId,
      courseId,
      unitId,
      title: homeworkToCreate.title,
      status: homeworkToCreate.status,
      lessonDate: Timestamp.fromDate(lessonDate),
      createdAt: updatedAt,
      updatedAt,
    });
  }

  for (const homework of homeworkChanges) {
    const homeworkRef = doc(firestore, COLLECTIONS.HOMEWORK_ASSIGNMENTS, homework.id);
    batch.update(homeworkRef, { status: homework.status, updatedAt });
  }

  await batch.commit();
  return historyId;
}
