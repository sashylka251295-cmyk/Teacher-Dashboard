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
  { name: "Sage", value: "#8fa77d" },
  { name: "Soft olive", value: "#aebd91" },
  { name: "Eucalyptus", value: "#789982" },
  { name: "Muted blue", value: "#7ea3bd" },
  { name: "Dusty blue", value: "#91aab8" },
  { name: "Dusty pink", value: "#c99aa1" },
  { name: "Lavender", value: "#ac8db8" },
  { name: "Mustard", value: "#d7ae55" },
  { name: "Terracotta", value: "#c68167" },
  { name: "Mauve", value: "#a98aa6" },
  { name: "Teal", value: "#6e9c98" },
  { name: "Warm beige", value: "#b8a98f" },
  { name: "Moss", value: "#829477" },
  { name: "Stone", value: "#aaa69d" },
]);

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
  return CALENDAR_COLORS[stableColorIndex(entity?.id || entity?.name || fallbackKey)].value;
}

export function calendarColorUsage(students = [], groups = [], excluded = {}) {
  const usage = new Map(CALENDAR_COLORS.map(({ value }) => [value.toLowerCase(), []]));
  const add = (entity, type) => {
    if (!entity?.id || entity.id === excluded[`${type}Id`]) return;
    const color = isCalendarPaletteColor(entity.color) ? entity.color.toLowerCase() : "";
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
