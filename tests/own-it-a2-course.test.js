import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { resolve } from "node:path";

import {
  OWN_IT_A2_IDS,
  OWN_IT_A2_PROGRAM,
} from "../js/data/course-programs/own-it-a2-course.js";
import {
  OWN_IT_A2_UNIT_6_LESSON_PLAN,
} from "../js/data/course-programs/own-it-a2-unit-6-lessons.js";

test("Own It! A2 uses the shared course → unit → lesson hierarchy", () => {
  assert.equal(OWN_IT_A2_PROGRAM.course.id, OWN_IT_A2_IDS.COURSE);
  assert.equal(OWN_IT_A2_PROGRAM.course.name, "Own It! A2");
  assert.equal(OWN_IT_A2_PROGRAM.course.edition, "Own It! 2 Student's Book");
  assert.equal(OWN_IT_A2_PROGRAM.course.level, "A2");
  assert.equal(OWN_IT_A2_PROGRAM.course.frequency, "1 lesson per week");
  assert.match(OWN_IT_A2_PROGRAM.course.defaultStartingPoint, /Unit 6/);
  assert.deepEqual(OWN_IT_A2_PROGRAM.units.map(({ number }) => number), [6, 7, 8, 9]);
  assert.ok(OWN_IT_A2_PROGRAM.units.every(({ courseId }) => courseId === OWN_IT_A2_IDS.COURSE));
});

test("Unit 6 contains the requested targets and exactly eight planned lessons", () => {
  const unit = OWN_IT_A2_PROGRAM.units[0];
  assert.equal(unit.id, OWN_IT_A2_IDS.UNIT_6);
  assert.equal(unit.title, "Hidden Danger");
  assert.equal(unit.estimatedLessons, 8);
  assert.equal(unit.objectives.length, 11);
  assert.equal(unit.objectives.filter(({ category }) => category === "vocabulary").length, 2);
  assert.equal(unit.objectives.filter(({ category }) => category === "grammar").length, 6);
  assert.equal(unit.objectives.filter(({ category }) => category === "reading").length, 1);
  assert.equal(unit.objectives.filter(({ category }) => category === "speaking").length, 2);
  assert.equal(unit.objectives.some(({ category }) => category === "writing"), false);

  assert.equal(OWN_IT_A2_UNIT_6_LESSON_PLAN.lessons.length, 8);
  assert.deepEqual(
    OWN_IT_A2_UNIT_6_LESSON_PLAN.lessons.map(({ number, order, status }) => [number, order, status]),
    Array.from({ length: 8 }, (_, index) => [index + 1, index + 1, "planned"]),
  );
  assert.ok(OWN_IT_A2_UNIT_6_LESSON_PLAN.lessons.every(({ resources }) => resources.length === 0));
  assert.ok(OWN_IT_A2_UNIT_6_LESSON_PLAN.lessons.every(({ courseId, unitId }) =>
    courseId === OWN_IT_A2_IDS.COURSE && unitId === OWN_IT_A2_IDS.UNIT_6));
});

test("Own It! program installation does not store textbook vocabulary lists", () => {
  const unit = OWN_IT_A2_PROGRAM.units[0];
  assert.deepEqual(unit.vocabulary, []);
  assert.deepEqual(unit.activeVocabulary, []);
  assert.ok(OWN_IT_A2_PROGRAM.lessons.every(({ vocabularyItemIds }) =>
    Array.isArray(vocabularyItemIds) && vocabularyItemIds.length === 0));
});

test("Units 7–9 are intentional unpopulated shells with empty progress", () => {
  for (const unit of OWN_IT_A2_PROGRAM.units.slice(1)) {
    assert.equal(unit.estimatedLessons, 0);
    assert.equal(unit.status, "planned");
    assert.equal(unit.mainGoal, "");
    assert.deepEqual(unit.objectives, []);
    assert.deepEqual(unit.vocabulary, []);
    assert.deepEqual(unit.resources, []);
    assert.equal(OWN_IT_A2_PROGRAM.lessons.some(({ unitId }) => unitId === unit.id), false);
  }
});

test("all Own It! covers resolve to local gallery files", async () => {
  const paths = [
    OWN_IT_A2_PROGRAM.course.coverImageUrl,
    ...OWN_IT_A2_PROGRAM.units.map(({ coverImageUrl }) => coverImageUrl),
  ];
  assert.equal(new Set(paths).size, 5);
  await Promise.all(paths.map((path) => access(resolve(path.replace(/^\.\//, "")))));
});
