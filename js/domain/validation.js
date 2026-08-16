import {
  GOAL_STATUSES,
  PROGRESS_SKILLS,
  STUDENT_STATUSES,
  STUDENT_VISUAL_THEMES,
} from "./constants.js";

export function isNonEmptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPositiveInteger(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

export function isProgressScore(value) {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= 100;
}

export function isProgressPayloadValid(payload) {
  return PROGRESS_SKILLS.every((skill) => isProgressScore(payload[skill]));
}

export function isStudentStatus(value) {
  return STUDENT_STATUSES.includes(value);
}

export function isStudentVisualTheme(value) {
  return STUDENT_VISUAL_THEMES.includes(value);
}

export function isGoalStatus(value) {
  return GOAL_STATUSES.includes(value);
}

export function isValidHexColor(value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}
