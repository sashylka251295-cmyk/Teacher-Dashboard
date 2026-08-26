import test from "node:test";
import assert from "node:assert/strict";

import {
  WIDER_WORLD_1_PILOT,
  activeVocabularyCompatibility,
  normalizeVocabularyItems,
  normalizeResources,
} from "../js/domain/course-program.js";
import {
  WIDER_WORLD_1_UNIT_4_LESSON_PLAN,
} from "../js/data/course-programs/wider-world-1-unit-4-lessons.js";

test("Wider World pilot contains only the requested Unit 4 master data", () => {
  assert.equal(WIDER_WORLD_1_PILOT.course.name, "Wider World 1");
  assert.equal(WIDER_WORLD_1_PILOT.unit.number, 4);
  assert.equal(WIDER_WORLD_1_PILOT.unit.title, "Live and Learn");
  assert.equal(WIDER_WORLD_1_PILOT.unit.estimatedLessons, 7);
  assert.deepEqual(WIDER_WORLD_1_PILOT.unit.activeVocabulary, []);
  assert.deepEqual(WIDER_WORLD_1_PILOT.unit.resources, []);
});

test("resources keep reusable typed fields and drop blank rows", () => {
  assert.deepEqual(normalizeResources([
    { id: "r1", title: "Practice", url: "https://example.com", type: "Website", skill: "grammar" },
    { id: "r2", title: "" },
  ]), [{
    id: "r1",
    title: "Practice",
    url: "https://example.com",
    type: "Website",
    note: "",
    skill: "grammar",
  }]);
});

test("Unit 4 lesson plan contains seven ordered reusable lesson records", () => {
  assert.equal(WIDER_WORLD_1_UNIT_4_LESSON_PLAN.estimatedLessons, 7);
  assert.equal(WIDER_WORLD_1_UNIT_4_LESSON_PLAN.lessons.length, 7);
  assert.deepEqual(
    WIDER_WORLD_1_UNIT_4_LESSON_PLAN.lessons.map(({ number, order }) => [number, order]),
    [[1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7]],
  );
  assert.ok(WIDER_WORLD_1_UNIT_4_LESSON_PLAN.lessons.every(({ resources }) => resources.length === 0));
});

test("legacy vocabulary normalizers remain available for explicit cleanup migration", () => {
  const vocabulary = normalizeVocabularyItems([
    { id: "legacy-1", text: "every day", type: "Chunk", status: "active", lessonIds: ["lesson-1", "lesson-2"] },
    { id: "legacy-2", text: "school", type: "Word", status: "receptive", lessonIds: ["lesson-1"] },
  ]);
  assert.equal(new Set(vocabulary.map(({ id }) => id)).size, vocabulary.length);
  const everyDay = vocabulary.find(({ text }) => text === "every day");
  assert.equal(vocabulary.filter(({ text }) => text === "every day").length, 1);
  assert.equal(everyDay.type, "Chunk");
  assert.equal(everyDay.status, "active");
  assert.equal(everyDay.lessonIds.length, 2);
  assert.ok(vocabulary.some(({ status }) => status === "receptive"));
  assert.ok(activeVocabularyCompatibility(vocabulary).every(({ id }) =>
    vocabulary.find((item) => item.id === id)?.status === "active"));
});
