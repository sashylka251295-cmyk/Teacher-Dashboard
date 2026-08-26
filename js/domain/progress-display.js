import { learningObjectivesForUnit } from "./learning-objectives.js";
import {
  lessonStopsForUnit,
  physicalProgress,
} from "./physical-progress.js";
import {
  latestLessonCompletion,
  orderedProgressHistory,
} from "./progress-revisions.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function cumulativeUnitTargets(unit, history = []) {
  const catalog = new Map(
    learningObjectivesForUnit(unit).map((objective) => [objective.id, objective]),
  );
  const accumulated = new Map();

  orderedProgressHistory(history)
    .filter((entry) => entry.unitId === unit?.id)
    .forEach((entry) => {
      const recorded = Array.isArray(entry.workedOnObjectives) && entry.workedOnObjectives.length
        ? entry.workedOnObjectives
        : (entry.changes ?? []);

      recorded.forEach((item) => {
        const id = text(item.objectiveId ?? item.id);
        if (!id) return;
        const planned = catalog.get(id);
        const previous = accumulated.get(id);
        accumulated.set(id, {
          id,
          title: text(item.title) || text(planned?.title) || text(previous?.title) || "Learning target",
          category: text(item.category) || text(planned?.category) || text(previous?.category),
        });
      });
    });

  return [...accumulated.values()];
}

export function unitPhysicalProgressFromHistory({
  unit,
  lessons = [],
  history = [],
  studentId = "",
  fallbackJourney = null,
}) {
  const stops = lessonStopsForUnit(unit, lessons);
  const physicalEntries = history.filter((entry) =>
    entry.studentId === studentId
    && entry.unitId === unit?.id
    && entry.lessonId
    && typeof entry.completeLesson === "boolean");

  if (!physicalEntries.length) {
    return physicalProgress(unit, fallbackJourney, lessons);
  }

  const fallbackCompleted = fallbackJourney?.unitId === unit?.id
    ? new Set(fallbackJourney.completedLessonIds ?? [])
    : new Set();
  const completedLessonIds = stops
    .filter((lesson) => {
      const latest = latestLessonCompletion(
        physicalEntries,
        studentId,
        unit.id,
        lesson.id,
      );
      return latest === null ? fallbackCompleted.has(lesson.id) : latest === true;
    })
    .map(({ id }) => id);
  const latestEntry = orderedProgressHistory(physicalEntries).at(-1);
  const currentLessonId = latestEntry?.completeLesson === false
    ? latestEntry.lessonId
    : "";

  return physicalProgress(unit, {
    unitId: unit.id,
    completedLessonIds,
    currentLessonId,
  }, lessons);
}
