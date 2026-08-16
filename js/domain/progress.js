import { PROGRESS_SKILLS } from "./constants.js";

function existingNumericValues(values) {
  return values
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(Number)
    .filter(Number.isFinite);
}

export function calculateUnitProgress(scores) {
  const existingScores = existingNumericValues(
    PROGRESS_SKILLS.map((skill) => scores[skill]),
  );

  if (existingScores.length === 0) return null;

  const total = existingScores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / existingScores.length);
}

export function calculateOverallProgress(progressDocuments) {
  const scores = existingNumericValues(
    progressDocuments.map((item) => item.unitProgress),
  );

  if (scores.length === 0) return null;

  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / scores.length);
}

export function findStrongestArea(progressDocuments) {
  if (progressDocuments.length === 0) return null;

  const skillAverages = PROGRESS_SKILLS.map((skill) => {
    const scores = existingNumericValues(progressDocuments.map((item) => item[skill]));

    if (scores.length === 0) return null;

    return {
      skill,
      score: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
    };
  }).filter(Boolean);

  if (skillAverages.length === 0) return null;

  return skillAverages.reduce((strongest, current) =>
    current.score > strongest.score ? current : strongest,
  );
}
