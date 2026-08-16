import { coursesRepository } from "../data/repositories/courses-repository.js";
import { goalsRepository } from "../data/repositories/goals-repository.js";
import { groupsRepository } from "../data/repositories/groups-repository.js";
import { progressRepository } from "../data/repositories/progress-repository.js";
import { studentsRepository } from "../data/repositories/students-repository.js";
import { teacherNotesRepository } from "../data/repositories/teacher-notes-repository.js";
import { unitsRepository } from "../data/repositories/units-repository.js";
import {
  ACTIVE_GOAL_STATUSES,
  PROGRESS_SKILL_LABELS,
  PROGRESS_SKILLS,
} from "../domain/constants.js";
import { calculateOverallProgress, findStrongestArea } from "../domain/progress.js";
import { configureQuickUpdate } from "./quick-update.js";
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
  return typeof document?.name === "string" && document.name.trim()
    ? document.name
    : fallback;
}

function unitName(unit) {
  if (typeof unit?.title === "string" && unit.title.trim()) return unit.title;
  if (unit?.number !== null && unit?.number !== undefined) return `Unit ${unit.number}`;
  return "Unknown unit";
}

function formatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? `${score}%` : "—";
}

function timestampToDate(timestamp) {
  if (!timestamp) return null;

  const value = typeof timestamp.toDate === "function" ? timestamp.toDate() : timestamp;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(timestamp) {
  const date = timestampToDate(timestamp);
  if (!date) return null;

  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function setProfileState(root, message) {
  const state = select(root, "[data-profile-state]");
  const content = select(root, "[data-profile-content]");
  state.textContent = message;
  state.hidden = false;
  content.hidden = true;
}

function createHeaderCell(text) {
  const cell = document.createElement("th");
  cell.scope = "col";
  cell.textContent = text;
  return cell;
}

function createScoreRow(label, units, progressByUnit, fieldName) {
  const row = document.createElement("tr");
  const heading = document.createElement("th");
  heading.scope = "row";
  heading.textContent = label;
  if (PROGRESS_SKILLS.includes(fieldName)) heading.dataset.skill = fieldName;
  row.append(heading);

  for (const unit of units) {
    const cell = document.createElement("td");
    const progress = progressByUnit.get(unit.id);
    cell.textContent = progress ? formatScore(progress[fieldName]) : "—";
    row.append(cell);
  }

  return row;
}

function renderProgressMatrix(root, units, progressDocuments) {
  const state = select(root, "[data-progress-state]");
  const container = select(root, "[data-progress-matrix]");
  container.replaceChildren();

  if (units.length === 0) {
    state.textContent = "No units yet.";
    state.dataset.state = "empty";
    state.hidden = false;
    return;
  }

  state.textContent = progressDocuments.length === 0 ? "No progress yet." : "";
  state.dataset.state = progressDocuments.length === 0 ? "empty" : "ready";
  state.hidden = progressDocuments.length > 0;

  const progressByUnit = new Map(
    progressDocuments.map((progress) => [progress.unitId, progress]),
  );
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const body = document.createElement("tbody");

  headRow.append(createHeaderCell("Skill"));
  for (const unit of units) {
    headRow.append(createHeaderCell(unitName(unit)));
  }
  head.append(headRow);

  for (const skill of PROGRESS_SKILLS) {
    body.append(
      createScoreRow(PROGRESS_SKILL_LABELS[skill], units, progressByUnit, skill),
    );
  }
  body.append(createScoreRow("Unit Progress", units, progressByUnit, "unitProgress"));

  table.append(head, body);
  container.append(table);
}

function renderSummary(root, progressDocuments) {
  const overallProgress = calculateOverallProgress(progressDocuments);
  const strongestArea = findStrongestArea(progressDocuments);
  const overallCard = select(root, ".summary-card--progress");
  overallCard?.style.setProperty("--profile-progress", String(overallProgress ?? 0));
  overallCard?.classList.toggle("has-progress", overallProgress !== null);

  setText(
    root,
    "[data-profile-overall-progress]",
    overallProgress === null ? "—" : `${overallProgress}%`,
  );
  setText(
    root,
    "[data-profile-strongest-area]",
    strongestArea
      ? `${PROGRESS_SKILL_LABELS[strongestArea.skill]} — ${strongestArea.score}%`
      : "—",
  );
}

function renderCurrentGoal(root, goals) {
  const currentGoal = goals.find((goal) => ACTIVE_GOAL_STATUSES.includes(goal.status));
  const empty = select(root, "[data-current-goal-empty]");
  const details = select(root, "[data-current-goal]");
  const card = select(root, ".summary-card--goal");
  card?.classList.toggle("has-goal", Boolean(currentGoal));

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

function createObservation(note, unitNames) {
  const item = document.createElement("li");
  const details = document.createElement("dl");
  const fields = [
    ["Unit", unitNames.get(note.unitId) ?? "Unknown unit"],
    ["Category", note.category],
    ["Observation", note.text],
  ];
  const createdAt = formatDate(note.createdAt);
  if (createdAt) fields.push(["Date", createdAt]);

  for (const [label, value] of fields) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = displayValue(value);
    details.append(term, description);
  }

  item.append(details);
  return item;
}

function renderObservations(root, notes, units) {
  const empty = select(root, "[data-observations-empty]");
  const list = select(root, "[data-observations-list]");
  const unitNames = new Map(units.map((unit) => [unit.id, unitName(unit)]));
  list.replaceChildren();

  if (notes.length === 0) {
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.append(...notes.map((note) => createObservation(note, unitNames)));
}

function renderProfile(root, data, onQuickUpdateSaved) {
  const { student, group, course, units, progress, goals, teacherNotes } = data;

  const initial = displayValue(student.name).trim().charAt(0).toUpperCase() || "S";
  setText(root, "[data-profile-initial]", initial);
  if (typeof student.color === "string" && globalThis.CSS?.supports?.("color", student.color)) {
    root.style.setProperty("--student-color", student.color);
  } else {
    root.style.removeProperty("--student-color");
  }

  setText(root, "[data-profile-name]", displayValue(student.name));
  setText(
    root,
    "[data-profile-group]",
    student.groupId ? relatedName(group, "Unknown group") : "Individual",
  );
  setText(root, "[data-profile-course]", relatedName(course, "Unknown course"));
  setText(root, "[data-profile-status]", displayValue(student.status ?? student.active));

  renderProgressMatrix(root, units, progress);
  renderSummary(root, progress);
  renderCurrentGoal(root, goals);
  renderObservations(root, teacherNotes, units);
  configureQuickUpdate({ ...data, onSaved: onQuickUpdateSaved });
  configureStudentAccess(root, student);

  select(root, "[data-profile-state]").hidden = true;
  select(root, "[data-profile-content]").hidden = false;
}

async function loadProfileData(studentId) {
  const student = await studentsRepository.getById(studentId);
  if (!student) return null;

  const [group, course, units, progress, goals, teacherNotes] = await Promise.all([
    student.groupId ? groupsRepository.getById(student.groupId) : Promise.resolve(null),
    student.courseId ? coursesRepository.getById(student.courseId) : Promise.resolve(null),
    student.courseId ? unitsRepository.listByCourse(student.courseId) : Promise.resolve([]),
    progressRepository.listByStudent(studentId),
    goalsRepository.listByStudent(studentId),
    teacherNotesRepository.listByStudent(studentId),
  ]);

  return { student, group, course, units, progress, goals, teacherNotes };
}

export async function loadAdminStudentProfile(studentId, successMessage = "") {
  const root = document.querySelector('[data-admin-section="student-profile"]');
  if (!root) {
    console.error("Admin student profile markup was not found.");
    return;
  }

  const requestId = ++activeRequestId;
  setText(root, "[data-profile-action-message]", "");
  setProfileState(root, "Loading student profile…");

  try {
    const data = await loadProfileData(studentId);
    if (requestId !== activeRequestId) return;

    if (!data) {
      setProfileState(root, "Student not found.");
      return;
    }

    renderProfile(root, data, (message) => loadAdminStudentProfile(studentId, message));
    setText(root, "[data-profile-action-message]", successMessage);
  } catch (error) {
    if (requestId !== activeRequestId) return;
    console.error("Unable to load the admin student profile.", error);
    setProfileState(root, "Unable to load student profile. Please try again.");
  }
}
