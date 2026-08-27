import test from "node:test";
import assert from "node:assert/strict";

import {
  homeworkResourceType,
  isSafeHomeworkResourceUrl,
  normalizeHomeworkResources,
} from "../js/domain/homework.js";

test("homework resources accept HTTPS links and repository PDFs", () => {
  assert.equal(isSafeHomeworkResourceUrl("https://example.com/task"), true);
  assert.equal(isSafeHomeworkResourceUrl("./assets/materials/homework/unit-4.pdf"), true);
  assert.equal(homeworkResourceType("./assets/materials/homework/unit-4.pdf"), "pdf");
});

test("homework resources reject executable and escaping paths", () => {
  assert.equal(isSafeHomeworkResourceUrl("javascript:alert(1)"), false);
  assert.equal(isSafeHomeworkResourceUrl("http://example.com/insecure.pdf"), false);
  assert.equal(isSafeHomeworkResourceUrl("../private/task.pdf"), false);
  assert.deepEqual(normalizeHomeworkResources([{ url: "javascript:alert(1)" }]), []);
});

test("homework resources keep a safe student-facing snapshot", () => {
  assert.deepEqual(normalizeHomeworkResources([
    { title: "Worksheet", url: "https://example.com/work.pdf", type: "pdf", secret: "hidden" },
  ]), [{ title: "Worksheet", url: "https://example.com/work.pdf", type: "pdf" }]);
});
