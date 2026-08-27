import {
  collection,
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { getFirestoreClient } from "../../core/firebase-client.js";
import {
  INDEPENDENT_PROGRESS_SCOPE,
  progressScopeKey,
} from "../../domain/independent-learning.js";
import { COLLECTIONS } from "../collection-names.js";

function progressDocumentId(studentId, unitId, objectiveId, scope = "") {
  return [studentId, progressScopeKey(unitId, scope), objectiveId].map(encodeURIComponent).join("__");
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
  scope = "course",
  ensureHistory = false,
}) {
  const firestore = getFirestoreClient();
  const batch = writeBatch(firestore);
  const updatedAt = serverTimestamp();

  for (const change of objectiveChanges) {
    const progressRef = doc(
      firestore,
      COLLECTIONS.OBJECTIVE_PROGRESS,
      progressDocumentId(studentId, unitId, change.objectiveId, scope),
    );
    batch.set(
      progressRef,
      {
        studentId,
        courseId,
        unitId,
        objectiveId: change.objectiveId,
        objectiveTitle: change.title ?? "",
        category: change.category,
        status: change.status,
        scope,
        updatedAt,
      },
      { merge: true },
    );
  }

  let historyId = "";
  if (objectiveChanges.length > 0 || workedOnObjectives.length > 0 || physicalJourney || ensureHistory) {
    const historyRef = doc(collection(firestore, COLLECTIONS.PROGRESS_HISTORY));
    historyId = historyRef.id;
    const historyEntry = {
      studentId,
      courseId,
      unitId,
      groupId,
      lessonId,
      scope,
      lessonDate: Timestamp.fromDate(lessonDate),
      changes: objectiveChanges.map(({ objectiveId, title, category, previousStatus, status }) => ({
        objectiveId,
        category,
        title: title ?? "",
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
        completedManually: false,
        currentLearningTargets: workedOnObjectives.map(({ id, objectiveId, title, category }) => ({
          id: objectiveId ?? id,
          title,
          category,
          categories: [category],
        })),
        updatedAt,
      },
      unitJourneys: {
        [unitId]: {
          ...physicalJourney,
          completedManually: false,
          currentLearningTargets: workedOnObjectives.map(({ id, objectiveId, title, category }) => ({
            id: objectiveId ?? id,
            title,
            category,
            categories: [category],
          })),
          updatedAt,
        },
      },
    }, { merge: true });
  } else if (scope === INDEPENDENT_PROGRESS_SCOPE && workedOnObjectives.length > 0) {
    const studentRef = doc(firestore, COLLECTIONS.STUDENTS, studentId);
    batch.set(studentRef, {
      independentLearning: {
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
      scope,
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
