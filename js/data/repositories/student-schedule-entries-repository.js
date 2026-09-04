import { where } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { COLLECTIONS } from "../collection-names.js?v=20260904-student-schedule";
import { createRepository } from "../firestore-repository.js";

const repository = createRepository(COLLECTIONS.STUDENT_SCHEDULE_ENTRIES);

export const studentScheduleEntriesRepository = Object.freeze({
  ...repository,
  listByStudent(studentId) {
    return repository.list(where("studentId", "==", studentId));
  },
  listByCalendarEvent(calendarEventId) {
    return repository.list(where("calendarEventId", "==", calendarEventId));
  },
});
