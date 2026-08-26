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
import { isGoalStatus, isNonEmptyText } from "../domain/validation.js";

let context = null;
let elements = null;
let initialized = false;

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
  const assignments = context.homeworkAssignments.filter((item) => item.unitId === elements.unit.value);
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

function renderObservationTargets() {
  const objectives = currentLessonObjectives();
  elements.observationTarget.replaceChildren(createOption("", "Select a learning target"));
  LANGUAGE_SKILL_CATEGORIES.forEach((category) => {
    const categoryObjectives = objectives.filter((objective) => objective.category === category);
    if (!categoryObjectives.length) return;
    const group = document.createElement("optgroup");
    group.label = LANGUAGE_SKILL_LABELS[category];
    categoryObjectives.forEach((objective) => group.append(createOption(objective.id, objective.title)));
    elements.observationTarget.append(group);
  });
  elements.observationTarget.disabled = objectives.length === 0;
}

function renderUnitFields() {
  populateLessons();
  renderObjectives();
  renderHomework();
  renderObservationTargets();
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
  setMessage("");
  populateUnits();
  renderUnitFields();
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
  const targetId = elements.observationTarget.value;
  const target = currentLessonObjectives()
    .find((objective) => objective.id === targetId);
  if (!target) throw new Error("Select the learning target connected to this feedback.");
  const changedStatus = objectiveChanges.find((change) => change.objectiveId === target.id)?.status;
  const currentStatus = progressByObjective(context.objectiveProgress).get(target.id)?.status;
  return {
    text,
    learningTargetId: target.id,
    learningTargetTitle: target.title,
    skillCategory: target.category,
    targetStatus: changedStatus ?? currentStatus ?? "not_assessed",
    lessonContext: elements.observationContext.value.trim(),
    includeInFeedback: elements.includeInFeedback.checked,
  };
}

async function addInlineObjective() {
  const unit = currentUnit();
  const lesson = currentLesson();
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
    renderObservationTargets();
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
  const unit = currentUnit();
  const lesson = currentLesson();
  const lessonDate = dateFromInput(elements.lessonDate.value);
  if (!unit) return setMessage("Select a unit before saving.");
  if (!lesson) return setMessage("Select a lesson before saving.");
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
  const physicalJourney = createJourneySnapshot({
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
      courseId: context.student.courseId,
      unitId: unit.id,
      groupId: context.group?.id ?? "",
      lessonId: lesson.id,
      objectiveChanges,
      homeworkToCreate: homework.create,
      homeworkChanges: homework.changes,
      lessonDate,
      observation: observation?.text ?? "",
      physicalJourney,
      physicalChange: {
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
        courseId: context.student.courseId,
        unitId: unit.id,
        lessonId: lesson.id,
        skillCategory: observation.skillCategory,
        learningTargetId: observation.learningTargetId,
        learningTargetTitle: observation.learningTargetTitle,
        targetStatus: observation.targetStatus,
        lessonContext: observation.lessonContext,
        includeInFeedback: observation.includeInFeedback,
        text: observation.text,
      }, lessonDate);
    }
    if (observation && elements.feedbackVisibility.value === "published") {
      await feedbackVersionsRepository.publishQuick({
        studentId: context.student.id,
        courseId: context.student.courseId,
        unitId: unit.id,
        lessonId: lesson.id,
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
    observationTarget: dialog.querySelector("[data-quick-observation-target]"),
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
      if (event.target.checked && !elements.observationTarget.value) {
        elements.observationTarget.value = event.target.dataset.assessObjective;
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
