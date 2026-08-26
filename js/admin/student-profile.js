import { coursesRepository } from "../data/repositories/courses-repository.js";
import { feedbackDraftsRepository } from "../data/repositories/feedback-drafts-repository.js";
import { goalsRepository } from "../data/repositories/goals-repository.js";
import { groupsRepository } from "../data/repositories/groups-repository.js";
import { homeworkAssignmentsRepository } from "../data/repositories/homework-assignments-repository.js";
import { lessonsRepository } from "../data/repositories/lessons-repository.js";
import { objectiveProgressRepository } from "../data/repositories/objective-progress-repository.js";
import { progressRepository } from "../data/repositories/progress-repository.js";
import { progressHistoryRepository } from "../data/repositories/progress-history-repository.js";
import { studentsRepository } from "../data/repositories/students-repository.js";
import { teacherNotesRepository } from "../data/repositories/teacher-notes-repository.js";
import { unitsRepository } from "../data/repositories/units-repository.js";
import {
  ACTIVE_GOAL_STATUSES,
  HOMEWORK_STATUS_LABELS,
  LANGUAGE_SKILL_CATEGORIES,
  LANGUAGE_SKILL_LABELS,
  OBJECTIVE_STATUS_LABELS,
} from "../domain/constants.js";
import {
  aggregateObjectiveStatus,
  learningObjectivesForUnit,
  objectiveStatusValue,
  overallObjectiveStatus,
  progressByObjective,
  strongestObjectiveCategory,
  unitObjectiveStatus,
} from "../domain/learning-objectives.js";
import { isIndependentProgressEntry } from "../domain/independent-learning.js";
import { configureQuickUpdate } from "./quick-update.js";
import { configureFeedbackWorkflow } from "./feedback-workflow.js";
import { configureProgressUpdateEditor } from "./progress-update-editor.js";
import { configureStudentAccess } from "./student-access.js";

let activeRequestId = 0;

function select(root, selector) {
  return root.querySelector(selector);
}

function setText(root, selector, value) {
  const element = select(root, selector);
  if (element) element.textContent = value;
}

function displayValue(value) {
  if (value === true) return "active";
  if (value === false) return "inactive";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function relatedName(document, fallback) {
  return typeof document?.name === "string" && document.name.trim() ? document.name : fallback;
}

function unitName(unit) {
  if (typeof unit?.title === "string" && unit.title.trim()) return unit.title;
  return unit?.number ? `Unit ${unit.number}` : "Unknown unit";
}

function statusBadge(status, labels = OBJECTIVE_STATUS_LABELS, emptyAsDash = false) {
  const badge = document.createElement("span");
  badge.className = "learning-status-badge";
  badge.dataset.status = status;
  badge.textContent = emptyAsDash && status === "not_assessed" ? "—" : labels[status] ?? "Not assessed";
  return badge;
}

function timestampToDate(timestamp) {
  if (!timestamp) return null;
  const value = typeof timestamp.toDate === "function" ? timestamp.toDate() : timestamp;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(timestamp) {
  const date = timestampToDate(timestamp);
  return date ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date) : null;
}

function setProfileState(root, message) {
  const state = select(root, "[data-profile-state]");
  state.textContent = message;
  state.hidden = false;
  select(root, "[data-profile-content]").hidden = true;
}

function createObjectiveItem(objective, progressMap) {
  const item = document.createElement("li");
  const title = document.createElement("span");
  title.textContent = objective.title;
  item.append(title, statusBadge(progressMap.get(objective.id)?.status ?? "not_assessed"));
  return item;
}

function createHomeworkBlock(assignments) {
  const block = document.createElement("section");
  const heading = document.createElement("h5");
  heading.textContent = "Learning habits — Homework";
  block.className = "unit-homework-block";
  block.append(heading);
  if (assignments.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No homework assigned.";
    block.append(empty);
    return block;
  }
  const list = document.createElement("ul");
  assignments.forEach((assignment) => {
    const item = document.createElement("li");
    const title = document.createElement("span");
    title.textContent = assignment.title || "Homework";
    item.append(title, statusBadge(assignment.status, HOMEWORK_STATUS_LABELS));
    list.append(item);
  });
  block.append(list);
  return block;
}

function createUnitObjectives(unit, objectiveProgress, homeworkAssignments) {
  const card = document.createElement("details");
  const summary = document.createElement("summary");
  const title = document.createElement("strong");
  const objectives = learningObjectivesForUnit(unit);
  const progressMap = progressByObjective(objectiveProgress);
  title.textContent = unitName(unit);
  summary.append(title, statusBadge(unitObjectiveStatus(unit, objectiveProgress), OBJECTIVE_STATUS_LABELS, true));
  card.className = "unit-objectives-card";
  card.append(summary);

  if (objectives.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No learning objectives have been added to this unit.";
    card.append(empty);
  } else {
    LANGUAGE_SKILL_CATEGORIES.forEach((category) => {
      const categoryObjectives = objectives.filter((objective) => objective.category === category);
      if (categoryObjectives.length === 0) return;
      const section = document.createElement("section");
      const heading = document.createElement("h4");
      const list = document.createElement("ul");
      heading.textContent = LANGUAGE_SKILL_LABELS[category];
      list.append(...categoryObjectives.map((objective) => createObjectiveItem(objective, progressMap)));
      section.append(heading, list);
      card.append(section);
    });
  }
  card.append(createHomeworkBlock(homeworkAssignments.filter((item) => item.unitId === unit.id)));
  return card;
}

function createIndependentObjectives(objectiveProgress, homeworkAssignments) {
  const card = document.createElement("details");
  const summary = document.createElement("summary");
  const title = document.createElement("strong");
  title.textContent = "Independent learning";
  summary.append(title, statusBadge(aggregateObjectiveStatus(objectiveProgress), OBJECTIVE_STATUS_LABELS, true));
  card.className = "unit-objectives-card";
  card.open = true;
  card.append(summary);
  LANGUAGE_SKILL_CATEGORIES.forEach((category) => {
    const documents = objectiveProgress.filter((item) => item.category === category);
    if (!documents.length) return;
    const section = document.createElement("section");
    const heading = document.createElement("h4");
    const list = document.createElement("ul");
    heading.textContent = LANGUAGE_SKILL_LABELS[category];
    documents.forEach((document) => {
      const item = document.createElement("li");
      const objectiveTitle = document.createElement("span");
      objectiveTitle.textContent = document.objectiveTitle || "Learning objective";
      item.append(objectiveTitle, statusBadge(document.status ?? "not_assessed"));
      list.append(item);
    });
    section.append(heading, list);
    card.append(section);
  });
  card.append(createHomeworkBlock(homeworkAssignments.filter((item) =>
    item.scope === "independent" || !item.unitId)));
  return card;
}

function renderLearningObjectives(root, units, objectiveProgress, homeworkAssignments) {
  const state = select(root, "[data-progress-state]");
  const container = select(root, "[data-progress-matrix]");
  const independentProgress = objectiveProgress.filter(isIndependentProgressEntry);
  container.replaceChildren();
  if (units.length === 0 && independentProgress.length === 0) {
    state.textContent = "No learning updates yet.";
    state.hidden = false;
    return;
  }
  state.hidden = true;
  container.append(...units.map((unit) => createUnitObjectives(unit, objectiveProgress, homeworkAssignments)));
  if (independentProgress.length) {
    container.append(createIndependentObjectives(independentProgress, homeworkAssignments));
  }
}

function renderSummary(root, units, objectiveProgress) {
  const independentProgress = objectiveProgress.filter(isIndependentProgressEntry);
  const overall = units.length
    ? overallObjectiveStatus(objectiveProgress, units)
    : aggregateObjectiveStatus(independentProgress);
  const strongest = units.length
    ? strongestObjectiveCategory(units, objectiveProgress)
    : LANGUAGE_SKILL_CATEGORIES.map((category) => {
      const documents = independentProgress.filter((item) => item.category === category);
      const values = documents.map(({ status }) => objectiveStatusValue(status)).filter((value) => value !== null);
      return values.length ? {
        category,
        status: aggregateObjectiveStatus(documents),
        average: values.reduce((sum, value) => sum + value, 0) / values.length,
      } : null;
    }).filter(Boolean).sort((first, second) => second.average - first.average)[0] ?? null;
  setText(root, "[data-profile-overall-progress]", overall === "not_assessed" ? "—" : OBJECTIVE_STATUS_LABELS[overall]);
  setText(root, "[data-profile-strongest-area]", strongest ? `${LANGUAGE_SKILL_LABELS[strongest.category]} — ${OBJECTIVE_STATUS_LABELS[strongest.status]}` : "—");
}

function renderCurrentGoal(root, goals) {
  const currentGoal = goals.find((goal) => ACTIVE_GOAL_STATUSES.includes(goal.status));
  const empty = select(root, "[data-current-goal-empty]");
  const details = select(root, "[data-current-goal]");
  select(root, ".summary-card--goal")?.classList.toggle("has-goal", Boolean(currentGoal));
  if (!currentGoal) {
    empty.hidden = false;
    details.hidden = true;
    return;
  }
  empty.hidden = true;
  details.hidden = false;
  setText(root, "[data-current-goal-title]", displayValue(currentGoal.title));
  setText(root, "[data-current-goal-status]", displayValue(currentGoal.status));
}

function createObservation(note, unitNames, courseName) {
  const item = document.createElement("li");
  const top = document.createElement("div");
  const skill = document.createElement("span");
  const date = document.createElement("time");
  const breadcrumb = document.createElement("p");
  const title = document.createElement("h4");
  const observation = document.createElement("div");
  const observationLabel = document.createElement("span");
  const observationText = document.createElement("p");
  const footer = document.createElement("footer");
  const selector = document.createElement("label");
  const checkbox = document.createElement("input");
  const selectorText = document.createElement("span");
  const actions = document.createElement("div");
  const edit = document.createElement("button");
  const more = document.createElement("details");
  const moreSummary = document.createElement("summary");
  const remove = document.createElement("button");
  const targetIds = Array.isArray(note.learningTargetIds) && note.learningTargetIds.length
    ? note.learningTargetIds
    : note.learningTargetId ? [note.learningTargetId] : [];
  const targetTitles = Array.isArray(note.learningTargetTitles) && note.learningTargetTitles.length
    ? note.learningTargetTitles
    : note.learningTargetTitle ? [note.learningTargetTitle] : [];
  const skillCategories = Array.isArray(note.skillCategories) && note.skillCategories.length
    ? note.skillCategories
    : note.skillCategory ? [note.skillCategory] : [];
  const isLinked = targetIds.length > 0 && skillCategories.length > 0;
  const observationDate = formatDate(note.lessonDate ?? note.createdAt);

  item.className = "observation-card";
  top.className = "observation-card__top";
  skill.className = "observation-skill-chip";
  skill.textContent = skillCategories.length
    ? skillCategories.map((category) => LANGUAGE_SKILL_LABELS[category] ?? category).join(" · ")
    : "General";
  date.textContent = observationDate ?? "Date unavailable";
  const rawDate = timestampToDate(note.lessonDate ?? note.createdAt);
  if (rawDate) date.dateTime = rawDate.toISOString();
  top.append(skill, date);

  breadcrumb.className = "observation-card__breadcrumb";
  breadcrumb.textContent = isIndependentProgressEntry(note)
    ? "Independent learning"
    : `${courseName} › Unit: ${unitNames.get(note.unitId) ?? "Unknown unit"}`;
  title.className = "observation-card__target";
  title.textContent = targetTitles.length
    ? targetTitles.join(" · ")
    : "Observation without a linked learning target";
  item.append(top, breadcrumb, title);

  if (note.lessonContext) {
    const contextRow = document.createElement("div");
    const contextIcon = document.createElement("span");
    const contextCopy = document.createElement("div");
    const contextLabel = document.createElement("span");
    const contextText = document.createElement("p");
    contextRow.className = "observation-card__context";
    contextIcon.className = "observation-card__context-icon";
    contextIcon.setAttribute("aria-hidden", "true");
    contextIcon.textContent = "▧";
    contextLabel.textContent = "Lesson context";
    contextText.textContent = note.lessonContext;
    contextCopy.append(contextLabel, contextText);
    contextRow.append(contextIcon, contextCopy);
    item.append(contextRow);
  }

  observation.className = "observation-card__note";
  observationLabel.textContent = "My observation";
  observationText.textContent = note.text || "No observation text.";
  observation.append(observationLabel, observationText);

  selector.className = "observation-feedback-toggle";
  checkbox.type = "checkbox";
  checkbox.dataset.feedbackObservation = note.id;
  checkbox.checked = note.includeInFeedback === true;
  checkbox.disabled = !isLinked;
  selectorText.textContent = isLinked ? "Include in feedback" : "No linked learning target";
  selector.append(checkbox, selectorText);

  actions.className = "observation-card__actions";
  edit.type = "button";
  edit.dataset.editObservation = note.id;
  edit.textContent = "Edit";
  more.className = "observation-card__more";
  moreSummary.setAttribute("aria-label", "More observation actions");
  moreSummary.textContent = "•••";
  remove.type = "button";
  remove.dataset.deleteObservation = note.id;
  remove.textContent = "Delete";
  more.append(moreSummary, remove);
  actions.append(edit, more);
  footer.append(selector, actions);
  item.append(observation, footer);
  return item;
}

function renderObservations(root, notes, units, course) {
  const empty = select(root, "[data-observations-empty]");
  const list = select(root, "[data-observations-list]");
  const unitNames = new Map(units.map((unit) => [unit.id, unitName(unit)]));
  list.replaceChildren();
  empty.hidden = notes.length > 0;
  const sorted = [...notes].sort((first, second) =>
    (timestampToDate(second.lessonDate ?? second.createdAt)?.getTime() ?? 0) -
    (timestampToDate(first.lessonDate ?? first.createdAt)?.getTime() ?? 0),
  );
  if (sorted.length) list.append(...sorted.map((note) =>
    createObservation(note, unitNames, relatedName(course, "Unknown course")),
  ));
}

function renderAssessmentHistory(root, history, units) {
  const empty = select(root, "[data-assessment-history-empty]");
  const list = select(root, "[data-assessment-history-list]");
  const unitNames = new Map(units.map((unit) => [unit.id, unitName(unit)]));
  const objectives = new Map(
    units.flatMap((unit) => learningObjectivesForUnit(unit)).map((objective) => [objective.id, objective]),
  );
  const sorted = [...history].sort((first, second) =>
    (timestampToDate(second.lessonDate)?.getTime() ?? timestampToDate(second.createdAt)?.getTime() ?? 0) -
    (timestampToDate(first.lessonDate)?.getTime() ?? timestampToDate(first.createdAt)?.getTime() ?? 0),
  );
  list.replaceChildren();
  empty.hidden = sorted.length > 0;
  sorted.forEach((entry) => {
    const item = document.createElement("li");
    const top = document.createElement("div");
    const heading = document.createElement("strong");
    const edit = document.createElement("button");
    const date = formatDate(entry.lessonDate ?? entry.createdAt);
    const changes = document.createElement("ul");
    top.className = "assessment-history__top";
    heading.textContent = [
      isIndependentProgressEntry(entry) ? "Independent update" : unitNames.get(entry.unitId) ?? "Unknown unit",
      date,
    ].filter(Boolean).join(" — ");
    edit.type = "button";
    edit.dataset.editProgressUpdate = entry.id;
    edit.textContent = "Edit progress";
    top.append(heading, edit);
    (Array.isArray(entry.changes) ? entry.changes : []).forEach((change) => {
      const changeItem = document.createElement("li");
      const objective = objectives.get(change.objectiveId);
       const label = objective?.title ?? change.title ?? LANGUAGE_SKILL_LABELS[change.category] ?? "Learning objective";
      changeItem.textContent = `${label}: ${OBJECTIVE_STATUS_LABELS[change.previousStatus] ?? "Not assessed"} → ${OBJECTIVE_STATUS_LABELS[change.status] ?? "Not assessed"}`;
      changes.append(changeItem);
    });
    const changedIds = new Set((entry.changes ?? []).map(({ objectiveId }) => objectiveId));
    (Array.isArray(entry.workedOnObjectives) ? entry.workedOnObjectives : [])
      .filter(({ objectiveId, id }) => !changedIds.has(objectiveId ?? id))
      .forEach((workedOn) => {
        const workedOnItem = document.createElement("li");
        workedOnItem.textContent = `${workedOn.title || "Learning objective"}: worked on (no status)`;
        changes.append(workedOnItem);
      });
    if (!changes.childElementCount) {
      const physical = document.createElement("li");
      physical.textContent = typeof entry.completeLesson === "boolean"
        ? `Lesson completion: ${entry.completeLesson ? "Completed" : "Not completed"}`
        : "Physical lesson progress update";
      changes.append(physical);
    }
    item.append(top, changes);
    list.append(item);
  });
}

function renderProfile(root, data, onQuickUpdateSaved) {
  const { student, group, course, units, objectiveProgress, homeworkAssignments, progressHistory, legacyProgress, goals, teacherNotes } = data;
  const initial = displayValue(student.name).trim().charAt(0).toUpperCase() || "S";
  setText(root, "[data-profile-initial]", initial);
  const avatarImage = select(root, "[data-profile-avatar-image]");
  const avatarFallback = select(root, "[data-profile-initial]");
  avatarImage.hidden = !student.avatarImageUrl;
  avatarFallback.hidden = Boolean(student.avatarImageUrl);
  avatarImage.alt = `${displayValue(student.name)} avatar`;
  if (student.avatarImageUrl) avatarImage.src = student.avatarImageUrl;
  else avatarImage.removeAttribute("src");
  avatarImage.onerror = () => {
    avatarImage.hidden = true;
    avatarFallback.hidden = false;
  };
  if (typeof student.color === "string" && globalThis.CSS?.supports?.("color", student.color)) root.style.setProperty("--student-color", student.color);
  else root.style.removeProperty("--student-color");
  setText(root, "[data-profile-name]", displayValue(student.name));
  setText(root, "[data-profile-group]", student.groupId ? relatedName(group, "Unknown group") : "Individual");
  setText(root, "[data-profile-course]", student.courseId ? relatedName(course, "Unknown course") : "Independent learning");
  setText(root, "[data-profile-status]", displayValue(student.status ?? student.active));
  select(root, "[data-profile-edit-student]").dataset.editStudent = student.id;
  renderLearningObjectives(root, units, objectiveProgress, homeworkAssignments);
  renderSummary(root, units, objectiveProgress);
  renderCurrentGoal(root, goals);
  renderObservations(root, teacherNotes, units, course);
  renderAssessmentHistory(root, progressHistory, units);
  select(root, "[data-legacy-progress-note]").hidden = legacyProgress.length === 0;
  configureQuickUpdate({ ...data, onSaved: onQuickUpdateSaved });
  configureProgressUpdateEditor({ ...data, onSaved: onQuickUpdateSaved });
  configureFeedbackWorkflow({ ...data, onSaved: onQuickUpdateSaved });
  configureStudentAccess(root, student);
  select(root, "[data-profile-state]").hidden = true;
  select(root, "[data-profile-content]").hidden = false;
}

async function loadProfileData(studentId) {
  const student = await studentsRepository.getById(studentId);
  if (!student) return null;
  const group = student.groupId
    ? await groupsRepository.getById(student.groupId)
    : null;
  const courseId = group?.courseId || student.courseId || "";
  const effectiveStudent = courseId === student.courseId ? student : { ...student, courseId };
  const [course, units, lessons, objectiveProgress, homeworkAssignments, progressHistory, legacyProgress, goals, teacherNotes, feedbackDrafts] = await Promise.all([
    courseId ? coursesRepository.getById(courseId) : Promise.resolve(null),
    courseId ? unitsRepository.listByCourse(courseId) : Promise.resolve([]),
    courseId ? lessonsRepository.listByCourse(courseId) : Promise.resolve([]),
    objectiveProgressRepository.listByStudent(studentId),
    homeworkAssignmentsRepository.listByStudent(studentId),
    progressHistoryRepository.listByStudent(studentId),
    progressRepository.listByStudent(studentId),
    goalsRepository.listByStudent(studentId),
    teacherNotesRepository.listByStudent(studentId),
    feedbackDraftsRepository.listByStudent(studentId),
  ]);
  return { student: effectiveStudent, group, course, units, lessons, objectiveProgress, homeworkAssignments, progressHistory, legacyProgress, goals, teacherNotes, feedbackDrafts };
}

export async function loadAdminStudentProfile(studentId, successMessage = "") {
  const root = document.querySelector('[data-admin-section="student-profile"]');
  if (!root) return console.error("Admin student profile markup was not found.");
  const requestId = ++activeRequestId;
  setText(root, "[data-profile-action-message]", "");
  setProfileState(root, "Loading student profile…");
  try {
    const data = await loadProfileData(studentId);
    if (requestId !== activeRequestId) return;
    if (!data) return setProfileState(root, "Student not found.");
    renderProfile(root, data, (message) => loadAdminStudentProfile(studentId, message));
    setText(root, "[data-profile-action-message]", successMessage);
  } catch (error) {
    if (requestId !== activeRequestId) return;
    console.error("Unable to load the admin student profile.", error);
    setProfileState(root, "Unable to load student profile. Please try again.");
  }
}
