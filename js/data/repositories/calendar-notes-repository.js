import { createRepository } from "../firestore-repository.js";
import { COLLECTIONS } from "../collection-names.js?v=20260905-calendar-organizer";

export const calendarNotesRepository = createRepository(COLLECTIONS.CALENDAR_NOTES);
