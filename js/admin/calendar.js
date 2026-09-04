import { calendarEventsRepository } from "../data/repositories/calendar-events-repository.js";
import { coursesRepository } from "../data/repositories/courses-repository.js";
import { groupsRepository } from "../data/repositories/groups-repository.js";
import { lessonsRepository } from "../data/repositories/lessons-repository.js";
import { studentsRepository } from "../data/repositories/students-repository.js";
import { unitsRepository } from "../data/repositories/units-repository.js";
import {
  CALENDAR_DAY_END_HOUR,
  CALENDAR_DAY_START_HOUR,
  CALENDAR_STATUS_LABELS,
  addCalendarDays,
  buildCalendarEvent,
  calendarColorForEntity,
  calendarDate,
  calendarDateFromKey,
  calendarDateKey,
  calendarEndTime,
  calendarOccurrences,
  isCalendarPaletteColor,
  startOfCalendarWeek,
} from "../domain/calendar.js";
import { createCalendarColorPicker } from "../ui/calendar-color-picker.js";

const MONTH_FORMAT = new Intl.DateTimeFormat("en", { month: "short" });
const DAY_HEADING_FORMAT = new Intl.DateTimeFormat("en", { weekday: "short" });
const LONG_DATE_FORMAT = new Intl.DateTimeFormat("en", { dateStyle: "medium" });
const TIME_FORMAT = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hour12: false });
const CALENDAR_SLOT_MINUTES = 30;

let elements = null;
let initialized = false;
let loaded = false;
let loading = null;
let colorPicker = null;
let view = "week";
let filter = "all";
let anchorDate = new Date();
let students = [];
let groups = [];
let courses = [];
let units = [];
let lessons = [];
let events = [];
let editingEvent = null;
let editingOccurrence = null;
let editorMode = "create";
let selectedParticipantValue = "";

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function showDialog(dialog) {
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}

function setState(message = "", isError = false) {
  elements.state.textContent = message;
  elements.state.hidden = !message;
  elements.state.dataset.error = String(isError);
}

function setEditorMessage(message = "") {
  elements.editorMessage.textContent = message;
}

function toDateInput(value) {
  return calendarDateKey(value);
}

function toTimeInput(value) {
  const date = calendarDate(value);
  return date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : "";
}

function dateTimeFromForm(dateValue, timeValue) {
  const date = calendarDateFromKey(dateValue);
  const match = /^(\d{2}):(\d{2})$/.exec(String(timeValue));
  if (!date || !match) return null;
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function courseName(id) {
  return courses.find((course) => course.id === id)?.name ?? "";
}

function unitName(id) {
  const unit = units.find((item) => item.id === id);
  if (!unit) return "";
  return unit.title || (unit.number ? `Unit ${unit.number}` : "Unit");
}

function lessonName(id) {
  const lesson = lessons.find((item) => item.id === id);
  if (!lesson) return "";
  return lesson.title || `Lesson ${lesson.number ?? lesson.order ?? ""}`.trim();
}

function participantValue(type, id) {
  return `${type}:${id}`;
}

function parseParticipant(value) {
  const [type, ...idParts] = String(value).split(":");
  const id = idParts.join(":");
  if (!id || !["student", "group"].includes(type)) return null;
  const entity = type === "student"
    ? students.find((student) => student.id === id)
    : groups.find((group) => group.id === id);
  return entity ? { type, entity } : null;
}

function activeParticipants() {
  return [
    ...students.filter((student) => student.status !== "archived").map((entity) => ({ type: "student", entity })),
    ...groups.filter((group) => group.active !== false).map((entity) => ({ type: "group", entity })),
  ].sort((first, second) => String(first.entity.name).localeCompare(String(second.entity.name)));
}

function renderParticipants(preserveValue = true) {
  const participants = activeParticipants();
  const current = preserveValue ? selectedParticipantValue : "";
  const query = elements.participantSearch.value.trim().toLowerCase();
  const matches = participants.filter(({ entity }) => !query || String(entity.name).toLowerCase().includes(query));
  const options = participants.map(({ type, entity }) => {
      const option = createOption(
        participantValue(type, entity.id),
        `${type === "student" ? "Student" : "Group"} · ${entity.name}`,
      );
      return option;
    });
  elements.participant.replaceChildren(...options);
  if (current && options.some(({ value }) => value === current)) {
    selectedParticipantValue = current;
    elements.participant.value = current;
  } else {
    selectedParticipantValue = "";
    elements.participant.selectedIndex = -1;
  }
  elements.participantList.replaceChildren(...matches.map(({ type, entity }) => {
    const button = document.createElement("button");
    const swatch = document.createElement("span");
    const identity = document.createElement("span");
    const name = document.createElement("strong");
    const kind = document.createElement("small");
    const check = document.createElement("span");
    const value = participantValue(type, entity.id);
    button.type = "button";
    button.dataset.participantValue = value;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(selectedParticipantValue === value));
    swatch.className = "calendar-participant-color";
    swatch.style.backgroundColor = calendarColorForEntity(entity);
    name.textContent = entity.name || "Untitled";
    kind.textContent = type === "student" ? "Individual" : "Group";
    check.className = "calendar-participant-check";
    check.textContent = "✓";
    check.setAttribute("aria-hidden", "true");
    identity.append(name, kind);
    button.append(swatch, identity, check);
    button.addEventListener("click", () => {
      selectedParticipantValue = value;
      elements.participant.value = value;
      elements.participantList.querySelectorAll("[aria-selected]").forEach((item) => {
        item.setAttribute("aria-selected", String(item === button));
      });
      syncParticipant();
    });
    return button;
  }));
  syncParticipant();
}

function effectiveCourseId(participant) {
  if (!participant) return "";
  if (participant.type === "group") return participant.entity.courseId ?? "";
  const group = groups.find((item) => item.id === participant.entity.groupId);
  return group?.courseId || participant.entity.courseId || "";
}

function populateCourses(selectedId = "") {
  elements.course.replaceChildren(createOption("", "No course"), ...courses.map((course) =>
    createOption(course.id, course.name || "Untitled course")));
  elements.course.value = courses.some(({ id }) => id === selectedId) ? selectedId : "";
  populateUnits();
}

function populateUnits(selectedId = "") {
  const courseUnits = units.filter((unit) => unit.courseId === elements.course.value);
  elements.unit.replaceChildren(createOption("", "No specific unit"), ...courseUnits.map((unit) =>
    createOption(unit.id, unit.title || `Unit ${unit.number ?? ""}`.trim())));
  elements.unit.value = courseUnits.some(({ id }) => id === selectedId) ? selectedId : "";
  populateLessons();
}

function populateLessons(selectedId = "") {
  const matching = lessons.filter((lesson) => lesson.courseId === elements.course.value
    && (!elements.unit.value || lesson.unitId === elements.unit.value));
  elements.lesson.replaceChildren(createOption("", "No specific lesson"), ...matching.map((lesson) =>
    createOption(lesson.id, `${lesson.number ?? lesson.order ?? "—"}. ${lesson.title || "Lesson"}`)));
  elements.lesson.value = matching.some(({ id }) => id === selectedId) ? selectedId : "";
}

async function ensureParticipantColor(participant) {
  if (!participant) return "";
  const color = calendarColorForEntity(participant.entity);
  if (isCalendarPaletteColor(participant.entity.color)) return color;
  participant.entity.color = color;
  try {
    const repository = participant.type === "student" ? studentsRepository : groupsRepository;
    await repository.update(participant.entity.id, { color });
  } catch (error) {
    console.error("Unable to persist the participant calendar color.", error);
  }
  return color;
}

function syncParticipant() {
  if (elements.form.elements.audienceMode.value !== "existing") return;
  const participant = parseParticipant(selectedParticipantValue);
  const color = participant ? calendarColorForEntity(participant.entity) : "#8fa77d";
  colorPicker.setValue(color);
  colorPicker.setDisabled(true);
  elements.colorContext.textContent = participant
    ? `${participant.entity.name} keeps this saved color across calendar events.`
    : "Select a student or group to use their saved color.";
  populateCourses(effectiveCourseId(participant));
}

function syncAudienceMode() {
  const manual = elements.form.elements.audienceMode.value === "manual";
  elements.existingFields.hidden = manual;
  elements.manualField.hidden = !manual;
  elements.courseFields.hidden = manual;
  elements.form.elements.manualTitle.required = manual;
  if (manual) {
    colorPicker.setDisabled(false);
    if (editorMode === "create") colorPicker.setValue(colorPicker.firstAvailable());
    elements.colorContext.textContent = "Choose a calm color for this manual event.";
    populateCourses("");
  } else syncParticipant();
}

function syncDuration() {
  elements.customDuration.hidden = elements.form.elements.duration.value !== "custom";
}

function syncRepeat() {
  const repeat = elements.form.elements.repeat.value;
  elements.repeatOptions.hidden = repeat === "none";
  elements.customRepeat.hidden = repeat !== "custom";
}

function defaultStartTime() {
  const now = new Date();
  const roundedMinutes = Math.ceil(now.getMinutes() / 15) * 15;
  now.setMinutes(roundedMinutes, 0, 0);
  if (now.getHours() < CALENDAR_DAY_START_HOUR || now.getHours() >= CALENDAR_DAY_END_HOUR) {
    now.setHours(16, 0, 0, 0);
  }
  return toTimeInput(now);
}

function resetEditor() {
  elements.form.reset();
  elements.form.elements.audienceMode.value = "existing";
  elements.form.elements.lessonDate.value = toDateInput(anchorDate);
  elements.form.elements.startTime.value = defaultStartTime();
  elements.form.elements.duration.value = "60";
  elements.form.elements.repeat.value = "none";
  elements.form.elements.repeatInterval.value = "3";
  elements.participantSearch.value = "";
  selectedParticipantValue = "";
  colorPicker.setUsage(students, groups);
  colorPicker.setValue("#8fa77d");
  renderParticipants(false);
  syncDuration();
  syncRepeat();
  syncAudienceMode();
  setEditorMessage("");
}

function selectExistingParticipant(event) {
  const value = event.participantType === "student"
    ? participantValue("student", event.studentId)
    : participantValue("group", event.groupId);
  if ([...elements.participant.options].some((option) => option.value === value)) {
    selectedParticipantValue = value;
    elements.participant.value = value;
    elements.participantList.querySelectorAll("[aria-selected]").forEach((item) => {
      item.setAttribute("aria-selected", String(item.dataset.participantValue === value));
    });
    syncParticipant();
  }
}

function openEditor(occurrence = null, mode = "edit", preset = null) {
  editingOccurrence = occurrence;
  editingEvent = occurrence ? events.find(({ id }) => id === occurrence.id) ?? occurrence : null;
  editorMode = occurrence ? mode : "create";
  resetEditor();
  elements.editorTitle.textContent = editorMode === "create"
    ? "Add lesson"
    : editorMode === "reschedule" ? "Reschedule lesson" : "Edit lesson";
  elements.editorSave.textContent = editorMode === "create"
    ? "Add lesson"
    : editorMode === "reschedule" ? "Save new time" : "Save changes";

  if (!editingEvent && preset?.startAt) {
    elements.form.elements.lessonDate.value = toDateInput(preset.startAt);
    elements.form.elements.startTime.value = toTimeInput(preset.startAt);
  }

  if (editingEvent) {
    const source = editorMode === "reschedule" ? occurrence : editingEvent;
    const manual = editingEvent.participantType === "manual";
    elements.form.elements.audienceMode.value = manual ? "manual" : "existing";
    syncAudienceMode();
    if (manual) {
      elements.form.elements.manualTitle.value = editingEvent.manualTitle || editingEvent.displayName || "";
      colorPicker.setDisabled(false);
      colorPicker.setValue(editingEvent.calendarColor);
    } else selectExistingParticipant(editingEvent);
    elements.form.elements.lessonDate.value = toDateInput(source.startAt);
    elements.form.elements.startTime.value = toTimeInput(source.startAt);
    const duration = String(source.durationMinutes || 60);
    if (["30", "45", "60", "90"].includes(duration)) elements.form.elements.duration.value = duration;
    else {
      elements.form.elements.duration.value = "custom";
      elements.form.elements.customDuration.value = duration;
    }
    populateCourses(editingEvent.courseId);
    populateUnits(editingEvent.unitId);
    populateLessons(editingEvent.lessonId);
    elements.form.elements.repeat.value = editingEvent.recurrence?.frequency ?? "none";
    elements.form.elements.repeatInterval.value = editingEvent.recurrence?.intervalWeeks ?? 1;
    elements.form.elements.repeatUntil.value = editingEvent.recurrence?.until ?? "";
    elements.form.elements.notes.value = editingEvent.notes ?? "";
    syncDuration();
    syncRepeat();
  }
  elements.form.dataset.mode = editorMode;
  showDialog(elements.editorDialog);
  if (editorMode === "create") elements.participantSearch.focus();
}

function collectEditorEvent() {
  const manual = elements.form.elements.audienceMode.value === "manual";
  const participant = manual ? null : parseParticipant(selectedParticipantValue);
  const startAt = dateTimeFromForm(
    elements.form.elements.lessonDate.value,
    elements.form.elements.startTime.value,
  );
  const durationMinutes = elements.form.elements.duration.value === "custom"
    ? Number(elements.form.elements.customDuration.value)
    : Number(elements.form.elements.duration.value);
  const repeat = elements.form.elements.repeat.value;
  const payload = buildCalendarEvent({
    startAt,
    durationMinutes,
    participantType: manual ? "manual" : participant?.type,
    studentId: participant?.type === "student" ? participant.entity.id : "",
    groupId: participant?.type === "group" ? participant.entity.id : "",
    manualTitle: elements.form.elements.manualTitle.value,
    displayName: manual ? elements.form.elements.manualTitle.value : participant?.entity.name,
    calendarColor: colorPicker.value,
    courseId: manual ? "" : elements.course.value,
    unitId: manual ? "" : elements.unit.value,
    lessonId: manual ? "" : elements.lesson.value,
    status: editingEvent?.status ?? "planned",
    notes: elements.form.elements.notes.value,
    recurrence: {
      frequency: repeat,
      intervalWeeks: elements.form.elements.repeatInterval.value,
      until: elements.form.elements.repeatUntil.value,
    },
    occurrenceOverrides: editingEvent?.occurrenceOverrides,
  });
  if (payload.recurrence.until && payload.recurrence.until < calendarDateKey(payload.startAt)) {
    throw new Error("Repeat end date cannot be before the first lesson.");
  }
  return payload;
}

async function saveEditor(event) {
  event.preventDefault();
  elements.editorSave.disabled = true;
  setEditorMessage("Saving lesson…");
  try {
    const payload = collectEditorEvent();
    const participant = payload.participantType === "manual" ? null : parseParticipant(selectedParticipantValue);
    if (participant) {
      payload.calendarColor = await ensureParticipantColor(participant);
    }
    if (editorMode === "create") await calendarEventsRepository.createEvent(payload);
    else if (editorMode === "reschedule" && editingEvent && editingOccurrence?.isRecurring) {
      await calendarEventsRepository.updateEvent(editingEvent.id, {
        occurrenceOverrides: {
          ...(editingEvent.occurrenceOverrides ?? {}),
          [editingOccurrence.occurrenceKey]: {
            startAt: payload.startAt,
            durationMinutes: payload.durationMinutes,
            status: "rescheduled",
          },
        },
      });
    } else if (editorMode === "reschedule" && editingEvent) {
      await calendarEventsRepository.updateEvent(editingEvent.id, {
        startAt: payload.startAt,
        durationMinutes: payload.durationMinutes,
        status: "rescheduled",
      });
    } else if (editingEvent) await calendarEventsRepository.updateEvent(editingEvent.id, payload);
    closeDialog(elements.editorDialog);
    await refreshCalendar();
    setState(editorMode === "create" ? "Lesson added." : "Lesson updated.");
  } catch (error) {
    console.error("Unable to save the calendar lesson.", error);
    setEditorMessage(error instanceof Error ? error.message : "Unable to save the lesson. Please try again.");
  } finally {
    elements.editorSave.disabled = false;
  }
}

function rangeForView() {
  if (view === "today") {
    const start = calendarDateFromKey(calendarDateKey(anchorDate), 0, 0);
    return { start, end: addCalendarDays(start, 1), days: [start] };
  }
  if (view === "month") {
    const monthStart = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const start = startOfCalendarWeek(monthStart);
    const end = addCalendarDays(start, 42);
    return { start, end, days: Array.from({ length: 42 }, (_, index) => addCalendarDays(start, index)) };
  }
  const start = startOfCalendarWeek(anchorDate);
  return { start, end: addCalendarDays(start, 7), days: Array.from({ length: 7 }, (_, index) => addCalendarDays(start, index)) };
}

function visibleOccurrences(range) {
  return calendarOccurrences(events, range.start, range.end)
    .filter((event) => filter === "all" || event.participantType === filter);
}

function formatRange(range) {
  if (view === "today") return LONG_DATE_FORMAT.format(range.start);
  if (view === "month") return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(anchorDate);
  const finalDay = addCalendarDays(range.end, -1);
  const firstLabel = `${MONTH_FORMAT.format(range.start)} ${range.start.getDate()}`;
  const lastLabel = `${MONTH_FORMAT.format(finalDay)} ${finalDay.getDate()}`;
  return `${firstLabel} – ${lastLabel}, ${finalDay.getFullYear()}`;
}

function eventCard(occurrence) {
  const card = document.createElement("button");
  const name = document.createElement("strong");
  const context = document.createElement("small");
  const time = document.createElement("small");
  const status = document.createElement("span");
  const end = calendarEndTime(occurrence);
  card.type = "button";
  card.className = "calendar-event-card";
  card.dataset.calendarEvent = occurrence.id;
  card.dataset.calendarOccurrence = occurrence.occurrenceKey;
  card.dataset.status = occurrence.status;
  card.style.setProperty("--event-color", occurrence.calendarColor || "#8fa77d");
  name.textContent = occurrence.displayName || occurrence.manualTitle || "Lesson";
  context.textContent = [
    courseName(occurrence.courseId) || (occurrence.participantType === "manual" ? "Manual event" : "No course"),
    lessonName(occurrence.lessonId) || unitName(occurrence.unitId),
  ].filter(Boolean).join(" · ");
  time.textContent = `${TIME_FORMAT.format(occurrence.startAt)} – ${end ? TIME_FORMAT.format(end) : "—"}`;
  status.textContent = CALENDAR_STATUS_LABELS[occurrence.status] ?? "Planned";
  status.className = "calendar-status-chip";
  card.append(name, context, time, status);
  card.addEventListener("click", () => openDetails(occurrence));
  return card;
}

function timeSlot(day, minutesFromStart, totalMinutes) {
  const button = document.createElement("button");
  const startAt = new Date(day);
  const hour = CALENDAR_DAY_START_HOUR + Math.floor(minutesFromStart / 60);
  const minute = minutesFromStart % 60;
  startAt.setHours(hour, minute, 0, 0);
  button.type = "button";
  button.className = "calendar-time-slot";
  button.style.top = `${(minutesFromStart / totalMinutes) * 100}%`;
  button.style.height = `${(CALENDAR_SLOT_MINUTES / totalMinutes) * 100}%`;
  button.title = `Add lesson at ${toTimeInput(startAt)}`;
  button.setAttribute("aria-label", `Add lesson on ${LONG_DATE_FORMAT.format(startAt)} at ${toTimeInput(startAt)}`);
  button.addEventListener("click", () => openEditor(null, "create", { startAt }));
  return button;
}

function renderSchedule(range, occurrences) {
  const grid = document.createElement("div");
  const spacer = document.createElement("span");
  grid.className = `calendar-week-grid${view === "today" ? " calendar-week-grid--today" : ""}`;
  spacer.className = "calendar-week-grid__corner";
  grid.append(spacer);
  range.days.forEach((day) => {
    const heading = document.createElement("div");
    const weekday = document.createElement("strong");
    const date = document.createElement("span");
    heading.className = "calendar-day-heading";
    heading.dataset.today = calendarDateKey(day) === calendarDateKey(new Date()) ? "true" : "false";
    weekday.textContent = DAY_HEADING_FORMAT.format(day);
    date.textContent = `${MONTH_FORMAT.format(day)} ${day.getDate()}`;
    heading.append(weekday, date);
    grid.append(heading);
  });
  const timeRail = document.createElement("div");
  timeRail.className = "calendar-time-rail";
  for (let hour = CALENDAR_DAY_START_HOUR; hour < CALENDAR_DAY_END_HOUR; hour += 1) {
    const label = document.createElement("span");
    label.textContent = `${String(hour).padStart(2, "0")}:00`;
    label.style.top = `${((hour - CALENDAR_DAY_START_HOUR) / (CALENDAR_DAY_END_HOUR - CALENDAR_DAY_START_HOUR)) * 100}%`;
    timeRail.append(label);
  }
  grid.append(timeRail);
  range.days.forEach((day) => {
    const column = document.createElement("div");
    const dayKey = calendarDateKey(day);
    const dayEvents = occurrences.filter((event) => calendarDateKey(event.startAt) === dayKey);
    column.className = "calendar-day-column";
    column.dataset.today = dayKey === calendarDateKey(new Date()) ? "true" : "false";
    const totalMinutes = (CALENDAR_DAY_END_HOUR - CALENDAR_DAY_START_HOUR) * 60;
    for (let minutes = 0; minutes < totalMinutes; minutes += CALENDAR_SLOT_MINUTES) {
      column.append(timeSlot(day, minutes, totalMinutes));
    }
    dayEvents.forEach((event) => {
      const startMinutes = (event.startAt.getHours() - CALENDAR_DAY_START_HOUR) * 60 + event.startAt.getMinutes();
      const card = eventCard(event);
      card.style.top = `${Math.max(0, Math.min(100, (startMinutes / totalMinutes) * 100))}%`;
      card.style.height = `${Math.max(4.5, Math.min(100, (event.durationMinutes / totalMinutes) * 100))}%`;
      if (startMinutes < 0 || startMinutes >= totalMinutes) card.dataset.outsideHours = "true";
      column.append(card);
    });
    grid.append(column);
  });
  return grid;
}

function renderMonth(range, occurrences) {
  const calendar = document.createElement("div");
  calendar.className = "calendar-month-grid";
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((label) => {
    const heading = document.createElement("strong");
    heading.textContent = label;
    calendar.append(heading);
  });
  range.days.forEach((day) => {
    const cell = document.createElement("article");
    const dateButton = document.createElement("button");
    const dayKey = calendarDateKey(day);
    const dayEvents = occurrences.filter((event) => calendarDateKey(event.startAt) === dayKey);
    cell.dataset.outsideMonth = String(day.getMonth() !== anchorDate.getMonth());
    cell.dataset.today = String(dayKey === calendarDateKey(new Date()));
    dateButton.type = "button";
    dateButton.textContent = String(day.getDate());
    dateButton.addEventListener("click", () => {
      anchorDate = day;
      view = "today";
      renderCalendar();
    });
    cell.append(dateButton);
    dayEvents.slice(0, 3).forEach((event) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "calendar-month-event";
      item.style.setProperty("--event-color", event.calendarColor || "#8fa77d");
      item.textContent = `${toTimeInput(event.startAt)} ${event.displayName}`;
      item.addEventListener("click", () => openDetails(event));
      cell.append(item);
    });
    if (dayEvents.length > 3) {
      const more = document.createElement("small");
      more.textContent = `+${dayEvents.length - 3} more`;
      cell.append(more);
    }
    calendar.append(cell);
  });
  return calendar;
}

function renderCalendar() {
  const range = rangeForView();
  const occurrences = visibleOccurrences(range);
  elements.range.textContent = formatRange(range);
  elements.stage.replaceChildren(view === "month"
    ? renderMonth(range, occurrences)
    : renderSchedule(range, occurrences));
  elements.stage.hidden = false;
  elements.viewButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.calendarView === view)));
  elements.filterButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.calendarFilter === filter)));
}

async function loadCalendarData(force = false) {
  if (loaded && !force) return;
  if (loading && !force) return loading;
  setState("Loading calendar…");
  elements.add.disabled = true;
  elements.stage.hidden = true;
  loading = Promise.all([
    studentsRepository.list(),
    groupsRepository.list(),
    coursesRepository.list(),
    unitsRepository.list(),
    lessonsRepository.list(),
    calendarEventsRepository.list(),
  ]).then((data) => {
    [students, groups, courses, units, lessons, events] = data;
    loaded = true;
    elements.add.disabled = false;
    setState("");
    renderCalendar();
  }).catch((error) => {
    console.error("Unable to load the teacher calendar.", error);
    elements.add.disabled = true;
    setState("Unable to load calendar. Please try again.", true);
  }).finally(() => {
    loading = null;
  });
  return loading;
}

async function refreshCalendar() {
  loaded = false;
  await loadCalendarData(true);
}

function openDetails(occurrence) {
  editingOccurrence = occurrence;
  editingEvent = events.find(({ id }) => id === occurrence.id) ?? occurrence;
  const rows = [
    ["Date", LONG_DATE_FORMAT.format(occurrence.startAt)],
    ["Time", `${TIME_FORMAT.format(occurrence.startAt)} – ${TIME_FORMAT.format(calendarEndTime(occurrence))}`],
    ["Duration", `${occurrence.durationMinutes} min`],
    ["Course", courseName(occurrence.courseId) || "No course"],
    ["Unit", unitName(occurrence.unitId) || "No specific unit"],
    ["Lesson", lessonName(occurrence.lessonId) || "No specific lesson"],
    ["Repeat", occurrence.isRecurring ? "Recurring lesson" : "Doesn’t repeat"],
  ];
  elements.detailsTitle.textContent = occurrence.displayName || occurrence.manualTitle || "Lesson";
  elements.detailsStatus.textContent = CALENDAR_STATUS_LABELS[occurrence.status] ?? "Planned";
  elements.detailsStatus.dataset.status = occurrence.status;
  elements.detailsList.replaceChildren(...rows.map(([label, value]) => {
    const row = document.createElement("div");
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value;
    row.append(term, description);
    return row;
  }));
  elements.detailsNotes.textContent = occurrence.notes ?? "";
  elements.detailsNotes.hidden = !occurrence.notes;
  elements.detailsMessage.textContent = "";
  elements.complete.disabled = occurrence.status === "completed";
  elements.cancelLesson.disabled = occurrence.status === "cancelled";
  showDialog(elements.detailsDialog);
}

async function updateOccurrenceStatus(status) {
  if (!editingEvent || !editingOccurrence) return;
  if (editingOccurrence.isRecurring) {
    await calendarEventsRepository.updateEvent(editingEvent.id, {
      occurrenceOverrides: {
        ...(editingEvent.occurrenceOverrides ?? {}),
        [editingOccurrence.occurrenceKey]: {
          ...(editingEvent.occurrenceOverrides?.[editingOccurrence.occurrenceKey] ?? {}),
          status,
        },
      },
    });
  } else await calendarEventsRepository.updateEvent(editingEvent.id, { status });
}

function launchProgressUpdate(occurrence) {
  const detail = {
    studentId: occurrence.studentId,
    groupId: occurrence.groupId,
    courseId: occurrence.courseId,
    unitId: occurrence.unitId,
    lessonId: occurrence.lessonId,
    lessonDate: calendarDateKey(occurrence.startAt),
  };
  if (occurrence.participantType === "student") {
    window.dispatchEvent(new CustomEvent("teacher:student-progress-request", { detail }));
  } else if (occurrence.participantType === "group") {
    window.dispatchEvent(new CustomEvent("teacher:group-progress-request", { detail }));
  } else setState("Manual lesson completed. It is not linked to a student progress profile.");
}

async function completeLesson() {
  if (!editingOccurrence) return;
  elements.complete.disabled = true;
  elements.detailsMessage.textContent = "Completing lesson…";
  const occurrence = editingOccurrence;
  try {
    await updateOccurrenceStatus("completed");
    closeDialog(elements.detailsDialog);
    await refreshCalendar();
    launchProgressUpdate(occurrence);
  } catch (error) {
    console.error("Unable to complete the calendar lesson.", error);
    elements.detailsMessage.textContent = "Unable to complete the lesson. Please try again.";
    elements.complete.disabled = false;
  }
}

async function cancelLesson() {
  if (!editingOccurrence || !window.confirm("Cancel this lesson? It will remain visible in the calendar.")) return;
  elements.cancelLesson.disabled = true;
  elements.detailsMessage.textContent = "Cancelling lesson…";
  try {
    await updateOccurrenceStatus("cancelled");
    closeDialog(elements.detailsDialog);
    await refreshCalendar();
    setState("Lesson cancelled. It remains visible in the calendar.");
  } catch (error) {
    console.error("Unable to cancel the calendar lesson.", error);
    elements.detailsMessage.textContent = "Unable to cancel the lesson. Please try again.";
    elements.cancelLesson.disabled = false;
  }
}

function changePeriod(direction) {
  if (view === "today") anchorDate = addCalendarDays(anchorDate, direction);
  else if (view === "week") anchorDate = addCalendarDays(anchorDate, direction * 7);
  else anchorDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + direction, 1);
  renderCalendar();
}

function initialize() {
  const root = document.querySelector('[data-admin-section="calendar"]');
  const editorDialog = document.querySelector("[data-calendar-editor-dialog]");
  const detailsDialog = document.querySelector("[data-calendar-details-dialog]");
  if (!root || !editorDialog || !detailsDialog) return false;
  elements = {
    root,
    stage: root.querySelector("[data-calendar-stage]"),
    state: root.querySelector("[data-calendar-state]"),
    range: root.querySelector("[data-calendar-range]"),
    viewButtons: [...root.querySelectorAll("[data-calendar-view]")],
    filterButtons: [...root.querySelectorAll("[data-calendar-filter]")],
    previous: root.querySelector("[data-calendar-previous]"),
    next: root.querySelector("[data-calendar-next]"),
    add: root.querySelector("[data-calendar-add]"),
    editorDialog,
    form: editorDialog.querySelector("[data-calendar-editor-form]"),
    editorTitle: editorDialog.querySelector("[data-calendar-editor-title]"),
    editorMessage: editorDialog.querySelector("[data-calendar-editor-message]"),
    editorSave: editorDialog.querySelector("[data-calendar-editor-save]"),
    editorClose: editorDialog.querySelector("[data-calendar-editor-close]"),
    editorCancel: editorDialog.querySelector("[data-calendar-editor-cancel]"),
    existingFields: editorDialog.querySelector("[data-calendar-existing-fields]"),
    manualField: editorDialog.querySelector("[data-calendar-manual-field]"),
    participantSearch: editorDialog.querySelector("[data-calendar-participant-search]"),
    participantList: editorDialog.querySelector("[data-calendar-participant-list]"),
    participant: editorDialog.querySelector("[data-calendar-participant]"),
    colorContext: editorDialog.querySelector("[data-calendar-color-context]"),
    courseFields: editorDialog.querySelector("[data-calendar-course-fields]"),
    course: editorDialog.querySelector("[data-calendar-course]"),
    unit: editorDialog.querySelector("[data-calendar-unit]"),
    lesson: editorDialog.querySelector("[data-calendar-lesson]"),
    customDuration: editorDialog.querySelector("[data-calendar-custom-duration]"),
    repeatOptions: editorDialog.querySelector("[data-calendar-repeat-options]"),
    customRepeat: editorDialog.querySelector("[data-calendar-custom-repeat]"),
    detailsDialog,
    detailsClose: detailsDialog.querySelector("[data-calendar-details-close]"),
    detailsTitle: detailsDialog.querySelector("[data-calendar-details-title]"),
    detailsStatus: detailsDialog.querySelector("[data-calendar-details-status]"),
    detailsList: detailsDialog.querySelector("[data-calendar-details-list]"),
    detailsNotes: detailsDialog.querySelector("[data-calendar-details-notes]"),
    detailsMessage: detailsDialog.querySelector("[data-calendar-details-message]"),
    complete: detailsDialog.querySelector("[data-calendar-complete]"),
    edit: detailsDialog.querySelector("[data-calendar-edit]"),
    reschedule: detailsDialog.querySelector("[data-calendar-reschedule]"),
    cancelLesson: detailsDialog.querySelector("[data-calendar-cancel]"),
  };
  if (Object.values(elements).some((element) => !element)) return false;
  colorPicker = createCalendarColorPicker(editorDialog.querySelector("[data-calendar-event-color]"));
  if (!colorPicker) return false;

  elements.viewButtons.forEach((button) => button.addEventListener("click", () => {
    view = button.dataset.calendarView;
    if (view === "today") anchorDate = new Date();
    renderCalendar();
  }));
  elements.filterButtons.forEach((button) => button.addEventListener("click", () => {
    filter = button.dataset.calendarFilter;
    renderCalendar();
  }));
  elements.previous.addEventListener("click", () => changePeriod(-1));
  elements.next.addEventListener("click", () => changePeriod(1));
  elements.add.addEventListener("click", () => openEditor());
  elements.editorClose.addEventListener("click", () => closeDialog(editorDialog));
  elements.editorCancel.addEventListener("click", () => closeDialog(editorDialog));
  elements.form.addEventListener("submit", saveEditor);
  [...elements.form.elements.audienceMode].forEach((radio) => radio.addEventListener("change", syncAudienceMode));
  elements.participantSearch.addEventListener("input", () => renderParticipants());
  elements.participant.addEventListener("change", syncParticipant);
  elements.course.addEventListener("change", () => populateUnits());
  elements.unit.addEventListener("change", () => populateLessons());
  elements.form.elements.duration.addEventListener("change", syncDuration);
  elements.form.elements.repeat.addEventListener("change", syncRepeat);
  elements.detailsClose.addEventListener("click", () => closeDialog(detailsDialog));
  elements.complete.addEventListener("click", completeLesson);
  elements.cancelLesson.addEventListener("click", cancelLesson);
  elements.edit.addEventListener("click", () => {
    closeDialog(detailsDialog);
    openEditor(editingOccurrence, "edit");
  });
  elements.reschedule.addEventListener("click", () => {
    closeDialog(detailsDialog);
    openEditor(editingOccurrence, "reschedule");
  });
  return true;
}

export function initializeCalendar() {
  if (initialized) return;
  initialized = initialize();
}

export async function showCalendar() {
  if (!initialized) initializeCalendar();
  if (initialized) await loadCalendarData();
}

export function invalidateCalendar() {
  loaded = false;
}
