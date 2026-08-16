import { achievementsRepository } from "../data/repositories/achievements-repository.js";
import { coursesRepository } from "../data/repositories/courses-repository.js";
import { goalsRepository } from "../data/repositories/goals-repository.js";
import { progressRepository } from "../data/repositories/progress-repository.js";
import { studentsRepository } from "../data/repositories/students-repository.js";
import { unitsRepository } from "../data/repositories/units-repository.js";
import {
  ACTIVE_GOAL_STATUSES,
  PROGRESS_SKILL_LABELS,
  PROGRESS_SKILLS,
} from "../domain/constants.js";
import { calculateOverallProgress, findStrongestArea } from "../domain/progress.js";
import { applyStudentTheme } from "./student-theme.js";

const DEFAULT_SECTION = "dashboard";
const PAGE_TITLES = Object.freeze({
  dashboard: "Dashboard",
  progress: "My Progress",
  achievements: "Achievements",
});

function select(root, selector) {
  return root.querySelector(selector);
}

function selectAll(root, selector) {
  return root.querySelectorAll(selector);
}

function setText(root, selector, value) {
  selectAll(root, selector).forEach((element) => {
    element.textContent = value;
  });
}

function displayValue(value, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatScore(value) {
  const score = Number(value);
  return Number.isFinite(score) ? `${Math.round(score)}%` : "—";
}

function timestampMillis(value) {
  if (!value) return 0;
  const dateValue = typeof value.toDate === "function" ? value.toDate() : value;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const milliseconds = timestampMillis(value);
  if (!milliseconds) return "";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(milliseconds);
}

function unitName(unit) {
  if (typeof unit?.title === "string" && unit.title.trim()) return unit.title.trim();
  return unit?.number ? `Unit ${unit.number}` : "Untitled unit";
}

function validImageSource(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value, document.baseURI);
    return ["http:", "https:", "file:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function firstImageSource(document) {
  return validImageSource(
    document?.avatarUrl ??
      document?.photoUrl ??
      document?.imageUrl ??
      document?.imagePath ??
      "",
  );
}

function renderStudentAvatar(root, student) {
  const name = displayValue(student.name, "Student");
  const initial = name.charAt(0).toUpperCase();
  const source = firstImageSource(student);

  setText(root, "[data-student-initial]", initial);
  selectAll(root, "[data-student-avatar]").forEach((image) => {
    const fallback = image.nextElementSibling;
    image.alt = `${name} profile photo`;
    image.hidden = !source;
    if (fallback) fallback.hidden = Boolean(source);

    image.addEventListener(
      "error",
      () => {
        image.hidden = true;
        if (fallback) fallback.hidden = false;
      },
      { once: true },
    );

    if (source) image.src = source;
    else image.removeAttribute("src");
  });
}

function renderCourseArt(root, course) {
  const name = displayValue(course?.name, "Course");
  const source = firstImageSource(course);
  const image = select(root, "[data-course-image]");
  const fallback = select(root, "[data-course-initial]");
  const art = select(root, "[data-course-art]");
  art.classList.toggle("has-image", Boolean(source));
  fallback.textContent = name.charAt(0).toUpperCase();
  image.alt = `${name} course image`;
  image.hidden = !source;
  fallback.hidden = Boolean(source);
  image.addEventListener(
    "error",
    () => {
      image.hidden = true;
      fallback.hidden = false;
    },
    { once: true },
  );
  if (source) image.src = source;
  else image.removeAttribute("src");
}

function calculateSkillAverages(progressDocuments) {
  return PROGRESS_SKILLS.map((skill) => {
    const scores = progressDocuments
      .map((document) => document[skill])
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map(Number)
      .filter(Number.isFinite);
    const score = scores.length
      ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
      : null;
    return { skill, label: PROGRESS_SKILL_LABELS[skill], score };
  });
}

function activeGoal(goals) {
  return [...goals]
    .filter((goal) => ACTIVE_GOAL_STATUSES.includes(goal.status))
    .sort((first, second) => timestampMillis(second.createdAt) - timestampMillis(first.createdAt))[0] ?? null;
}

function goalStatusLabel(status) {
  const labels = {
    new: "New goal",
    working: "Working on it",
    confident: "Feeling confident",
  };
  return labels[status] ?? "Active goal";
}

function createSkillItem(item) {
  const row = document.createElement("div");
  const heading = document.createElement("div");
  const label = document.createElement("span");
  const value = document.createElement("strong");
  const track = document.createElement("div");
  const fill = document.createElement("span");

  row.className = "skill-row";
  label.textContent = item.label;
  label.dataset.skill = item.skill;
  value.textContent = formatScore(item.score);
  heading.append(label, value);
  track.className = "student-progress-track";
  fill.style.width = item.score === null ? "0%" : `${Math.max(0, Math.min(100, item.score))}%`;
  track.append(fill);
  row.append(heading, track);
  return row;
}

function renderSkills(root, selector, emptySelector, averages) {
  const container = select(root, selector);
  const empty = select(root, emptySelector);
  const existing = averages.filter((item) => item.score !== null);
  container.replaceChildren(...existing.map(createSkillItem));
  container.hidden = existing.length === 0;
  empty.hidden = existing.length > 0;
}

function createAchievementMarker(achievement) {
  const marker = document.createElement("span");
  const source = validImageSource(achievement.icon);
  const fallback = displayValue(achievement.title, "A").charAt(0).toUpperCase();
  marker.className = "achievement-marker";

  if (source) {
    const image = document.createElement("img");
    image.src = source;
    image.alt = "";
    image.addEventListener(
      "error",
      () => {
        marker.textContent = fallback;
      },
      { once: true },
    );
    marker.append(image);
  }

  if (!source) {
    marker.classList.add("achievement-marker--default");
    marker.setAttribute("aria-hidden", "true");
  }
  return marker;
}

function createAchievementPreviewItem(achievement) {
  const item = document.createElement("li");
  const text = document.createElement("span");
  const title = document.createElement("strong");
  const detail = document.createElement("small");
  title.textContent = displayValue(achievement.title, "Achievement");
  detail.textContent = formatDate(achievement.earnedAt) || displayValue(achievement.type, "Milestone");
  text.append(title, detail);
  item.append(createAchievementMarker(achievement), text);
  return item;
}

function createAchievementCard(achievement) {
  const item = document.createElement("li");
  const title = document.createElement("h3");
  const description = document.createElement("p");
  const meta = document.createElement("small");
  title.textContent = displayValue(achievement.title, "Achievement");
  description.textContent = displayValue(
    achievement.description,
    "A meaningful step in your learning journey.",
  );
  meta.textContent = [displayValue(achievement.type, "Milestone"), formatDate(achievement.earnedAt)]
    .filter(Boolean)
    .join(" · ");
  item.append(createAchievementMarker(achievement), title, description, meta);
  return item;
}

function renderAchievements(root, achievements) {
  const sorted = [...achievements].sort(
    (first, second) => timestampMillis(second.earnedAt) - timestampMillis(first.earnedAt),
  );
  const preview = select(root, "[data-achievement-preview]");
  const previewEmpty = select(root, "[data-achievement-preview-empty]");
  const list = select(root, "[data-achievement-list]");
  const empty = select(root, "[data-achievement-empty]");

  preview.replaceChildren(...sorted.slice(0, 3).map(createAchievementPreviewItem));
  preview.hidden = sorted.length === 0;
  previewEmpty.hidden = sorted.length > 0;
  list.replaceChildren(...sorted.map(createAchievementCard));
  list.hidden = sorted.length === 0;
  empty.hidden = sorted.length > 0;
  setText(root, "[data-achievement-count]", String(sorted.length));
}

function createUnitCard(unit, progressByUnit) {
  const card = document.createElement("article");
  const number = document.createElement("span");
  const title = document.createElement("h4");
  const value = document.createElement("strong");
  const track = document.createElement("div");
  const fill = document.createElement("span");
  const progress = progressByUnit.get(unit.id);
  const score = progress ? Number(progress.unitProgress) : null;
  card.dataset.unitState = Number.isFinite(score)
    ? score >= 100
      ? "complete"
      : "current"
    : "upcoming";

  number.textContent = unit.number ? `Unit ${unit.number}` : "Unit";
  title.textContent = unitName(unit);
  value.textContent = Number.isFinite(score) ? `${Math.round(score)}%` : "—";
  track.className = "student-progress-track";
  fill.style.width = Number.isFinite(score) ? `${Math.max(0, Math.min(100, score))}%` : "0%";
  track.append(fill);
  card.append(number, title, value, track);
  return card;
}

function renderUnits(root, units, progressDocuments) {
  const container = select(root, "[data-unit-progress]");
  const empty = select(root, "[data-unit-progress-empty]");
  const progressByUnit = new Map(progressDocuments.map((document) => [document.unitId, document]));
  container.replaceChildren(...units.map((unit) => createUnitCard(unit, progressByUnit)));
  container.hidden = units.length === 0;
  empty.hidden = units.length > 0;
}

function createMatrixRow(label, units, progressByUnit, field) {
  const row = document.createElement("tr");
  const heading = document.createElement("th");
  heading.scope = "row";
  heading.textContent = label;
  if (PROGRESS_SKILLS.includes(field)) heading.dataset.skill = field;
  row.append(heading);

  units.forEach((unit) => {
    const cell = document.createElement("td");
    const progress = progressByUnit.get(unit.id);
    cell.textContent = progress ? formatScore(progress[field]) : "—";
    row.append(cell);
  });
  return row;
}

function renderProgressMatrix(root, units, progressDocuments) {
  const container = select(root, "[data-student-progress-matrix]");
  const empty = select(root, "[data-student-progress-empty]");
  container.replaceChildren();

  if (units.length === 0 || progressDocuments.length === 0) {
    container.hidden = true;
    empty.hidden = false;
    return;
  }

  const progressByUnit = new Map(progressDocuments.map((document) => [document.unitId, document]));
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const body = document.createElement("tbody");
  const skillHeading = document.createElement("th");
  skillHeading.scope = "col";
  skillHeading.textContent = "Skill";
  headRow.append(skillHeading);

  units.forEach((unit) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = unitName(unit);
    headRow.append(cell);
  });
  PROGRESS_SKILLS.forEach((skill) => {
    body.append(createMatrixRow(PROGRESS_SKILL_LABELS[skill], units, progressByUnit, skill));
  });
  body.append(createMatrixRow("Unit Progress", units, progressByUnit, "unitProgress"));
  head.append(headRow);
  table.append(head, body);
  container.append(table);
  container.hidden = false;
  empty.hidden = true;
}

function renderStudent(root, data) {
  const { student, course, units, progress, goals, achievements } = data;
  const name = displayValue(student.name, "Student");
  const courseName = displayValue(course?.name, "Course not available");
  const overall = calculateOverallProgress(progress);
  const strongest = findStrongestArea(progress);
  const currentGoal = activeGoal(goals);
  const averages = calculateSkillAverages(progress);

  applyStudentTheme(root, student.visualTheme);
  if (typeof student.color === "string" && globalThis.CSS?.supports?.("color", student.color)) {
    root.style.setProperty("--student-accent", student.color);
  }
  renderStudentAvatar(root, student);
  renderCourseArt(root, course);

  setText(root, "[data-student-name]", name);
  setText(root, "[data-student-account-name]", name);
  setText(root, "[data-student-course]", courseName);
  setText(root, "[data-student-overall]", formatScore(overall));
  setText(root, "[data-progress-overall]", formatScore(overall));
  setText(root, "[data-progress-course]", courseName);
  setText(
    root,
    "[data-student-strongest]",
    strongest ? `${PROGRESS_SKILL_LABELS[strongest.skill]} · ${strongest.score}%` : "—",
  );
  setText(
    root,
    "[data-progress-strongest]",
    strongest ? `${PROGRESS_SKILL_LABELS[strongest.skill]} · ${strongest.score}%` : "—",
  );
  setText(root, "[data-student-goal-title]", currentGoal ? displayValue(currentGoal.title) : "—");
  setText(
    root,
    "[data-student-goal-status]",
    currentGoal ? goalStatusLabel(currentGoal.status) : "No active goal",
  );
  setText(root, "[data-student-unit-count]", String(units.length));
  setText(
    root,
    "[data-student-progress-count]",
    progress.length ? `${progress.length} units with progress` : "No progress yet",
  );

  renderSkills(root, "[data-dashboard-skills]", "[data-dashboard-skills-empty]", averages);
  renderSkills(root, "[data-progress-skills]", "[data-progress-skills-empty]", averages);
  renderUnits(root, units, progress);
  renderProgressMatrix(root, units, progress);
  renderAchievements(root, achievements);
}

async function loadStudentData(studentId) {
  const student = await studentsRepository.getById(studentId);
  if (!student) return null;

  const [course, units, progress, goals, achievements] = await Promise.all([
    student.courseId ? coursesRepository.getById(student.courseId) : Promise.resolve(null),
    student.courseId ? unitsRepository.listByCourse(student.courseId) : Promise.resolve([]),
    progressRepository.listByStudent(studentId),
    goalsRepository.listVisibleByStudent(studentId),
    achievementsRepository.listByStudent(studentId),
  ]);
  return { student, course, units, progress, goals, achievements };
}

function activateSection(root, sectionName) {
  const active = PAGE_TITLES[sectionName] ? sectionName : DEFAULT_SECTION;
  selectAll(root, "[data-student-section]").forEach((section) => {
    section.hidden = section.dataset.studentSection !== active;
  });
  selectAll(root, ".student-nav [data-student-link], .student-brand[data-student-link]").forEach((link) => {
    if (link.dataset.studentLink === active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  setText(root, "[data-student-page-title]", PAGE_TITLES[active]);
}

function sectionFromHash() {
  const sectionName = window.location.hash.slice(1);
  return PAGE_TITLES[sectionName] ? sectionName : DEFAULT_SECTION;
}

function initializeNavigation(root) {
  root.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest("[data-student-link]");
    if (!link) return;
    event.preventDefault();
    const sectionName = link.dataset.studentLink;
    window.history.pushState(null, "", `#${sectionName}`);
    activateSection(root, sectionName);
  });
  window.addEventListener("popstate", () => activateSection(root, sectionFromHash()));
  activateSection(root, sectionFromHash());
}

export async function initializeStudentView(session) {
  const root = document.querySelector("[data-protected-content]");
  const state = select(root, "[data-student-state]");
  const content = select(root, "[data-student-content]");
  const studentId = session.profile.studentId;

  initializeNavigation(root);
  state.textContent = "Loading your learning space…";
  state.hidden = false;
  content.hidden = true;

  if (typeof studentId !== "string" || !studentId.trim()) {
    state.textContent = "Your account is not connected to a student profile. Please contact your teacher.";
    return;
  }

  try {
    const data = await loadStudentData(studentId);
    if (!data) {
      state.textContent = "Student profile not found. Please contact your teacher.";
      return;
    }
    renderStudent(root, data);
    state.hidden = true;
    content.hidden = false;
  } catch (error) {
    console.error("Unable to load the student learning space.", error);
    state.textContent = "Unable to load your learning space. Please try again.";
  }
}
