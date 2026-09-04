import { initializeCoursesCrud } from "./courses-crud.js?v=20260827-lesson-targets";
import { initializeGroupsCrud } from "./groups-crud.js?v=20260904-calendar";
import { initializeStudentsCrud } from "./students-crud.js?v=20260904-calendar";

let initialized = false;

export function initializeAdminCrud(callbacks) {
  if (initialized) return;

  initializeStudentsCrud(callbacks);
  initializeGroupsCrud(callbacks);
  initializeCoursesCrud(callbacks);
  initialized = true;
}
