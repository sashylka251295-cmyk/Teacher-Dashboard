import { learningObjectivesForLesson } from "./learning-objectives.js";
import { LANGUAGE_SKILL_CATEGORIES } from "./constants.js";

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

export function lessonSkillTags(lesson) {
  const explicit = Array.isArray(lesson?.skillTags)
    ? [...new Set(lesson.skillTags.filter((skill) => LANGUAGE_SKILL_CATEGORIES.includes(skill)))]
    : [];
  if (explicit.length) return explicit;
  const goals = lesson?.skillGoals && typeof lesson.skillGoals === "object"
    ? lesson.skillGoals
    : {};
  return Object.entries(goals)
    .filter(([skill, goal]) => LANGUAGE_SKILL_CATEGORIES.includes(skill) && text(goal))
    .map(([skill]) => skill);
}

export function lessonStopsForUnit(unit, lessons = []) {
  const actual = Array.isArray(lessons)
    ? lessons.filter((lesson) => lesson?.unitId === unit?.id && lesson?.status !== "archived")
    : [];
  if (actual.length) {
    return actual
      .map((lesson, index) => ({
        id: text(lesson.id) || `${text(unit?.id) || "unit"}-lesson-${index + 1}`,
        number: positiveNumber(lesson.number, index + 1),
        order: positiveNumber(lesson.order, positiveNumber(lesson.number, index + 1)),
        title: text(lesson.title) || `Lesson ${positiveNumber(lesson.number, index + 1)}`,
        skillTags: lessonSkillTags(lesson),
        learningTargets: learningObjectivesForLesson(unit, lesson).slice(0, 3),
      }))
      .sort((first, second) => first.order - second.order);
  }

  const publicStops = Array.isArray(unit?.lessonStops)
    ? unit.lessonStops
      .filter((stop) => text(stop?.id))
      .map((stop, index) => ({
        id: text(stop.id),
        number: positiveNumber(stop.number, index + 1),
        order: positiveNumber(stop.order, positiveNumber(stop.number, index + 1)),
        title: text(stop.title) || `Lesson ${positiveNumber(stop.number, index + 1)}`,
        skillTags: Array.isArray(stop.skillTags)
          ? [...new Set(stop.skillTags.filter((skill) => LANGUAGE_SKILL_CATEGORIES.includes(skill)))]
          : [],
        learningTargets: Array.isArray(stop.learningTargets)
          ? stop.learningTargets
            .filter((target) => text(target?.id) && text(target?.title))
            .map((target, targetIndex) => ({
              id: text(target.id),
              title: text(target.title),
              category: text(target.category),
              order: positiveNumber(target.order, targetIndex + 1),
            }))
            .slice(0, 3)
          : [],
      }))
      .sort((first, second) => first.order - second.order)
    : [];
  if (publicStops.length) return publicStops;

  const estimatedLessons = Math.max(0, Number(unit?.estimatedLessons) || 0);
  return Array.from({ length: estimatedLessons }, (_, index) => ({
    id: `${text(unit?.id) || "unit"}-lesson-${index + 1}`,
    number: index + 1,
    order: index + 1,
    title: `Lesson ${index + 1}`,
    skillTags: [],
    learningTargets: [],
  }));
}

function normalizeSnapshotStops(journey, unit, lessons) {
  const stored = Array.isArray(journey?.lessonStops)
    ? journey.lessonStops
      .filter((stop) => text(stop?.id))
      .map((stop, index) => ({
        id: text(stop.id),
        number: positiveNumber(stop.number, index + 1),
        order: positiveNumber(stop.order, positiveNumber(stop.number, index + 1)),
        title: text(stop.title) || `Lesson ${positiveNumber(stop.number, index + 1)}`,
        skillTags: Array.isArray(stop.skillTags)
          ? [...new Set(stop.skillTags.filter((skill) => text(skill)))]
          : [],
        learningTargets: Array.isArray(stop.learningTargets)
          ? stop.learningTargets.filter((target) => text(target?.id) && text(target?.title)).map((target) => ({
            id: text(target.id),
            title: text(target.title),
            category: text(target.category),
            order: positiveNumber(target.order, index + 1),
          })).slice(0, 3)
          : [],
      }))
      .sort((first, second) => first.order - second.order)
    : [];
  return stored.length ? stored : lessonStopsForUnit(unit, lessons);
}

export function physicalProgress(unit, journey = null, lessons = []) {
  const relevantJourney = journey?.unitId === unit?.id ? journey : null;
  const stops = normalizeSnapshotStops(relevantJourney, unit, lessons);
  const stopIds = new Set(stops.map(({ id }) => id));
  const completedLessonIds = [...new Set(
    (Array.isArray(relevantJourney?.completedLessonIds) ? relevantJourney.completedLessonIds : [])
      .filter((id) => stopIds.has(id)),
  )];
  const completedSet = new Set(completedLessonIds);
  const requestedCurrent = text(relevantJourney?.currentLessonId);
  const currentLessonId = requestedCurrent && stopIds.has(requestedCurrent)
    && !completedSet.has(requestedCurrent)
    ? requestedCurrent
    : stops.find(({ id }) => !completedSet.has(id))?.id ?? "";
  const completed = completedLessonIds.length;
  const total = stops.length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  return {
    unitId: text(unit?.id),
    stops: stops.map((stop) => ({
      ...stop,
      state: completedSet.has(stop.id)
        ? "completed"
        : stop.id === currentLessonId
          ? "current"
          : "upcoming",
    })),
    completedLessonIds,
    currentLessonId,
    completed,
    total,
    percent,
  };
}

export function createJourneySnapshot({
  courseId,
  unit,
  lessons,
  previousJourney = null,
  selectedLessonId,
  completeLesson = true,
}) {
  const stops = lessonStopsForUnit(unit, lessons);
  if (!stops.length) throw new Error("The selected unit has no lessons to update.");
  const selected = stops.find(({ id }) => id === selectedLessonId);
  if (!selected) throw new Error("Select a valid lesson.");

  const previous = previousJourney?.unitId === unit.id
    ? physicalProgress(unit, previousJourney, lessons)
    : physicalProgress(unit, null, lessons);
  const completed = new Set(previous.completedLessonIds);
  if (completeLesson) completed.add(selected.id);
  else completed.delete(selected.id);
  const completedLessonIds = stops.filter(({ id }) => completed.has(id)).map(({ id }) => id);
  const currentLessonId = completeLesson
    ? stops.find(({ id }) => !completed.has(id))?.id ?? ""
    : selected.id;

  return {
    courseId: text(courseId),
    unitId: text(unit.id),
    completedLessonIds,
    currentLessonId,
    lessonStops: stops,
  };
}

export function currentPhysicalUnit(units, journey) {
  if (!Array.isArray(units) || !units.length) return null;
  return units.find(({ id }) => id === journey?.unitId) ?? units[0];
}
