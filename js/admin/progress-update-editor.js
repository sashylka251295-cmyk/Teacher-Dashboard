import { reviseLearningUpdate } from "../data/repositories/learning-update-revisions-repository.js";
import {
  LANGUAGE_SKILL_LABELS,
  OBJECTIVE_STATUSES,
  OBJECTIVE_STATUS_LABELS,
} from "../domain/constants.js";
import {
  learningObjectivesForLesson,
  learningObjectivesForUnit,
} from "../domain/learning-objectives.js";
import { isIndependentProgressEntry } from "../domain/independent-learning.js";

let context = null;
let currentEntry = null;
let elements = null;
let initialized = false;

function timestampToDate(value) {
  if (!value) return null;
  const raw = typeof value.toDate === "function" ? value.toDate() : value;
  const date = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateInputValue(value) {
  const date = timestampToDate(value) ?? new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function dateFromInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return year && month && day && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function unitName(unit) {
  return unit?.number ? `Unit ${unit.number} · ${unit.title || "Untitled unit"}` : (unit?.title || "Unknown unit");
}

function lessonName(lesson) {
  if (!lesson) return "Lesson unavailable";
  return `Lesson ${lesson.number ?? lesson.order ?? "—"} · ${lesson.title || "Untitled lesson"}`;
}

function objectivesForEntry(entry, unit, lesson) {
  const byId = new Map(
    (lesson ? learningObjectivesForLesson(unit, lesson) : learningObjectivesForUnit(unit))
      .map((objective) => [objective.id, objective]),
  );
  (Array.isArray(entry.changes) ? entry.changes : []).forEach((change) => {
    if (!byId.has(change.objectiveId)) {
      byId.set(change.objectiveId, {
        id: change.objectiveId,
        title: change.title || LANGUAGE_SKILL_LABELS[change.category] || "Archived learning target",
        category: change.category,
      });
    }
  });
  (Array.isArray(entry.workedOnObjectives) ? entry.workedOnObjectives : []).forEach((workedOn) => {
    const objectiveId = workedOn.objectiveId ?? workedOn.id;
    if (objectiveId && !byId.has(objectiveId)) {
      byId.set(objectiveId, {
        id: objectiveId,
        title: workedOn.title || LANGUAGE_SKILL_LABELS[workedOn.category] || "Learning target",
        category: workedOn.category,
      });
    }
  });
  return [...byId.values()];
}

function createObjectiveRow(objective, entryChange, workedOnIds) {
  const row = document.createElement("label");
  const checkbox = document.createElement("input");
  const copy = document.createElement("span");
  const title = document.createElement("strong");
  const category = document.createElement("small");
  const select = document.createElement("select");
  row.className = "progress-update-objective";
  row.dataset.progressObjective = objective.id;
  row.dataset.category = objective.category;
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(entryChange) || workedOnIds.has(objective.id);
  checkbox.dataset.progressObjectiveEnabled = objective.id;
  title.textContent = objective.title;
  category.textContent = LANGUAGE_SKILL_LABELS[objective.category] ?? "Learning target";
  copy.append(title, category);
  select.append(createOption("", "No status — worked on only"));
  OBJECTIVE_STATUSES.forEach((status) => select.append(
    createOption(status, OBJECTIVE_STATUS_LABELS[status]),
  ));
  select.value = entryChange?.status && OBJECTIVE_STATUSES.includes(entryChange.status)
    ? entryChange.status
    : "";
  select.disabled = !checkbox.checked;
  select.dataset.progressObjectiveStatus = objective.id;
  row.append(checkbox, copy, select);
  return row;
}

function closeDialog() {
  if (typeof elements.dialog.close === "function") elements.dialog.close();
  else elements.dialog.removeAttribute("open");
  currentEntry = null;
}

function openDialog(entryId) {
  if (!context) return;
  const entry = context.progressHistory.find(({ id }) => id === entryId);
  if (!entry) return;
  const unit = context.units.find(({ id }) => id === entry.unitId);
  const lesson = context.lessons.find(({ id }) => id === entry.lessonId);
  const independent = isIndependentProgressEntry(entry);
  if (!independent && !unit) return;
  currentEntry = entry;
  const changes = new Map(
    (Array.isArray(entry.changes) ? entry.changes : []).map((change) => [change.objectiveId, change]),
  );
  const workedOnIds = new Set(
    (Array.isArray(entry.workedOnObjectives) ? entry.workedOnObjectives : [])
      .map((objective) => objective.objectiveId ?? objective.id),
  );
  elements.context.textContent = independent
    ? "Independent learning — no course or lesson required"
    : `${unitName(unit)} › ${lessonName(lesson)}`;
  elements.date.value = dateInputValue(entry.lessonDate ?? entry.createdAt);
  elements.completeRow.hidden = independent;
  elements.completeLesson.checked = independent
    ? false
    : typeof entry.completeLesson === "boolean"
      ? entry.completeLesson
      : context.student.courseJourney?.unitId === unit.id
        && Array.isArray(context.student.courseJourney.completedLessonIds)
        && context.student.courseJourney.completedLessonIds.includes(entry.lessonId);
  elements.completeLesson.disabled = independent || !lesson || context.student.courseJourney?.unitId !== unit?.id;
  elements.objectives.replaceChildren(
    ...objectivesForEntry(entry, unit, lesson).map((objective) =>
      createObjectiveRow(objective, changes.get(objective.id), workedOnIds)),
  );
  elements.message.textContent = "";
  elements.save.disabled = false;
  elements.remove.disabled = false;
  if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
  else elements.dialog.setAttribute("open", "");
}

function collectObjectiveUpdate() {
  const selected = [...elements.objectives.querySelectorAll("[data-progress-objective]")]
    .filter((row) => row.querySelector("[data-progress-objective-enabled]").checked)
    .map((row) => ({
      objectiveId: row.dataset.progressObjective,
      category: row.dataset.category,
      status: row.querySelector("[data-progress-objective-status]").value,
    }));
  return {
    workedOnObjectives: selected.map(({ objectiveId, category }) => {
      const row = elements.objectives.querySelector(`[data-progress-objective="${objectiveId}"]`);
      return { objectiveId, category, title: row.querySelector("strong").textContent };
    }),
    objectiveChanges: selected.filter(({ status }) => OBJECTIVE_STATUSES.includes(status)),
  };
}

async function submitRevision(event) {
  event.preventDefault();
  if (!currentEntry || !context) return;
  const unit = context.units.find(({ id }) => id === currentEntry.unitId);
  const lessonDate = dateFromInput(elements.date.value);
  if (!lessonDate) {
    elements.message.textContent = "Select a valid lesson date.";
    return;
  }
  elements.save.disabled = true;
  elements.remove.disabled = true;
  elements.message.textContent = "Saving changes…";
  try {
    const objectiveUpdate = collectObjectiveUpdate();
    await reviseLearningUpdate({
      entry: currentEntry,
      history: context.progressHistory,
      student: context.student,
      unit,
      lessons: context.lessons,
      objectiveChanges: objectiveUpdate.objectiveChanges,
      workedOnObjectives: objectiveUpdate.workedOnObjectives,
      lessonDate,
      completeLesson: elements.completeLesson.checked,
    });
    closeDialog();
    await context.onSaved("The progress update was edited and current progress was recalculated.");
  } catch (error) {
    console.error("Unable to revise the progress update.", error);
    elements.message.textContent = error instanceof Error && error.message
      ? `Unable to save the changes: ${error.message}`
      : "Unable to save the changes. Please try again.";
  } finally {
    elements.save.disabled = false;
    elements.remove.disabled = false;
  }
}

async function removeUpdate() {
  if (!currentEntry || !context) return;
  const confirmed = window.confirm(
    "Delete this progress update? Learning statuses and lesson completion will be recalculated. Private observations and published feedback will not be deleted.",
  );
  if (!confirmed) return;
  const unit = context.units.find(({ id }) => id === currentEntry.unitId);
  const lessonDate = timestampToDate(currentEntry.lessonDate ?? currentEntry.createdAt) ?? new Date();
  elements.save.disabled = true;
  elements.remove.disabled = true;
  elements.message.textContent = "Deleting update…";
  try {
    await reviseLearningUpdate({
      entry: currentEntry,
      history: context.progressHistory,
      student: context.student,
      unit,
      lessons: context.lessons,
      lessonDate,
      completeLesson: false,
      remove: true,
    });
    closeDialog();
    await context.onSaved("The progress update was deleted and current progress was recalculated.");
  } catch (error) {
    console.error("Unable to delete the progress update.", error);
    elements.message.textContent = error instanceof Error && error.message
      ? `Unable to delete the update: ${error.message}`
      : "Unable to delete the update. Please try again.";
  } finally {
    elements.save.disabled = false;
    elements.remove.disabled = false;
  }
}

function initialize() {
  const root = document.querySelector('[data-admin-section="student-profile"]');
  const dialog = root?.querySelector("[data-progress-update-dialog]");
  const form = dialog?.querySelector("[data-progress-update-form]");
  if (!root || !dialog || !form) return false;
  elements = {
    root,
    dialog,
    form,
    context: dialog.querySelector("[data-progress-update-context]"),
    date: form.elements.progressUpdateDate,
    completeLesson: dialog.querySelector("[data-progress-update-complete]"),
    completeRow: dialog.querySelector("[data-progress-update-complete-row]"),
    objectives: dialog.querySelector("[data-progress-update-objectives]"),
    message: dialog.querySelector("[data-progress-update-message]"),
    save: dialog.querySelector("[data-progress-update-save]"),
    remove: dialog.querySelector("[data-progress-update-delete]"),
    close: dialog.querySelector("[data-progress-update-close]"),
  };
  if (Object.values(elements).some((element) => !element)) return false;
  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const edit = target?.closest("[data-edit-progress-update]");
    if (edit) openDialog(edit.dataset.editProgressUpdate);
  });
  elements.objectives.addEventListener("change", (event) => {
    if (!event.target.matches("[data-progress-objective-enabled]")) return;
    event.target.closest("[data-progress-objective]")
      .querySelector("[data-progress-objective-status]").disabled = !event.target.checked;
  });
  form.addEventListener("submit", submitRevision);
  elements.remove.addEventListener("click", removeUpdate);
  elements.close.addEventListener("click", closeDialog);
  return true;
}

export function configureProgressUpdateEditor(nextContext) {
  if (!initialized) initialized = initialize();
  if (initialized) context = nextContext;
}
