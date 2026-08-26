import test from "node:test";
import assert from "node:assert/strict";

import { buildObservationTargetFields } from "../js/domain/observation-links.js";

test("one observation can retain several real learning-target links", () => {
  const fields = buildObservationTargetFields([
    { id: "vocabulary-bag", title: "What's in my bag", category: "vocabulary" },
    { id: "grammar-has", title: "She has … in her bag", category: "grammar" },
  ], ({ id }) => id === "vocabulary-bag" ? "confident" : "developing");

  assert.deepEqual(fields.learningTargetIds, ["vocabulary-bag", "grammar-has"]);
  assert.deepEqual(fields.learningTargetTitles, ["What's in my bag", "She has … in her bag"]);
  assert.deepEqual(fields.skillCategories, ["vocabulary", "grammar"]);
  assert.equal(fields.learningTargetId, "vocabulary-bag");
  assert.equal(fields.targetStatuses["grammar-has"], "developing");
});
