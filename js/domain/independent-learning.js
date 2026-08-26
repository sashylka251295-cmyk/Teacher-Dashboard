export const INDEPENDENT_PROGRESS_SCOPE = "independent";
export const INDEPENDENT_PROGRESS_KEY = "__independent__";

export function isIndependentProgressEntry(entry) {
  return entry?.scope === INDEPENDENT_PROGRESS_SCOPE
    || typeof entry?.unitId !== "string"
    || !entry.unitId.trim();
}

export function progressScopeKey(unitId, scope = "") {
  return scope === INDEPENDENT_PROGRESS_SCOPE || !String(unitId ?? "").trim()
    ? INDEPENDENT_PROGRESS_KEY
    : String(unitId).trim();
}

export function independentLearningTargets(entry) {
  if (!isIndependentProgressEntry(entry) || !Array.isArray(entry?.workedOnObjectives)) return [];
  return entry.workedOnObjectives
    .filter(({ objectiveId, id, title, category }) =>
      String(objectiveId ?? id ?? "").trim()
      && String(title ?? "").trim()
      && String(category ?? "").trim())
    .map(({ objectiveId, id, title, category }) => ({
      id: String(objectiveId ?? id).trim(),
      title: String(title).trim(),
      category: String(category).trim(),
      categories: [String(category).trim()],
    }));
}
