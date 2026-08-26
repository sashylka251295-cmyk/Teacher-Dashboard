import {
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { getFirestoreClient } from "../../core/firebase-client.js";
import { learningObjectivesForUnit } from "../../domain/learning-objectives.js";
import { createJourneySnapshot } from "../../domain/physical-progress.js";
import {
  latestLessonCompletion,
  latestObjectiveChange,
  statusesBeforeProgressEntry,
} from "../../domain/progress-revisions.js";
import { COLLECTIONS } from "../collection-names.js";

function progressDocumentId(studentId, unitId, objectiveId) {
  return [studentId, unitId, objectiveId].map(encodeURIComponent).join("__");
}

function replacementEntry(entry, history, { objectiveChanges, workedOnObjectives, lessonDate, completeLesson }) {
  const previousStatuses = statusesBeforeProgressEntry(history, entry);
  const originalChanges = new Map(
    (Array.isArray(entry.changes) ? entry.changes : []).map((change) => [change.objectiveId, change]),
  );
  return {
    ...entry,
    lessonDate: Timestamp.fromDate(lessonDate),
    completeLesson: completeLesson === true,
    previousLessonCompleted: typeof entry.previousLessonCompleted === "boolean"
      ? entry.previousLessonCompleted
      : false,
    changes: objectiveChanges.map((change) => ({
      objectiveId: change.objectiveId,
      category: change.category,
      previousStatus: previousStatuses.get(change.objectiveId)
        ?? originalChanges.get(change.objectiveId)?.previousStatus
        ?? "not_assessed",
      status: change.status,
    })),
    workedOnObjectives: workedOnObjectives.map(({ objectiveId, title, category }) => ({
      objectiveId, title, category,
    })),
  };
}

function historyWithRevision(history, entry, replacement) {
  return history
    .filter((item) => item.id !== entry.id)
    .concat(replacement ? [replacement] : []);
}

function validDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export async function reviseLearningUpdate({
  entry,
  history,
  student,
  unit,
  lessons,
  objectiveChanges = [],
  workedOnObjectives = [],
  lessonDate,
  completeLesson,
  remove = false,
}) {
  if (!entry?.id || !student?.id || entry.studentId !== student.id) {
    throw new Error("A valid student progress update is required.");
  }
  if (!unit || unit.id !== entry.unitId) throw new Error("The update unit is unavailable.");
  if (!validDate(lessonDate)) throw new Error("Select a valid lesson date.");

  const firestore = getFirestoreClient();
  const batch = writeBatch(firestore);
  const updatedAt = serverTimestamp();
  const replacement = remove
    ? null
    : replacementEntry(entry, history, { objectiveChanges, workedOnObjectives, lessonDate, completeLesson });
  const revisedHistory = historyWithRevision(history, entry, replacement);
  const affectedObjectiveIds = new Set([
    ...(Array.isArray(entry.changes) ? entry.changes : []).map(({ objectiveId }) => objectiveId),
    ...objectiveChanges.map(({ objectiveId }) => objectiveId),
  ]);
  const originalChanges = new Map(
    (Array.isArray(entry.changes) ? entry.changes : []).map((change) => [change.objectiveId, change]),
  );

  affectedObjectiveIds.forEach((objectiveId) => {
    const progressRef = doc(
      firestore,
      COLLECTIONS.OBJECTIVE_PROGRESS,
      progressDocumentId(student.id, unit.id, objectiveId),
    );
    const latest = latestObjectiveChange(revisedHistory, student.id, unit.id, objectiveId);
    const fallback = originalChanges.get(objectiveId);
    const status = latest?.change.status ?? fallback?.previousStatus ?? "not_assessed";
    if (status === "not_assessed") {
      batch.delete(progressRef);
      return;
    }
    batch.set(progressRef, {
      studentId: student.id,
      courseId: latest?.entry.courseId ?? entry.courseId,
      unitId: unit.id,
      objectiveId,
      category: latest?.change.category ?? fallback?.category ?? "",
      status,
      updatedAt,
    }, { merge: true });
  });

  const lesson = lessons.find(({ id }) => id === entry.lessonId);
  if (lesson && student.courseJourney?.unitId === unit.id) {
    const latestCompletion = latestLessonCompletion(
      revisedHistory,
      student.id,
      unit.id,
      lesson.id,
    );
    const desiredCompletion = latestCompletion ?? (
      typeof entry.previousLessonCompleted === "boolean"
        ? entry.previousLessonCompleted
        : false
    );
    const nextJourney = createJourneySnapshot({
      courseId: entry.courseId,
      unit,
      lessons,
      previousJourney: student.courseJourney,
      selectedLessonId: lesson.id,
      completeLesson: desiredCompletion,
    });
    const latestLearningUpdate = [...revisedHistory]
      .filter((item) => item.studentId === student.id && item.unitId === unit.id)
      .sort((first, second) => {
        const firstDate = first.lessonDate?.toMillis?.() ?? first.lessonDate?.getTime?.() ?? 0;
        const secondDate = second.lessonDate?.toMillis?.() ?? second.lessonDate?.getTime?.() ?? 0;
        return secondDate - firstDate;
      })[0];
    const objectivesById = new Map(learningObjectivesForUnit(unit).map((objective) => [objective.id, objective]));
    const latestLearningTargets = Array.isArray(latestLearningUpdate?.workedOnObjectives)
      ? latestLearningUpdate.workedOnObjectives
      : (latestLearningUpdate?.changes ?? []).map((change) => ({
        objectiveId: change.objectiveId,
        title: objectivesById.get(change.objectiveId)?.title ?? "Learning objective",
        category: change.category,
      }));
    batch.set(doc(firestore, COLLECTIONS.STUDENTS, student.id), {
      courseJourney: {
        ...nextJourney,
        currentLearningTargets: latestLearningTargets.map(
          ({ objectiveId, title, category }) => ({
            id: objectiveId, title, category, categories: [category],
          }),
        ),
        updatedAt,
      },
    }, { merge: true });
  }

  const historyRef = doc(firestore, COLLECTIONS.PROGRESS_HISTORY, entry.id);
  if (remove) batch.delete(historyRef);
  else batch.set(historyRef, {
    changes: replacement.changes,
    workedOnObjectives: replacement.workedOnObjectives,
    lessonDate: replacement.lessonDate,
    completeLesson: replacement.completeLesson,
    previousLessonCompleted: replacement.previousLessonCompleted,
    updatedAt,
  }, { merge: true });

  await batch.commit();
}
