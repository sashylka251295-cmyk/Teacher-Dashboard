import { FEEDBACK_STATUSES } from "./constants.js";

export const FEEDBACK_SECTIONS = Object.freeze([
  "whatWentWell",
  "whatToPractise",
  "nextStep",
]);

export function isFeedbackStatus(value) {
  return FEEDBACK_STATUSES.includes(value);
}

export function normalizeFeedbackContent(content) {
  return Object.fromEntries(
    FEEDBACK_SECTIONS.map((section) => [
      section,
      typeof content?.[section] === "string" ? content[section].trim() : "",
    ]),
  );
}

export function isFeedbackContentComplete(content) {
  const normalized = normalizeFeedbackContent(content);
  return FEEDBACK_SECTIONS.every((section) => normalized[section].length > 0);
}
