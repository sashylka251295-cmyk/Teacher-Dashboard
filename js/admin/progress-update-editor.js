import { reviseLearningUpdate } from "../data/repositories/learning-update-revisions-repository.js?v=20260827-profile-hotfix";
import { addObjectiveToLesson } from "../data/repositories/lesson-objectives-repository.js";
import { feedbackDraftsRepository } from "../data/repositories/feedback-drafts-repository.js?v=20260827-profile-hotfix";
import {
  LANGUAGE_SKILL_CATEGORIES,
  LANGUAGE_SKILL_LABELS,
  OBJECTIVE_STATUSES,
  OBJECTIVE_STATUS_LABELS,
} from "../domain/constants.js";
import {
  learningObjectivesForLesson,
  learningObjectivesForUnit,
} from "../domain/learning-objectives.js";
import { isIndependentProgressEntry } from "../domain/independent-learning.js";
import { latestLessonCompletion } from "../domain/progress-revisions.js";
import { hasFeedbackContent, normalizeFeedbackContent } from "../domain/feedback.js?v=20260827-profile-hotfix";
import { readingSoundForObjective } from "../domain/reading-sounds.js";
import { createReadingSoundChip } from "../ui/reading-map.js";

let context = null;
let currentEntry = null;
let elements = null;
let initialized = false;
let addedIndependentObjectives = [];
let activeFeedbackDraft = null;

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

function selectedUnit() {
  return context?.units.find(({ id }) => id === elements.unit.value) ?? null;
}

function selectedLesson() {
  return context?.lessons.find(({ id }) => id === elements.lesson.value) ?? null;
}

function lessonsForUnit(unitId) {
  return (context?.lessons ?? [])
    .filter((lesson) => lesson.unitId === unitId && lesson.status !== "archived")
    .sort((first, second) => (first.order ?? first.number ?? 0) - (second.order ?? second.number ?? 0));
}

function populateLessonOptions(preferredId = "") {
  const lessons = lessonsForUnit(elements.unit.value);
  elements.lesson.replaceChildren(...lessons.map((lesson) =>
    createOption(lesson.id, lessonName(lesson))));
  if (lessons.some(({ id }) => id === preferredId)) elements.lesson.value = preferredId;
  elements.lesson.disabled = lessons.length === 0;
}

function unitName(unit) {
  return unit?.number ? `Unit ${unit.number} · ${unit.title || "Untitled unit"}` : (unit?.title || "Unknown unit");
}

function lessonName(lesson) {
  if (!lesson) return "Lesson unavailable";
  return `Lesson ${lesson.number ?? lesson.order ?? "—"} · ${lesson.title || "Untitled lesson"}`;
}

function objectivesForEntry(entry, unit, lesson, includeRecorded = true) {
  const byId = new Map(
    (unit ? (lesson ? learningObjectivesForLesson(unit, lesson) : learningObjectivesForUnit(unit)) : [])
      .map((objective) => [objective.id, objective]),
  );
  addedIndependentObjectives.forEach((objective) => byId.set(objective.id, objective));
  (includeRecorded && Array.isArray(entry.changes) ? entry.changes : []).forEach((change) => {
    if (!byId.has(change.objectiveId)) {
      byId.set(change.objectiveId, {
        id: change.objectiveId,
        title: change.title || LANGUAGE_SKILL_LABELS[change.category] || "Archived learning target",
        category: change.category,
      });
    }
  });
  (includeRecorded && Array.isArray(entry.workedOnObjectives) ? entry.workedOnObjectives : []).forEach((workedOn) => {
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
  const soundChip = createReadingSoundChip(readingSoundForObjective(selectedUnit(), objective.id));
  if (soundChip) copy.append(soundChip);
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

function objectiveRowState() {
  return new Map([...elements.objectives.querySelectorAll("[data-progress-objective]")].map((row) => [
    row.dataset.progressObjective,
    {
      checked: row.querySelector("[data-progress-objective-enabled]").checked,
      status: row.querySelector("[data-progress-objective-status]").value,
    },
  ]));
}

function renderObjectives({ preserve = null } = {}) {
  if (!currentEntry) return;
  const independent = isIndependentProgressEntry(currentEntry);
  const unit = independent ? null : selectedUnit();
  const lesson = independent ? null : selectedLesson();
  const sameContext = independent || (
    unit?.id === currentEntry.unitId && lesson?.id === currentEntry.lessonId
  );
  const changes = new Map(
    (sameContext && Array.isArray(currentEntry.changes) ? currentEntry.changes : [])
      .map((change) => [change.objectiveId, change]),
  );
  const workedOnIds = new Set(
    (sameContext && Array.isArray(currentEntry.workedOnObjectives)
      ? currentEntry.workedOnObjectives
      : []).map((objective) => objective.objectiveId ?? objective.id),
  );
  elements.objectives.replaceChildren(
    ...objectivesForEntry(currentEntry, unit, lesson, sameContext).map((objective) =>
      createObjectiveRow(objective, changes.get(objective.id), workedOnIds)),
  );
  if (preserve) {
    preserve.forEach((state, objectiveId) => {
      const row = elements.objectives.querySelector(`[data-progress-objective="${objectiveId}"]`);
      if (!row) return;
      const checkbox = row.querySelector("[data-progress-objective-enabled]");
      const select = row.querySelector("[data-progress-objective-status]");
      checkbox.checked = state.checked;
      select.value = state.status;
      select.disabled = !state.checked;
    });
  }
  elements.objectiveAddToggle.disabled = !independent && (!unit || !lesson);
}

function syncLessonCompletion() {
  if (!currentEntry || isIndependentProgressEntry(currentEntry)) return;
  const unit = selectedUnit();
  const lesson = selectedLesson();
  if (!unit || !lesson) {
    elements.completeLesson.checked = false;
    elements.completeLesson.disabled = true;
    return;
  }
  const latest = latestLessonCompletion(
    context.progressHistory.filter(({ id }) => id !== currentEntry.id),
    context.student.id,
    unit.id,
    lesson.id,
  );
  const journeyCompleted = context.student.courseJourney?.unitId === unit.id
    && context.student.courseJourney.completedLessonIds?.includes(lesson.id);
  elements.completeLesson.checked = unit.id === currentEntry.unitId && lesson.id === currentEntry.lessonId
    ? currentEntry.completeLesson === true
    : latest ?? journeyCompleted ?? false;
  elements.completeLesson.disabled = false;
}

function feedbackContent() {
  return normalizeFeedbackContent({
    message: elements.feedbackMessage.value,
    whatWentWell: elements.feedbackWentWell.value,
    whatToPractise: elements.feedbackNextFocus.value,
    nextStep: activeFeedbackDraft?.content?.nextStep ?? "",
  });
}

function feedbackChanged(content) {
  if (!activeFeedbackDraft) return hasFeedbackContent(content);
  const previous = normalizeFeedbackContent(activeFeedbackDraft.content);
  return Object.keys(content).some((key) => content[key] !== previous[key]);
}

function renderLinkedFeedback() {
  activeFeedbackDraft = (context?.feedbackDrafts ?? []).find((draft) =>
    draft.progressHistoryId === currentEntry?.id) ?? null;
  const content = normalizeFeedbackContent(activeFeedbackDraft?.content);
  elements.feedbackMessage.value = content.message;
  elements.feedbackWentWell.value = content.whatWentWell;
  elements.feedbackNextFocus.value = content.whatToPractise;
  if (!activeFeedbackDraft) {
    elements.feedbackStatus.textContent = "Not added";
    elements.feedbackStatus.dataset.status = "empty";
    elements.feedbackPublish.textContent = "Publish feedback";
  } else if (activeFeedbackDraft.status === "published") {
    elements.feedbackStatus.textContent = `Published · v${activeFeedbackDraft.latestVersionNumber || 1}`;
    elements.feedbackStatus.dataset.status = "published";
    elements.feedbackPublish.textContent = "Update published feedback";
  } else {
    elements.feedbackStatus.textContent = "Draft · not visible yet";
    elements.feedbackStatus.dataset.status = "draft";
    elements.feedbackPublish.textContent = "Publish feedback";
  }
  elements.feedbackMessageState.textContent = "";
}

async function saveLinkedFeedback({ publish = false } = {}) {
  const content = feedbackContent();
  if (!hasFeedbackContent(content)) {
    if (publish) throw new Error("Add student feedback before publishing.");
    return;
  }
  if (!publish && !feedbackChanged(content)) return;

  const independent = isIndependentProgressEntry(currentEntry);
  const courseId = independent ? "" : selectedUnit()?.courseId ?? currentEntry.courseId;
  const unitId = independent ? "" : selectedUnit()?.id ?? currentEntry.unitId;
  const lessonId = independent ? "" : selectedLesson()?.id ?? currentEntry.lessonId;
  const learningTargetIds = collectObjectiveUpdate().workedOnObjectives
    .map(({ objectiveId }) => objectiveId);

  if (!activeFeedbackDraft) {
    const id = await feedbackDraftsRepository.createProgressDraft({
      studentId: context.student.id,
      courseId,
      unitId,
      lessonId,
      progressHistoryId: currentEntry.id,
      learningTargetIds,
      content,
    });
    activeFeedbackDraft = {
      id,
      studentId: context.student.id,
      progressHistoryId: currentEntry.id,
      content,
      status: "draft",
      latestVersionNumber: 0,
    };
    context.feedbackDrafts.push(activeFeedbackDraft);
  } else {
    if (activeFeedbackDraft.status === "published") {
      await feedbackDraftsRepository.prepareRepublish(activeFeedbackDraft.id);
      activeFeedbackDraft.status = "draft";
    }
    await feedbackDraftsRepository.saveProgressDraft(activeFeedbackDraft.id, {
      courseId,
      unitId,
      lessonId,
      learningTargetIds,
      content,
    });
    activeFeedbackDraft.content = content;
  }

  if (publish) {
    const result = await feedbackDraftsRepository.publish(activeFeedbackDraft.id, content);
    activeFeedbackDraft.status = "published";
    activeFeedbackDraft.latestVersionNumber = result.versionNumber;
    activeFeedbackDraft.content = content;
  }
}

function closeDialog() {
  if (typeof elements.dialog.close === "function") elements.dialog.close();
  else elements.dialog.removeAttribute("open");
  currentEntry = null;
  activeFeedbackDraft = null;
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
  addedIndependentObjectives = [];
  elements.context.textContent = independent
    ? "Independent learning — no course or lesson required"
    : `${unitName(unit)} › ${lessonName(lesson)}`;
  elements.date.value = dateInputValue(entry.lessonDate ?? entry.createdAt);
  elements.courseContext.hidden = independent;
  if (!independent) {
    elements.unit.replaceChildren(...context.units.map((candidate) =>
      createOption(candidate.id, unitName(candidate))));
    elements.unit.value = unit.id;
    populateLessonOptions(entry.lessonId);
  }
  elements.completeRow.hidden = independent;
  elements.completeLesson.checked = independent
    ? false
    : typeof entry.completeLesson === "boolean"
      ? entry.completeLesson
      : context.student.courseJourney?.unitId === unit.id
        && Array.isArray(context.student.courseJourney.completedLessonIds)
        && context.student.courseJourney.completedLessonIds.includes(entry.lessonId);
  elements.completeLesson.disabled = independent || !lesson || context.student.courseJourney?.unitId !== unit?.id;
  if (!independent) syncLessonCompletion();
  renderObjectives();
  elements.objectiveCreator.hidden = true;
  elements.objectiveTitle.value = "";
  elements.objectiveMessage.textContent = "";
  renderLinkedFeedback();
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

async function addInlineObjective() {
  if (!currentEntry || !context) return;
  const title = elements.objectiveTitle.value.trim();
  const category = elements.objectiveSkill.value;
  if (!title) {
    elements.objectiveMessage.textContent = "Enter an objective title.";
    return;
  }
  if (!LANGUAGE_SKILL_CATEGORIES.includes(category)) {
    elements.objectiveMessage.textContent = "Select a valid skill area.";
    return;
  }

  const previous = objectiveRowState();
  elements.objectiveAdd.disabled = true;
  elements.objectiveMessage.textContent = "Saving objective…";
  try {
    let objective;
    if (isIndependentProgressEntry(currentEntry)) {
      objective = {
        id: globalThis.crypto?.randomUUID?.() ?? `independent-${Date.now()}`,
        title,
        category,
        categories: [category],
      };
      addedIndependentObjectives.push(objective);
    } else {
      const result = await addObjectiveToLesson({
        unit: selectedUnit(),
        lesson: selectedLesson(),
        lessons: context.lessons,
        title,
        category,
      });
      objective = result.objective;
      context.units = context.units.map((unit) => unit.id === result.unit.id ? result.unit : unit);
      context.lessons = result.lessons;
    }
    renderObjectives({ preserve: previous });
    const row = elements.objectives.querySelector(`[data-progress-objective="${objective.id}"]`);
    if (row) {
      row.querySelector("[data-progress-objective-enabled]").checked = true;
      row.querySelector("[data-progress-objective-status]").disabled = false;
    }
    elements.objectiveTitle.value = "";
    elements.objectiveCreator.hidden = true;
    elements.objectiveMessage.textContent = "";
  } catch (error) {
    elements.objectiveMessage.textContent = error instanceof Error ? error.message : "Unable to add the objective.";
  } finally {
    elements.objectiveAdd.disabled = false;
  }
}

async function submitRevision(event) {
  event.preventDefault();
  if (!currentEntry || !context) return;
  const publishFeedback = event.submitter === elements.feedbackPublish;
  const independent = isIndependentProgressEntry(currentEntry);
  const unit = independent ? null : selectedUnit();
  const lesson = independent ? null : selectedLesson();
  if (!independent && (!unit || !lesson)) {
    elements.message.textContent = "Select a valid unit and lesson.";
    return;
  }
  const lessonDate = dateFromInput(elements.date.value);
  if (!lessonDate) {
    elements.message.textContent = "Select a valid lesson date.";
    return;
  }
  elements.save.disabled = true;
  elements.remove.disabled = true;
  elements.feedbackPublish.disabled = true;
  elements.message.textContent = "Saving changes…";
  try {
    const objectiveUpdate = collectObjectiveUpdate();
    await reviseLearningUpdate({
      entry: currentEntry,
      history: context.progressHistory,
      student: context.student,
      unit,
      lessons: context.lessons,
      lessonId: lesson?.id ?? "",
      objectiveChanges: objectiveUpdate.objectiveChanges,
      workedOnObjectives: objectiveUpdate.workedOnObjectives,
      lessonDate,
      completeLesson: elements.completeLesson.checked,
    });
    await saveLinkedFeedback({ publish: publishFeedback });
    closeDialog();
    await context.onSaved(publishFeedback
      ? "Progress updated and the new feedback version was published to the student."
      : "The progress update was edited and current progress was recalculated.");
  } catch (error) {
    console.error("Unable to revise the progress update.", error);
    elements.message.textContent = error instanceof Error && error.message
      ? `Unable to save the changes: ${error.message}`
      : "Unable to save the changes. Please try again.";
  } finally {
    elements.save.disabled = false;
    elements.remove.disabled = false;
    elements.feedbackPublish.disabled = false;
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
  elements.feedbackPublish.disabled = true;
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
    elements.feedbackPublish.disabled = false;
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
    courseContext: dialog.querySelector("[data-progress-update-course-context]"),
    unit: dialog.querySelector("[data-progress-update-unit]"),
    lesson: dialog.querySelector("[data-progress-update-lesson]"),
    date: form.elements.progressUpdateDate,
    completeLesson: dialog.querySelector("[data-progress-update-complete]"),
    completeRow: dialog.querySelector("[data-progress-update-complete-row]"),
    objectives: dialog.querySelector("[data-progress-update-objectives]"),
    objectiveAddToggle: dialog.querySelector("[data-progress-objective-add-toggle]"),
    objectiveCreator: dialog.querySelector("[data-progress-objective-creator]"),
    objectiveTitle: dialog.querySelector("[data-progress-objective-title]"),
    objectiveSkill: dialog.querySelector("[data-progress-objective-skill]"),
    objectiveAdd: dialog.querySelector("[data-progress-objective-add]"),
    objectiveAddCancel: dialog.querySelector("[data-progress-objective-add-cancel]"),
    objectiveMessage: dialog.querySelector("[data-progress-objective-message]"),
    feedbackStatus: dialog.querySelector("[data-progress-feedback-status]"),
    feedbackWentWell: form.elements.progressFeedbackWentWell,
    feedbackNextFocus: form.elements.progressFeedbackNextFocus,
    feedbackMessage: form.elements.progressFeedbackMessage,
    feedbackPublish: dialog.querySelector("[data-progress-feedback-publish]"),
    feedbackMessageState: dialog.querySelector("[data-progress-feedback-message]"),
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
  elements.unit.addEventListener("change", () => {
    populateLessonOptions();
    renderObjectives();
    syncLessonCompletion();
  });
  elements.lesson.addEventListener("change", () => {
    renderObjectives();
    syncLessonCompletion();
  });
  elements.objectiveAddToggle.addEventListener("click", () => {
    elements.objectiveCreator.hidden = false;
    elements.objectiveTitle.focus();
  });
  elements.objectiveAddCancel.addEventListener("click", () => {
    elements.objectiveCreator.hidden = true;
    elements.objectiveTitle.value = "";
    elements.objectiveMessage.textContent = "";
  });
  elements.objectiveAdd.addEventListener("click", addInlineObjective);
  form.addEventListener("submit", submitRevision);
  elements.remove.addEventListener("click", removeUpdate);
  elements.close.addEventListener("click", closeDialog);
  return true;
}

export function configureProgressUpdateEditor(nextContext) {
  if (!initialized) initialized = initialize();
  if (initialized) context = nextContext;
}
