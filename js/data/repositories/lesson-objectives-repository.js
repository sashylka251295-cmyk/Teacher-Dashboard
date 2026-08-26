import {
  doc,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { getFirestoreClient } from "../../core/firebase-client.js";
import { createProgramItemId } from "../../domain/course-program.js";
import {
  isLanguageSkillCategory,
  learningObjectivesForLesson,
  normalizeUnitObjectives,
} from "../../domain/learning-objectives.js";
import { lessonStopsForUnit } from "../../domain/physical-progress.js";
import { COLLECTIONS } from "../collection-names.js";

export async function addObjectiveToLesson({ unit, lesson, lessons, title, category }) {
  const normalizedTitle = String(title ?? "").trim();
  if (!unit?.id || !lesson?.id) throw new Error("Select a unit and lesson first.");
  if (!normalizedTitle) throw new Error("Enter the learning objective.");
  if (!isLanguageSkillCategory(category)) throw new Error("Select a valid skill area.");

  const currentObjectives = normalizeUnitObjectives(unit.objectives);
  const objective = {
    id: createProgramItemId("objective"),
    title: normalizedTitle,
    category,
    categories: [category],
    order: currentObjectives.length + 1,
  };
  const existingLessonIds = learningObjectivesForLesson(unit, lesson).map(({ id }) => id);
  const nextLesson = {
    ...lesson,
    learningTargetIds: [...new Set([
      ...(Array.isArray(lesson.learningTargetIds) && lesson.learningTargetIds.length
        ? lesson.learningTargetIds
        : existingLessonIds),
      objective.id,
    ])],
    skillTags: [...new Set([...(Array.isArray(lesson.skillTags) ? lesson.skillTags : []), category])],
  };
  const nextLessons = (lessons ?? []).map((item) => item.id === lesson.id ? nextLesson : item);
  const nextUnit = {
    ...unit,
    objectives: [...currentObjectives, objective],
  };
  const firestore = getFirestoreClient();
  const batch = writeBatch(firestore);
  batch.set(doc(firestore, COLLECTIONS.UNITS, unit.id), {
    objectives: nextUnit.objectives,
    lessonStops: lessonStopsForUnit(nextUnit, nextLessons),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  batch.set(doc(firestore, COLLECTIONS.LESSONS, lesson.id), {
    learningTargetIds: nextLesson.learningTargetIds,
    skillTags: nextLesson.skillTags,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  await batch.commit();
  return { objective, unit: nextUnit, lesson: nextLesson, lessons: nextLessons };
}
