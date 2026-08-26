import test from "node:test";
import assert from "node:assert/strict";

import {
  INDEPENDENT_PROGRESS_KEY,
  independentLearningTargets,
  isIndependentProgressEntry,
  progressScopeKey,
} from "../js/domain/independent-learning.js";

test("an independent update does not require course, unit, or lesson IDs", () => {
  assert.equal(isIndependentProgressEntry({ scope: "independent", unitId: "" }), true);
  assert.equal(isIndependentProgressEntry({ unitId: "" }), true);
  assert.equal(isIndependentProgressEntry({ scope: "course", unitId: "unit-4" }), false);
  assert.equal(progressScopeKey("", "independent"), INDEPENDENT_PROGRESS_KEY);
  assert.equal(progressScopeKey("unit-4", "course"), "unit-4");
});

test("only safe student-facing target fields are copied to the independent snapshot", () => {
  assert.deepEqual(independentLearningTargets({
    scope: "independent",
    workedOnObjectives: [{
      objectiveId: "target-1",
      title: "Describe a recent experience",
      category: "speaking",
      privateNote: "Teacher-only detail",
    }],
  }), [{
    id: "target-1",
    title: "Describe a recent experience",
    category: "speaking",
    categories: ["speaking"],
  }]);
});
