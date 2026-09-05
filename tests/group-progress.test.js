import assert from "node:assert/strict";
import test from "node:test";

import { groupJourneyChanged, groupJourneyFromHistory } from "../js/domain/group-physical-progress.js";

const group = {
  id: "group-1",
  courseId: "course-1",
  courseJourney: {
    unitId: "unit-4",
    completedLessonIds: ["lesson-1"],
    currentLessonId: "lesson-2",
  },
};
const units = [{ id: "unit-4", courseId: "course-1", number: 4, title: "School" }];
const lessons = [
  { id: "lesson-1", unitId: "unit-4", number: 1, order: 1, title: "School Life" },
  { id: "lesson-2", unitId: "unit-4", number: 2, order: 2, title: "Where Is Everything?" },
];

test("group journey returns to zero when all progress updates were deleted", () => {
  const { journey } = groupJourneyFromHistory({ group, units, lessons, history: [] });
  assert.deepEqual(journey.completedLessonIds, []);
  assert.equal(journey.currentLessonId, "lesson-1");
  assert.equal(groupJourneyChanged(group.courseJourney, journey), true);
});

test("remaining group progress updates reconstruct physical completion", () => {
  const history = [
    {
      id: "update-alice",
      groupId: "group-1",
      studentId: "alice",
      unitId: "unit-4",
      lessonId: "lesson-1",
      lessonDate: new Date("2026-09-01T12:00:00Z"),
      completeLesson: true,
      workedOnObjectives: [{ objectiveId: "target-1", title: "School vocabulary", category: "vocabulary" }],
    },
    {
      id: "update-artem",
      groupId: "group-1",
      studentId: "artem",
      unitId: "unit-4",
      lessonId: "lesson-1",
      lessonDate: new Date("2026-09-01T12:00:00Z"),
      completeLesson: true,
    },
  ];
  const { journey } = groupJourneyFromHistory({ group, units, lessons, history });
  assert.deepEqual(journey.completedLessonIds, ["lesson-1"]);
  assert.equal(journey.currentLessonId, "lesson-2");
  assert.equal(journey.currentLearningTargets[0].title, "School vocabulary");
});
