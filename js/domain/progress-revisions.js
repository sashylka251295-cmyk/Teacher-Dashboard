function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  const raw = typeof value.toDate === "function" ? value.toDate() : value;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function orderedProgressHistory(history) {
  return [...history].sort((first, second) => {
    const byCreation = timestampMillis(first.createdAt) - timestampMillis(second.createdAt);
    if (byCreation) return byCreation;
    const byLessonDate = timestampMillis(first.lessonDate) - timestampMillis(second.lessonDate);
    return byLessonDate || String(first.id).localeCompare(String(second.id));
  });
}

export function statusesBeforeProgressEntry(history, entry) {
  const statuses = new Map();
  for (const item of orderedProgressHistory(history)) {
    if (item.id === entry.id) break;
    if (item.studentId !== entry.studentId || item.unitId !== entry.unitId) continue;
    for (const change of Array.isArray(item.changes) ? item.changes : []) {
      if (change.status === "not_assessed") statuses.delete(change.objectiveId);
      else statuses.set(change.objectiveId, change.status);
    }
  }
  return statuses;
}

export function latestObjectiveChange(history, studentId, unitId, objectiveId) {
  let latest = null;
  orderedProgressHistory(history).forEach((entry) => {
    if (entry.studentId !== studentId || entry.unitId !== unitId) return;
    const change = (Array.isArray(entry.changes) ? entry.changes : [])
      .find((candidate) => candidate.objectiveId === objectiveId);
    if (change) latest = { entry, change };
  });
  return latest;
}

export function latestLessonCompletion(history, studentId, unitId, lessonId) {
  let latest = null;
  orderedProgressHistory(history).forEach((entry) => {
    if (
      entry.studentId === studentId
      && entry.unitId === unitId
      && entry.lessonId === lessonId
      && typeof entry.completeLesson === "boolean"
    ) latest = entry.completeLesson;
  });
  return latest;
}
