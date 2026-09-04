import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CALENDAR_DAY_END_HOUR,
  CALENDAR_DAY_START_HOUR,
  buildCalendarEvent,
  calendarColorForEntity,
  calendarColorUsage,
  calendarOccurrences,
  startOfCalendarWeek,
} from "../js/domain/calendar.js";

const monday = new Date(2026, 7, 31, 0, 0, 0, 0);

function sampleEvent(overrides = {}) {
  return buildCalendarEvent({
    startAt: new Date(2026, 8, 1, 16, 0),
    durationMinutes: 60,
    participantType: "student",
    studentId: "student-1",
    displayName: "Vera",
    calendarColor: "#8fa77d",
    status: "planned",
    recurrence: { frequency: "none" },
    ...overrides,
  });
}

test("Calendar page and teacher-only navigation render", async () => {
  const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
  const studentHtml = await readFile(new URL("../student.html", import.meta.url), "utf8");
  assert.match(html, /data-admin-link="calendar"/);
  assert.match(html, /data-admin-section="calendar"/);
  assert.match(html, /data-calendar-view="week" aria-pressed="true"/);
  assert.doesNotMatch(studentHtml, /data-admin-link="calendar"|data-admin-section="calendar"/);
});

test("Week navigation and all required calendar views are wired", async () => {
  const source = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  assert.match(source, /data-calendar-previous/);
  assert.match(source, /changePeriod\(-1\)/);
  assert.match(source, /view === "today"/);
  assert.match(source, /view === "week"/);
  assert.match(source, /view === "month"/);
});

test("Week and Today time slots open Add lesson with their date and time pre-filled", async () => {
  const source = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../css/admin.css", import.meta.url), "utf8");
  assert.match(source, /const CALENDAR_SLOT_MINUTES = 30/);
  assert.match(source, /calendar-time-slot/);
  assert.match(source, /openEditor\(null, "create", \{ startAt \}\)/);
  assert.match(source, /lessonDate\.value = toDateInput\(preset\.startAt\)/);
  assert.match(source, /startTime\.value = toTimeInput\(preset\.startAt\)/);
  assert.match(styles, /\.calendar-time-slot:hover/);
});

test("Calendar participant selection is explicit and remains stable while searching", async () => {
  const source = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../css/admin.css", import.meta.url), "utf8");
  assert.match(source, /let selectedParticipantValue = ""/);
  assert.match(source, /selectedParticipantValue = value/);
  assert.match(source, /elements\.participant\.selectedIndex = -1/);
  assert.match(source, /parseParticipant\(selectedParticipantValue\)/);
  assert.match(source, /calendar-participant-check/);
  assert.match(styles, /\[aria-selected="true"\] \.calendar-participant-check/);
});

test("Week starts on Monday and includes the full 09:00–20:00 working range", () => {
  assert.equal(startOfCalendarWeek(new Date(2026, 8, 3)).getTime(), monday.getTime());
  assert.equal(CALENDAR_DAY_START_HOUR, 9);
  assert.equal(CALENDAR_DAY_END_HOUR, 21);
  assert.ok(20 < CALENDAR_DAY_END_HOUR);
});

test("Existing student selection keeps its calendar color", () => {
  const color = calendarColorForEntity({ id: "student-1", name: "Vera", color: "#7ea3bd" });
  assert.equal(color, "#7ea3bd");
});

test("Existing group selection is a valid calendar participant", () => {
  const event = sampleEvent({
    participantType: "group",
    studentId: "",
    groupId: "group-5",
    displayName: "Group 5",
  });
  assert.equal(event.groupId, "group-5");
  assert.equal(event.studentId, "");
});

test("Manual event can be created without a Student or Group entity", () => {
  const event = sampleEvent({
    participantType: "manual",
    studentId: "",
    manualTitle: "Trial lesson — Anna",
    displayName: "Trial lesson — Anna",
  });
  assert.equal(event.manualTitle, "Trial lesson — Anna");
  assert.equal(event.studentId, "");
  assert.equal(event.groupId, "");
});

test("Color availability reports occupied students and groups", () => {
  const usage = calendarColorUsage(
    [{ id: "s1", name: "Vera", color: "#8fa77d" }],
    [{ id: "g1", name: "Group 5", color: "#d7ae55" }],
  );
  assert.deepEqual(usage.get("#8fa77d").map(({ name }) => name), ["Vera"]);
  assert.deepEqual(usage.get("#d7ae55").map(({ name }) => name), ["Group 5"]);
  assert.deepEqual(usage.get("#7ea3bd"), []);
});

test("Reused color warning still provides Use anyway", async () => {
  const source = await readFile(new URL("../js/ui/calendar-color-picker.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
  assert.match(source, /This color is already used by/);
  assert.match(html, /data-calendar-color-choose-another[^>]*>Choose another/);
  assert.match(html, /data-calendar-color-use-anyway[^>]*>Use anyway/);
});

test("Calendar event creation validates required fields", () => {
  assert.throws(() => sampleEvent({ studentId: "" }), /Select a student/);
  assert.throws(() => sampleEvent({ durationMinutes: 0 }), /Duration/);
  assert.throws(() => sampleEvent({ calendarColor: "lime" }), /calendar color/);
});

test("Weekly recurrence stays in one event and expands for the visible range", () => {
  const event = { id: "event-1", ...sampleEvent({
    recurrence: { frequency: "weekly", until: "2026-09-30" },
  }) };
  const occurrences = calendarOccurrences(
    [event],
    new Date(2026, 8, 1),
    new Date(2026, 8, 23),
  );
  assert.equal(occurrences.length, 4);
  assert.equal(event.recurrence.frequency, "weekly");
  assert.equal(event.occurrenceOverrides && Object.keys(event.occurrenceOverrides).length, 0);
});

test("Completed and cancelled lessons remain visible in occurrence history", () => {
  const occurrences = calendarOccurrences([
    { id: "completed", ...sampleEvent({ status: "completed" }) },
    { id: "cancelled", ...sampleEvent({ status: "cancelled", startAt: new Date(2026, 8, 2, 16) }) },
  ], new Date(2026, 8, 1), new Date(2026, 8, 3));
  assert.deepEqual(occurrences.map(({ status }) => status), ["completed", "cancelled"]);
});

test("Complete lesson links to the existing student and group Progress Update flows", async () => {
  const calendar = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../js/admin/admin-dashboard.js", import.meta.url), "utf8");
  const groupsCrud = await readFile(new URL("../js/admin/groups-crud.js", import.meta.url), "utf8");
  const quickUpdate = await readFile(new URL("../js/admin/quick-update.js", import.meta.url), "utf8");
  assert.match(calendar, /teacher:student-progress-request/);
  assert.match(calendar, /teacher:group-progress-request/);
  assert.match(dashboard, /loadAdminStudentProfile\(route\.studentId, "", selection\)/);
  assert.match(groupsCrud, /openGroupQuickUpdate\("", selection\)/);
  assert.match(quickUpdate, /selection\.lessonId/);
  assert.match(quickUpdate, /elements\.completeLesson\.checked = false/);
});

test("Student and group colors persist through their existing edit forms", async () => {
  const studentsCrud = await readFile(new URL("../js/admin/students-crud.js", import.meta.url), "utf8");
  const groupsCrud = await readFile(new URL("../js/admin/groups-crud.js", import.meta.url), "utf8");
  assert.match(studentsCrud, /const color = field\(elements\.form, "color"\)\.value/);
  assert.match(studentsCrud, /\bcolor,/);
  assert.match(groupsCrud, /color: field\(elements\.form, "color"\)\.value/);
});

test("Calendar events use a narrow teacher-only Firestore rule", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /match \/calendarEvents\/\{eventId\}[\s\S]*?allow read, create, update, delete: if isAdmin\(\);/);
});
