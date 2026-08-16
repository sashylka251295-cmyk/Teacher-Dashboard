export const PROFICIENCY_LEVELS = Object.freeze([
  Object.freeze({ key: "needs-support", label: "Needs support", value: 20 }),
  Object.freeze({ key: "developing", label: "Developing", value: 40 }),
  Object.freeze({ key: "mostly-confident", label: "Mostly confident", value: 60 }),
  Object.freeze({ key: "confident", label: "Confident", value: 80 }),
  Object.freeze({ key: "independent", label: "Independent", value: 100 }),
]);

export function proficiencyValue(levelKey) {
  return PROFICIENCY_LEVELS.find((level) => level.key === levelKey)?.value ?? null;
}

export function closestProficiencyLevel(value) {
  if (value === null || value === undefined || value === "") return null;

  const score = Number(value);
  if (!Number.isFinite(score)) return null;

  return PROFICIENCY_LEVELS.reduce((closest, level) =>
    Math.abs(level.value - score) < Math.abs(closest.value - score) ? level : closest,
  );
}
