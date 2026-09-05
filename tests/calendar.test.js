import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CALENDAR_DAY_END_HOUR,
  CALENDAR_DAY_START_HOUR,
  buildCalendarEvent,
  buildStudentScheduleEntry,
  calendarColorForEntity,
  calendarColorUsage,
  calendarOccurrences,
  nextCalendarOccurrence,
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

test("Calendar scheduling stays compact and leaves Unit and Lesson to Progress Update", async () => {
  const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  assert.doesNotMatch(html, /data-calendar-unit|data-calendar-lesson/);
  assert.doesNotMatch(source, /function populateUnits|function populateLessons/);
  assert.match(source, /preserveExistingCurriculum/);
});

test("Calendar cache version is propagated through the complete admin module chain", async () => {
  const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
  const page = await readFile(new URL("../js/pages/admin-page.js", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../js/admin/admin-dashboard.js", import.meta.url), "utf8");
  const version = "20260905-calendar-organizer";
  assert.match(html, new RegExp(`admin-page\\.js\\?v=${version}`));
  assert.match(page, new RegExp(`admin-dashboard\\.js\\?v=${version}`));
  assert.match(dashboard, new RegExp(`calendar\\.js\\?v=${version}`));
});

test("Calendar returns directly to its grid after save and shows participant names on events", async () => {
  const source = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /setState\(editorMode === "create" \? "Lesson added\."/);
  assert.match(source, /linkedParticipant\?\.name \|\| occurrence\.displayName/);
  assert.match(source, /card\.append\(name, time\)/);
  assert.doesNotMatch(source, /status\.textContent = CALENDAR_STATUS_LABELS/);
});

test("Desktop calendar includes a navigable mini month date picker", async () => {
  const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../css/admin.css", import.meta.url), "utf8");
  assert.match(html, /data-calendar-mini-month/);
  assert.match(source, /function renderMiniMonth\(\)/);
  assert.match(source, /Previous month/);
  assert.match(source, /Next month/);
  assert.match(styles, /grid-template-columns: 12\.5rem minmax\(0, 1fr\)/);
});

test("Week starts on Monday and includes the full 09:00–20:00 working range", () => {
  assert.equal(startOfCalendarWeek(new Date(2026, 8, 3)).getTime(), monday.getTime());
  assert.equal(CALENDAR_DAY_START_HOUR, 9);
  assert.equal(CALENDAR_DAY_END_HOUR, 21);
  assert.ok(20 < CALENDAR_DAY_END_HOUR);
});

test("Existing student selection migrates its calendar color to the bright palette", () => {
  const color = calendarColorForEntity({ id: "student-1", name: "Vera", color: "#7ea3bd" });
  assert.equal(color, "#3f91d2");
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
  assert.deepEqual(usage.get("#59a85b").map(({ name }) => name), ["Vera"]);
  assert.deepEqual(usage.get("#e0a928").map(({ name }) => name), ["Group 5"]);
  assert.deepEqual(usage.get("#3f91d2"), []);
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

test("Student schedule projection excludes private calendar fields", () => {
  const event = sampleEvent({
    notes: "Private teacher note",
    displayName: "Vera",
    groupId: "private-group-id",
  });
  const entry = buildStudentScheduleEntry(event, "event-1", "student-1");
  assert.deepEqual(Object.keys(entry).sort(), [
    "calendarEventId",
    "courseId",
    "durationMinutes",
    "occurrenceOverrides",
    "participantType",
    "recurrence",
    "startAt",
    "status",
    "studentId",
  ]);
  assert.equal(entry.notes, undefined);
  assert.equal(entry.displayName, undefined);
  assert.equal(entry.groupId, undefined);
});

test("Next student lesson skips completed and cancelled occurrences", () => {
  const now = new Date(2026, 8, 1, 12, 0);
  const completed = { id: "done", ...buildStudentScheduleEntry(
    sampleEvent({ startAt: new Date(2026, 8, 1, 13, 0), status: "completed" }),
    "done",
    "student-1",
  ) };
  const cancelled = { id: "cancelled", ...buildStudentScheduleEntry(
    sampleEvent({ startAt: new Date(2026, 8, 1, 14, 0), status: "cancelled" }),
    "cancelled",
    "student-1",
  ) };
  const planned = { id: "planned", ...buildStudentScheduleEntry(
    sampleEvent({ startAt: new Date(2026, 8, 1, 15, 0) }),
    "planned",
    "student-1",
  ) };
  assert.equal(nextCalendarOccurrence([completed, cancelled, planned], now)?.calendarEventId, "planned");
});

test("Individual and group calendar events synchronize safe student schedules", async () => {
  const calendar = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  const repository = await readFile(new URL("../js/data/repositories/calendar-events-repository.js", import.meta.url), "utf8");
  const studentView = await readFile(new URL("../js/student/student-view.js", import.meta.url), "utf8");
  assert.match(calendar, /student\.groupId === event\.groupId/);
  assert.match(calendar, /createEvent\(payload, scheduleOptions\(payload\)\)/);
  assert.match(repository, /buildStudentScheduleEntry/);
  assert.match(repository, /writeBatch/);
  assert.match(studentView, /studentScheduleEntriesRepository\.listByStudent\(studentId\)/);
  assert.match(studentView, /nextCalendarOccurrence\(scheduleEntries\)/);
});

test("Complete lesson links to the existing student and group Progress Update flows", async () => {
  const calendar = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  const dashboard = await readFile(new URL("../js/admin/admin-dashboard.js", import.meta.url), "utf8");
  const groupsCrud = await readFile(new URL("../js/admin/groups-crud.js", import.meta.url), "utf8");
  const quickUpdate = await readFile(new URL("../js/admin/quick-update.js", import.meta.url), "utf8");
  assert.match(calendar, /teacher:student-progress-request/);
  assert.match(calendar, /teacher:group-progress-request/);
  assert.match(dashboard, /loadAdminStudentProfile\(route\.studentId, "", selection, homeworkId\)/);
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

test("Calendar keeps notes and separates online/offline students and groups", async () => {
  const html = await readFile(new URL("../admin.html", import.meta.url), "utf8");
  const source = await readFile(new URL("../js/admin/calendar.js", import.meta.url), "utf8");
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  for (const category of ["student:online", "student:offline", "group:online", "group:offline"]) {
    assert.match(html, new RegExp(`data-calendar-participant-filter="${category}"`));
  }
  assert.match(html, /data-calendar-note-form/);
  assert.match(source, /calendarNotesRepository/);
  assert.match(source, /await Promise\.all\(events\.map/);
  assert.doesNotMatch(html, /data-calendar-event-color/);
  assert.match(rules, /match \/calendarNotes\/\{noteId\}[\s\S]*?isAdmin\(\)/);
});

test("Calendar events use a narrow teacher-only Firestore rule", async () => {
  const rules = await readFile(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /match \/calendarEvents\/\{eventId\}[\s\S]*?allow read, create, update, delete: if isAdmin\(\);/);
  assert.match(rules, /match \/studentScheduleEntries\/\{entryId\}[\s\S]*?allow read: if isAdmin\(\) \|\| isOwnStudent\(resource\.data\.studentId\);/);
  assert.match(rules, /request\.resource\.data\.keys\(\)\.hasOnly/);
});
