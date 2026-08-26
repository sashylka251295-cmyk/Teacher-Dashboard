export const USER_ROLES = Object.freeze({
  ADMIN: "admin",
  STUDENT: "student",
});

export const STUDENT_STATUSES = Object.freeze(["active", "paused", "archived"]);
export const STUDENT_VISUAL_THEMES = Object.freeze(["child", "teen", "adult", "neutral"]);
export const DEFAULT_STUDENT_VISUAL_THEME = "adult";
export const GOAL_STATUSES = Object.freeze(["new", "working", "confident", "completed"]);
export const ACTIVE_GOAL_STATUSES = Object.freeze(["new", "working", "confident"]);
export const LANGUAGE_SKILL_CATEGORIES = Object.freeze([
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "speaking",
  "writing",
]);

export const LANGUAGE_SKILL_LABELS = Object.freeze({
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  writing: "Writing",
});

export const OBJECTIVE_STATUSES = Object.freeze([
  "needs_practice",
  "developing",
  "confident",
]);

export const OBJECTIVE_STATUS_LABELS = Object.freeze({
  needs_practice: "Needs practice",
  developing: "Developing",
  confident: "Confident",
  not_assessed: "Not assessed",
});

export const HOMEWORK_STATUSES = Object.freeze([
  "assigned",
  "completed",
  "needs_completion",
]);

export const HOMEWORK_STATUS_LABELS = Object.freeze({
  assigned: "Assigned",
  completed: "Completed",
  needs_completion: "Needs completion",
});

export const FEEDBACK_STATUSES = Object.freeze(["draft", "published", "archived"]);

export const FEEDBACK_STATUS_LABELS = Object.freeze({
  draft: "Draft",
  published: "Published",
  archived: "Archived",
});

// Read-only compatibility for percentage records created by the previous model.
export const LEGACY_PROGRESS_SKILLS = Object.freeze([
  "vocabulary",
  "grammar",
  "reading",
  "listening",
  "speaking",
  "homework",
]);

export const LEGACY_PROGRESS_SKILL_LABELS = Object.freeze({
  vocabulary: "Vocabulary",
  grammar: "Grammar",
  reading: "Reading",
  listening: "Listening",
  speaking: "Speaking",
  homework: "Homework",
});
