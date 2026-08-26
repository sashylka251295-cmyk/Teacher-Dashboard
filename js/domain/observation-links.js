export function buildObservationTargetFields(targets, statusForTarget = () => "not_assessed") {
  const linkedTargets = (Array.isArray(targets) ? targets : []).filter((target) =>
    typeof target?.id === "string" && target.id.trim()
    && typeof target?.title === "string" && target.title.trim()
    && typeof target?.category === "string" && target.category.trim());
  if (!linkedTargets.length) return null;
  const targetStatuses = Object.fromEntries(linkedTargets.map((target) => [
    target.id,
    statusForTarget(target) || "not_assessed",
  ]));
  const primaryTarget = linkedTargets[0];
  return {
    learningTargetId: primaryTarget.id,
    learningTargetTitle: primaryTarget.title,
    skillCategory: primaryTarget.category,
    targetStatus: targetStatuses[primaryTarget.id],
    learningTargetIds: linkedTargets.map(({ id }) => id),
    learningTargetTitles: linkedTargets.map(({ title }) => title),
    skillCategories: [...new Set(linkedTargets.map(({ category }) => category))],
    targetStatuses,
  };
}
