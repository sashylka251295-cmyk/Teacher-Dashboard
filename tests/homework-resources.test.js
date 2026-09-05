import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

test("teacher can edit or delete homework and both portals render safe links", async () => {
  const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
  const teacher = await readFile(new URL("../js/admin/student-profile.js", import.meta.url), "utf8");
  const student = await readFile(new URL("../js/student/student-view.js", import.meta.url), "utf8");
  assert.match(html, /data-homework-editor-delete/);
  assert.match(teacher, /homeworkAssignmentsRepository\.remove\(assignment\.id\)/);
  assert.match(teacher, /appendTextWithLinks/);
  assert.match(student, /appendTextWithLinks/);
  assert.match(student, /normalizeHomeworkResources\(assignment\.resources\)/);
});
