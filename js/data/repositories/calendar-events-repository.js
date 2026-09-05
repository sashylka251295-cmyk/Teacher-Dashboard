import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { createRepository } from "../firestore-repository.js";
import { getFirestoreClient } from "../../core/firebase-client.js";
import { buildStudentScheduleEntry } from "../../domain/calendar.js?v=20260905-calendar-organizer";
import { COLLECTIONS } from "../collection-names.js?v=20260905-calendar-organizer";

const repository = createRepository(COLLECTIONS.CALENDAR_EVENTS);

function uniqueStudentIds(studentIds = []) {
  return [...new Set(studentIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()))];
}

function scheduleEntryId(calendarEventId, studentId) {
  return `${calendarEventId}__${studentId}`;
}

async function existingScheduleEntries(calendarEventId) {
  const database = getFirestoreClient();
  const snapshot = await getDocs(query(
    collection(database, COLLECTIONS.STUDENT_SCHEDULE_ENTRIES),
    where("calendarEventId", "==", calendarEventId),
  ));
  return snapshot.docs;
}

function addScheduleWrites(batch, database, event, calendarEventId, studentIds, existing = []) {
  const desiredIds = new Set();
  uniqueStudentIds(studentIds).forEach((studentId) => {
    const id = scheduleEntryId(calendarEventId, studentId);
    desiredIds.add(id);
    batch.set(doc(database, COLLECTIONS.STUDENT_SCHEDULE_ENTRIES, id), {
      ...buildStudentScheduleEntry(event, calendarEventId, studentId),
      updatedAt: serverTimestamp(),
    });
  });
  existing.filter((snapshot) => !desiredIds.has(snapshot.id)).forEach((snapshot) => batch.delete(snapshot.ref));
}

async function writeEventWithSchedules(id, eventWriteData, scheduleEvent, studentIds, mode) {
  const database = getFirestoreClient();
  const existing = mode === "create" ? [] : await existingScheduleEntries(id);
  const batch = writeBatch(database);
  const timestamps = mode === "create"
    ? { createdAt: serverTimestamp(), updatedAt: serverTimestamp() }
    : { updatedAt: serverTimestamp() };
  if (mode === "create") batch.set(doc(database, COLLECTIONS.CALENDAR_EVENTS, id), { ...eventWriteData, ...timestamps });
  else batch.update(doc(database, COLLECTIONS.CALENDAR_EVENTS, id), { ...eventWriteData, ...timestamps });
  addScheduleWrites(batch, database, scheduleEvent, id, studentIds, existing);
  await batch.commit();
  return id;
}

export const calendarEventsRepository = Object.freeze({
  ...repository,
  createEvent(data, { studentIds = [] } = {}) {
    return writeEventWithSchedules(repository.createId(), data, data, studentIds, "create");
  },
  updateEvent(id, data, { scheduleEvent = null, studentIds = [] } = {}) {
    if (!scheduleEvent) return repository.update(id, { ...data, updatedAt: serverTimestamp() });
    return writeEventWithSchedules(id, data, { ...scheduleEvent, ...data }, studentIds, "update");
  },
  async reconcileStudentSchedules(event, studentIds = []) {
    const existing = await existingScheduleEntries(event.id);
    const desiredIds = new Set(uniqueStudentIds(studentIds).map((studentId) => scheduleEntryId(event.id, studentId)));
    if (existing.length === desiredIds.size && existing.every((snapshot) => desiredIds.has(snapshot.id))) return;
    const database = getFirestoreClient();
    const batch = writeBatch(database);
    addScheduleWrites(batch, database, event, event.id, studentIds, existing);
    await batch.commit();
  },
});
