import {
  doc,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { getFirestoreClient } from "../../core/firebase-client.js";
import {
  independentLearningTargets,
  isIndependentProgressEntry,
  progressScopeKey,
} from "../../domain/independent-learning.js";
import { learningObjectivesForUnit } from "../../domain/learning-objectives.js";
import { lessonStopsForUnit } from "../../domain/physical-progress.js";
import {
  latestLessonCompletion,
  latestObjectiveChange,
  statusesBeforeProgressEntry,
} from "../../domain/progress-revisions.js";
import { COLLECTIONS } from "../collection-names.js";

function progressDocumentId(studentId, unitId, objectiveId, scope = "") {
  return [studentId, progressScopeKey(unitId, scope), objectiveId].map(encodeURIComponent).join("__");
}

function replacementEntry(entry, history, {
  courseId,
  unitId,
  lessonId,
  objectiveChanges,
  workedOnObjectives,
  lessonDate,
  completeLesson,
  previousLessonCompleted,
}) {
  const previousStatuses = statusesBeforeProgressEntry(history, { ...entry, unitId });
  const originalChanges = new Map(
    (Array.isArray(entry.changes) ? entry.changes : []).map((change) => [change.objectiveId, change]),
  );
  const objectiveTitles = new Map([
    ...(Array.isArray(entry.workedOnObjectives) ? entry.workedOnObjectives : []),
    ...workedOnObjectives,
  ].map(({ objectiveId, id, title }) => [objectiveId ?? id, title ?? ""]));
  return {
    ...entry,
    courseId,
    unitId,
    lessonId,
    lessonDate: Timestamp.fromDate(lessonDate),
    completeLesson: completeLesson === true,
    previousLessonCompleted: previousLessonCompleted === true,
    changes: objectiveChanges.map((change) => ({
      objectiveId: change.objectiveId,
      title: change.title ?? originalChanges.get(change.objectiveId)?.title ?? objectiveTitles.get(change.objectiveId) ?? "",
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
  lessonId = entry?.lessonId ?? "",
  objectiveChanges = [],
  workedOnObjectives = [],
  lessonDate,
  completeLesson,
  remove = false,
}) {
  if (!entry?.id || !student?.id || entry.studentId !== student.id) {
    throw new Error("A valid student progress update is required.");
  }
  const independent = isIndependentProgressEntry(entry);
  const nextUnitId = independent ? "" : unit?.id ?? "";
  const nextLessonId = independent ? "" : lessonId;
  const nextCourseId = independent ? "" : unit?.courseId ?? entry.courseId;
  if (!independent && (!unit || !nextLessonId || !lessons.some((lesson) =>
    lesson.id === nextLessonId && lesson.unitId === unit.id))) {
    throw new Error("Select a valid unit and lesson.");
  }
  if (!validDate(lessonDate)) throw new Error("Select a valid lesson date.");

  const firestore = getFirestoreClient();
  const batch = writeBatch(firestore);
  const updatedAt = serverTimestamp();
  const replacement = remove
    ? null
    : replacementEntry(entry, history, {
      courseId: nextCourseId,
      unitId: nextUnitId,
      lessonId: nextLessonId,
      objectiveChanges,
      workedOnObjectives,
      lessonDate,
      completeLesson,
      previousLessonCompleted: independent
        ? false
        : entry.unitId === nextUnitId
          && entry.lessonId === nextLessonId
          && typeof entry.previousLessonCompleted === "boolean"
          ? entry.previousLessonCompleted
          : latestLessonCompletion(
            history.filter(({ id }) => id !== entry.id),
            student.id,
            nextUnitId,
            nextLessonId,
          ) ?? (
            student.courseJourney?.unitId === nextUnitId
            && student.courseJourney.completedLessonIds?.includes(nextLessonId)
          ),
    });
  const revisedHistory = historyWithRevision(history, entry, replacement);
  const affectedObjectives = new Map();
  (Array.isArray(entry.changes) ? entry.changes : []).forEach(({ objectiveId }) => {
    affectedObjectives.set(`${entry.unitId ?? ""}\u0000${objectiveId}`, {
      unitId: entry.unitId ?? "",
      objectiveId,
      scope: entry.scope,
    });
  });
  objectiveChanges.forEach(({ objectiveId }) => {
    affectedObjectives.set(`${nextUnitId}\u0000${objectiveId}`, {
      unitId: nextUnitId,
      objectiveId,
      scope: replacement?.scope ?? entry.scope,
    });
  });
  const originalChanges = new Map(
    (Array.isArray(entry.changes) ? entry.changes : []).map((change) => [change.objectiveId, change]),
  );

  affectedObjectives.forEach(({ unitId, objectiveId, scope }) => {
    const progressRef = doc(
      firestore,
      COLLECTIONS.OBJECTIVE_PROGRESS,
      progressDocumentId(student.id, unitId, objectiveId, scope),
    );
    const latest = latestObjectiveChange(
      revisedHistory,
      student.id,
      unitId,
      objectiveId,
    );
    const fallback = unitId === (entry.unitId ?? "") ? originalChanges.get(objectiveId) : null;
    const status = latest?.change.status ?? fallback?.previousStatus ?? "not_assessed";
    if (status === "not_assessed") {
      batch.delete(progressRef);
      return;
    }
    batch.set(progressRef, {
      studentId: student.id,
      courseId: latest?.entry.courseId ?? nextCourseId ?? entry.courseId,
      unitId,
      objectiveId,
      objectiveTitle: latest?.change.title ?? fallback?.title ?? "",
      category: latest?.change.category ?? fallback?.category ?? "",
      status,
      scope: latest?.entry.scope ?? scope ?? (independent ? "independent" : "course"),
      updatedAt,
    }, { merge: true });
  });

  const lesson = lessons.find(({ id }) => id === nextLessonId && unit?.id === nextUnitId);
  const journeyWasAffected = student.courseJourney?.unitId === entry.unitId
    || student.courseJourney?.unitId === nextUnitId;
  if (!independent && lesson && journeyWasAffected) {
    const stops = lessonStopsForUnit(unit, lessons);
    const fallbackCompleted = student.courseJourney?.unitId === unit.id
      ? new Set(student.courseJourney.completedLessonIds ?? [])
      : new Set();
    const completedLessonIds = stops.filter((stop) => {
      const latestCompletion = latestLessonCompletion(
        revisedHistory,
        student.id,
        unit.id,
        stop.id,
      );
      if (latestCompletion !== null) return latestCompletion;
      if (
        !remove
        && entry.unitId === nextUnitId
        && entry.lessonId !== nextLessonId
        && stop.id === entry.lessonId
        && typeof entry.previousLessonCompleted === "boolean"
      ) return entry.previousLessonCompleted;
      if (remove && stop.id === entry.lessonId && typeof entry.previousLessonCompleted === "boolean") {
        return entry.previousLessonCompleted;
      }
      return fallbackCompleted.has(stop.id);
    }).map(({ id }) => id);
    const completedSet = new Set(completedLessonIds);
    const nextJourney = {
      courseId: nextCourseId,
      unitId: unit.id,
      completedLessonIds,
      currentLessonId: stops.find(({ id }) => !completedSet.has(id))?.id ?? "",
      lessonStops: stops,
    };
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

  if (independent) {
    const latestIndependentUpdate = [...revisedHistory]
      .filter((item) => item.studentId === student.id && isIndependentProgressEntry(item))
      .sort((first, second) => {
        const firstDate = first.lessonDate?.toMillis?.() ?? first.lessonDate?.getTime?.() ?? 0;
        const secondDate = second.lessonDate?.toMillis?.() ?? second.lessonDate?.getTime?.() ?? 0;
        return secondDate - firstDate;
      })[0] ?? null;
    batch.set(doc(firestore, COLLECTIONS.STUDENTS, student.id), {
      independentLearning: {
        currentLearningTargets: latestIndependentUpdate
          ? independentLearningTargets(latestIndependentUpdate)
          : [],
        updatedAt,
      },
    }, { merge: true });
  }

  const historyRef = doc(firestore, COLLECTIONS.PROGRESS_HISTORY, entry.id);
  if (remove) batch.delete(historyRef);
  else batch.set(historyRef, {
    courseId: replacement.courseId,
    unitId: replacement.unitId,
    lessonId: replacement.lessonId,
    changes: replacement.changes,
    workedOnObjectives: replacement.workedOnObjectives,
    lessonDate: replacement.lessonDate,
    completeLesson: replacement.completeLesson,
    previousLessonCompleted: replacement.previousLessonCompleted,
    updatedAt,
  }, { merge: true });

  await batch.commit();
}
