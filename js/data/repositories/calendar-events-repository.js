import { serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js";

const repository = createRepository(COLLECTIONS.CALENDAR_EVENTS);

export const calendarEventsRepository = Object.freeze({
  ...repository,
  createEvent(data) {
    return repository.create({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  },
  updateEvent(id, data) {
    return repository.update(id, { ...data, updatedAt: serverTimestamp() });
  },
});
