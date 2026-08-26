import assert from "node:assert/strict";
import test from "node:test";

import {
  latestLessonCompletion,
  latestObjectiveChange,
  statusesBeforeProgressEntry,
} from "../js/domain/progress-revisions.js";

const history = [
  {
    id: "first",
    studentId: "student-1",
    unitId: "unit-4",
    lessonId: "lesson-1",
    createdAt: new Date("2026-08-20T10:00:00Z"),
    completeLesson: true,
    changes: [{ objectiveId: "target-1", category: "grammar", previousStatus: "not_assessed", status: "developing" }],
  },
  {
    id: "second",
    studentId: "student-1",
    unitId: "unit-4",
    lessonId: "lesson-1",
    createdAt: new Date("2026-08-21T10:00:00Z"),
    completeLesson: false,
    changes: [{ objectiveId: "target-1", category: "grammar", previousStatus: "developing", status: "confident" }],
  },
];

test("an edited or deleted progress entry can restore the status before that entry", () => {
  const beforeSecond = statusesBeforeProgressEntry(history, history[1]);
  assert.equal(beforeSecond.get("target-1"), "developing");

  const remaining = history.filter(({ id }) => id !== "second");
  assert.equal(
    latestObjectiveChange(remaining, "student-1", "unit-4", "target-1")?.change.status,
    "developing",
  );
});

test("the latest explicit lesson action controls physical completion after revision", () => {
  assert.equal(latestLessonCompletion(history, "student-1", "unit-4", "lesson-1"), false);
  assert.equal(
    latestLessonCompletion(history.filter(({ id }) => id !== "second"), "student-1", "unit-4", "lesson-1"),
    true,
  );
});

test("progress revisions remain isolated to the correct student and unit", () => {
  assert.equal(latestObjectiveChange(history, "student-2", "unit-4", "target-1"), null);
  assert.equal(latestLessonCompletion(history, "student-1", "unit-5", "lesson-1"), null);
});
