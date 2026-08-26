import {
  LANGUAGE_SKILL_CATEGORIES,
  OBJECTIVE_STATUSES,
} from "./constants.js";

const ASSESSED_STATUS_VALUES = Object.freeze({
  needs_practice: 1,
  developing: 2,
  confident: 3,
});

export function isLanguageSkillCategory(value) {
  return LANGUAGE_SKILL_CATEGORIES.includes(value);
}

export function isObjectiveStatus(value) {
  return OBJECTIVE_STATUSES.includes(value);
}

export function objectiveStatusValue(status) {
  return ASSESSED_STATUS_VALUES[status] ?? null;
}

export function normalizeUnitObjectives(objectives) {
  if (!Array.isArray(objectives)) return [];

  return objectives
    .filter(
      (objective) =>
        objective &&
        typeof objective.id === "string" &&
        objective.id.trim() &&
        isLanguageSkillCategory(objective.category) &&
        typeof objective.title === "string" &&
        objective.title.trim(),
    )
    .map((objective, index) => ({
      id: objective.id.trim(),
      category: objective.category,
      categories: [...new Set([
        objective.category,
        ...(Array.isArray(objective.categories) ? objective.categories : []),
      ].filter(isLanguageSkillCategory))],
      title: objective.title.trim(),
      order: Number.isFinite(Number(objective.order)) ? Number(objective.order) : index + 1,
    }))
    .sort((first, second) => first.order - second.order);
}

export function learningObjectivesForUnit(unit) {
  const objectives = normalizeUnitObjectives(unit?.objectives);
  if (objectives.length > 0) return objectives;

  const skillGoals = unit?.skillGoals && typeof unit.skillGoals === "object"
    ? unit.skillGoals
    : {};
  const unitId = typeof unit?.id === "string" && unit.id.trim()
    ? unit.id.trim()
    : "unit";
  return LANGUAGE_SKILL_CATEGORIES
    .filter((category) => typeof skillGoals[category] === "string" && skillGoals[category].trim())
    .map((category, index) => ({
      id: `${unitId}-skill-goal-${category}`,
      category,
      categories: [category],
      title: skillGoals[category].trim(),
      order: index + 1,
    }));
}

export function learningObjectivesForLesson(unit, lesson) {
  const objectives = learningObjectivesForUnit(unit);
  if (!lesson) return objectives;
  const explicitIds = new Set(
    Array.isArray(lesson.learningTargetIds)
      ? lesson.learningTargetIds.filter((id) => typeof id === "string" && id)
      : [],
  );
  if (explicitIds.size) {
    return objectives.filter(({ id }) => explicitIds.has(id));
  }

  const skillGoals = lesson.skillGoals && typeof lesson.skillGoals === "object"
    ? lesson.skillGoals
    : {};
  const lessonSkills = new Set(Object.entries(skillGoals)
    .filter(([, goal]) => typeof goal === "string" && goal.trim())
    .map(([skill]) => skill));
  const inferred = objectives.filter((objective) =>
    (objective.categories ?? [objective.category])
      .some((category) => lessonSkills.has(category)));
  return (inferred.length ? inferred : objectives).slice(0, 3);
}

export function progressByObjective(progressDocuments) {
  return new Map(
    progressDocuments
      .filter((document) => typeof document?.objectiveId === "string")
      .map((document) => [document.objectiveId, document]),
  );
}

export function aggregateObjectiveStatus(progressDocuments) {
  const values = progressDocuments
    .map((document) => objectiveStatusValue(document?.status))
    .filter((value) => value !== null);

  if (values.length === 0) return "not_assessed";

  const roundedAverage = Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
  return Object.keys(ASSESSED_STATUS_VALUES).find(
    (status) => ASSESSED_STATUS_VALUES[status] === roundedAverage,
  ) ?? "not_assessed";
}

export function categorySummaries(units, progressDocuments) {
  const objectiveIdsByCategory = new Map(
    LANGUAGE_SKILL_CATEGORIES.map((category) => [category, new Set()]),
  );

  for (const unit of units) {
    for (const objective of learningObjectivesForUnit(unit)) {
      for (const category of objective.categories ?? [objective.category]) {
        objectiveIdsByCategory.get(category)?.add(objective.id);
      }
    }
  }

  return LANGUAGE_SKILL_CATEGORIES.map((category) => {
    const objectiveIds = objectiveIdsByCategory.get(category);
    const relevantProgress = progressDocuments.filter((document) =>
      objectiveIds.has(document.objectiveId),
    );
    const assessedValues = relevantProgress
      .map((document) => objectiveStatusValue(document.status))
      .filter((value) => value !== null);
    return {
      category,
      objectiveCount: objectiveIds.size,
      assessedCount: assessedValues.length,
      average: assessedValues.length
        ? assessedValues.reduce((sum, value) => sum + value, 0) / assessedValues.length
        : null,
      status: aggregateObjectiveStatus(relevantProgress),
    };
  }).filter((summary) => summary.objectiveCount > 0);
}

export function unitObjectiveStatus(unit, progressDocuments) {
  const objectiveIds = new Set(learningObjectivesForUnit(unit).map(({ id }) => id));
  return aggregateObjectiveStatus(
    progressDocuments.filter((document) => objectiveIds.has(document.objectiveId)),
  );
}

export function strongestObjectiveCategory(units, progressDocuments) {
  const assessed = categorySummaries(units, progressDocuments)
    .map((summary) => ({
      ...summary,
      value: summary.average,
    }))
    .filter((summary) => summary.value !== null);

  if (assessed.length === 0) return null;
  return assessed.reduce((strongest, current) =>
    current.value > strongest.value ? current : strongest,
  );
}

export function overallObjectiveStatus(progressDocuments, units = null) {
  if (!Array.isArray(units)) return aggregateObjectiveStatus(progressDocuments);
  const objectiveIds = new Set(
    units.flatMap((unit) => learningObjectivesForUnit(unit).map(({ id }) => id)),
  );
  return aggregateObjectiveStatus(
    progressDocuments.filter((document) => objectiveIds.has(document.objectiveId)),
  );
}
