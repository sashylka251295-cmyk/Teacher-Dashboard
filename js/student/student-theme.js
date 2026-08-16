import {
  DEFAULT_STUDENT_VISUAL_THEME,
  STUDENT_VISUAL_THEMES,
} from "../domain/constants.js";

const THEME_COPY = Object.freeze({
  child: {
    label: "Child theme",
    brand: "Learning Garden",
    message: "Every small step helps your learning garden grow.",
  },
  neutral: {
    label: "Neutral theme",
    brand: "Learning Studio",
    message: "Your learning journey, clearly organized.",
  },
});

export function resolveStudentTheme(value) {
  return STUDENT_VISUAL_THEMES.includes(value)
    ? value
    : DEFAULT_STUDENT_VISUAL_THEME;
}

export function applyStudentTheme(root, value) {
  const theme = resolveStudentTheme(value);
  const copy = THEME_COPY[theme];

  root.dataset.theme = theme;
  document.body.dataset.studentTheme = theme;
  root.querySelectorAll("[data-theme-label]").forEach((element) => {
    element.textContent = copy.label;
  });
  root.querySelectorAll("[data-brand-name]").forEach((element) => {
    element.textContent = copy.brand;
  });
  root.querySelectorAll("[data-theme-message]").forEach((element) => {
    element.textContent = copy.message;
  });

  return theme;
}
