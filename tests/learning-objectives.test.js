import assert from "node:assert/strict";
import test from "node:test";

import {
  LANGUAGE_SKILL_CATEGORIES,
  OBJECTIVE_STATUSES,
} from "../js/domain/constants.js";
import {
  aggregateObjectiveStatus,
  categorySummaries,
  learningObjectivesForUnit,
  normalizeUnitObjectives,
  overallObjectiveStatus,
  strongestObjectiveCategory,
  unitObjectiveStatus,
} from "../js/domain/learning-objectives.js";

const units = [
  {
    id: "unit-1",
    objectives: [
      { id: "vocab-1", category: "vocabulary", title: "Use food words", order: 2 },
      { id: "grammar-1", category: "grammar", title: "Use some and any", order: 1 },
    ],
  },
  {
    id: "unit-2",
    objectives: [
      { id: "writing-1", category: "writing", title: "Write a short description", order: 1 },
    ],
  },
];

const progress = [
  { objectiveId: "vocab-1", status: "needs_practice" },
  { objectiveId: "grammar-1", status: "confident" },
  { objectiveId: "writing-1", status: "developing" },
  { objectiveId: "removed-objective", status: "confident" },
];

test("the language model includes Writing and excludes Homework", () => {
  assert.deepEqual(LANGUAGE_SKILL_CATEGORIES, [
    "vocabulary",
    "grammar",
    "reading",
    "listening",
    "speaking",
    "writing",
  ]);
});

test("teacher-selectable target statuses do not include percentages or Not assessed", () => {
  assert.deepEqual(OBJECTIVE_STATUSES, ["needs_practice", "developing", "confident"]);
});

test("unit objectives keep stable IDs and sort by order", () => {
  assert.deepEqual(normalizeUnitObjectives(units[0].objectives).map(({ id }) => id), [
    "grammar-1",
    "vocab-1",
  ]);
});

test("legacy unit skill goals remain usable as stable learning targets", () => {
  const objectives = learningObjectivesForUnit({
    id: "unit-4",
    objectives: [],
    skillGoals: {
      vocabulary: "Use school vocabulary",
      grammar: "Contrast routines and actions happening now",
      writing: "",
    },
  });
  assert.deepEqual(objectives, [
    {
      id: "unit-4-skill-goal-vocabulary",
      category: "vocabulary",
      categories: ["vocabulary"],
      title: "Use school vocabulary",
      order: 1,
    },
    {
      id: "unit-4-skill-goal-grammar",
      category: "grammar",
      categories: ["grammar"],
      title: "Contrast routines and actions happening now",
      order: 2,
    },
  ]);
});

test("one learning target can contribute to several skill areas", () => {
  const crossSkillUnits = [{
    id: "unit-cross-skill",
    objectives: [{
      id: "target-1",
      category: "speaking",
      categories: ["speaking", "grammar"],
      title: "Ask what people are doing",
      order: 1,
    }],
  }];
  const summaries = categorySummaries(crossSkillUnits, [
    { objectiveId: "target-1", status: "developing" },
  ]);

  assert.deepEqual(summaries.map(({ category }) => category), ["grammar", "speaking"]);
  assert.ok(summaries.every(({ status }) => status === "developing"));
});

test("not assessed values are excluded from aggregation", () => {
  assert.equal(aggregateObjectiveStatus([
    { status: "needs_practice" },
    { status: "not_assessed" },
    { status: "confident" },
  ]), "developing");
  assert.equal(aggregateObjectiveStatus([{ status: "not_assessed" }]), "not_assessed");
});

test("unit and overall summaries use current objectives only", () => {
  assert.equal(unitObjectiveStatus(units[0], progress), "developing");
  assert.equal(overallObjectiveStatus(progress, units), "developing");
});

test("Writing appears only where Writing objectives exist", () => {
  const categories = categorySummaries(units, progress).map(({ category }) => category);
  assert.deepEqual(categories, ["vocabulary", "grammar", "writing"]);
});

test("strongest category is calculated from assessed objectives", () => {
  assert.deepEqual(strongestObjectiveCategory(units, progress), {
    category: "grammar",
    objectiveCount: 1,
    assessedCount: 1,
    average: 3,
    status: "confident",
    value: 3,
  });
});
