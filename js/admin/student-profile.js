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
import { unitsRepository } from "../data/repositories/units-repository.js";
import {
  ACTIVE_GOAL_STATUSES,
  FEEDBACK_STATUS_LABELS,
  HOMEWORK_STATUSES,
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
} from "../domain/learning-objectives.js";
import { normalizeHomeworkResources } from "../domain/homework.js";
import { isIndependentProgressEntry } from "../domain/independent-learning.js";
import { lessonStopsForUnit } from "../domain/physical-progress.js";
import {
  cumulativeUnitTargets,
  unitPhysicalProgressFromHistory,
} from "../domain/progress-display.js?v=20260827-profile-hotfix";
import { renderCourseJourneyMap } from "../ui/course-journey-map.js?v=20260828-route-decor";
import {
  renderReadingMap,
  renderReadingMapSummary,
} from "../ui/reading-map.js";
import { configureQuickUpdate } from "./quick-update.js?v=20260827-homework-details";
import { configureProgressUpdateEditor } from "./progress-update-editor.js?v=20260827-profile-hotfix";
import { configureStudentAccess } from "./student-access.js";
import { closeDialog, showDialog } from "./crud-helpers.js";

let activeRequestId = 0;
let homeworkEditorAssignments = [];
let homeworkEditorOnSaved = null;
let editingHomeworkId = "";
let homeworkEditorElements = null;
const PROFILE_LIST_PREVIEW_LIMIT = 3;

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

function timestampMillis(timestamp) {
  return timestampToDate(timestamp)?.getTime() ?? 0;
}

function dateInputValue(timestamp) {
  const date = timestampToDate(timestamp);
  if (!date) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateFromInput(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return year && month && day
    && date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? date
    : null;
}

function setProfileState(root, message) {
  const state = select(root, "[data-profile-state]");
  state.textContent = message;
  state.hidden = false;
  select(root, "[data-profile-content]").hidden = true;
}

function configureProfileFeature(label, callback) {
  try {
    callback();
  } catch (error) {
    console.error(`Unable to initialize ${label}.`, error);
  }
}

function renderProfilePart(label, callback, warnings) {
  try {
    callback();
  } catch (error) {
    console.error(`Unable to render ${label}.`, error);
    warnings.push(label);
  }
}

async function loadProfilePart(label, operation, fallback, warnings) {
  try {
    return await operation;
  } catch (error) {
    console.error(`Unable to load ${label}.`, error);
    warnings.push(label);
    return fallback;
  }
}

function createObjectiveItem(objective, progressMap) {
  const item = document.createElement("li");
  const title = document.createElement("span");
  const progress = progressMap.get(objective.id);
  title.textContent = objective.title;
  if (progress?.status) {
    item.append(title, statusBadge(progress.status));
  } else {
    const workedOn = document.createElement("span");
    workedOn.className = "learning-status-badge learning-status-badge--worked-on";
    workedOn.textContent = "Worked on";
    item.append(title, workedOn);
  }
  return item;
}

function physicalProgressBadge(progress) {
  const badge = document.createElement("span");
  const lessons = document.createElement("span");
  const percent = document.createElement("strong");
  badge.className = "unit-physical-progress";
  lessons.textContent = progress.total
    ? `${progress.completed} of ${progress.total} lessons`
    : "No lessons yet";
  percent.textContent = `${progress.percent}%`;
  badge.append(lessons, percent);
  return badge;
}

function addCompactRecordsToggle(container, items, { allLabel, fewerLabel }) {
  if (items.length <= PROFILE_LIST_PREVIEW_LIMIT) return;
  let expanded = false;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "profile-list-toggle profile-record-list__toggle";
  const syncVisibility = () => {
    items.forEach((item, index) => {
      item.hidden = !expanded && index >= PROFILE_LIST_PREVIEW_LIMIT;
    });
    toggle.textContent = expanded
      ? fewerLabel
      : `${allLabel} (${items.length})`;
    toggle.setAttribute("aria-expanded", String(expanded));
  };
  toggle.addEventListener("click", () => {
    expanded = !expanded;
    syncVisibility();
  });
  syncVisibility();
  container.append(toggle);
}

function feedbackExcerpt(feedback) {
  const content = feedback.content ?? {};
  const value = [content.message, content.whatWentWell, content.whatToPractise, content.nextStep]
    .find((part) => typeof part === "string" && part.trim());
  if (!value) return "No feedback text yet.";
  const text = value.trim();
  return text.length > 170 ? `${text.slice(0, 167).trimEnd()}...` : text;
}

function renderProfileFeedback(root, feedbackDrafts, units, lessons) {
  const container = select(root, "[data-profile-feedback-list]");
  const empty = select(root, "[data-profile-feedback-empty]");
  const unitNames = new Map(units.map((unit) => [unit.id, unitName(unit)]));
  const lessonNames = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
  const sorted = [...feedbackDrafts].sort((first, second) =>
    timestampMillis(second.updatedAt ?? second.publishedAt ?? second.createdAt)
    - timestampMillis(first.updatedAt ?? first.publishedAt ?? first.createdAt));
  const cards = sorted.map((feedback) => {
    const card = document.createElement("article");
    const heading = document.createElement("header");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    const excerpt = document.createElement("p");
    title.textContent = lessonNames.get(feedback.lessonId)
      || unitNames.get(feedback.unitId)
      || "Student feedback";
    meta.textContent = [
      unitNames.get(feedback.unitId),
      formatDate(feedback.updatedAt ?? feedback.publishedAt ?? feedback.createdAt),
    ].filter(Boolean).join(" · ");
    excerpt.textContent = feedbackExcerpt(feedback);
    heading.append(title, statusBadge(feedback.status ?? "draft", FEEDBACK_STATUS_LABELS));
    card.className = "profile-record-card";
    card.append(heading);
    if (meta.textContent) card.append(meta);
    card.append(excerpt);
    if (feedback.progressHistoryId) {
      const edit = document.createElement("button");
      edit.type = "button";
      edit.dataset.editProgressUpdate = feedback.progressHistoryId;
      edit.textContent = "Edit feedback";
      card.append(edit);
    }
    return card;
  });
  container.replaceChildren(...cards);
  empty.hidden = cards.length > 0;
  addCompactRecordsToggle(container, cards, {
    allLabel: "Show all feedback",
    fewerLabel: "Show less feedback",
  });
}

function renderProfileHomework(root, assignments, units) {
  const container = select(root, "[data-profile-homework-list]");
  const empty = select(root, "[data-profile-homework-empty]");
  const unitNames = new Map(units.map((unit) => [unit.id, unitName(unit)]));
  const sorted = [...assignments].sort((first, second) =>
    timestampMillis(second.lessonDate ?? second.createdAt)
    - timestampMillis(first.lessonDate ?? first.createdAt));
  const cards = sorted.map((assignment) => {
    const card = document.createElement("article");
    const heading = document.createElement("header");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    const actions = document.createElement("footer");
    const edit = document.createElement("button");
    title.textContent = assignment.title || "Homework";
    meta.textContent = [
      unitNames.get(assignment.unitId) || (assignment.scope === "independent" ? "Independent learning" : ""),
      assignment.dueDate ? `Due ${formatDate(assignment.dueDate)}` : "",
    ].filter(Boolean).join(" · ");
    heading.append(title, statusBadge(assignment.status, HOMEWORK_STATUS_LABELS));
    edit.type = "button";
    edit.className = "homework-edit-action";
    edit.dataset.editHomework = assignment.id;
    edit.textContent = "Edit homework";
    actions.append(edit);
    card.className = "profile-record-card";
    card.append(heading);
    if (meta.textContent) card.append(meta);
    if (assignment.description) {
      const description = document.createElement("p");
      description.textContent = assignment.description;
      card.append(description);
    }
    card.append(actions);
    return card;
  });
  container.replaceChildren(...cards);
  empty.hidden = cards.length > 0;
  addCompactRecordsToggle(container, cards, {
    allLabel: "Show all homework",
    fewerLabel: "Show less homework",
  });
}

function createHomeworkResourceRow(resource = {}) {
  const row = document.createElement("div");
  const title = document.createElement("input");
  const url = document.createElement("input");
  const type = document.createElement("select");
  const remove = document.createElement("button");
  row.className = "homework-resource-editor__row";
  row.dataset.homeworkResourceRow = "";
  title.type = "text";
  title.placeholder = "Resource title";
  title.value = resource.title ?? "";
  title.dataset.homeworkResourceTitle = "";
  title.setAttribute("aria-label", "Homework resource title");
  url.type = "text";
  url.inputMode = "url";
  url.placeholder = "https://… or ./assets/materials/homework/file.pdf";
  url.value = resource.url ?? "";
  url.dataset.homeworkResourceUrl = "";
  url.setAttribute("aria-label", "Homework resource URL or PDF path");
  type.append(
    Object.assign(document.createElement("option"), { value: "", textContent: "Detect type" }),
    Object.assign(document.createElement("option"), { value: "pdf", textContent: "PDF" }),
    Object.assign(document.createElement("option"), { value: "link", textContent: "Website" }),
  );
  type.value = resource.type ?? "";
  type.dataset.homeworkResourceType = "";
  type.setAttribute("aria-label", "Homework resource type");
  remove.type = "button";
  remove.dataset.homeworkResourceRemove = "";
  remove.textContent = "Remove";
  row.append(title, url, type, remove);
  return row;
}

function syncHomeworkResourceEditor() {
  const rows = homeworkEditorElements?.resources.querySelectorAll("[data-homework-resource-row]") ?? [];
  homeworkEditorElements.addResource.disabled = rows.length >= 5;
  rows.forEach((row) => {
    row.querySelector("[data-homework-resource-remove]").disabled = rows.length === 1;
  });
}

function openHomeworkEditor(assignmentId) {
  const assignment = homeworkEditorAssignments.find(({ id }) => id === assignmentId);
  if (!assignment || !homeworkEditorElements) return;
  editingHomeworkId = assignment.id;
  homeworkEditorElements.form.reset();
  homeworkEditorElements.context.textContent = assignment.title || "Homework";
  homeworkEditorElements.title.value = assignment.title ?? "";
  homeworkEditorElements.description.value = assignment.description ?? "";
  homeworkEditorElements.dueDate.value = dateInputValue(assignment.dueDate);
  homeworkEditorElements.status.value = HOMEWORK_STATUSES.includes(assignment.status)
    ? assignment.status
    : "assigned";
  const resources = Array.isArray(assignment.resources) && assignment.resources.length
    ? assignment.resources.slice(0, 5)
    : [{}];
  homeworkEditorElements.resources.replaceChildren(...resources.map(createHomeworkResourceRow));
  homeworkEditorElements.message.textContent = "";
  homeworkEditorElements.save.disabled = false;
  syncHomeworkResourceEditor();
  showDialog(homeworkEditorElements.dialog);
}

async function saveHomework(event) {
  event.preventDefault();
  const assignment = homeworkEditorAssignments.find(({ id }) => id === editingHomeworkId);
  if (!assignment) return;
  const title = homeworkEditorElements.title.value.trim();
  const status = homeworkEditorElements.status.value;
  const dueDate = homeworkEditorElements.dueDate.value
    ? dateFromInput(homeworkEditorElements.dueDate.value)
    : null;
  const enteredResources = [...homeworkEditorElements.resources.querySelectorAll("[data-homework-resource-row]")]
    .map((row) => ({
      title: row.querySelector("[data-homework-resource-title]").value,
      url: row.querySelector("[data-homework-resource-url]").value,
      type: row.querySelector("[data-homework-resource-type]").value,
    }))
    .filter(({ title: resourceTitle, url }) => resourceTitle.trim() || url.trim());
  const resources = normalizeHomeworkResources(enteredResources);
  if (!title) {
    homeworkEditorElements.message.textContent = "Enter a homework title.";
    return;
  }
  if (!HOMEWORK_STATUSES.includes(status)) {
    homeworkEditorElements.message.textContent = "Select a valid homework status.";
    return;
  }
  if (homeworkEditorElements.dueDate.value && !dueDate) {
    homeworkEditorElements.message.textContent = "Select a valid due date.";
    return;
  }
  if (resources.length !== enteredResources.length) {
    homeworkEditorElements.message.textContent = "Every resource needs a valid HTTPS link or homework PDF path.";
    return;
  }
  homeworkEditorElements.save.disabled = true;
  homeworkEditorElements.message.textContent = "Saving homework…";
  try {
    await homeworkAssignmentsRepository.update(assignment.id, {
      title,
      description: homeworkEditorElements.description.value.trim(),
      dueDate,
      resources,
      status,
      updatedAt: new Date(),
    });
    closeDialog(homeworkEditorElements.dialog);
    await homeworkEditorOnSaved?.("Homework updated.");
  } catch (error) {
    console.error("Unable to update homework.", error);
    homeworkEditorElements.message.textContent = "Unable to save homework. Please try again.";
  } finally {
    homeworkEditorElements.save.disabled = false;
  }
}

function configureHomeworkEditor(root, assignments, onSaved) {
  homeworkEditorAssignments = assignments;
  homeworkEditorOnSaved = onSaved;
  if (homeworkEditorElements) return;
  const dialog = select(root, "[data-homework-editor-dialog]");
  const form = select(root, "[data-homework-editor-form]");
  homeworkEditorElements = {
    dialog,
    form,
    context: select(root, "[data-homework-editor-context]"),
    title: form.elements.homeworkEditorTitle,
    description: form.elements.homeworkEditorDescription,
    dueDate: form.elements.homeworkEditorDueDate,
    status: form.elements.homeworkEditorStatus,
    resources: select(root, "[data-homework-editor-resources]"),
    addResource: select(root, "[data-homework-resource-add]"),
    message: select(root, "[data-homework-editor-message]"),
    save: select(root, "[data-homework-editor-save]"),
    close: select(root, "[data-homework-editor-close]"),
  };
  root.addEventListener("click", (event) => {
    const edit = event.target instanceof Element ? event.target.closest("[data-edit-homework]") : null;
    if (edit) openHomeworkEditor(edit.dataset.editHomework);
  });
  homeworkEditorElements.addResource.addEventListener("click", () => {
    homeworkEditorElements.resources.append(createHomeworkResourceRow());
    syncHomeworkResourceEditor();
  });
  homeworkEditorElements.resources.addEventListener("click", (event) => {
    const remove = event.target instanceof Element ? event.target.closest("[data-homework-resource-remove]") : null;
    if (!remove) return;
    remove.closest("[data-homework-resource-row]").remove();
    syncHomeworkResourceEditor();
  });
  homeworkEditorElements.close.addEventListener("click", () => closeDialog(dialog));
  form.addEventListener("submit", saveHomework);
}

function createUnitObjectives({
  unit,
  units,
  objectiveProgress,
  progressHistory,
  lessons,
  student,
  onSaved,
}) {
  const card = document.createElement("details");
  const summary = document.createElement("summary");
  const title = document.createElement("strong");
  const objectives = cumulativeUnitTargets(unit, progressHistory);
  const progressMap = progressByObjective(objectiveProgress);
  const physical = unitPhysicalProgressFromHistory({
    unit,
    lessons,
    history: progressHistory,
    studentId: student.id,
    fallbackJourney: student.unitJourneys?.[unit.id]
      ?? (student.courseJourney?.unitId === unit.id ? student.courseJourney : null),
  });
  const storedUnitJourney = student.unitJourneys?.[unit.id]
    ?? (student.courseJourney?.unitId === unit.id ? student.courseJourney : null);
  const manuallyCompleted = storedUnitJourney?.completedManually === true;
  title.textContent = unitName(unit);
  summary.append(title, physicalProgressBadge(physical));
  card.className = "unit-objectives-card";
  card.append(summary);

  const journeyMap = document.createElement("div");
  const displayJourney = {
    ...(storedUnitJourney ?? {}),
    unitId: unit.id,
    completedLessonIds: physical.completedLessonIds,
    currentLessonId: physical.currentLessonId,
    lessonStops: physical.stops,
  };
  journeyMap.className = "unit-objectives-journey";
  journeyMap.setAttribute("aria-label", `${unitName(unit)} course journey`);
  renderCourseJourneyMap(journeyMap, {
    unit,
    journey: displayJourney,
    lessons,
    theme: "adult",
    showCurrent: Boolean(storedUnitJourney) || physical.completed > 0,
  });
  card.append(journeyMap);

  const physicalActions = document.createElement("div");
  const completeUnit = document.createElement("button");
  physicalActions.className = "unit-physical-actions";
  completeUnit.type = "button";
  completeUnit.textContent = manuallyCompleted
    ? "Undo manual completion"
    : physical.percent === 100
      ? "Unit completed"
      : "Complete unit";
  completeUnit.disabled = (!manuallyCompleted && physical.percent === 100) || physical.total === 0;
  completeUnit.addEventListener("click", async () => {
    if (manuallyCompleted) {
      const confirmed = window.confirm(
        `Undo the manual 100% completion for ${unitName(unit)}? Saved lesson updates will remain unchanged.`,
      );
      if (!confirmed) return;
      const recordedPhysical = unitPhysicalProgressFromHistory({
        unit,
        lessons,
        history: progressHistory,
        studentId: student.id,
        fallbackJourney: null,
      });
      const restoredJourney = {
        courseId: unit.courseId ?? student.courseId ?? "",
        unitId: unit.id,
        completedLessonIds: recordedPhysical.completedLessonIds,
        currentLessonId: recordedPhysical.currentLessonId,
        lessonStops: lessonStopsForUnit(unit, lessons),
        currentLearningTargets: storedUnitJourney?.currentLearningTargets ?? [],
        completedManually: false,
        updatedAt: new Date(),
      };
      completeUnit.disabled = true;
      completeUnit.textContent = "Restoring…";
      try {
        const changes = { [`unitJourneys.${unit.id}`]: restoredJourney };
        if (student.courseJourney?.unitId === unit.id) changes.courseJourney = restoredJourney;
        await studentsRepository.update(student.id, changes);
        await onSaved(`${unitName(unit)} restored to its saved lesson progress.`);
      } catch (error) {
        console.error("Unable to undo the manual unit completion.", error);
        completeUnit.disabled = false;
        completeUnit.textContent = "Undo manual completion";
        window.alert("Unable to restore the unit progress. Please try again.");
      }
      return;
    }
    const confirmed = window.confirm(
      `Mark all ${physical.total} lessons in ${unitName(unit)} as completed? Learning-target statuses will not change.`,
    );
    if (!confirmed) return;
    const stops = lessonStopsForUnit(unit, lessons);
    const completedJourney = {
      courseId: unit.courseId ?? student.courseId ?? "",
      unitId: unit.id,
      completedLessonIds: stops.map(({ id }) => id),
      currentLessonId: "",
      lessonStops: stops,
      completedManually: true,
      updatedAt: new Date(),
    };
    completeUnit.disabled = true;
    completeUnit.textContent = "Completing…";
    try {
      const changes = {
        [`unitJourneys.${unit.id}`]: completedJourney,
      };
      if (!student.courseJourney?.unitId || student.courseJourney.unitId === unit.id) {
        const orderedUnits = [...units].sort((first, second) =>
          (first.order ?? first.number ?? 0) - (second.order ?? second.number ?? 0));
        const currentIndex = orderedUnits.findIndex(({ id }) => id === unit.id);
        const nextUnit = currentIndex >= 0 ? orderedUnits[currentIndex + 1] : null;
        if (nextUnit) {
          const nextStops = lessonStopsForUnit(nextUnit, lessons);
          changes.courseJourney = {
            courseId: nextUnit.courseId ?? student.courseId ?? "",
            unitId: nextUnit.id,
            completedLessonIds: [],
            currentLessonId: nextStops[0]?.id ?? "",
            lessonStops: nextStops,
            updatedAt: new Date(),
          };
        } else {
          changes.courseJourney = completedJourney;
        }
      }
      await studentsRepository.update(student.id, changes);
      await onSaved(`${unitName(unit)} marked 100% complete. Learning statuses were not changed.`);
    } catch (error) {
      console.error("Unable to complete the unit.", error);
      completeUnit.disabled = false;
      completeUnit.textContent = "Complete unit";
      window.alert("Unable to complete the unit. Please try again.");
    }
  });
  physicalActions.append(completeUnit);
  card.append(physicalActions);

  if (objectives.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No learning targets have been recorded for this student yet.";
    card.append(empty);
  } else {
    const skillsGrid = document.createElement("div");
    skillsGrid.className = "unit-objectives-grid";
    LANGUAGE_SKILL_CATEGORIES.forEach((category) => {
      const categoryObjectives = objectives.filter((objective) => objective.category === category);
      if (categoryObjectives.length === 0) return;
      const section = document.createElement("section");
      const heading = document.createElement("h4");
      const list = document.createElement("ul");
      heading.textContent = LANGUAGE_SKILL_LABELS[category];
      list.append(...categoryObjectives.map((objective) => createObjectiveItem(objective, progressMap)));
      section.append(heading, list);
      skillsGrid.append(section);
    });
    card.append(skillsGrid);
  }
  return card;
}

function createIndependentObjectives(objectiveProgress) {
  const card = document.createElement("details");
  const summary = document.createElement("summary");
  const title = document.createElement("strong");
  title.textContent = "Independent learning";
  summary.append(title, statusBadge(aggregateObjectiveStatus(objectiveProgress), OBJECTIVE_STATUS_LABELS, true));
  card.className = "unit-objectives-card";
  card.open = true;
  card.append(summary);
  const skillsGrid = document.createElement("div");
  skillsGrid.className = "unit-objectives-grid";
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
    skillsGrid.append(section);
  });
  card.append(skillsGrid);
  return card;
}

function renderLearningObjectives(
  root,
  units,
  objectiveProgress,
  progressHistory,
  lessons,
  student,
  onSaved,
) {
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
  const unitCards = units.map((unit) => createUnitObjectives({
    unit,
    units,
    objectiveProgress,
    progressHistory,
    lessons,
    student,
    onSaved,
  }));
  container.append(...unitCards);
  if (independentProgress.length) {
    container.append(createIndependentObjectives(independentProgress));
  }
  if (unitCards.length > PROFILE_LIST_PREVIEW_LIMIT) {
    let expanded = false;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "profile-list-toggle";
    toggle.dataset.unitsVisibilityToggle = "";
    const syncVisibility = () => {
      unitCards.forEach((card, index) => {
        card.hidden = !expanded && index >= PROFILE_LIST_PREVIEW_LIMIT;
      });
      toggle.textContent = expanded
        ? "Show fewer units"
        : `Show all units (${unitCards.length})`;
      toggle.setAttribute("aria-expanded", String(expanded));
    };
    toggle.addEventListener("click", () => {
      expanded = !expanded;
      syncVisibility();
    });
    syncVisibility();
    container.append(toggle);
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

function renderProfileReadingMap(root, course, units, objectiveProgress, student) {
  const section = select(root, "[data-profile-reading-map-section]");
  const container = select(root, "[data-profile-reading-map]");
  const summary = select(root, "[data-profile-reading-map-summary]");
  if (course?.readingMapEnabled !== true) {
    section.hidden = true;
    container.replaceChildren();
    summary.replaceChildren();
    return;
  }
  const map = renderReadingMap(container, {
    units,
    progressDocuments: objectiveProgress,
    theme: student?.visualTheme === "child" ? "child" : "adult",
  });
  section.hidden = map.length === 0;
  if (map.length) renderReadingMapSummary(summary, map);
  else summary.replaceChildren();
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

function renderAssessmentHistory(root, history, units, lessons) {
  const empty = select(root, "[data-assessment-history-empty]");
  const list = select(root, "[data-assessment-history-list]");
  const unitNames = new Map(units.map((unit) => [unit.id, unitName(unit)]));
  const objectives = new Map(
    units.flatMap((unit) => learningObjectivesForUnit(unit)).map((objective) => [objective.id, objective]),
  );
  const lessonNames = new Map(lessons.map((lesson) => [
    lesson.id,
    lesson.title || `Lesson ${lesson.number ?? lesson.order ?? ""}`.trim(),
  ]));
  const sorted = [...history].sort((first, second) =>
    (timestampToDate(second.lessonDate)?.getTime() ?? timestampToDate(second.createdAt)?.getTime() ?? 0) -
    (timestampToDate(first.lessonDate)?.getTime() ?? timestampToDate(first.createdAt)?.getTime() ?? 0),
  );
  select(root, "[data-assessment-history-toggle]")?.remove();
  list.replaceChildren();
  empty.hidden = sorted.length > 0;
  const renderedItems = [];
  sorted.forEach((entry) => {
    const item = document.createElement("li");
    const top = document.createElement("div");
    const heading = document.createElement("strong");
    const edit = document.createElement("button");
    const date = formatDate(entry.lessonDate ?? entry.createdAt);
    const changes = document.createElement("ul");
    const topActions = document.createElement("div");
    top.className = "assessment-history__top";
    heading.textContent = [
      isIndependentProgressEntry(entry) ? "Independent update" : unitNames.get(entry.unitId) ?? "Unknown unit",
      isIndependentProgressEntry(entry) ? "" : lessonNames.get(entry.lessonId),
      date,
    ].filter(Boolean).join(" — ");
    edit.type = "button";
    edit.dataset.editProgressUpdate = entry.id;
    edit.textContent = "Edit progress";
    topActions.className = "assessment-history__actions";
    if (!isIndependentProgressEntry(entry) && typeof entry.completeLesson === "boolean") {
      const completion = document.createElement("span");
      completion.className = "assessment-history__completion";
      completion.dataset.completed = entry.completeLesson === true ? "true" : "false";
      completion.textContent = entry.completeLesson === true ? "Lesson completed" : "Lesson not completed";
      topActions.append(completion);
    }
    topActions.append(edit);
    top.append(heading, topActions);
    (Array.isArray(entry.changes) ? entry.changes : []).forEach((change) => {
      const changeItem = document.createElement("li");
      const objective = objectives.get(change.objectiveId);
      const label = objective?.title ?? change.title ?? LANGUAGE_SKILL_LABELS[change.category] ?? "Learning objective";
      const target = document.createElement("span");
      target.textContent = label;
      changeItem.append(target, statusBadge(change.status));
      changes.append(changeItem);
    });
    const changedIds = new Set((entry.changes ?? []).map(({ objectiveId }) => objectiveId));
    (Array.isArray(entry.workedOnObjectives) ? entry.workedOnObjectives : [])
      .filter(({ objectiveId, id }) => !changedIds.has(objectiveId ?? id))
      .forEach((workedOn) => {
        const workedOnItem = document.createElement("li");
        const target = document.createElement("span");
        const workedOnBadge = document.createElement("span");
        target.textContent = workedOn.title || "Learning objective";
        workedOnBadge.className = "learning-status-badge learning-status-badge--worked-on";
        workedOnBadge.textContent = "Worked on";
        workedOnItem.append(target, workedOnBadge);
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
    renderedItems.push(item);
  });
  list.append(...renderedItems);
  if (renderedItems.length > PROFILE_LIST_PREVIEW_LIMIT) {
    let expanded = false;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "profile-list-toggle";
    toggle.dataset.assessmentHistoryToggle = "";
    const syncVisibility = () => {
      renderedItems.forEach((item, index) => {
        item.hidden = !expanded && index >= PROFILE_LIST_PREVIEW_LIMIT;
      });
      toggle.textContent = expanded
        ? "Show fewer updates"
        : `Show all updates (${renderedItems.length})`;
      toggle.setAttribute("aria-expanded", String(expanded));
    };
    toggle.addEventListener("click", () => {
      expanded = !expanded;
      syncVisibility();
    });
    syncVisibility();
    list.after(toggle);
  }
}

function renderProfile(root, data, onQuickUpdateSaved) {
  const { student, group, course, units, lessons, objectiveProgress, homeworkAssignments, progressHistory, legacyProgress, goals, feedbackDrafts } = data;
  const warnings = [...(data.loadWarnings ?? [])];
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
  renderProfilePart("learning objectives", () => renderLearningObjectives(
    root,
    units,
    objectiveProgress,
    progressHistory,
    lessons,
    student,
    onQuickUpdateSaved,
  ), warnings);
  renderProfilePart("learning summary", () => renderSummary(root, units, objectiveProgress), warnings);
  renderProfilePart("reading map", () => renderProfileReadingMap(
    root,
    course,
    units,
    objectiveProgress,
    student,
  ), warnings);
  renderProfilePart("current goal", () => renderCurrentGoal(root, goals), warnings);
  renderProfilePart("feedback records", () => renderProfileFeedback(root, feedbackDrafts, units, lessons), warnings);
  renderProfilePart("homework records", () => renderProfileHomework(root, homeworkAssignments, units), warnings);
  renderProfilePart("progress updates", () =>
    renderAssessmentHistory(root, progressHistory, units, lessons), warnings);
  configureProfileFeature("homework editor", () =>
    configureHomeworkEditor(root, homeworkAssignments, onQuickUpdateSaved));
  select(root, "[data-legacy-progress-note]").hidden = legacyProgress.length === 0;
  configureProfileFeature("Quick Update", () =>
    configureQuickUpdate({ ...data, onSaved: onQuickUpdateSaved }));
  configureProfileFeature("Progress Update editor", () =>
    configureProgressUpdateEditor({ ...data, onSaved: onQuickUpdateSaved }));
  configureProfileFeature("student access", () => configureStudentAccess(root, student));
  select(root, "[data-profile-state]").hidden = true;
  select(root, "[data-profile-content]").hidden = false;
  return warnings;
}

async function loadProfileData(studentId) {
  const student = await studentsRepository.getById(studentId);
  if (!student) return null;
  const loadWarnings = [];
  const group = student.groupId
    ? await loadProfilePart(
      "group",
      groupsRepository.getById(student.groupId),
      null,
      loadWarnings,
    )
    : null;
  const courseId = group?.courseId || student.courseId || "";
  const effectiveStudent = courseId === student.courseId ? student : { ...student, courseId };
  const [course, units, lessons, objectiveProgress, homeworkAssignments, progressHistory, legacyProgress, goals, feedbackDrafts] = await Promise.all([
    loadProfilePart("course", courseId ? coursesRepository.getById(courseId) : Promise.resolve(null), null, loadWarnings),
    loadProfilePart("units", courseId ? unitsRepository.listByCourse(courseId) : Promise.resolve([]), [], loadWarnings),
    loadProfilePart("lessons", courseId ? lessonsRepository.listByCourse(courseId) : Promise.resolve([]), [], loadWarnings),
    loadProfilePart("learning progress", objectiveProgressRepository.listByStudent(studentId), [], loadWarnings),
    loadProfilePart("homework", homeworkAssignmentsRepository.listByStudent(studentId), [], loadWarnings),
    loadProfilePart("progress updates", progressHistoryRepository.listByStudent(studentId), [], loadWarnings),
    loadProfilePart("legacy progress", progressRepository.listByStudent(studentId), [], loadWarnings),
    loadProfilePart("goals", goalsRepository.listByStudent(studentId), [], loadWarnings),
    loadProfilePart("feedback drafts", feedbackDraftsRepository.listByStudent(studentId), [], loadWarnings),
  ]);
  return { student: effectiveStudent, group, course, units, lessons, objectiveProgress, homeworkAssignments, progressHistory, legacyProgress, goals, feedbackDrafts, loadWarnings };
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
    const warnings = renderProfile(root, data, (message) => loadAdminStudentProfile(studentId, message));
    const warningMessage = warnings.length
      ? `Profile loaded, but these sections need attention: ${[...new Set(warnings)].join(", ")}.`
      : "";
    setText(root, "[data-profile-action-message]", successMessage || warningMessage);
  } catch (error) {
    if (requestId !== activeRequestId) return;
    console.error("Unable to load the admin student profile.", error);
    setProfileState(root, "Unable to load student profile. Please try again.");
  }
}
