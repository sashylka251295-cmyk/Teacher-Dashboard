import { currentPhysicalUnit, lessonStopsForUnit } from "./physical-progress.js";

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  const raw = typeof value.toDate === "function" ? value.toDate() : value;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function entryTime(entry) {
  return timestampMillis(entry.lessonDate) || timestampMillis(entry.updatedAt) || timestampMillis(entry.createdAt);
}

function recordedTargets(entry) {
  const source = Array.isArray(entry?.workedOnObjectives) && entry.workedOnObjectives.length
    ? entry.workedOnObjectives
    : (entry?.changes ?? []);
  return source.flatMap((target) => {
    const id = String(target.objectiveId ?? target.id ?? "").trim();
    if (!id) return [];
    return [{
      id,
      title: String(target.title ?? "Learning target").trim() || "Learning target",
      category: String(target.category ?? "").trim(),
      categories: target.category ? [target.category] : [],
    }];
  });
}

export function groupJourneyFromHistory({ group, units = [], lessons = [], history = [] }) {
  const unit = currentPhysicalUnit(units, group?.courseJourney);
  if (!unit) return { unit: null, journey: null };
  const stops = lessonStopsForUnit(unit, lessons);
  const stopIds = new Set(stops.map(({ id }) => id));
  const relevant = history
    .filter((entry) => entry.unitId === unit.id && stopIds.has(entry.lessonId))
    .sort((first, second) => entryTime(first) - entryTime(second));
  const latestByLesson = new Map();
  relevant.forEach((entry) => {
    if (typeof entry.completeLesson !== "boolean") return;
    const time = entryTime(entry);
    const current = latestByLesson.get(entry.lessonId);
    if (!current || time > current.time) {
      latestByLesson.set(entry.lessonId, { time, values: [entry.completeLesson] });
    } else if (time === current.time) current.values.push(entry.completeLesson);
  });
  const completedLessonIds = stops
    .filter(({ id }) => latestByLesson.get(id)?.values.includes(true))
    .map(({ id }) => id);
  const completed = new Set(completedLessonIds);
  const latestLearningUpdate = [...relevant].reverse().find((entry) =>
    (entry.workedOnObjectives?.length ?? 0) > 0 || (entry.changes?.length ?? 0) > 0) ?? null;
  return {
    unit,
    journey: {
      courseId: unit.courseId ?? group?.courseId ?? "",
      unitId: unit.id,
      completedLessonIds,
      currentLessonId: stops.find(({ id }) => !completed.has(id))?.id ?? "",
      lessonStops: stops,
      currentLearningTargets: recordedTargets(latestLearningUpdate),
      completedManually: false,
    },
  };
}

export function groupJourneyChanged(stored, calculated) {
  if (!stored || !calculated) return stored !== calculated;
  const storedCompleted = [...new Set(stored.completedLessonIds ?? [])].sort();
  const calculatedCompleted = [...new Set(calculated.completedLessonIds ?? [])].sort();
  return stored.unitId !== calculated.unitId
    || stored.currentLessonId !== calculated.currentLessonId
    || storedCompleted.join("\u0000") !== calculatedCompleted.join("\u0000")
    || JSON.stringify(stored.currentLearningTargets ?? []) !== JSON.stringify(calculated.currentLearningTargets ?? []);
}
