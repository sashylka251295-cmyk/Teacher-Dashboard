import { goalsRepository } from "../data/repositories/goals-repository.js";
import { progressRepository } from "../data/repositories/progress-repository.js";
import { teacherNotesRepository } from "../data/repositories/teacher-notes-repository.js";
import {
  ACTIVE_GOAL_STATUSES,
  PROGRESS_SKILLS,
} from "../domain/constants.js";
import { calculateUnitProgress } from "../domain/progress.js";
import {
  closestProficiencyLevel,
  PROFICIENCY_LEVELS,
  proficiencyValue,
} from "../domain/proficiency.js";
import { isGoalStatus, isNonEmptyText } from "../domain/validation.js";

let context = null;
let elements = null;
let initialized = false;
const dirtySkills = new Set();

function unitName(unit) {
  if (typeof unit?.title === "string" && unit.title.trim()) return unit.title;
  if (unit?.number !== null && unit?.number !== undefined) return `Unit ${unit.number}`;
  return "Unknown unit";
}

function currentGoal() {
  return context?.goals.find((goal) => ACTIVE_GOAL_STATUSES.includes(goal.status)) ?? null;
}

function currentProgress() {
  const unitId = elements.unit.value;
  return context?.progress.find((progress) => progress.unitId === unitId) ?? null;
}

function setMessage(message) {
  elements.message.textContent = message;
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function populateProficiencyOptions() {
  for (const select of elements.skills.values()) {
    select.replaceChildren(createOption("", "Not updated"));
    for (const level of PROFICIENCY_LEVELS) {
      select.append(createOption(level.key, level.label));
    }
  }
}

function populateUnits() {
  elements.unit.replaceChildren();

  if (context.units.length === 0) {
    elements.unit.append(createOption("", "No units available"));
    elements.unit.disabled = true;
    return;
  }

  elements.unit.disabled = false;
  for (const unit of context.units) {
    elements.unit.append(createOption(unit.id, unitName(unit)));
  }
}

function populateSkillValues() {
  const progress = currentProgress();
  dirtySkills.clear();

  for (const [skill, select] of elements.skills) {
    const level = closestProficiencyLevel(progress?.[skill]);
    select.value = level?.key ?? "";
  }
}

function todayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    !year ||
    !month ||
    !day ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function populateGoalEditor() {
  const goal = currentGoal();
  elements.currentGoal.textContent = goal
    ? `${goal.title} (${goal.status})`
    : "No active goal.";
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
  elements.observationCategory.value = "general";
  setMessage("");
  populateUnits();
  populateSkillValues();
  populateGoalEditor();

  if (typeof elements.dialog.showModal === "function") {
    elements.dialog.showModal();
  } else {
    elements.dialog.setAttribute("open", "");
  }
}

function closeDialog() {
  if (typeof elements.dialog.close === "function") {
    elements.dialog.close();
  } else {
    elements.dialog.removeAttribute("open");
  }
}

function collectSkillChanges() {
  const changes = {};

  for (const skill of dirtySkills) {
    const selectedLevel = elements.skills.get(skill).value;
    if (!selectedLevel) continue;

    const numericValue = proficiencyValue(selectedLevel);
    if (numericValue === null) {
      throw new Error("Select a valid proficiency level.");
    }
    changes[skill] = numericValue;
  }

  return changes;
}

function collectGoalOperation() {
  const action = elements.goalAction.value;
  if (action === "unchanged") return null;

  const title = elements.goalTitle.value.trim();
  const status = elements.goalStatus.value;
  if (!isNonEmptyText(title)) {
    throw new Error("Enter a goal title.");
  }
  if (!isGoalStatus(status)) {
    throw new Error("Select a valid goal status.");
  }

  if (action === "update") {
    const goal = currentGoal();
    if (!goal) throw new Error("There is no active goal to update.");
    if (goal.title === title && goal.status === status) return null;
    return { type: "update", goal, title, status };
  }

  return { type: "create", title, status };
}

async function saveProgress(unitId, changes) {
  if (Object.keys(changes).length === 0) return;

  const existingProgress = currentProgress();
  if (existingProgress) {
    await progressRepository.updatePartialWithCalculatedProgress(
      existingProgress.id,
      existingProgress,
      changes,
    );
    Object.assign(existingProgress, changes, {
      unitProgress: calculateUnitProgress({ ...existingProgress, ...changes }),
    });
  } else {
    const progressData = { studentId: context.student.id, unitId, ...changes };
    const id = await progressRepository.createWithCalculatedProgress(progressData);
    context.progress.push({
      id,
      ...progressData,
      unitProgress: calculateUnitProgress(progressData),
    });
  }

  dirtySkills.clear();
}

async function saveGoal(operation) {
  if (!operation) return;

  if (operation.type === "update") {
    await goalsRepository.update(operation.goal.id, {
      title: operation.title,
      status: operation.status,
    });
    Object.assign(operation.goal, {
      title: operation.title,
      status: operation.status,
    });
  } else {
    const goalData = {
      studentId: context.student.id,
      title: operation.title,
      status: operation.status,
      studentVisible: true,
    };
    const id = await goalsRepository.create(goalData);
    context.goals.push({ id, ...goalData });
  }

  populateGoalEditor();
}

async function saveObservation(unitId, observation, category, lessonDate) {
  if (!observation) return;

  await teacherNotesRepository.createWithDate(
    {
      studentId: context.student.id,
      unitId,
      category,
      text: observation,
    },
    lessonDate,
  );
  elements.observation.value = "";
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!context) return;

  const unitId = elements.unit.value;
  if (!unitId || !context.units.some((unit) => unit.id === unitId)) {
    setMessage("Select a unit before saving.");
    return;
  }

  const lessonDate = dateFromInput(elements.lessonDate.value);
  if (!lessonDate) {
    setMessage("Select a valid lesson date.");
    return;
  }

  let skillChanges;
  let goalOperation;
  try {
    skillChanges = collectSkillChanges();
    goalOperation = collectGoalOperation();
  } catch (error) {
    setMessage(error.message);
    return;
  }

  const observation = elements.observation.value.trim();
  const hasChanges =
    Object.keys(skillChanges).length > 0 || Boolean(observation) || Boolean(goalOperation);
  if (!hasChanges) {
    setMessage("No changes to save.");
    return;
  }

  elements.saveButton.disabled = true;
  setMessage("Saving update…");

  try {
    await saveProgress(unitId, skillChanges);
    await saveGoal(goalOperation);
    await saveObservation(
      unitId,
      observation,
      elements.observationCategory.value,
      lessonDate,
    );

    const successMessage = `${context.student.name}'s progress updated.`;
    closeDialog();
    await context.onSaved(successMessage);
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

  if (!dialog || !form || !openButton) {
    console.error("Quick Update markup is incomplete.");
    return false;
  }

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
    observation: form.elements.observation,
    observationCategory: form.elements.observationCategory,
    currentGoal: dialog.querySelector("[data-quick-current-goal]"),
    goalAction: dialog.querySelector("[data-quick-goal-action]"),
    goalUpdateOption: dialog.querySelector("[data-goal-update-option]"),
    goalTitle: dialog.querySelector("[data-quick-goal-title]"),
    goalStatus: dialog.querySelector("[data-quick-goal-status]"),
    skills: new Map(
      [...dialog.querySelectorAll("[data-quick-skill]")].map((select) => [
        select.dataset.quickSkill,
        select,
      ]),
    ),
  };

  if (elements.skills.size !== PROGRESS_SKILLS.length) {
    console.error("Quick Update skill fields are incomplete.");
    return false;
  }

  populateProficiencyOptions();
  openButton.addEventListener("click", openDialog);
  elements.closeButton.addEventListener("click", closeDialog);
  elements.unit.addEventListener("change", populateSkillValues);
  elements.goalAction.addEventListener("change", updateGoalFields);
  elements.form.addEventListener("submit", handleSubmit);
  for (const [skill, select] of elements.skills) {
    select.addEventListener("change", () => dirtySkills.add(skill));
  }

  return true;
}

export function configureQuickUpdate(nextContext) {
  if (!initialized) {
    initialized = initialize();
  }
  if (!initialized) return;

  context = nextContext;
}
