export const CALENDAR_DAY_START_HOUR = 9;
export const CALENDAR_DAY_END_HOUR = 21;

export const CALENDAR_EVENT_STATUSES = Object.freeze([
  "planned",
  "completed",
  "cancelled",
  "rescheduled",
]);

export const CALENDAR_STATUS_LABELS = Object.freeze({
  planned: "Planned",
  completed: "Completed",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
});

export const CALENDAR_RECURRENCE_LABELS = Object.freeze({
  none: "Doesn’t repeat",
  weekly: "Every week",
  biweekly: "Every 2 weeks",
  custom: "Custom",
});

export const CALENDAR_COLORS = Object.freeze([
  { name: "Leaf green", value: "#59a85b" },
  { name: "Lime", value: "#8dbb45" },
  { name: "Emerald", value: "#2d9b78" },
  { name: "Sky blue", value: "#3f91d2" },
  { name: "Ocean blue", value: "#4d75c5" },
  { name: "Coral", value: "#df6f79" },
  { name: "Purple", value: "#9465c4" },
  { name: "Sunflower", value: "#e0a928" },
  { name: "Orange", value: "#dc7545" },
  { name: "Berry", value: "#b55b91" },
  { name: "Turquoise", value: "#2ca5a0" },
  { name: "Caramel", value: "#b8894d" },
  { name: "Forest", value: "#477e51" },
  { name: "Slate", value: "#687b8b" },
]);

const LEGACY_CALENDAR_COLORS = Object.freeze({
  "#8fa77d": "#59a85b",
  "#aebd91": "#8dbb45",
  "#789982": "#2d9b78",
  "#7ea3bd": "#3f91d2",
  "#91aab8": "#4d75c5",
  "#c99aa1": "#df6f79",
  "#ac8db8": "#9465c4",
  "#d7ae55": "#e0a928",
  "#c68167": "#dc7545",
  "#a98aa6": "#b55b91",
  "#6e9c98": "#2ca5a0",
  "#b8a98f": "#b8894d",
  "#829477": "#477e51",
  "#aaa69d": "#687b8b",
});

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function calendarDate(value) {
  if (!value) return null;
  const converted = typeof value.toDate === "function" ? value.toDate() : value;
  const date = converted instanceof Date ? new Date(converted) : new Date(converted);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calendarDateKey(value) {
  const date = calendarDate(value);
  if (!date) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function calendarDateFromKey(value, hour = 12, minute = 0) {
  if (!DATE_KEY_PATTERN.test(String(value))) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

export function startOfCalendarWeek(value = new Date()) {
  const date = calendarDate(value) ?? new Date();
  date.setHours(0, 0, 0, 0);
  const mondayOffset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - mondayOffset);
  return date;
}

export function addCalendarDays(value, amount) {
  const date = calendarDate(value) ?? new Date();
  date.setDate(date.getDate() + Number(amount || 0));
  return date;
}

export function isCalendarColor(value) {
  return HEX_COLOR_PATTERN.test(String(value));
}

export function isCalendarPaletteColor(value) {
  return CALENDAR_COLORS.some((color) => color.value.toLowerCase() === String(value).toLowerCase());
}

function stableColorIndex(value) {
  return [...String(value || "calendar")]
    .reduce((total, character) => ((total * 31) + character.charCodeAt(0)) >>> 0, 0)
    % CALENDAR_COLORS.length;
}

export function calendarColorForEntity(entity, fallbackKey = "") {
  if (isCalendarPaletteColor(entity?.color)) return entity.color.toLowerCase();
  const migratedColor = LEGACY_CALENDAR_COLORS[String(entity?.color ?? "").toLowerCase()];
  if (migratedColor) return migratedColor;
  return CALENDAR_COLORS[stableColorIndex(entity?.id || entity?.name || fallbackKey)].value;
}

export function calendarColorUsage(students = [], groups = [], excluded = {}) {
  const usage = new Map(CALENDAR_COLORS.map(({ value }) => [value.toLowerCase(), []]));
  const add = (entity, type) => {
    if (!entity?.id || entity.id === excluded[`${type}Id`]) return;
    const color = calendarColorForEntity(entity);
    if (!usage.has(color)) return;
    usage.get(color).push({ id: entity.id, name: entity.name || "Untitled", type });
  };
  students.forEach((student) => add(student, "student"));
  groups.forEach((group) => add(group, "group"));
  return usage;
}

export function normalizeCalendarRecurrence(recurrence = {}) {
  const frequency = ["weekly", "biweekly", "custom"].includes(recurrence.frequency)
    ? recurrence.frequency
    : "none";
  const intervalWeeks = frequency === "biweekly"
    ? 2
    : frequency === "custom"
      ? Math.min(12, Math.max(1, Number.parseInt(recurrence.intervalWeeks, 10) || 1))
      : 1;
  const until = DATE_KEY_PATTERN.test(String(recurrence.until || "")) ? recurrence.until : "";
  return { frequency, intervalWeeks, until };
}

export function validateCalendarEvent(input) {
  const startAt = calendarDate(input?.startAt);
  const durationMinutes = Number(input?.durationMinutes);
  const participantType = input?.participantType;
  if (!startAt) throw new Error("Select a valid lesson date and start time.");
  if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 480) {
    throw new Error("Duration must be between 15 and 480 minutes.");
  }
  if (!CALENDAR_EVENT_STATUSES.includes(input?.status ?? "planned")) {
    throw new Error("Select a valid lesson status.");
  }
  if (participantType === "student" && !input.studentId) throw new Error("Select a student.");
  if (participantType === "group" && !input.groupId) throw new Error("Select a group.");
  if (participantType === "manual" && !String(input.manualTitle || "").trim()) {
    throw new Error("Enter an event or student name.");
  }
  if (!["student", "group", "manual"].includes(participantType)) {
    throw new Error("Choose who this lesson is for.");
  }
  if (!isCalendarColor(input.calendarColor)) throw new Error("Choose a calendar color.");
  return true;
}

export function buildCalendarEvent(input) {
  validateCalendarEvent(input);
  return {
    startAt: calendarDate(input.startAt),
    durationMinutes: Number(input.durationMinutes),
    participantType: input.participantType,
    studentId: input.participantType === "student" ? String(input.studentId) : "",
    groupId: input.participantType === "group" ? String(input.groupId) : "",
    manualTitle: input.participantType === "manual" ? String(input.manualTitle).trim() : "",
    displayName: String(input.displayName || input.manualTitle || "Lesson").trim(),
    calendarColor: String(input.calendarColor).toLowerCase(),
    courseId: String(input.courseId || ""),
    unitId: String(input.unitId || ""),
    lessonId: String(input.lessonId || ""),
    status: input.status ?? "planned",
    notes: String(input.notes || "").trim(),
    recurrence: normalizeCalendarRecurrence(input.recurrence),
    occurrenceOverrides: input.occurrenceOverrides && typeof input.occurrenceOverrides === "object"
      ? input.occurrenceOverrides
      : {},
  };
}

function occurrenceFrom(event, scheduledStart, occurrenceKey) {
  const override = event.occurrenceOverrides?.[occurrenceKey] ?? {};
  const overriddenStart = calendarDate(override.startAt);
  return {
    ...event,
    startAt: overriddenStart ?? scheduledStart,
    durationMinutes: Number(override.durationMinutes) || Number(event.durationMinutes),
    status: CALENDAR_EVENT_STATUSES.includes(override.status) ? override.status : event.status,
    occurrenceKey,
    isRecurring: event.recurrence?.frequency && event.recurrence.frequency !== "none",
  };
}

export function calendarOccurrences(events, rangeStart, rangeEnd) {
  const start = calendarDate(rangeStart);
  const end = calendarDate(rangeEnd);
  if (!start || !end || end <= start) return [];
  const results = [];
  events.forEach((event) => {
    const baseStart = calendarDate(event.startAt);
    if (!baseStart) return;
    const recurrence = normalizeCalendarRecurrence(event.recurrence);
    if (recurrence.frequency === "none") {
      if (baseStart >= start && baseStart < end) {
        results.push(occurrenceFrom(event, baseStart, calendarDateKey(baseStart)));
      }
      return;
    }

    const intervalDays = recurrence.intervalWeeks * 7;
    const until = recurrence.until ? calendarDateFromKey(recurrence.until, 23, 59) : null;
    const cursor = new Date(baseStart);
    if (cursor < start) {
      const difference = Math.floor((start - cursor) / 86400000);
      cursor.setDate(cursor.getDate() + Math.max(0, Math.floor(difference / intervalDays) * intervalDays));
      while (cursor < start) cursor.setDate(cursor.getDate() + intervalDays);
    }
    let guard = 0;
    while (cursor < end && (!until || cursor <= until) && guard < 500) {
      const occurrenceKey = calendarDateKey(cursor);
      const occurrence = occurrenceFrom(event, new Date(cursor), occurrenceKey);
      if (occurrence.startAt >= start && occurrence.startAt < end) results.push(occurrence);
      cursor.setDate(cursor.getDate() + intervalDays);
      guard += 1;
    }

    Object.entries(event.occurrenceOverrides ?? {}).forEach(([occurrenceKey, override]) => {
      const overrideStart = calendarDate(override?.startAt);
      if (!overrideStart || overrideStart < start || overrideStart >= end) return;
      if (results.some((item) => item.id === event.id && item.occurrenceKey === occurrenceKey)) return;
      const scheduled = calendarDateFromKey(
        occurrenceKey,
        baseStart.getHours(),
        baseStart.getMinutes(),
      );
      if (scheduled) results.push(occurrenceFrom(event, scheduled, occurrenceKey));
    });
  });
  return results.sort((first, second) => first.startAt - second.startAt);
}

export function calendarEndTime(event) {
  const start = calendarDate(event?.startAt);
  return start ? new Date(start.getTime() + (Number(event.durationMinutes) || 0) * 60000) : null;
}

function safeOccurrenceOverrides(overrides = {}) {
  if (!overrides || typeof overrides !== "object") return {};
  return Object.fromEntries(Object.entries(overrides).map(([key, override]) => {
    const safe = {};
    const startAt = calendarDate(override?.startAt);
    const durationMinutes = Number(override?.durationMinutes);
    if (startAt) safe.startAt = startAt;
    if (Number.isInteger(durationMinutes) && durationMinutes >= 15 && durationMinutes <= 480) {
      safe.durationMinutes = durationMinutes;
    }
    if (CALENDAR_EVENT_STATUSES.includes(override?.status)) safe.status = override.status;
    return [key, safe];
  }));
}

export function buildStudentScheduleEntry(event, calendarEventId, studentId) {
  const startAt = calendarDate(event?.startAt);
  const durationMinutes = Number(event?.durationMinutes);
  if (!calendarEventId || !studentId || !startAt || !Number.isInteger(durationMinutes)) {
    throw new Error("A student schedule entry needs an event, student, date and duration.");
  }
  return {
    calendarEventId: String(calendarEventId),
    studentId: String(studentId),
    startAt,
    durationMinutes,
    participantType: event.participantType === "group" ? "group" : "student",
    courseId: String(event.courseId || ""),
    status: CALENDAR_EVENT_STATUSES.includes(event.status) ? event.status : "planned",
    recurrence: normalizeCalendarRecurrence(event.recurrence),
    occurrenceOverrides: safeOccurrenceOverrides(event.occurrenceOverrides),
  };
}

export function nextCalendarOccurrence(events, now = new Date(), horizonDays = 730) {
  const current = calendarDate(now);
  if (!current) return null;
  const rangeStart = new Date(current);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = addCalendarDays(current, horizonDays);
  return calendarOccurrences(events, rangeStart, rangeEnd).find((event) => {
    if (!["planned", "rescheduled"].includes(event.status)) return false;
    const end = calendarEndTime(event);
    return end && end > current;
  }) ?? null;
}
