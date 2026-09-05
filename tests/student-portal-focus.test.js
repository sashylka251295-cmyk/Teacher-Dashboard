import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function sources() {
  return Promise.all([
    readFile(new URL("../student.html", import.meta.url), "utf8"),
    readFile(new URL("../js/student/student-view.js", import.meta.url), "utf8"),
  ]);
}

test("student dashboard keeps the focused course, feedback, homework and journey cards", async () => {
  const [html] = await sources();
  assert.match(html, /<h2>Current Course<\/h2>/);
  assert.match(html, /<h2>Current Feedback<\/h2>/);
  assert.match(html, /<h2>Current Homework<\/h2>/);
  assert.match(html, /<h2>Course Journey<\/h2>/);
  assert.doesNotMatch(html, /<h2>Current Learning<\/h2>/);
});

test("My Progress presents course description, goal and physical lesson progress", async () => {
  const [html, view] = await sources();
  assert.match(html, /data-course-description-preview/);
  assert.match(html, /data-course-goal-preview/);
  assert.match(html, /<span>Course Progress<\/span>/);
  assert.match(view, /coursePhysicalProgress\(units, student\)/);
  assert.match(view, /completed} of \$\{courseProgress\.total} lessons/);
});

test("feedback is navigable and long feedback and homework lists collapse after three items", async () => {
  const [html, view] = await sources();
  assert.match(html, /href="#feedback" data-student-link="feedback"/);
  assert.match(html, /data-student-feedback-page-list/);
  assert.match(view, /limit = 3/);
  assert.match(view, /Show all feedback/);
  assert.match(view, /Show all homework/);
});

test("homework previews navigate to the full assignment and expose safe resources", async () => {
  const [, view] = await sources();
  assert.match(view, /mainLink\.dataset\.studentLink = "homework"/);
  assert.match(view, /mainLink\.dataset\.homeworkId = assignment\.id/);
  assert.match(view, /normalizeHomeworkResources\(assignment\.resources\)\.slice\(0, 2\)/);
  assert.match(view, /appendTextWithLinks\(instructionsText/);
});
