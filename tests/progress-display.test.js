import test from "node:test";
import assert from "node:assert/strict";

import {
  cumulativeUnitTargets,
  unitPhysicalProgressFromHistory,
} from "../js/domain/progress-display.js";

const unit = {
  id: "unit-home",
  objectives: [
    { id: "places", title: "Places", category: "vocabulary", order: 1 },
    { id: "listening", title: "Listen for places", category: "listening", order: 2 },
    { id: "future", title: "Future target", category: "grammar", order: 3 },
  ],
};

const lessons = [
  { id: "lesson-1", unitId: unit.id, title: "One", order: 1 },
  { id: "lesson-2", unitId: unit.id, title: "Two", order: 2 },
  { id: "lesson-3", unitId: unit.id, title: "Three", order: 3 },
];

test("unit learning display accumulates only targets recorded in real updates", () => {
  const history = [
    {
      id: "first",
      unitId: unit.id,
      workedOnObjectives: [{ objectiveId: "places", title: "Places", category: "vocabulary" }],
    },
    {
      id: "second",
      unitId: unit.id,
      workedOnObjectives: [{ objectiveId: "listening", title: "Listen for places", category: "listening" }],
    },
  ];

  assert.deepEqual(cumulativeUnitTargets(unit, history), [
    { id: "places", title: "Places", category: "vocabulary" },
    { id: "listening", title: "Listen for places", category: "listening" },
  ]);
});

test("unit header percentage represents completed lessons only", () => {
  const history = [
    { id: "first", studentId: "student", unitId: unit.id, lessonId: "lesson-1", completeLesson: true },
    { id: "second", studentId: "student", unitId: unit.id, lessonId: "lesson-2", completeLesson: true },
  ];
  const progress = unitPhysicalProgressFromHistory({ unit, lessons, history, studentId: "student" });

  assert.equal(progress.completed, 2);
  assert.equal(progress.total, 3);
  assert.equal(progress.percent, 67);
});

test("new physical history keeps completed lessons from an existing safe journey", () => {
  const history = [
    { id: "second", studentId: "student", unitId: unit.id, lessonId: "lesson-2", completeLesson: true },
  ];
  const progress = unitPhysicalProgressFromHistory({
    unit,
    lessons,
    history,
    studentId: "student",
    fallbackJourney: { unitId: unit.id, completedLessonIds: ["lesson-1"] },
  });

  assert.deepEqual(progress.completedLessonIds, ["lesson-1", "lesson-2"]);
  assert.equal(progress.percent, 67);
});

test("an explicit manual unit completion remains 100 percent", () => {
  const progress = unitPhysicalProgressFromHistory({
    unit,
    lessons,
    history: [{
      id: "older-update",
      studentId: "student",
      unitId: unit.id,
      lessonId: "lesson-2",
      completeLesson: false,
    }],
    studentId: "student",
    fallbackJourney: {
      unitId: unit.id,
      completedLessonIds: lessons.map(({ id }) => id),
      completedManually: true,
    },
  });

  assert.equal(progress.completed, 3);
  assert.equal(progress.percent, 100);
});
