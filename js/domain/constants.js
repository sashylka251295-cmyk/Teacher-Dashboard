export const USER_ROLES = Object.freeze({
  ADMIN: "admin",
  STUDENT: "student",
});

export const STUDENT_STATUSES = Object.freeze(["active", "paused", "archived"]);
export const STUDENT_VISUAL_THEMES = Object.freeze(["child", "neutral"]);
export const DEFAULT_STUDENT_VISUAL_THEME = "neutral";
export const GOAL_STATUSES = Object.freeze(["new", "working", "confident", "completed"]);
export const ACTIVE_GOAL_STATUSES = Object.freeze(["new", "working", "confident"]);
export const PROGRESS_SKILLS = Object.freeze([
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "speaking",
  "homework",
]);

export const PROGRESS_SKILL_LABELS = Object.freeze({
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  homework: "Homework",
});
