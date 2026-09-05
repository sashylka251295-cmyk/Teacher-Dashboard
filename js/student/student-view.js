import { achievementsRepository } from "../data/repositories/achievements-repository.js";
import { coursesRepository } from "../data/repositories/courses-repository.js";
import { feedbackVersionsRepository } from "../data/repositories/feedback-versions-repository.js";
import { goalsRepository } from "../data/repositories/goals-repository.js";
import { homeworkAssignmentsRepository } from "../data/repositories/homework-assignments-repository.js";
import { objectiveProgressRepository } from "../data/repositories/objective-progress-repository.js";
import { studentsRepository } from "../data/repositories/students-repository.js";
import { studentScheduleEntriesRepository } from "../data/repositories/student-schedule-entries-repository.js?v=20260904-student-schedule";
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
  categorySummaries,
  learningObjectivesForUnit,
  objectiveStatusValue,
  overallObjectiveStatus,
  progressByObjective,
  strongestObjectiveCategory,
} from "../domain/learning-objectives.js";
import { isIndependentProgressEntry } from "../domain/independent-learning.js";
import { normalizeHomeworkResources } from "../domain/homework.js";
import { appendTextWithLinks } from "../ui/linked-text.js?v=20260905-homework-links";
import { calendarDate, calendarEndTime, nextCalendarOccurrence } from "../domain/calendar.js?v=20260905-calendar-organizer";
import { applyStudentTheme } from "./student-theme.js";
import { currentPhysicalUnit, physicalProgress } from "../domain/physical-progress.js";
import { renderCourseJourneyMap } from "../ui/course-journey-map.js?v=20260828-route-decor";
import {
  renderReadingMap,
  renderReadingMapSummary,
} from "../ui/reading-map.js";

const DEFAULT_SECTION = "dashboard";
const PAGE_TITLES = Object.freeze({
  dashboard: "Dashboard",
  progress: "My Progress",
  reading: "My Reading",
  "ai-practice": "AI Practice",
  homework: "Homework",
  achievements: "Achievements",
});

const DASHBOARD_ASSETS = Object.freeze({
  courseFallback: "./assets/references/teacher-dashboard/child-course-cover-fallback.png",
  unitFallback: "./assets/references/teacher-dashboard/child-course-cover-fallback.png",
  homework: "./assets/references/teacher-dashboard/child-homework-notebook.png",
  achievement: "./assets/references/teacher-dashboard/child-achievement-placeholder.png",
});

const SKILL_ICON_PATHS = Object.freeze({
  vocabulary: "./assets/images/skill-vocabulary.png.png",
  grammar: "./assets/images/skill-grammar.png.png",
  reading: "./assets/images/skill-reading.png.png",
  listening: "./assets/images/skill-listening.png.png",
  speaking: "./assets/images/skill-speaking.png.png",
  writing: "./assets/images/decor-study-notebook-pencil.png.png",
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

function statusLabel(status) {
  return OBJECTIVE_STATUS_LABELS[status] ?? "Not assessed";
}

function summaryStatusLabel(status) {
  return status === "not_assessed" ? "—" : statusLabel(status);
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
    document?.avatarImageUrl ||
      document?.coverImageUrl ||
      document?.avatarUrl ||
      document?.photoUrl ||
      document?.imageUrl ||
      document?.imagePath ||
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
  const source = firstImageSource(course) || DASHBOARD_ASSETS.courseFallback;
  const image = select(root, "[data-course-image]");
  const fallback = select(root, "[data-course-initial]");
  const art = select(root, "[data-course-art]");
  art.classList.add("has-image");
  if (fallback) {
    fallback.textContent = name.charAt(0).toUpperCase();
    fallback.hidden = true;
  }
  image.alt = `${name} course image`;
  image.hidden = false;
  image.addEventListener(
    "error",
    () => {
      image.src = DASHBOARD_ASSETS.courseFallback;
    },
    { once: true },
  );
  image.src = source;
}

function calculateSkillSummaries(units, progressDocuments) {
  const summaries = units.length ? categorySummaries(units, progressDocuments) : LANGUAGE_SKILL_CATEGORIES.map((category) => {
    const documents = progressDocuments.filter((item) =>
      isIndependentProgressEntry(item) && item.category === category);
    const assessed = documents.filter(({ status }) => objectiveStatusValue(status) !== null);
    return {
      category,
      objectiveCount: documents.length,
      assessedCount: assessed.length,
      status: aggregateObjectiveStatus(documents),
      average: assessed.length
        ? assessed.reduce((sum, { status }) => sum + objectiveStatusValue(status), 0) / assessed.length
        : null,
    };
  }).filter(({ objectiveCount }) => objectiveCount > 0);
  return summaries.map((summary) => ({
    ...summary,
    skill: summary.category,
    label: LANGUAGE_SKILL_LABELS[summary.category],
  }));
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
  row.className = "skill-row";
  row.dataset.status = item.status;
  label.textContent = item.label;
  label.dataset.skill = item.skill;
  value.textContent = summaryStatusLabel(item.status);
  heading.append(label, value);
  const detail = document.createElement("small");
  detail.textContent = `${item.assessedCount} of ${item.objectiveCount} objectives assessed`;
  row.append(heading, detail);
  return row;
}

function renderSkills(root, selector, emptySelector, averages) {
  const container = select(root, selector);
  const empty = select(root, emptySelector);
  const existing = averages.filter((item) => item.objectiveCount > 0);
  container.replaceChildren(...existing.map(createSkillItem));
  container.hidden = existing.length === 0;
  empty.hidden = existing.length > 0;
}

function dashboardCurrentUnit(units, journey) {
  return currentPhysicalUnit(units, journey);
}

function createDashboardLearningTarget(objective, status) {
  const row = document.createElement("div");
  const icon = document.createElement("span");
  const image = document.createElement("img");
  const title = document.createElement("strong");
  row.className = "dashboard-learning-target";
  row.dataset.status = status;
  image.src = SKILL_ICON_PATHS[objective.category] ?? SKILL_ICON_PATHS.reading;
  image.alt = "";
  icon.append(image);
  title.textContent = objective.title;
  row.append(icon, title, createStatusBadge(status));
  return row;
}

function renderDashboardLearning(root, unit, progressDocuments, journey, independentLearning) {
  const container = select(root, "[data-dashboard-learning]");
  const empty = select(root, "[data-dashboard-learning-empty]");
  const currentStop = journey?.unitId === unit?.id && Array.isArray(journey?.lessonStops)
    ? journey.lessonStops.find(({ id }) => id === journey.currentLessonId)
    : null;
  const objectives = !unit && Array.isArray(independentLearning?.currentLearningTargets)
    ? independentLearning.currentLearningTargets.slice(0, 3)
    : Array.isArray(journey?.currentLearningTargets)
    ? journey.currentLearningTargets.slice(0, 3)
    : Array.isArray(currentStop?.learningTargets) && currentStop.learningTargets.length
      ? currentStop.learningTargets.slice(0, 3)
      : learningObjectivesForUnit(unit).slice(0, 3);
  const progressMap = progressByObjective(progressDocuments);
  container.replaceChildren(...objectives.map((objective) => createDashboardLearningTarget(
    objective,
    progressMap.get(objective.id)?.status ?? "not_assessed",
  )));
  container.hidden = objectives.length === 0;
  empty.hidden = objectives.length > 0;
}

function renderDashboardJourney(root, unit, journey, theme) {
  const container = select(root, "[data-dashboard-journey]");
  return renderCourseJourneyMap(container, { unit, journey, theme });
}

function renderNextLesson(root, progress, scheduledLesson, course) {
  if (scheduledLesson) {
    const start = calendarDate(scheduledLesson.startAt);
    const end = calendarEndTime(scheduledLesson);
    const date = new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).format(start);
    const time = new Intl.DateTimeFormat("en", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const courseLabel = displayValue(course?.name, "English lesson");
    const lessonType = scheduledLesson.participantType === "group" ? "Group lesson" : "Individual lesson";
    setText(root, "[data-dashboard-next-lesson]", date);
    setText(
      root,
      "[data-dashboard-next-lesson-meta]",
      `${time.format(start)}–${time.format(end)} · ${courseLabel} · ${lessonType}`,
    );
    return;
  }
  const current = progress?.stops.find(({ state }) => state === "current");
  setText(root, "[data-dashboard-next-lesson]", current?.title ?? (progress?.total ? "Unit completed" : "No lesson scheduled"));
  setText(
    root,
    "[data-dashboard-next-lesson-meta]",
    current
      ? `Lesson ${current.number} · ${progress.completed} of ${progress.total} completed`
      : progress?.total
        ? "All lessons in this unit are complete."
        : "Your next lesson will appear here when it is available.",
  );
}

function renderDashboardHomework(root, assignments, units) {
  const container = select(root, "[data-dashboard-homework]");
  const empty = select(root, "[data-dashboard-homework-empty]");
  const active = [...assignments]
    .filter((assignment) => assignment.status !== "completed")
    .sort((first, second) =>
      timestampMillis(second.lessonDate ?? second.createdAt) -
      timestampMillis(first.lessonDate ?? first.createdAt))[0] ?? null;
  container.replaceChildren();
  container.hidden = !active;
  empty.hidden = Boolean(active);
  if (!active) return;

  const item = document.createElement("a");
  const image = document.createElement("img");
  const body = document.createElement("div");
  const title = document.createElement("strong");
  const meta = document.createElement("p");
  const status = createStatusBadge(active.status, HOMEWORK_STATUS_LABELS);
  const unit = units.find((candidate) => candidate.id === active.unitId);
  item.className = "dashboard-homework-item";
  item.href = "#homework";
  item.dataset.studentLink = "homework";
  item.dataset.homeworkId = active.id;
  item.setAttribute("aria-label", `Open homework: ${displayValue(active.title, "Homework")}`);
  image.src = DASHBOARD_ASSETS.homework;
  image.alt = "";
  title.textContent = displayValue(active.title, "Homework");
  meta.textContent = [unit ? unitName(unit) : "", formatDate(active.lessonDate)].filter(Boolean).join(" · ");
  body.append(title);
  if (meta.textContent) body.append(meta);
  item.append(image, body, status);
  container.append(item);
}

function homeworkResourceHost(url) {
  try {
    const resourceUrl = new URL(url, document.baseURI);
    return resourceUrl.origin === window.location.origin ? "Course file" : resourceUrl.hostname;
  } catch {
    return "Learning resource";
  }
}

function createHomeworkResource(resource) {
  const card = document.createElement("article");
  const identity = document.createElement("div");
  const type = document.createElement("span");
  const title = document.createElement("strong");
  const source = document.createElement("small");
  const link = document.createElement("a");
  card.className = "homework-resource-card";
  card.dataset.resourceType = resource.type;
  type.className = "homework-resource-card__type";
  type.textContent = resource.type === "pdf" ? "PDF" : "WEB";
  title.textContent = resource.title;
  source.textContent = homeworkResourceHost(resource.url);
  identity.append(title, source);
  link.href = resource.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = resource.type === "pdf" ? "Open PDF" : "Open link";
  card.append(type, identity, link);

  if (resource.type === "pdf") {
    const preview = document.createElement("iframe");
    preview.src = resource.url;
    preview.title = `${resource.title} PDF preview`;
    preview.loading = "lazy";
    preview.referrerPolicy = "no-referrer";
    card.append(preview);
  }
  return card;
}

function createHomeworkAssignment(assignment, units) {
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const identity = document.createElement("div");
  const title = document.createElement("strong");
  const meta = document.createElement("span");
  const content = document.createElement("div");
  const instructions = document.createElement("section");
  const instructionsHeading = document.createElement("h3");
  const instructionsText = document.createElement("p");
  const unit = units.find((candidate) => candidate.id === assignment.unitId);
  const resources = normalizeHomeworkResources(assignment.resources);
  const assignedDate = formatDate(assignment.lessonDate ?? assignment.createdAt);
  const dueDate = formatDate(assignment.dueDate);
  details.className = "homework-assignment-card";
  details.dataset.homeworkAssignment = assignment.id;
  appendTextWithLinks(title, displayValue(assignment.title, "Homework"));
  meta.textContent = [unit ? unitName(unit) : "Independent learning", assignedDate ? `Assigned ${assignedDate}` : ""]
    .filter(Boolean).join(" · ");
  identity.append(title, meta);
  summary.append(identity, createStatusBadge(assignment.status, HOMEWORK_STATUS_LABELS));
  instructionsHeading.textContent = "What to do";
  appendTextWithLinks(instructionsText, displayValue(
    assignment.description,
    "No additional instructions were added. Ask your teacher if anything is unclear.",
  ));
  instructions.append(instructionsHeading, instructionsText);
  content.className = "homework-assignment-card__content";
  content.append(instructions);

  if (dueDate) {
    const deadline = document.createElement("p");
    const deadlineLabel = document.createElement("strong");
    const deadlineValue = document.createElement("span");
    deadline.className = "homework-assignment-card__deadline";
    deadlineLabel.textContent = "Due date";
    deadlineValue.textContent = dueDate;
    deadline.append(deadlineLabel, deadlineValue);
    content.append(deadline);
  }

  if (resources.length > 0) {
    const resourcesSection = document.createElement("section");
    const resourcesHeading = document.createElement("h3");
    const resourceList = document.createElement("div");
    resourcesHeading.textContent = "Resources";
    resourceList.className = "homework-resource-list";
    resourceList.append(...resources.map(createHomeworkResource));
    resourcesSection.append(resourcesHeading, resourceList);
    content.append(resourcesSection);
  }

  details.append(summary, content);
  return details;
}

function renderHomeworkPage(root, assignments, units) {
  const container = select(root, "[data-homework-assignment-list]");
  const empty = select(root, "[data-homework-assignment-empty]");
  const ordered = [...assignments].sort((first, second) => {
    const firstComplete = first.status === "completed" ? 1 : 0;
    const secondComplete = second.status === "completed" ? 1 : 0;
    if (firstComplete !== secondComplete) return firstComplete - secondComplete;
    return timestampMillis(second.lessonDate ?? second.createdAt)
      - timestampMillis(first.lessonDate ?? first.createdAt);
  });
  container.replaceChildren(...ordered.map((assignment) => createHomeworkAssignment(assignment, units)));
  container.hidden = ordered.length === 0;
  empty.hidden = ordered.length > 0;
}

function createAchievementMarker(achievement) {
  const marker = document.createElement("span");
  const source = validImageSource(achievement.icon) || DASHBOARD_ASSETS.achievement;
  marker.className = "achievement-marker";
  const image = document.createElement("img");
  image.src = source;
  image.alt = "";
  image.addEventListener("error", () => { image.src = DASHBOARD_ASSETS.achievement; }, { once: true });
  marker.append(image);
  return marker;
}

function createAchievementPreviewItem(achievement) {
  const item = document.createElement("li");
  const text = document.createElement("span");
  const title = document.createElement("strong");
  const detail = document.createElement("small");
  const description = document.createElement("p");
  title.textContent = displayValue(achievement.title, "Achievement");
  detail.textContent = formatDate(achievement.earnedAt) || displayValue(achievement.type, "Milestone");
  description.textContent = displayValue(achievement.description, "A meaningful step in your learning journey.");
  text.append(title, description, detail);
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

  preview.replaceChildren(...sorted.slice(0, 1).map(createAchievementPreviewItem));
  preview.hidden = sorted.length === 0;
  previewEmpty.hidden = sorted.length > 0;
  list.replaceChildren(...sorted.map(createAchievementCard));
  list.hidden = sorted.length === 0;
  empty.hidden = sorted.length > 0;
  setText(root, "[data-achievement-count]", String(sorted.length));
}

function createFeedbackSection(title, text) {
  const section = document.createElement("section");
  const heading = document.createElement("h4");
  const content = document.createElement("p");
  heading.textContent = title;
  content.textContent = displayValue(text);
  section.append(heading, content);
  return section;
}

function createFeedbackCard(feedback) {
  const card = document.createElement("article");
  const avatar = document.createElement("span");
  const body = document.createElement("div");
  const excerpt = document.createElement("p");
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  const full = document.createElement("div");
  const published = document.createElement("small");
  const content = feedback.content ?? {};
  const previewText = [content.message, content.whatWentWell, content.whatToPractise, content.nextStep]
    .find((value) => typeof value === "string" && value.trim());
  card.className = "dashboard-feedback-item";
  avatar.className = "dashboard-teacher-avatar";
  avatar.textContent = "T";
  avatar.setAttribute("aria-label", "Teacher");
  excerpt.textContent = displayValue(previewText, "Your teacher has shared new feedback.");
  published.textContent = formatDate(feedback.publishedAt);
  summary.textContent = "Read feedback →";
  const sections = [
    ["What went well", content.whatWentWell],
    ["Next focus", content.whatToPractise],
    ["Next step", content.nextStep],
    ["Message from your teacher", content.message],
  ].filter(([, value]) => typeof value === "string" && value.trim())
    .map(([title, value]) => createFeedbackSection(title, value));
  full.append(...sections);
  details.append(summary, full);
  body.append(excerpt);
  if (published.textContent) body.append(published);
  body.append(details);
  card.append(avatar, body);
  return card;
}

function renderFeedback(root, feedbackVersions) {
  const list = select(root, "[data-student-feedback-list]");
  const empty = select(root, "[data-student-feedback-empty]");
  const sorted = [...feedbackVersions].sort(
    (first, second) => timestampMillis(second.publishedAt) - timestampMillis(first.publishedAt),
  );
  list.replaceChildren(...sorted.slice(0, 1).map(createFeedbackCard));
  list.hidden = sorted.length === 0;
  empty.hidden = sorted.length > 0;
}

function createUnitCard(unit, homeworkAssignments, journey, isCurrent) {
  const card = document.createElement("article");
  const number = document.createElement("span");
  const title = document.createElement("h4");
  const value = document.createElement("strong");
  const homework = homeworkAssignments.filter((item) => item.unitId === unit.id);
  const completedHomework = homework.filter((item) => item.status === "completed").length;
  const physical = physicalProgress(unit, journey, []);
  card.dataset.unitState = isCurrent
    ? physical.percent === 100 ? "complete" : "current"
    : physical.percent === 100 ? "complete" : "upcoming";

  number.textContent = unit.number ? `Unit ${unit.number}` : "Unit";
  title.textContent = unitName(unit);
  value.textContent = journey?.unitId === unit.id
    ? `${physical.completed} of ${physical.total} lessons · ${physical.percent}% complete`
    : "Not started";
  card.append(number, title, value);
  if (homework.length > 0) {
    const habits = document.createElement("small");
    habits.textContent = `Homework: ${completedHomework} of ${homework.length} completed`;
    card.append(habits);
  }
  return card;
}

function renderUnits(root, units, homeworkAssignments, student) {
  const container = select(root, "[data-unit-progress]");
  const empty = select(root, "[data-unit-progress-empty]");
  container.replaceChildren(...units.map((unit) => {
    const journey = student.unitJourneys?.[unit.id]
      ?? (student.courseJourney?.unitId === unit.id ? student.courseJourney : null);
    return createUnitCard(unit, homeworkAssignments, journey, student.courseJourney?.unitId === unit.id);
  }));
  container.hidden = units.length === 0;
  empty.hidden = units.length > 0;
}

function createStatusBadge(status, labels = OBJECTIVE_STATUS_LABELS, emptyAsDash = false) {
  const badge = document.createElement("span");
  badge.className = "learning-status-badge";
  badge.dataset.status = status;
  badge.textContent = emptyAsDash && status === "not_assessed" ? "—" : labels[status] ?? "Not assessed";
  return badge;
}

function createUnitDetails(unit, progressDocuments, homeworkAssignments, journey, theme) {
  const card = document.createElement("details");
  const summary = document.createElement("summary");
  const title = document.createElement("strong");
  const progressMap = progressByObjective(progressDocuments);
  const objectives = learningObjectivesForUnit(unit).filter((objective) => progressMap.has(objective.id));
  const physical = physicalProgress(unit, journey, []);
  title.textContent = unitName(unit);
  const physicalLabel = document.createElement("span");
  physicalLabel.className = "student-unit-physical-progress";
  physicalLabel.textContent = journey?.unitId === unit.id
    ? `${physical.completed} of ${physical.total} lessons · ${physical.percent}%`
    : "Not started";
  summary.append(title, physicalLabel);
  card.className = "student-objective-unit";
  card.append(summary);

  const journeyMap = document.createElement("div");
  journeyMap.className = "student-objective-journey";
  journeyMap.setAttribute("aria-label", `${unitName(unit)} course journey`);
  renderCourseJourneyMap(journeyMap, {
    unit,
    journey,
    theme,
    showCurrent: Boolean(journey),
  });
  card.append(journeyMap);
  if (objectives.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No learning targets have been assessed in this unit yet.";
    card.append(empty);
  } else {
    LANGUAGE_SKILL_CATEGORIES.forEach((category) => {
      const categoryObjectives = objectives.filter((objective) => objective.category === category);
      if (!categoryObjectives.length) return;
      const section = document.createElement("section");
      const heading = document.createElement("h4");
      const list = document.createElement("ul");
      heading.textContent = LANGUAGE_SKILL_LABELS[category];
      categoryObjectives.forEach((objective) => {
        const item = document.createElement("li");
        const objectiveTitle = document.createElement("span");
        objectiveTitle.textContent = objective.title;
        item.append(objectiveTitle, createStatusBadge(progressMap.get(objective.id)?.status ?? "not_assessed"));
        list.append(item);
      });
      section.append(heading, list);
      card.append(section);
    });
  }
  const homeworkSection = document.createElement("section");
  const homeworkHeading = document.createElement("h4");
  const homework = homeworkAssignments.filter((item) => item.unitId === unit.id);
  homeworkHeading.textContent = "Learning habits — Homework";
  homeworkSection.className = "student-homework-section";
  homeworkSection.append(homeworkHeading);
  if (!homework.length) {
    const empty = document.createElement("p");
    empty.textContent = "No homework assigned.";
    homeworkSection.append(empty);
  } else {
    const list = document.createElement("ul");
    homework.forEach((assignment) => {
      const item = document.createElement("li");
      const assignmentTitle = document.createElement("span");
      appendTextWithLinks(assignmentTitle, assignment.title || "Homework");
      item.append(assignmentTitle, createStatusBadge(assignment.status, HOMEWORK_STATUS_LABELS));
      list.append(item);
    });
    homeworkSection.append(list);
  }
  card.append(homeworkSection);
  return card;
}

function createIndependentDetails(progressDocuments, homeworkAssignments) {
  const card = document.createElement("details");
  const summary = document.createElement("summary");
  const title = document.createElement("strong");
  title.textContent = "Independent learning";
  summary.append(title, createStatusBadge(aggregateObjectiveStatus(progressDocuments), OBJECTIVE_STATUS_LABELS, true));
  card.className = "student-objective-unit";
  card.open = true;
  card.append(summary);
  LANGUAGE_SKILL_CATEGORIES.forEach((category) => {
    const documents = progressDocuments.filter((item) => item.category === category);
    if (!documents.length) return;
    const section = document.createElement("section");
    const heading = document.createElement("h4");
    const list = document.createElement("ul");
    heading.textContent = LANGUAGE_SKILL_LABELS[category];
    documents.forEach((document) => {
      const item = document.createElement("li");
      const objectiveTitle = document.createElement("span");
      objectiveTitle.textContent = document.objectiveTitle || "Learning objective";
      item.append(objectiveTitle, createStatusBadge(document.status ?? "not_assessed"));
      list.append(item);
    });
    section.append(heading, list);
    card.append(section);
  });
  const independentHomework = homeworkAssignments.filter((item) =>
    item.scope === "independent" || !item.unitId);
  if (independentHomework.length) {
    const section = document.createElement("section");
    const heading = document.createElement("h4");
    const list = document.createElement("ul");
    heading.textContent = "Learning habits — Homework";
    independentHomework.forEach((assignment) => {
      const item = document.createElement("li");
      const title = document.createElement("span");
      appendTextWithLinks(title, assignment.title || "Homework");
      item.append(title, createStatusBadge(assignment.status, HOMEWORK_STATUS_LABELS));
      list.append(item);
    });
    section.append(heading, list);
    card.append(section);
  }
  return card;
}

function renderProgressMatrix(root, units, progressDocuments, homeworkAssignments, student, theme) {
  const container = select(root, "[data-student-progress-matrix]");
  const empty = select(root, "[data-student-progress-empty]");
  container.replaceChildren();

  const independentProgress = progressDocuments.filter(isIndependentProgressEntry);
  if (units.length === 0 && independentProgress.length === 0) {
    container.hidden = true;
    empty.hidden = false;
    return;
  }
  container.append(...units.map((unit) => createUnitDetails(
    unit,
    progressDocuments,
    homeworkAssignments,
    student.unitJourneys?.[unit.id]
      ?? (student.courseJourney?.unitId === unit.id ? student.courseJourney : null),
    theme,
  )));
  if (independentProgress.length) {
    container.append(createIndependentDetails(independentProgress, homeworkAssignments));
  }
  container.hidden = false;
  empty.hidden = true;
}

function renderStudentReadingMap(root, course, units, progressDocuments, theme) {
  const enabled = course?.readingMapEnabled === true;
  const link = select(root, "[data-student-reading-link]");
  const container = select(root, "[data-student-reading-map]");
  const summary = select(root, "[data-student-reading-summary]");
  const empty = select(root, "[data-student-reading-empty]");
  link.hidden = !enabled;
  if (!enabled) {
    container.replaceChildren();
    summary.replaceChildren();
    empty.hidden = true;
    return;
  }
  const map = renderReadingMap(container, { units, progressDocuments, theme });
  renderReadingMapSummary(summary, map);
  const hasSounds = map.length > 0;
  container.hidden = !hasSounds;
  summary.hidden = !hasSounds;
  empty.hidden = hasSounds;
}

function renderStudent(root, data) {
  const { student, course, units, objectiveProgress, homeworkAssignments, goals, achievements, feedbackVersions, scheduleEntries } = data;
  const name = displayValue(student.name, "Student");
  const courseName = displayValue(course?.name, "Independent learning");
  const independentProgress = objectiveProgress.filter(isIndependentProgressEntry);
  const skillSummaries = calculateSkillSummaries(units, objectiveProgress);
  const overall = units.length
    ? overallObjectiveStatus(objectiveProgress, units)
    : aggregateObjectiveStatus(independentProgress);
  const strongest = units.length
    ? strongestObjectiveCategory(units, objectiveProgress)
    : [...skillSummaries].filter(({ average }) => average !== null)
      .sort((first, second) => second.average - first.average)[0] ?? null;
  const currentGoal = activeGoal(goals);
  const currentUnit = dashboardCurrentUnit(units, student.courseJourney);
  const averages = skillSummaries;

  const theme = applyStudentTheme(root, student.visualTheme);
  if (typeof student.color === "string" && globalThis.CSS?.supports?.("color", student.color)) {
    root.style.setProperty("--student-accent", student.color);
  }
  renderStudentAvatar(root, student);
  renderCourseArt(root, course);

  setText(root, "[data-student-name]", name);
  setText(root, "[data-student-account-name]", name);
  setText(root, "[data-student-course]", courseName);
  setText(
    root,
    "[data-dashboard-current-unit]",
    currentUnit
      ? `${currentUnit.number ? `Unit ${currentUnit.number} · ` : ""}${unitName(currentUnit)}`
      : student.independentLearning?.currentLearningTargets?.length
        ? "Independent learning"
        : "No learning update yet",
  );
  setText(root, "[data-progress-overall]", summaryStatusLabel(overall));
  setText(root, "[data-progress-course]", courseName);
  setText(
    root,
    "[data-progress-strongest]",
    strongest ? `${LANGUAGE_SKILL_LABELS[strongest.category]} · ${statusLabel(strongest.status)}` : "—",
  );
  setText(root, "[data-student-goal-title]", currentGoal ? displayValue(currentGoal.title) : "No active goal");
  setText(
    root,
    "[data-student-goal-status]",
    currentGoal ? goalStatusLabel(currentGoal.status) : "Your next goal will appear here",
  );
  renderSkills(root, "[data-progress-skills]", "[data-progress-skills-empty]", averages);
  renderDashboardLearning(root, currentUnit, objectiveProgress, student.courseJourney, student.independentLearning);
  const physical = renderDashboardJourney(root, currentUnit, student.courseJourney, theme);
  renderNextLesson(root, physical, nextCalendarOccurrence(scheduleEntries), course);
  if (currentUnit && physical?.total) {
    setText(
      root,
      "[data-dashboard-current-unit]",
      `${currentUnit.number ? `Unit ${currentUnit.number} · ` : ""}${unitName(currentUnit)} · ${physical.completed} of ${physical.total} lessons completed`,
    );
  }
  renderDashboardHomework(root, homeworkAssignments, units);
  renderHomeworkPage(root, homeworkAssignments, units);
  renderUnits(root, units, homeworkAssignments, student);
  renderProgressMatrix(root, units, objectiveProgress, homeworkAssignments, student, theme);
  renderStudentReadingMap(root, course, units, objectiveProgress, theme);
  renderAchievements(root, achievements);
  renderFeedback(root, feedbackVersions);
}

async function loadStudentData(studentId) {
  const student = await studentsRepository.getById(studentId);
  if (!student) return null;
  // Group documents are teacher-only. The admin group editor keeps courseId
  // denormalized on every member so the student portal never needs to read a
  // private group record merely to resolve its course.
  const courseId = typeof student.courseId === "string" ? student.courseId.trim() : "";

  const [course, units, objectiveProgress, homeworkAssignments, goals, achievements, feedbackVersions, scheduleEntries] = await Promise.all([
    courseId ? coursesRepository.getById(courseId) : Promise.resolve(null),
    courseId ? unitsRepository.listByCourse(courseId) : Promise.resolve([]),
    objectiveProgressRepository.listByStudent(studentId),
    homeworkAssignmentsRepository.listByStudent(studentId),
    goalsRepository.listVisibleByStudent(studentId),
    achievementsRepository.listByStudent(studentId),
    feedbackVersionsRepository.listPublishedByStudent(studentId),
    studentScheduleEntriesRepository.listByStudent(studentId),
  ]);
  return { student, course, units, objectiveProgress, homeworkAssignments, goals, achievements, feedbackVersions, scheduleEntries };
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

function initializeSidebar(root) {
  const sidebar = select(root, "[data-student-sidebar]");
  const toggle = select(root, "[data-student-menu-toggle]");
  const close = select(root, "[data-student-sidebar-close]");
  const overlay = select(root, "[data-student-sidebar-overlay]");

  function setOpen(isOpen) {
    sidebar.classList.toggle("is-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    overlay.hidden = !isOpen;
    document.body.classList.toggle("student-menu-open", isOpen);
  }

  toggle.addEventListener("click", () => setOpen(!sidebar.classList.contains("is-open")));
  close.addEventListener("click", () => setOpen(false));
  overlay.addEventListener("click", () => setOpen(false));
  sidebar.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("a")) setOpen(false);
  });
  selectAll(root, "[data-student-unavailable]").forEach((link) => {
    link.title = "This section is not available yet";
    link.addEventListener("click", (event) => event.preventDefault());
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}

function initializeAccountMenu(root) {
  const account = select(root, "[data-student-account]");
  const toggle = select(root, "[data-student-account-toggle]");
  const menu = select(root, "[data-student-account-menu]");

  function setOpen(isOpen) {
    menu.hidden = !isOpen;
    toggle.setAttribute("aria-expanded", String(isOpen));
    account.classList.toggle("is-open", isOpen);
  }

  toggle.addEventListener("click", () => setOpen(menu.hidden));
  menu.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a, button")) setOpen(false);
  });
  document.addEventListener("click", (event) => {
    if (!account.contains(event.target)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setOpen(false);
      toggle.focus();
    }
  });
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
    if (sectionName === "homework" && link.dataset.homeworkId) {
      const assignment = select(
        root,
        `[data-homework-assignment="${CSS.escape(link.dataset.homeworkId)}"]`,
      );
      if (assignment) {
        assignment.open = true;
        requestAnimationFrame(() => assignment.scrollIntoView({ behavior: "smooth", block: "start" }));
      }
    }
  });
  window.addEventListener("popstate", () => activateSection(root, sectionFromHash()));
  activateSection(root, sectionFromHash());
}

export async function initializeStudentView(session) {
  const root = document.querySelector("[data-protected-content]");
  const state = select(root, "[data-student-state]");
  const content = select(root, "[data-student-content]");
  const studentId = session.profile.studentId;

  initializeSidebar(root);
  initializeAccountMenu(root);
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
