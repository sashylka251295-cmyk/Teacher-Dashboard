import { goalsRepository } from "../data/repositories/goals-repository.js";
import { feedbackVersionsRepository } from "../data/repositories/feedback-versions-repository.js";
import { addObjectiveToLesson } from "../data/repositories/lesson-objectives-repository.js";
import { saveLearningUpdate } from "../data/repositories/learning-updates-repository.js";
import { teacherNotesRepository } from "../data/repositories/teacher-notes-repository.js";
import {
  ACTIVE_GOAL_STATUSES,
  HOMEWORK_STATUSES,
  HOMEWORK_STATUS_LABELS,
  LANGUAGE_SKILL_CATEGORIES,
  LANGUAGE_SKILL_LABELS,
  OBJECTIVE_STATUSES,
  OBJECTIVE_STATUS_LABELS,
} from "../domain/constants.js";
import {
  isObjectiveStatus,
  learningObjectivesForLesson,
  progressByObjective,
} from "../domain/learning-objectives.js";
import {
  createJourneySnapshot,
  currentPhysicalUnit,
} from "../domain/physical-progress.js";
import { INDEPENDENT_PROGRESS_SCOPE } from "../domain/independent-learning.js";
import { buildObservationTargetFields } from "../domain/observation-links.js";
import { isGoalStatus, isNonEmptyText } from "../domain/validation.js";

let context = null;
let elements = null;
let initialized = false;
let independentObjectives = [];

function isIndependentMode() {
  return elements?.mode?.value === INDEPENDENT_PROGRESS_SCOPE;
}

function unitName(unit) {
  if (typeof unit?.title === "string" && unit.title.trim()) return unit.title;
  return unit?.number ? `Unit ${unit.number}` : "Unknown unit";
}

function currentUnit() {
  return context?.units.find((unit) => unit.id === elements.unit.value) ?? null;
}

function currentLesson() {
  return context?.lessons?.find((lesson) => lesson.id === elements.lesson.value) ?? null;
}

function currentLessonObjectives() {
  if (isIndependentMode()) return independentObjectives;
  const lesson = currentLesson();
  return lesson ? learningObjectivesForLesson(currentUnit(), lesson) : [];
}

function currentGoal() {
  return context?.goals.find((goal) => ACTIVE_GOAL_STATUSES.includes(goal.status)) ?? null;
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function setMessage(message) {
  elements.message.textContent = message;
}

function todayInputValue() {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
}

function dateFromInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return year && month && day && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

function populateUnits() {
  elements.unit.replaceChildren();
  if (context.units.length === 0) {
    elements.unit.append(createOption("", "No units available"));
    elements.unit.disabled = true;
    return;
  }
  elements.unit.disabled = false;
  context.units.forEach((unit) => elements.unit.append(createOption(unit.id, unitName(unit))));
  const journeyUnit = currentPhysicalUnit(context.units, context.student.courseJourney);
  if (journeyUnit) elements.unit.value = journeyUnit.id;
}

function populateLessons() {
  const lessons = (context.lessons ?? []).filter((lesson) => lesson.unitId === elements.unit.value);
  elements.lesson.replaceChildren(...lessons.map((lesson) =>
    createOption(lesson.id, `Lesson ${lesson.number ?? lesson.order ?? "—"} · ${lesson.title}`)));
  elements.lesson.disabled = lessons.length === 0;
  if (context.student.courseJourney?.unitId === elements.unit.value) {
    const currentId = context.student.courseJourney.currentLessonId;
    if (lessons.some(({ id }) => id === currentId)) elements.lesson.value = currentId;
  }
}

function createObjectiveRow(objective, progressMap) {
  const row = document.createElement("label");
  const checkbox = document.createElement("input");
  const title = document.createElement("span");
  const current = document.createElement("small");
  const select = document.createElement("select");
  const currentStatus = progressMap.get(objective.id)?.status ?? "not_assessed";
  row.className = "quick-objective-row";
  checkbox.type = "checkbox";
  checkbox.checked = false;
  checkbox.dataset.assessObjective = objective.id;
  title.textContent = objective.title;
  current.textContent = `Current: ${OBJECTIVE_STATUS_LABELS[currentStatus] ?? "Not assessed"}`;
  select.append(createOption("", "Set status (optional)"));
  OBJECTIVE_STATUSES.forEach((status) => select.append(createOption(status, OBJECTIVE_STATUS_LABELS[status])));
  select.value = "";
  select.disabled = true;
  select.dataset.objectiveStatus = objective.id;
  row.append(checkbox, title, current, select);
  return row;
}

function objectiveRowState() {
  return new Map([...elements.objectives.querySelectorAll("[data-assess-objective]")].map((checkbox) => {
    const select = checkbox.closest(".quick-objective-row").querySelector("[data-objective-status]");
    return [checkbox.dataset.assessObjective, { checked: checkbox.checked, status: select.value }];
  }));
}

function restoreObjectiveRowState(state) {
  state.forEach(({ checked, status }, objectiveId) => {
    const checkbox = elements.objectives.querySelector(`[data-assess-objective="${objectiveId}"]`);
    if (!checkbox) return;
    const select = checkbox.closest(".quick-objective-row").querySelector("[data-objective-status]");
    checkbox.checked = checked;
    select.disabled = !checked;
    select.value = status;
  });
}

function renderObjectives() {
  const objectives = currentLessonObjectives();
  const progressMap = progressByObjective(context.objectiveProgress);
  elements.objectives.replaceChildren();
  LANGUAGE_SKILL_CATEGORIES.forEach((category) => {
    const categoryObjectives = objectives.filter((objective) => objective.category === category);
    if (categoryObjectives.length === 0) return;
    const group = document.createElement("section");
    const heading = document.createElement("h4");
    heading.textContent = LANGUAGE_SKILL_LABELS[category];
    group.append(heading, ...categoryObjectives.map((objective) => createObjectiveRow(objective, progressMap)));
    elements.objectives.append(group);
  });
  elements.objectivesEmpty.hidden = objectives.length > 0;
}

function createHomeworkRow(homework) {
  const row = document.createElement("label");
  const checkbox = document.createElement("input");
  const title = document.createElement("span");
  const select = document.createElement("select");
  row.className = "quick-homework-row";
  checkbox.type = "checkbox";
  checkbox.dataset.updateHomework = homework.id;
  title.textContent = homework.title || "Homework";
  HOMEWORK_STATUSES.forEach((status) => select.append(createOption(status, HOMEWORK_STATUS_LABELS[status])));
  select.value = homework.status;
  select.disabled = true;
  select.dataset.homeworkStatus = homework.id;
  row.append(checkbox, title, select);
  return row;
}

function renderHomework() {
  const assignments = context.homeworkAssignments.filter((item) => isIndependentMode()
    ? item.scope === INDEPENDENT_PROGRESS_SCOPE || !item.unitId
    : item.unitId === elements.unit.value);
  elements.existingHomework.replaceChildren();
  if (assignments.length > 0) {
    const heading = document.createElement("h4");
    heading.textContent = "Existing homework";
    elements.existingHomework.append(heading, ...assignments.map(createHomeworkRow));
  }
  elements.homeworkAssigned.value = "no";
  elements.newHomework.hidden = true;
  elements.homeworkTitle.value = "";
  elements.homeworkStatus.value = "assigned";
}

function selectedObservationTargetIds() {
  return new Set([...elements.observationTargets.querySelectorAll("[data-observation-target]:checked")]
    .map((checkbox) => checkbox.dataset.observationTarget));
}

function renderObservationTargets(selectedIds = new Set()) {
  const objectives = currentLessonObjectives();
  elements.observationTargets.replaceChildren();
  LANGUAGE_SKILL_CATEGORIES.forEach((category) => {
    const categoryObjectives = objectives.filter((objective) => objective.category === category);
    if (!categoryObjectives.length) return;
    const group = document.createElement("section");
    const heading = document.createElement("h4");
    heading.textContent = LANGUAGE_SKILL_LABELS[category];
    group.append(heading, ...categoryObjectives.map((objective) => {
      const label = document.createElement("label");
      const checkbox = document.createElement("input");
      const title = document.createElement("span");
      checkbox.type = "checkbox";
      checkbox.dataset.observationTarget = objective.id;
      checkbox.checked = selectedIds.has(objective.id);
      title.textContent = objective.title;
      label.append(checkbox, title);
      return label;
    }));
    elements.observationTargets.append(group);
  });
  elements.observationTargetsEmpty.hidden = objectives.length > 0;
}

function renderUnitFields() {
  if (isIndependentMode()) {
    elements.lesson.replaceChildren(createOption("", "Not needed for an independent update"));
    elements.lesson.disabled = true;
    elements.completeLesson.checked = false;
    elements.completeLesson.disabled = true;
  } else {
    populateLessons();
    elements.completeLesson.disabled = false;
  }
  renderObjectives();
  elements.objectivesEmpty.textContent = isIndependentMode()
    ? "Add one or more learning objectives for this lesson."
    : "This lesson has no learning objectives yet.";
  renderHomework();
  renderObservationTargets();
}

function renderUpdateMode() {
  const independent = isIndependentMode();
  elements.courseContext.forEach((element) => { element.hidden = independent; });
  elements.unit.required = !independent;
  elements.lesson.required = !independent;
  elements.unit.disabled = independent || context.units.length === 0;
  renderUnitFields();
}

function populateGoalEditor() {
  const goal = currentGoal();
  elements.currentGoal.textContent = goal ? `${goal.title} (${goal.status})` : "No active goal.";
  elements.goalUpdateOption.disabled = !goal;
  elements.goalAction.value = "unchanged";
  updateGoalFields();
}

function updateGoalFields() {
  const action = elements.goalAction.value;
  const goal = currentGoal();
  const editable = action !== "unchanged";
  elements.goalTitle.disabled = !editable;
  elements.goalStatus.disabled = !editable;
  if (action === "update" && goal) {
    elements.goalTitle.value = goal.title ?? "";
    elements.goalStatus.value = goal.status;
  } else if (action === "create") {
    elements.goalTitle.value = "";
    elements.goalStatus.value = "new";
  } else {
    elements.goalTitle.value = goal?.title ?? "";
    elements.goalStatus.value = goal?.status ?? "new";
  }
}

function openDialog() {
  if (!context) return;
  elements.studentName.textContent = context.student.name ?? "—";
  elements.lessonDate.value = todayInputValue();
  elements.observation.value = "";
  elements.observationContext.value = "";
  elements.includeInFeedback.checked = false;
  elements.feedbackVisibility.value = "private";
  elements.includeFeedbackRow.hidden = false;
  elements.objectiveCreator.hidden = true;
  elements.objectiveTitle.value = "";
  elements.objectiveMessage.textContent = "";
  independentObjectives = [];
  setMessage("");
  populateUnits();
  const courseModeAvailable = Boolean(context.student.courseId) && context.units.length > 0;
  elements.mode.querySelector('option[value="course"]').disabled = !courseModeAvailable;
  elements.mode.value = courseModeAvailable ? "course" : INDEPENDENT_PROGRESS_SCOPE;
  renderUpdateMode();
  populateGoalEditor();
  if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
  else elements.dialog.setAttribute("open", "");
}

function closeDialog() {
  if (typeof elements.dialog.close === "function") elements.dialog.close();
  else elements.dialog.removeAttribute("open");
}

function collectObjectiveUpdate() {
  const objectives = new Map(currentLessonObjectives().map((item) => [item.id, item]));
  const progressMap = progressByObjective(context.objectiveProgress);
  const workedOnObjectives = [...elements.objectives.querySelectorAll("[data-assess-objective]:checked")].map((checkbox) => {
    const objective = objectives.get(checkbox.dataset.assessObjective);
    const select = checkbox.closest(".quick-objective-row").querySelector("[data-objective-status]");
    if (!objective) throw new Error("Select a valid learning objective.");
    if (select.value && !isObjectiveStatus(select.value)) throw new Error("Select a valid objective status.");
    return {
      ...objective,
      selectedStatus: select.value,
    };
  });
  const objectiveChanges = workedOnObjectives.filter(({ selectedStatus }) => selectedStatus).map((objective) => ({
    objectiveId: objective.id,
    title: objective.title,
    category: objective.category,
    previousStatus: progressMap.get(objective.id)?.status ?? "not_assessed",
    status: objective.selectedStatus,
  })).filter(({ previousStatus, status }) => previousStatus !== status);
  return { workedOnObjectives, objectiveChanges };
}

function collectHomework() {
  const create = elements.homeworkAssigned.value === "yes" ? {
    title: elements.homeworkTitle.value.trim() || "Homework",
    status: elements.homeworkStatus.value,
  } : null;
  if (create && !HOMEWORK_STATUSES.includes(create.status)) throw new Error("Select a valid homework status.");
  const currentAssignments = new Map(context.homeworkAssignments.map((assignment) => [assignment.id, assignment]));
  const changes = [...elements.existingHomework.querySelectorAll("[data-update-homework]:checked")].map((checkbox) => ({
    id: checkbox.dataset.updateHomework,
    status: checkbox.closest(".quick-homework-row").querySelector("[data-homework-status]").value,
  })).filter((change) => currentAssignments.get(change.id)?.status !== change.status);
  if (changes.some((change) => !HOMEWORK_STATUSES.includes(change.status))) throw new Error("Select a valid homework status.");
  return { create, changes };
}

function collectGoalOperation() {
  const action = elements.goalAction.value;
  if (action === "unchanged") return null;
  const title = elements.goalTitle.value.trim();
  const status = elements.goalStatus.value;
  if (!isNonEmptyText(title)) throw new Error("Enter a goal title.");
  if (!isGoalStatus(status)) throw new Error("Select a valid goal status.");
  if (action === "update") {
    const goal = currentGoal();
    if (!goal) throw new Error("There is no active goal to update.");
    if (goal.title === title && goal.status === status) return null;
    return { type: "update", goal, title, status };
  }
  return { type: "create", title, status };
}

function collectObservation(objectiveChanges) {
  const text = elements.observation.value.trim();
  if (!text) return null;
  const targetIds = selectedObservationTargetIds();
  const targets = currentLessonObjectives().filter((objective) => targetIds.has(objective.id));
  if (!targets.length) throw new Error("Select at least one learning target connected to this feedback.");
  const progressMap = progressByObjective(context.objectiveProgress);
  const targetFields = buildObservationTargetFields(targets, (target) => {
    const changedStatus = objectiveChanges.find((change) => change.objectiveId === target.id)?.status;
    return changedStatus ?? progressMap.get(target.id)?.status ?? "not_assessed";
  });
  return {
    text,
    ...targetFields,
    lessonContext: elements.observationContext.value.trim(),
    includeInFeedback: elements.includeInFeedback.checked,
  };
}

async function addInlineObjective() {
  if (isIndependentMode()) {
    const previousRows = objectiveRowState();
    const previousObservationTargets = selectedObservationTargetIds();
    const title = elements.objectiveTitle.value.trim();
    const category = elements.objectiveSkill.value;
    if (!isNonEmptyText(title)) {
      elements.objectiveMessage.textContent = "Enter an objective title.";
      return;
    }
    if (!LANGUAGE_SKILL_CATEGORIES.includes(category)) {
      elements.objectiveMessage.textContent = "Select a valid skill area.";
      return;
    }
    const objective = {
      id: globalThis.crypto?.randomUUID?.() ?? `independent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      category,
      categories: [category],
    };
    independentObjectives.push(objective);
    elements.objectiveTitle.value = "";
    elements.objectiveCreator.hidden = true;
    renderObjectives();
    restoreObjectiveRowState(previousRows);
    renderObservationTargets(previousObservationTargets);
    const checkbox = elements.objectives.querySelector(`[data-assess-objective="${objective.id}"]`);
    if (checkbox) {
      checkbox.checked = true;
      checkbox.closest(".quick-objective-row").querySelector("select").disabled = false;
    }
    elements.objectiveMessage.textContent = "";
    return;
  }
  const unit = currentUnit();
  const lesson = currentLesson();
  const previousRows = objectiveRowState();
  const previousObservationTargets = selectedObservationTargetIds();
  elements.objectiveAdd.disabled = true;
  elements.objectiveMessage.textContent = "Saving objective…";
  try {
    const result = await addObjectiveToLesson({
      unit,
      lesson,
      lessons: context.lessons,
      title: elements.objectiveTitle.value,
      category: elements.objectiveSkill.value,
    });
    context.units = context.units.map((item) => item.id === result.unit.id ? result.unit : item);
    context.lessons = result.lessons;
    elements.objectiveTitle.value = "";
    elements.objectiveCreator.hidden = true;
    renderObjectives();
    restoreObjectiveRowState(previousRows);
    renderObservationTargets(previousObservationTargets);
    const checkbox = elements.objectives.querySelector(`[data-assess-objective="${result.objective.id}"]`);
    if (checkbox) {
      checkbox.checked = true;
      checkbox.closest(".quick-objective-row").querySelector("select").disabled = false;
    }
    elements.objectiveMessage.textContent = "";
  } catch (error) {
    elements.objectiveMessage.textContent = error.message;
  } finally {
    elements.objectiveAdd.disabled = false;
  }
}

async function saveGoal(operation) {
  if (!operation) return;
  if (operation.type === "update") {
    await goalsRepository.update(operation.goal.id, { title: operation.title, status: operation.status });
  } else {
    await goalsRepository.create({ studentId: context.student.id, title: operation.title, status: operation.status, studentVisible: true });
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  const independent = isIndependentMode();
  const unit = currentUnit();
  const lesson = currentLesson();
  const lessonDate = dateFromInput(elements.lessonDate.value);
  if (!independent && !unit) return setMessage("Select a unit before saving.");
  if (!independent && !lesson) return setMessage("Select a lesson before saving.");
  if (!lessonDate) return setMessage("Select a valid lesson date.");
  let objectiveChanges;
  let workedOnObjectives;
  let homework;
  let goalOperation;
  let observation;
  try {
    ({ objectiveChanges, workedOnObjectives } = collectObjectiveUpdate());
    homework = collectHomework();
    goalOperation = collectGoalOperation();
    observation = collectObservation(objectiveChanges);
  } catch (error) {
    return setMessage(error.message);
  }
  if (
    independent
    && workedOnObjectives.length === 0
    && !homework.create
    && homework.changes.length === 0
    && !goalOperation
    && !observation
  ) {
    return setMessage("Add and select at least one learning objective before saving.");
  }
  const physicalJourney = independent ? null : createJourneySnapshot({
    courseId: context.student.courseId,
    unit,
    lessons: context.lessons,
    previousJourney: context.student.courseJourney,
    selectedLessonId: lesson.id,
    completeLesson: elements.completeLesson.checked,
  });

  elements.saveButton.disabled = true;
  setMessage("Saving update…");
  try {
    await saveLearningUpdate({
      studentId: context.student.id,
      courseId: independent ? "" : context.student.courseId,
      unitId: independent ? "" : unit.id,
      groupId: context.group?.id ?? "",
      lessonId: independent ? "" : lesson.id,
      scope: independent ? INDEPENDENT_PROGRESS_SCOPE : "course",
      objectiveChanges,
      homeworkToCreate: homework.create,
      homeworkChanges: homework.changes,
      lessonDate,
      observation: observation?.text ?? "",
      physicalJourney,
      physicalChange: independent ? null : {
        completeLesson: elements.completeLesson.checked,
        previousLessonCompleted: context.student.courseJourney?.unitId === unit.id
          && Array.isArray(context.student.courseJourney.completedLessonIds)
          && context.student.courseJourney.completedLessonIds.includes(lesson.id),
      },
      workedOnObjectives,
    });
    await saveGoal(goalOperation);
    if (observation && elements.feedbackVisibility.value === "private") {
      await teacherNotesRepository.createWithDate({
        studentId: context.student.id,
        groupId: context.group?.id ?? "",
        courseId: independent ? "" : context.student.courseId,
        unitId: independent ? "" : unit.id,
        lessonId: independent ? "" : lesson.id,
        scope: independent ? INDEPENDENT_PROGRESS_SCOPE : "course",
        skillCategory: observation.skillCategory,
        learningTargetId: observation.learningTargetId,
        learningTargetTitle: observation.learningTargetTitle,
        targetStatus: observation.targetStatus,
        learningTargetIds: observation.learningTargetIds,
        learningTargetTitles: observation.learningTargetTitles,
        skillCategories: observation.skillCategories,
        targetStatuses: observation.targetStatuses,
        lessonContext: observation.lessonContext,
        includeInFeedback: observation.includeInFeedback,
        text: observation.text,
      }, lessonDate);
    }
    if (observation && elements.feedbackVisibility.value === "published") {
      await feedbackVersionsRepository.publishQuick({
        studentId: context.student.id,
        courseId: independent ? "" : context.student.courseId,
        unitId: independent ? "" : unit.id,
        lessonId: independent ? "" : lesson.id,
        learningTargetIds: observation.learningTargetIds,
        text: observation.text,
      });
    }
    closeDialog();
    await context.onSaved(`${context.student.name}'s learning update was saved.`);
  } catch (error) {
    console.error("Unable to save the quick update.", error);
    setMessage("Unable to save the update. Please try again.");
  } finally {
    elements.saveButton.disabled = false;
  }
}

function initialize() {
  const dialog = document.querySelector("[data-quick-update-dialog]");
  const form = document.querySelector("[data-quick-update-form]");
  const openButton = document.querySelector("[data-quick-update-open]");
  if (!dialog || !form || !openButton) return false;
  elements = {
    dialog,
    form,
    openButton,
    closeButton: dialog.querySelector("[data-quick-update-close]"),
    saveButton: dialog.querySelector("[data-quick-update-save]"),
    message: dialog.querySelector("[data-quick-update-message]"),
    studentName: dialog.querySelector("[data-quick-student-name]"),
    lessonDate: form.elements.lessonDate,
    mode: dialog.querySelector("[data-quick-update-mode]"),
    courseContext: [...dialog.querySelectorAll("[data-quick-course-context]")],
    unit: dialog.querySelector("[data-quick-unit]"),
    lesson: dialog.querySelector("[data-quick-lesson]"),
    completeLesson: dialog.querySelector("[data-quick-complete-lesson]"),
    objectives: dialog.querySelector("[data-quick-objectives]"),
    objectivesEmpty: dialog.querySelector("[data-quick-objectives-empty]"),
    objectiveAddToggle: dialog.querySelector("[data-quick-objective-add-toggle]"),
    objectiveCreator: dialog.querySelector("[data-quick-objective-creator]"),
    objectiveTitle: dialog.querySelector("[data-quick-objective-title]"),
    objectiveSkill: dialog.querySelector("[data-quick-objective-skill]"),
    objectiveAdd: dialog.querySelector("[data-quick-objective-add]"),
    objectiveAddCancel: dialog.querySelector("[data-quick-objective-add-cancel]"),
    objectiveMessage: dialog.querySelector("[data-quick-objective-message]"),
    homeworkAssigned: dialog.querySelector("[data-quick-homework-assigned]"),
    newHomework: dialog.querySelector("[data-quick-new-homework]"),
    homeworkTitle: form.elements.homeworkTitle,
    homeworkStatus: form.elements.homeworkStatus,
    existingHomework: dialog.querySelector("[data-quick-existing-homework]"),
    observationTargets: dialog.querySelector("[data-quick-observation-targets]"),
    observationTargetsEmpty: dialog.querySelector("[data-quick-observation-targets-empty]"),
    observation: form.elements.observation,
    observationContext: form.elements.observationContext,
    includeInFeedback: form.elements.includeInFeedback,
    feedbackVisibility: dialog.querySelector("[data-quick-feedback-visibility]"),
    includeFeedbackRow: dialog.querySelector("[data-quick-include-feedback-row]"),
    currentGoal: dialog.querySelector("[data-quick-current-goal]"),
    goalAction: dialog.querySelector("[data-quick-goal-action]"),
    goalUpdateOption: dialog.querySelector("[data-goal-update-option]"),
    goalTitle: dialog.querySelector("[data-quick-goal-title]"),
    goalStatus: dialog.querySelector("[data-quick-goal-status]"),
  };
  if (Object.values(elements).some((element) => !element)) return false;
  openButton.addEventListener("click", openDialog);
  elements.closeButton.addEventListener("click", closeDialog);
  elements.unit.addEventListener("change", renderUnitFields);
  elements.mode.addEventListener("change", renderUpdateMode);
  elements.lesson.addEventListener("change", () => {
    renderObjectives();
    renderObservationTargets();
  });
  elements.goalAction.addEventListener("change", updateGoalFields);
  elements.homeworkAssigned.addEventListener("change", () => {
    elements.newHomework.hidden = elements.homeworkAssigned.value !== "yes";
  });
  elements.objectiveAddToggle.addEventListener("click", () => {
    elements.objectiveCreator.hidden = false;
    elements.objectiveTitle.focus();
  });
  elements.objectiveAddCancel.addEventListener("click", () => {
    elements.objectiveCreator.hidden = true;
    elements.objectiveMessage.textContent = "";
  });
  elements.objectiveAdd.addEventListener("click", addInlineObjective);
  elements.feedbackVisibility.addEventListener("change", () => {
    const published = elements.feedbackVisibility.value === "published";
    elements.includeFeedbackRow.hidden = published;
    elements.includeInFeedback.checked = false;
  });
  dialog.addEventListener("change", (event) => {
    if (event.target.matches("[data-assess-objective]")) {
      event.target.closest(".quick-objective-row").querySelector("select").disabled = !event.target.checked;
      if (event.target.checked && selectedObservationTargetIds().size === 0) {
        const relatedTarget = elements.observationTargets.querySelector(
          `[data-observation-target="${event.target.dataset.assessObjective}"]`,
        );
        if (relatedTarget) relatedTarget.checked = true;
      }
    }
    if (event.target.matches("[data-update-homework]")) event.target.closest(".quick-homework-row").querySelector("select").disabled = !event.target.checked;
  });
  form.addEventListener("submit", handleSubmit);
  return true;
}

export function configureQuickUpdate(nextContext) {
  if (!initialized) initialized = initialize();
  if (initialized) context = nextContext;
}
