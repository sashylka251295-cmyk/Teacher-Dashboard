import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function directorySources() {
  return Promise.all([
    readFile(new URL("../admin.html", import.meta.url), "utf8"),
    readFile(new URL("../js/admin/admin-dashboard.js", import.meta.url), "utf8"),
    readFile(new URL("../js/admin/students-crud.js", import.meta.url), "utf8"),
  ]);
}

test("Students can be viewed separately as online or offline", async () => {
  const [html, dashboard] = await directorySources();
  assert.match(html, /data-student-mode-filter="all"/);
  assert.match(html, /data-student-mode-filter="online"/);
  assert.match(html, /data-student-mode-filter="offline"/);
  assert.match(dashboard, /function studentLessonMode\(student\)/);
  assert.match(dashboard, /matchesStatus && matchesMode && matchesSearch/);
  assert.match(dashboard, /student-mode-badge/);
});

test("A course can be created and selected without leaving Add Student", async () => {
  const [html, , studentsCrud] = await directorySources();
  assert.match(html, /data-student-course-create-toggle/);
  assert.match(html, /Create and assign a course/);
  assert.match(html, /data-student-course-create>Create &amp; assign/);
  assert.match(studentsCrud, /createCourseRecord\(/);
  assert.match(studentsCrud, /elements\.course\.value = course\.id/);
  assert.match(studentsCrud, /Save the student to confirm the assignment/);
});

test("A group can be created with the selected course and assigned inside Add Student", async () => {
  const [html, , studentsCrud] = await directorySources();
  assert.match(html, /data-student-group-create-toggle/);
  assert.match(html, /Create and assign a group/);
  assert.match(html, /data-student-group-create>Create &amp; assign/);
  assert.match(studentsCrud, /async function createGroupForStudent\(\)/);
  assert.match(studentsCrud, /const id = await groupsRepository\.create\(payload\)/);
  assert.match(studentsCrud, /elements\.group\.value = id/);
  assert.match(studentsCrud, /Select or create a course first/);
});
