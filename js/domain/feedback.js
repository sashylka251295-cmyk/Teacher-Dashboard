import { FEEDBACK_STATUSES } from "./constants.js";

export const FEEDBACK_SECTIONS = Object.freeze([
  "message",
  "whatWentWell",
  "whatToPractise",
  "nextStep",
]);

const REQUIRED_REVIEW_SECTIONS = Object.freeze([
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
  return REQUIRED_REVIEW_SECTIONS.every((section) => normalized[section].length > 0);
}

export function hasFeedbackContent(content) {
  const normalized = normalizeFeedbackContent(content);
  return FEEDBACK_SECTIONS.some((section) => normalized[section].length > 0);
}

export function mergeFeedbackContent(currentContent, updates) {
  const current = normalizeFeedbackContent(currentContent);
  return normalizeFeedbackContent(Object.fromEntries(
    FEEDBACK_SECTIONS.map((section) => [
      section,
      typeof updates?.[section] === "string" ? updates[section] : current[section],
    ]),
  ));
}
