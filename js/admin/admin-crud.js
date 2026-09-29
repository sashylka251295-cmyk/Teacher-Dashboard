import { initializeCoursesCrud } from "./courses-crud.js?v=20260827-lesson-targets";
import { initializeGroupsCrud } from "./groups-crud.js?v=20260907-student-colors";
import { initializeStudentsCrud } from "./students-crud.js?v=20260929-lesson-billing";

let initialized = false;

export function initializeAdminCrud(callbacks) {
  if (initialized) return;

  initializeStudentsCrud(callbacks);
  initializeGroupsCrud(callbacks);
  initializeCoursesCrud(callbacks);
  initialized = true;
}
