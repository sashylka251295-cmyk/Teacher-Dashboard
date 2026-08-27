import test from "node:test";
import assert from "node:assert/strict";

import {
  createJourneySnapshot,
  currentPhysicalUnit,
  lessonStopsForUnit,
  physicalProgress,
} from "../js/domain/physical-progress.js";
import { learningObjectivesForLesson } from "../js/domain/learning-objectives.js";
import { journeyLessonTitle } from "../js/ui/course-journey-map.js";

const unit = {
  id: "unit-4",
  number: 4,
  estimatedLessons: 3,
  objectives: [
    { id: "target-grammar", category: "grammar", title: "Present Continuous", order: 1 },
    { id: "target-speaking", category: "speaking", title: "Describe actions happening now", order: 2 },
    { id: "target-reading", category: "reading", title: "Understand a school text", order: 3 },
  ],
};

const lessons = [
  {
    id: "lesson-1", unitId: "unit-4", number: 1, order: 1, title: "Actions now",
    learningTargetIds: ["target-grammar", "target-speaking"],
    skillTags: ["grammar", "speaking"],
    teacherNotes: "private",
  },
  { id: "lesson-2", unitId: "unit-4", number: 2, order: 2, title: "Questions" },
  { id: "lesson-3", unitId: "unit-4", number: 3, order: 3, title: "Review" },
];

test("physical progress uses only completed lesson IDs for its percentage", () => {
  const progress = physicalProgress(unit, {
    unitId: "unit-4",
    lessonStops: lessonStopsForUnit(unit, lessons),
    completedLessonIds: ["lesson-1"],
    currentLessonId: "lesson-2",
  });
  assert.equal(progress.completed, 1);
  assert.equal(progress.total, 3);
  assert.equal(progress.percent, 33);
  assert.deepEqual(progress.stops.map(({ state }) => state), ["completed", "current", "upcoming"]);
});

test("publishing a completed lesson advances the physical current stop", () => {
  const first = createJourneySnapshot({
    courseId: "course-1",
    unit,
    lessons,
    selectedLessonId: "lesson-1",
    completeLesson: true,
  });
  assert.deepEqual(first.completedLessonIds, ["lesson-1"]);
  assert.equal(first.currentLessonId, "lesson-2");

  const second = createJourneySnapshot({
    courseId: "course-1",
    unit,
    lessons,
    previousJourney: first,
    selectedLessonId: "lesson-2",
    completeLesson: true,
  });
  assert.deepEqual(second.completedLessonIds, ["lesson-1", "lesson-2"]);
  assert.equal(physicalProgress(unit, second).percent, 67);
});

test("journey snapshots expose safe lesson stops but not teacher notes", () => {
  const snapshot = createJourneySnapshot({
    courseId: "course-1",
    unit,
    lessons,
    selectedLessonId: "lesson-1",
    completeLesson: false,
  });
  assert.equal(snapshot.lessonStops[0].title, "Actions now");
  assert.deepEqual(snapshot.lessonStops[0].skillTags, ["grammar", "speaking"]);
  assert.deepEqual(snapshot.lessonStops[0].learningTargets.map(({ title }) => title), [
    "Present Continuous",
    "Describe actions happening now",
  ]);
  assert.equal("teacherNotes" in snapshot.lessonStops[0], false);
});

test("student maps can use the safe unit lesson projection before first publication", () => {
  const publicUnit = {
    ...unit,
    lessonStops: lessonStopsForUnit(unit, lessons),
  };
  const progress = physicalProgress(publicUnit);

  assert.deepEqual(progress.stops.map(({ title }) => title), ["Actions now", "Questions", "Review"]);
  assert.equal(progress.currentLessonId, "lesson-1");
  assert.equal(progress.percent, 0);
  assert.equal(JSON.stringify(publicUnit.lessonStops).includes("private"), false);
});

test("lesson targets use explicit IDs and remain status-based", () => {
  assert.deepEqual(
    learningObjectivesForLesson(unit, lessons[0]).map(({ id }) => id),
    ["target-grammar", "target-speaking"],
  );
});

test("the physical current unit does not depend on mastery documents", () => {
  const units = [unit, { id: "unit-5", number: 5 }];
  assert.equal(currentPhysicalUnit(units, { unitId: "unit-5" }).id, "unit-5");
  assert.equal(currentPhysicalUnit(units, null).id, "unit-4");
});

test("journey labels keep the lesson title below one separate number", () => {
  assert.equal(journeyLessonTitle("1. What's in my bag?", 1), "What's in my bag?");
  assert.equal(journeyLessonTitle("Lesson 2 — Practice", 2), "Practice");
  assert.equal(journeyLessonTitle("School Life", 1), "School Life");
});
