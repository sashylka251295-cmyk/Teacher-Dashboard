import { initializeCoursesCrud } from "./courses-crud.js";
import { initializeGroupsCrud } from "./groups-crud.js?v=20260827-observations-retired";
import { initializeStudentsCrud } from "./students-crud.js";

let initialized = false;

export function initializeAdminCrud(callbacks) {
  if (initialized) return;

  initializeStudentsCrud(callbacks);
  initializeGroupsCrud(callbacks);
  initializeCoursesCrud(callbacks);
  initialized = true;
}
