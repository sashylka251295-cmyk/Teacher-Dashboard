import { coursesRepository } from "../data/repositories/courses-repository.js";
import { feedbackDraftsRepository } from "../data/repositories/feedback-drafts-repository.js?v=20260827-observations-retired";
import { goalsRepository } from "../data/repositories/goals-repository.js";
import { groupsRepository } from "../data/repositories/groups-repository.js";
import { homeworkAssignmentsRepository } from "../data/repositories/homework-assignments-repository.js";
import { saveLearningUpdate } from "../data/repositories/learning-updates-repository.js?v=20260827-homework-details";
import { lessonsRepository } from "../data/repositories/lessons-repository.js";
import { addObjectiveToLesson } from "../data/repositories/lesson-objectives-repository.js";
import { objectiveProgressRepository } from "../data/repositories/objective-progress-repository.js";
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
  OBJECTIVE_STATUSES,
  OBJECTIVE_STATUS_LABELS,
} from "../domain/constants.js";
import {
  aggregateObjectiveStatus,
  isObjectiveStatus,
  learningObjectivesForLesson,
  learningObjectivesForUnit,
  progressByObjective,
} from "../domain/learning-objectives.js";
import {
  createJourneySnapshot,
  currentPhysicalUnit,
} from "../domain/physical-progress.js";
import { renderCourseJourneyMap } from "../ui/course-journey-map.js?v=20260828-route-decor";
import { normalizeHomeworkResources } from "../domain/homework.js";
import { appendTextWithLinks } from "../ui/linked-text.js?v=20260905-homework-links";
import { isGoalStatus, isNonEmptyText, isStudentStatus, isValidHexColor } from "../domain/validation.js";
import { readingSoundForObjective } from "../domain/reading-sounds.js";
import { createReadingSoundChip } from "../ui/reading-map.js";
import { createCalendarColorPicker } from "../ui/calendar-color-picker.js";
import { calendarColorForEntity } from "../domain/calendar.js?v=20260905-calendar-organizer";
import {
  closeDialog,
  displayValue,
  field,
  populateDocumentSelect,
  setMessage,
  setSectionMessage,
  showDialog,
} from "./crud-helpers.js";

let onEntityChanged = null;
let onOpenStudent = null;
let elements = null;
let editingGroupId = null;
let availableCourses = [];
let availableGroups = [];
let availableStudents = [];
let currentGroupDetails = null;
let groupUpdateStudents = [];
let pendingLessonUpdate = null;
let groupCalendarColorPicker = null;

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function unitName(unit) {
  if (typeof unit?.title === "string" && unit.title.trim()) return unit.title;
  return unit?.number ? `Unit ${unit.number}` : "Unknown unit";
}

function todayInputValue() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateFromInput(value) {
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return year && month && day
    && date.getFullYear() === year
    && date.getMonth() === month - 1
    && date.getDate() === day
    ? date
    : null;
}

function timestampToDate(timestamp) {
  if (!timestamp) return null;
  const value = typeof timestamp.toDate === "function" ? timestamp.toDate() : timestamp;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timestampMillis(timestamp) {
  return timestampToDate(timestamp)?.getTime() ?? 0;
}

function formatActivityDate(timestamp, includeTime = false) {
  const date = timestampToDate(timestamp);
  return date
    ? new Intl.DateTimeFormat("en", includeTime
      ? { dateStyle: "medium", timeStyle: "short" }
      : { dateStyle: "medium" }).format(date)
    : "Date unavailable";
}

function studentStatus(student) {
  if (isStudentStatus(student.status)) return student.status;
  return student.active === false ? "paused" : "active";
}

function selectedCourseLabel() {
  const label = elements.course.selectedOptions[0]?.textContent?.trim();
  return label && elements.course.value ? label : "Select course";
}

function syncPreview() {
  elements.previewName.textContent = field(elements.form, "name").value.trim() || "Group name";
  elements.previewCourse.textContent = selectedCourseLabel();
  elements.previewYear.textContent = field(elements.form, "academicYear").value.trim() || "Academic year";
  elements.previewActive.textContent = field(elements.form, "active").checked
    ? "Active"
    : "Inactive";
}

function renderGroupMembers() {
  const groupNames = new Map(availableGroups.map((group) => [group.id, group.name]));
  const visibleStudents = availableStudents.filter(
    (student) => studentStatus(student) !== "archived" || student.groupId === editingGroupId,
  );
  elements.memberList.replaceChildren(...visibleStudents.map((student) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const identity = document.createElement("span");
    const name = document.createElement("strong");
    const current = document.createElement("small");
    label.className = "group-member-option";
    checkbox.type = "checkbox";
    checkbox.dataset.groupMember = student.id;
    checkbox.checked = student.groupId === editingGroupId;
    name.textContent = displayValue(student.name);
    current.textContent = student.groupId && student.groupId !== editingGroupId
      ? `Currently in ${groupNames.get(student.groupId) ?? "another group"}`
      : student.groupId === editingGroupId
        ? "Current member"
        : "Individual";
    identity.append(name, current);
    label.append(checkbox, identity);
    return label;
  }));
  elements.memberList.hidden = visibleStudents.length === 0;
  elements.memberEmpty.hidden = visibleStudents.length > 0;
}

async function openForm(groupId = null) {
  editingGroupId = groupId;
  elements.form.reset();
  field(elements.form, "active").checked = true;
  field(elements.form, "lessonMode").value = "online";
  groupCalendarColorPicker.setValue("#8fa77d");
  elements.title.textContent = groupId ? "Edit Group" : "Add Group";
  elements.groupDelete.hidden = !groupId;
  elements.groupDelete.disabled = Boolean(groupId);
  syncPreview();
  elements.save.disabled = true;
  setMessage(elements.message, "Loading…");
  showDialog(elements.dialog);

  try {
    const [courses, group, students, groups] = await Promise.all([
      coursesRepository.list(),
      groupId ? groupsRepository.getById(groupId) : Promise.resolve(null),
      studentsRepository.list(),
      groupsRepository.list(),
    ]);
    availableCourses = courses;
    availableStudents = students;
    availableGroups = groups;
    groupCalendarColorPicker.setUsage(students, groups, { groupId });
    populateDocumentSelect(elements.course, courses, "Select course");

    if (groupId && !group) {
      setMessage(elements.message, "Group not found.");
      return;
    }

    if (group) {
      field(elements.form, "name").value = group.name ?? "";
      elements.course.value = group.courseId ?? "";
      field(elements.form, "academicYear").value = group.academicYear ?? "";
      field(elements.form, "active").checked = group.active !== false;
      field(elements.form, "lessonMode").value = group.lessonMode === "offline" ? "offline" : "online";
      groupCalendarColorPicker.setValue(calendarColorForEntity(group));
      elements.groupDelete.disabled = false;
    } else {
      groupCalendarColorPicker.setValue(groupCalendarColorPicker.firstAvailable());
    }

    renderGroupMembers();
    syncPreview();
    elements.save.disabled = false;
    setMessage(elements.message, "");
  } catch (error) {
    console.error("Unable to load the group form.", error);
    setMessage(elements.message, "Unable to load form data. Please try again.");
  }
}

async function deleteGroup() {
  if (!editingGroupId) return;

  const confirmed = window.confirm(
    "Delete this group permanently? Students in this group will not be deleted and will keep their existing group reference.",
  );
  if (!confirmed) return;

  const groupId = editingGroupId;
  elements.groupDelete.disabled = true;
  setMessage(elements.message, "Deleting…");

  try {
    await groupsRepository.remove(groupId);
    closeDialog(elements.dialog);
    await onEntityChanged("groups");
    setSectionMessage("groups", "Group deleted.");
  } catch (error) {
    console.error("Unable to delete the group.", error);
    setMessage(elements.message, "Unable to delete the group. Please try again.");
  } finally {
    elements.groupDelete.disabled = false;
  }
}

async function saveGroup(event) {
  event.preventDefault();
  const name = field(elements.form, "name").value.trim();
  const courseId = elements.course.value;

  if (!isNonEmptyText(name)) {
    setMessage(elements.message, "Group name is required.");
    return;
  }
  if (!availableCourses.some((course) => course.id === courseId)) {
    setMessage(elements.message, "Select a course.");
    return;
  }
  if (!isValidHexColor(field(elements.form, "color").value)) {
    setMessage(elements.message, "Select a valid calendar color.");
    return;
  }
  if (!["online", "offline"].includes(field(elements.form, "lessonMode").value)) {
    setMessage(elements.message, "Select a lesson format.");
    return;
  }

  const payload = {
    name,
    courseId,
    academicYear: field(elements.form, "academicYear").value.trim(),
    active: field(elements.form, "active").checked,
    lessonMode: field(elements.form, "lessonMode").value,
    color: field(elements.form, "color").value,
  };
  elements.save.disabled = true;
  setMessage(elements.message, "Saving…");

  try {
    let savedGroupId = editingGroupId;
    if (editingGroupId) {
      await groupsRepository.update(editingGroupId, payload);
    } else savedGroupId = await groupsRepository.create(payload);

    const selectedStudentIds = new Set(
      [...elements.memberList.querySelectorAll("[data-group-member]:checked")]
        .map((checkbox) => checkbox.dataset.groupMember),
    );
    const membershipUpdates = availableStudents.filter((student) =>
      selectedStudentIds.has(student.id) || student.groupId === savedGroupId);
    await Promise.all(membershipUpdates.map((student) => {
      if (selectedStudentIds.has(student.id)) {
        if (student.groupId === savedGroupId && student.courseId === courseId) return Promise.resolve();
        return studentsRepository.update(student.id, { groupId: savedGroupId, courseId });
      }
      return studentsRepository.update(student.id, { groupId: "" });
    }));

    const message = editingGroupId ? "Group updated." : "Group added successfully.";
    closeDialog(elements.dialog);
    await onEntityChanged("groups");
    if (membershipUpdates.length > 0) await onEntityChanged("students");
    setSectionMessage("groups", message);
  } catch (error) {
    console.error("Unable to save the group.", error);
    setMessage(elements.message, "Unable to save changes. Please try again.");
  } finally {
    elements.save.disabled = false;
  }
}

function createStudentItem(student) {
  const item = document.createElement("li");
  const marker = document.createElement("span");
  const identity = document.createElement("span");
  const link = document.createElement("button");
  const details = document.createElement("span");
  const update = document.createElement("button");
  marker.className = "group-student-avatar";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = displayValue(student.name).trim().charAt(0).toUpperCase();
  if (student.avatarImageUrl) {
    const image = document.createElement("img");
    image.src = student.avatarImageUrl;
    image.alt = "";
    image.addEventListener("error", () => image.remove(), { once: true });
    marker.prepend(image);
  }
  if (typeof student.color === "string" && globalThis.CSS?.supports?.("color", student.color)) {
    marker.style.backgroundColor = student.color;
  }
  link.type = "button";
  link.dataset.groupStudentProfile = student.id;
  link.textContent = displayValue(student.name);
  details.textContent = studentStatus(student);
  update.type = "button";
  update.className = "group-student-update";
  update.dataset.groupStudentUpdate = student.id;
  update.textContent = "Quick Update";
  identity.append(link, details);
  item.append(marker, identity, update);
  return item;
}

function renderGroupCourseLink(course) {
  if (!course) {
    setMessage(elements.detailsCourse, "Unknown course");
    return;
  }

  const link = document.createElement("button");
  link.type = "button";
  link.className = "group-course-link";
  link.dataset.groupOpenCourse = course.id;
  link.dataset.openCourse = course.id;
  link.setAttribute("aria-label", `Open course ${displayValue(course.name)}`);

  const name = document.createElement("strong");
  const action = document.createElement("span");
  name.textContent = displayValue(course.name);
  action.textContent = "Open course";
  link.append(name, action);
  elements.detailsCourse.replaceChildren(link);
}

function createGroupStudentAction(studentId, label = "Open student") {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.groupStudentProfile = studentId;
  button.textContent = label;
  return button;
}

function createGroupHomeworkAction(assignment, action) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.groupHomeworkAction = action;
  button.dataset.groupHomeworkId = assignment.id;
  button.dataset.groupHomeworkStudent = assignment.studentId;
  button.textContent = action === "delete" ? "Delete homework" : "Edit homework";
  if (action === "delete") button.className = "button-danger";
  return button;
}

function renderGroupProgressHistory(history, students, units, lessons) {
  const studentNames = new Map(students.map((student) => [student.id, displayValue(student.name)]));
  const unitNames = new Map(units.map((unit) => [unit.id, unitName(unit)]));
  const lessonNames = new Map(lessons.map((lesson) => [
    lesson.id,
    lesson.title || `Lesson ${lesson.number ?? lesson.order ?? ""}`.trim(),
  ]));
  const objectiveNames = new Map(
    units.flatMap((unit) => learningObjectivesForUnit(unit))
      .map((objective) => [objective.id, objective.title]),
  );
  const grouped = new Map();
  history.forEach((entry) => {
    const day = timestampToDate(entry.lessonDate ?? entry.createdAt)?.toISOString().slice(0, 10) ?? entry.id;
    const key = [entry.unitId, entry.lessonId, day].join("::");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });
  const groups = [...grouped.values()].sort((first, second) =>
    Math.max(...second.map((entry) => timestampMillis(entry.lessonDate ?? entry.createdAt)))
    - Math.max(...first.map((entry) => timestampMillis(entry.lessonDate ?? entry.createdAt))));
  elements.groupProgressHistory.replaceChildren(...groups.map((entries) => {
    const representative = entries[0];
    const card = document.createElement("details");
    const summary = document.createElement("summary");
    const identity = document.createElement("span");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    const roster = document.createElement("div");
    title.textContent = [
      unitNames.get(representative.unitId) ?? "Course update",
      lessonNames.get(representative.lessonId),
    ].filter(Boolean).join(" › ");
    meta.textContent = `${formatActivityDate(representative.lessonDate ?? representative.createdAt)} · ${entries.length} ${entries.length === 1 ? "student" : "students"}`;
    identity.append(title, meta);
    summary.append(identity);
    roster.className = "group-activity__student-records";
    entries.sort((first, second) => (studentNames.get(first.studentId) ?? "")
      .localeCompare(studentNames.get(second.studentId) ?? ""))
      .forEach((entry) => {
        const row = document.createElement("article");
        const heading = document.createElement("div");
        const name = document.createElement("strong");
        const completion = document.createElement("span");
        const list = document.createElement("ul");
        const changedIds = new Set((entry.changes ?? []).map(({ objectiveId }) => objectiveId));
        name.textContent = studentNames.get(entry.studentId) ?? "Unknown student";
        completion.textContent = entry.completeLesson === true
          ? "Lesson completed"
          : entry.completeLesson === false ? "Lesson not completed" : "Learning update";
        completion.dataset.completed = entry.completeLesson === true ? "true" : "false";
        heading.append(name, completion);
        (entry.changes ?? []).forEach((change) => {
          const item = document.createElement("li");
          item.textContent = `${change.title || objectiveNames.get(change.objectiveId) || "Learning objective"}: ${OBJECTIVE_STATUS_LABELS[change.status] ?? change.status}`;
          list.append(item);
        });
        (entry.workedOnObjectives ?? [])
          .filter(({ objectiveId, id }) => !changedIds.has(objectiveId ?? id))
          .forEach((objective) => {
            const item = document.createElement("li");
            item.textContent = `${objective.title || objectiveNames.get(objective.objectiveId ?? objective.id) || "Learning objective"}: Worked on`;
            list.append(item);
          });
        if (!list.childElementCount) {
          const item = document.createElement("li");
          item.textContent = "Physical lesson progress only";
          list.append(item);
        }
        row.append(heading, list, createGroupStudentAction(entry.studentId));
        roster.append(row);
      });
    card.className = "group-activity-card";
    card.append(summary, roster);
    return card;
  }));
  elements.groupProgressHistoryEmpty.hidden = groups.length > 0;
}

function renderGroupFeedbackHistory(feedback, students, units, lessons) {
  const studentNames = new Map(students.map((student) => [student.id, displayValue(student.name)]));
  const unitNames = new Map(units.map((unit) => [unit.id, unitName(unit)]));
  const lessonNames = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
  const sorted = [...feedback].sort((first, second) =>
    timestampMillis(second.updatedAt ?? second.publishedAt ?? second.createdAt)
    - timestampMillis(first.updatedAt ?? first.publishedAt ?? first.createdAt));
  elements.groupFeedbackHistory.replaceChildren(...sorted.map((record) => {
    const card = document.createElement("details");
    const summary = document.createElement("summary");
    const identity = document.createElement("span");
    const name = document.createElement("strong");
    const meta = document.createElement("small");
    const status = document.createElement("span");
    const content = document.createElement("div");
    name.textContent = studentNames.get(record.studentId) ?? "Unknown student";
    meta.textContent = [
      unitNames.get(record.unitId),
      lessonNames.get(record.lessonId),
      formatActivityDate(record.updatedAt ?? record.publishedAt ?? record.createdAt),
    ].filter(Boolean).join(" · ");
    status.className = "feedback-status-chip";
    status.dataset.status = record.status ?? "draft";
    status.textContent = FEEDBACK_STATUS_LABELS[record.status] ?? "Draft";
    identity.append(name, meta);
    summary.append(identity, status);
    content.className = "group-activity__feedback-content";
    [
      ["What went well", record.content?.whatWentWell],
      ["What to practise", record.content?.whatToPractise],
      ["Next step", record.content?.nextStep],
      ["Teacher message", record.content?.message],
    ].filter(([, value]) => typeof value === "string" && value.trim())
      .forEach(([label, value]) => {
        const section = document.createElement("section");
        const heading = document.createElement("strong");
        const text = document.createElement("p");
        heading.textContent = label;
        text.textContent = value;
        section.append(heading, text);
        content.append(section);
      });
    if (!content.childElementCount) {
      const empty = document.createElement("p");
      empty.textContent = "This feedback has no text yet.";
      content.append(empty);
    }
    content.append(createGroupStudentAction(record.studentId, "Open student feedback"));
    card.className = "group-activity-card";
    card.append(summary, content);
    return card;
  }));
  elements.groupFeedbackHistoryEmpty.hidden = sorted.length > 0;
}

function renderGroupHomeworkHistory(assignments, students, units, lessons) {
  const studentNames = new Map(students.map((student) => [student.id, displayValue(student.name)]));
  const unitNames = new Map(units.map((unit) => [unit.id, unitName(unit)]));
  const lessonNames = new Map(lessons.map((lesson) => [lesson.id, lesson.title]));
  const sorted = [...assignments].sort((first, second) =>
    timestampMillis(second.lessonDate ?? second.createdAt)
    - timestampMillis(first.lessonDate ?? first.createdAt));
  elements.groupHomeworkHistory.replaceChildren(...sorted.map((assignment) => {
    const card = document.createElement("details");
    const summary = document.createElement("summary");
    const identity = document.createElement("span");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    const status = document.createElement("span");
    const content = document.createElement("div");
    appendTextWithLinks(title, assignment.title || "Homework");
    meta.textContent = [
      studentNames.get(assignment.studentId) ?? "Unknown student",
      unitNames.get(assignment.unitId),
      lessonNames.get(assignment.lessonId),
      assignment.dueDate ? `Due ${formatActivityDate(assignment.dueDate)}` : "",
    ].filter(Boolean).join(" · ");
    status.className = "learning-status-badge";
    status.dataset.status = assignment.status;
    status.textContent = HOMEWORK_STATUS_LABELS[assignment.status] ?? assignment.status;
    identity.append(title, meta);
    summary.append(identity, status);
    content.className = "group-activity__homework-content";
    if (assignment.description) {
      const description = document.createElement("p");
      appendTextWithLinks(description, assignment.description);
      content.append(description);
    }
    const homeworkResources = normalizeHomeworkResources(assignment.resources);
    if (homeworkResources.length) {
      const resources = document.createElement("ul");
      resources.className = "homework-resource-links";
      homeworkResources.forEach((resource) => {
        const item = document.createElement("li");
        const link = document.createElement("a");
        link.href = resource.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `${resource.type === "pdf" ? "PDF" : "Open link"} · ${resource.title}`;
        item.append(link);
        resources.append(item);
      });
      content.append(resources);
    }
    const actions = document.createElement("footer");
    actions.className = "group-homework-actions";
    actions.append(
      createGroupHomeworkAction(assignment, "delete"),
      createGroupStudentAction(assignment.studentId, "Open student"),
      createGroupHomeworkAction(assignment, "edit"),
    );
    content.append(actions);
    card.className = "group-activity-card";
    card.append(summary, content);
    return card;
  }));
  elements.groupHomeworkHistoryEmpty.hidden = sorted.length > 0;
}

function renderGroupActivity(data) {
  renderGroupProgressHistory(data.progressHistory, data.students, data.units, data.lessons);
  renderGroupFeedbackHistory(data.feedbackDrafts, data.students, data.units, data.lessons);
  renderGroupHomeworkHistory(data.homeworkAssignments, data.students, data.units, data.lessons);
}

async function openDetails(groupId, successMessage = "") {
  currentGroupDetails = null;
  elements.detailsEdit.dataset.editGroup = groupId;
  elements.detailsEdit.disabled = true;
  elements.groupQuickUpdate.disabled = true;
  setMessage(elements.detailsState, "Loading…");
  elements.detailsState.hidden = false;
  elements.detailsContent.hidden = true;
  showDialog(elements.detailsDialog);

  try {
    const group = await groupsRepository.getById(groupId);
    if (!group) {
      setMessage(elements.detailsState, "Group not found.");
      return;
    }

    const [course, students, progressDocuments, units, lessons, progressHistory, homeworkAssignments, feedbackDrafts] = await Promise.all([
      group.courseId ? coursesRepository.getById(group.courseId) : Promise.resolve(null),
      studentsRepository.listByGroup(groupId),
      objectiveProgressRepository.list(),
      group.courseId ? unitsRepository.listByCourse(group.courseId) : Promise.resolve([]),
      group.courseId ? lessonsRepository.listByCourse(group.courseId) : Promise.resolve([]),
      progressHistoryRepository.list(),
      homeworkAssignmentsRepository.list(),
      feedbackDraftsRepository.list(),
    ]);
    const studentIds = new Set(students.map(({ id }) => id));
    const groupProgressHistory = progressHistory.filter((entry) =>
      entry.groupId === group.id
      || (studentIds.has(entry.studentId)
        && entry.courseId === group.courseId
        && (!entry.groupId || entry.groupId === group.id)));
    const groupHomeworkAssignments = homeworkAssignments.filter((assignment) =>
      studentIds.has(assignment.studentId) && assignment.courseId === group.courseId);
    const groupFeedbackDrafts = feedbackDrafts.filter((feedback) =>
      studentIds.has(feedback.studentId) && feedback.courseId === group.courseId);
    currentGroupDetails = {
      group,
      course,
      students,
      progressDocuments,
      units,
      lessons,
      progressHistory: groupProgressHistory,
      homeworkAssignments: groupHomeworkAssignments,
      feedbackDrafts: groupFeedbackDrafts,
    };
    setMessage(elements.detailsName, displayValue(group.name));
    renderGroupCourseLink(course);
    setMessage(elements.detailsYear, displayValue(group.academicYear));
    setMessage(elements.detailsActive, displayValue(group.active));
    elements.detailsActive.dataset.status = group.active === false ? "inactive" : "active";
    const journeyUnit = currentPhysicalUnit(units, group.courseJourney);
    const journeyProgress = renderCourseJourneyMap(elements.detailsJourney, {
      unit: journeyUnit,
      journey: group.courseJourney,
      lessons,
      theme: "adult",
    });
    const currentStop = journeyProgress?.stops.find(({ state }) => state === "current");
    elements.detailsCurrentLesson.textContent = currentStop
      ? `Current: ${currentStop.title}`
      : journeyProgress?.total
        ? "Unit completed"
        : "No lessons yet";
    const currentTargets = Array.isArray(group.courseJourney?.currentLearningTargets)
      ? group.courseJourney.currentLearningTargets
      : Array.isArray(currentStop?.learningTargets)
        ? currentStop.learningTargets
        : [];
    const groupStudentIds = new Set(students.map(({ id }) => id));
    elements.detailsCurrentTargets.replaceChildren(...currentTargets.map((target) => {
      const chip = document.createElement("span");
      const title = document.createElement("strong");
      const status = document.createElement("small");
      const aggregate = aggregateObjectiveStatus(progressDocuments.filter((entry) =>
        groupStudentIds.has(entry.studentId)
        && entry.unitId === journeyUnit?.id
        && entry.objectiveId === target.id));
      title.textContent = target.title;
      status.textContent = aggregate === "not_assessed"
        ? "Not assessed"
        : OBJECTIVE_STATUS_LABELS[aggregate];
      status.dataset.status = aggregate;
      chip.append(title, status);
      return chip;
    }));
    elements.detailsCurrentTargets.hidden = currentTargets.length === 0;
    renderGroupActivity(currentGroupDetails);
    elements.students.replaceChildren(
      ...students.map((student) => createStudentItem(student)),
    );
    elements.studentsEmpty.hidden = students.length > 0;
    setMessage(elements.detailsState, successMessage);
    elements.detailsState.hidden = !successMessage;
    elements.detailsContent.hidden = false;
    elements.detailsEdit.disabled = false;
    elements.groupQuickUpdate.disabled = students.length === 0;
    if ((pendingLessonUpdate?.groupId === group.id
      || pendingLessonUpdate?.courseId === group.courseId) && students.length > 0) {
      const selection = pendingLessonUpdate;
      pendingLessonUpdate = null;
      await openGroupQuickUpdate("", selection);
    }
  } catch (error) {
    console.error("Unable to load group details.", error);
    setMessage(elements.detailsState, "Unable to load group. Please try again.");
  }
}

function currentGroupUpdateUnit() {
  return currentGroupDetails?.units.find((unit) => unit.id === elements.groupUpdateUnit.value) ?? null;
}

function currentGroupUpdateLesson() {
  return currentGroupDetails?.lessons.find((lesson) => lesson.id === elements.groupUpdateLesson.value)
    ?? null;
}

function groupUpdateObjectives() {
  const lesson = currentGroupUpdateLesson();
  return lesson ? learningObjectivesForLesson(currentGroupUpdateUnit(), lesson) : [];
}

function selectedGroupUpdateObjectives() {
  const objectives = new Map(
    groupUpdateObjectives().map((objective) => [objective.id, objective]),
  );
  return [...elements.groupUpdateObjectives.querySelectorAll("[data-group-common-objective]:checked")]
    .map((checkbox) => ({
      ...objectives.get(checkbox.dataset.groupCommonObjective),
      status: checkbox.closest("[data-group-common-objective-row]")
        .querySelector("[data-group-common-status]").value,
    }))
    .filter((objective) => objective.id && (!objective.status || isObjectiveStatus(objective.status)));
}

function createCommonObjectiveRow(objective) {
  const row = document.createElement("label");
  const checkbox = document.createElement("input");
  const identity = document.createElement("span");
  const title = document.createElement("strong");
  const category = document.createElement("small");
  const status = document.createElement("select");
  row.className = "group-common-objective-row";
  row.dataset.groupCommonObjectiveRow = objective.id;
  checkbox.type = "checkbox";
  checkbox.dataset.groupCommonObjective = objective.id;
  title.textContent = objective.title;
  category.textContent = LANGUAGE_SKILL_LABELS[objective.category] ?? objective.category;
  const soundChip = createReadingSoundChip(
    readingSoundForObjective(currentGroupUpdateUnit(), objective.id),
  );
  if (soundChip) identity.append(soundChip);
  identity.append(title, category);
  status.append(createOption("", "Set status (optional)"));
  OBJECTIVE_STATUSES.forEach((value) => status.append(
    createOption(value, OBJECTIVE_STATUS_LABELS[value]),
  ));
  status.value = "";
  status.disabled = true;
  status.dataset.groupCommonStatus = objective.id;
  row.append(checkbox, identity, status);
  return row;
}

function populateGroupUpdateObjectives() {
  const objectives = groupUpdateObjectives();
  elements.groupUpdateObjectives.replaceChildren(...objectives.map(createCommonObjectiveRow));
  elements.groupUpdateObjectives.hidden = objectives.length === 0;
  elements.groupUpdateObjectivesEmpty.hidden = objectives.length > 0;
  renderGroupUpdateStudents();
}

function populateGroupUpdateLessons() {
  const unit = currentGroupUpdateUnit();
  const lessons = currentGroupDetails?.lessons.filter((lesson) => lesson.unitId === unit?.id) ?? [];
  elements.groupUpdateLesson.replaceChildren(...lessons.map((lesson) =>
    createOption(lesson.id, `Lesson ${lesson.number ?? lesson.order ?? "—"} · ${lesson.title}`)));
  elements.groupUpdateLesson.disabled = lessons.length === 0;
  if (lessons.length && currentGroupDetails.group.courseJourney?.unitId === unit?.id) {
    const currentId = currentGroupDetails.group.courseJourney.currentLessonId;
    if (lessons.some(({ id }) => id === currentId)) elements.groupUpdateLesson.value = currentId;
  }
  populateGroupUpdateObjectives();
}

function createLabeledControl(labelText, control) {
  const label = document.createElement("label");
  const text = document.createElement("span");
  text.textContent = labelText;
  label.append(text, control);
  return label;
}

function activeGoalForStudent(studentId) {
  return (currentGroupDetails.goals ?? []).find(
    (goal) => goal.studentId === studentId && ACTIVE_GOAL_STATUSES.includes(goal.status),
  ) ?? null;
}

function createGroupUpdateStudentRow(student) {
  const card = document.createElement("details");
  const summary = document.createElement("summary");
  const include = document.createElement("input");
  const name = document.createElement("strong");
  const hint = document.createElement("span");
  const body = document.createElement("div");
  const objectiveSection = document.createElement("section");
  const objectiveHeading = document.createElement("h4");
  const objectiveRows = document.createElement("div");
  const homeworkSection = document.createElement("section");
  const homeworkHeading = document.createElement("h4");
  const createHomework = document.createElement("div");
  const assignHomework = document.createElement("input");
  const homeworkTitle = document.createElement("input");
  const homeworkStatus = document.createElement("select");
  const existingHomework = document.createElement("div");
  const observationSection = document.createElement("section");
  const observationHeading = document.createElement("h4");
  const relatedTargets = document.createElement("fieldset");
  const relatedTargetsLegend = document.createElement("legend");
  const relatedTargetsHint = document.createElement("p");
  const observationTargets = document.createElement("div");
  const observationText = document.createElement("textarea");
  const goalSection = document.createElement("section");
  const goalHeading = document.createElement("h4");
  const currentGoalText = document.createElement("p");
  const goalAction = document.createElement("select");
  const goalTitle = document.createElement("input");
  const goalStatus = document.createElement("select");
  const unit = currentGroupUpdateUnit();
  const objectives = learningObjectivesForLesson(unit, currentGroupUpdateLesson());
  const progress = currentGroupDetails.progressDocuments.filter((entry) =>
    entry.studentId === student.id && entry.unitId === unit?.id);
  const progressMap = progressByObjective(progress);
  const activeGoal = activeGoalForStudent(student.id);

  card.className = "group-update-student-card";
  card.dataset.groupUpdateStudent = student.id;
  summary.className = "group-update-student-card__summary";
  include.type = "checkbox";
  include.checked = true;
  include.dataset.groupUpdateInclude = student.id;
  include.setAttribute("aria-label", `Include ${displayValue(student.name)} in this update`);
  name.textContent = displayValue(student.name);
  hint.textContent = "Common settings · Open for individual changes";
  summary.append(include, name, hint);

  objectiveHeading.textContent = "Learning objectives";
  objectiveRows.className = "group-student-objective-overrides";
  objectiveRows.append(...objectives.map((objective) => {
    const row = document.createElement("label");
    const enabled = document.createElement("input");
    const identity = document.createElement("span");
    const title = document.createElement("strong");
    const current = document.createElement("small");
    const status = document.createElement("select");
    const currentStatus = progressMap.get(objective.id)?.status ?? "not_assessed";
    row.dataset.groupObjectiveOverride = objective.id;
    row.dataset.currentStatus = currentStatus;
    row.hidden = true;
    enabled.type = "checkbox";
    enabled.checked = true;
    enabled.dataset.groupStudentObjectiveEnabled = objective.id;
    title.textContent = objective.title;
    current.textContent = `Current: ${OBJECTIVE_STATUS_LABELS[currentStatus]}`;
    identity.append(title, current);
    status.append(createOption("", "Use group / no status"));
    OBJECTIVE_STATUSES.forEach((value) => status.append(
      createOption(value, OBJECTIVE_STATUS_LABELS[value]),
    ));
    status.value = "";
    status.dataset.groupOverrideStatus = objective.id;
    status.dataset.overridden = "false";
    row.append(enabled, identity, status);
    return row;
  }));
  objectiveSection.append(objectiveHeading, objectiveRows);

  homeworkHeading.textContent = "Learning habits — Homework";
  createHomework.className = "group-student-new-homework";
  createHomework.dataset.groupStudentNewHomework = "";
  createHomework.hidden = true;
  assignHomework.type = "checkbox";
  assignHomework.checked = true;
  assignHomework.dataset.groupStudentAssignHomework = "";
  homeworkTitle.type = "text";
  homeworkTitle.dataset.groupStudentHomeworkTitle = "";
  HOMEWORK_STATUSES.forEach((value) => homeworkStatus.append(
    createOption(value, HOMEWORK_STATUS_LABELS[value]),
  ));
  homeworkStatus.dataset.groupStudentHomeworkStatus = "";
  const assignLabel = document.createElement("label");
  assignLabel.append(assignHomework, document.createTextNode(" Assign common homework"));
  createHomework.append(
    assignLabel,
    createLabeledControl("Homework", homeworkTitle),
    createLabeledControl("Status", homeworkStatus),
  );
  const assignments = (currentGroupDetails.homeworkAssignments ?? []).filter(
    (assignment) => assignment.studentId === student.id && assignment.unitId === unit?.id,
  );
  if (assignments.length > 0) {
    const existingHeading = document.createElement("h5");
    existingHeading.textContent = "Existing homework";
    existingHomework.append(existingHeading, ...assignments.map((assignment) => {
      const row = document.createElement("label");
      const checkbox = document.createElement("input");
      const title = document.createElement("span");
      const status = document.createElement("select");
      checkbox.type = "checkbox";
      checkbox.dataset.groupExistingHomework = assignment.id;
      title.textContent = assignment.title || "Homework";
      HOMEWORK_STATUSES.forEach((value) => status.append(
        createOption(value, HOMEWORK_STATUS_LABELS[value]),
      ));
      status.value = assignment.status;
      status.disabled = true;
      status.dataset.groupExistingHomeworkStatus = assignment.id;
      row.append(checkbox, title, status);
      return row;
    }));
  }
  homeworkSection.append(homeworkHeading, createHomework, existingHomework);

  observationHeading.textContent = "Optional student feedback";
  relatedTargets.className = "quick-related-targets";
  relatedTargetsLegend.textContent = "Related learning targets";
  relatedTargetsHint.textContent = "Select one or more targets connected to this student-facing feedback.";
  observationTargets.dataset.groupObservationTargets = "";
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
      checkbox.dataset.groupObservationTarget = objective.id;
      title.textContent = objective.title;
      label.append(checkbox, title);
      return label;
    }));
    observationTargets.append(group);
  });
  relatedTargets.append(relatedTargetsLegend, relatedTargetsHint, observationTargets);
  observationText.rows = 3;
  observationText.dataset.groupObservationText = "";
  observationSection.append(
    observationHeading,
    relatedTargets,
    createLabeledControl("Feedback visible to the student", observationText),
  );

  goalHeading.textContent = "Current goal";
  currentGoalText.textContent = activeGoal
    ? `${activeGoal.title} (${activeGoal.status})`
    : "No active goal.";
  goalAction.append(
    createOption("unchanged", "Leave unchanged"),
    createOption("update", "Update current goal"),
    createOption("create", "Create new goal"),
  );
  goalAction.querySelector('[value="update"]').disabled = !activeGoal;
  goalAction.dataset.groupGoalAction = "";
  goalTitle.type = "text";
  goalTitle.value = activeGoal?.title ?? "";
  goalTitle.disabled = true;
  goalTitle.dataset.groupGoalTitle = "";
  ["new", "working", "confident", "completed"].forEach((value) => goalStatus.append(
    createOption(value, `${value.charAt(0).toUpperCase()}${value.slice(1)}`),
  ));
  goalStatus.value = activeGoal?.status ?? "new";
  goalStatus.disabled = true;
  goalStatus.dataset.groupGoalStatus = "";
  goalSection.append(
    goalHeading,
    currentGoalText,
    createLabeledControl("Goal action", goalAction),
    createLabeledControl("Goal title", goalTitle),
    createLabeledControl("Goal status", goalStatus),
  );

  body.className = "group-update-student-card__body";
  body.append(objectiveSection, homeworkSection, observationSection, goalSection);
  card.append(summary, body);
  return card;
}

function syncGroupUpdateSelection() {
  const checkboxes = [...elements.groupUpdateStudents.querySelectorAll("[data-group-update-include]")];
  const selected = checkboxes.filter((checkbox) => checkbox.checked).length;
  elements.groupUpdateSelectAll.checked = checkboxes.length > 0 && selected === checkboxes.length;
  elements.groupUpdateSelectAll.indeterminate = selected > 0 && selected < checkboxes.length;
  checkboxes.forEach((checkbox) => {
    const card = checkbox.closest("[data-group-update-student]");
    card.classList.toggle("is-excluded", !checkbox.checked);
    card.querySelector(".group-update-student-card__body").hidden = !checkbox.checked;
  });
  elements.groupUpdateSave.disabled = !currentGroupUpdateUnit() || selected === 0;
}

function renderGroupUpdateStudents() {
  const rows = currentGroupUpdateUnit()
    ? groupUpdateStudents.map((student) => createGroupUpdateStudentRow(student))
    : [];
  elements.groupUpdateStudents.replaceChildren(...rows);
  elements.groupUpdateEmpty.hidden = rows.length > 0;
  elements.groupUpdateSelectAll.closest("label").hidden = rows.length <= 1;
  syncGroupCommonObjectives();
  syncGroupHomeworkDefaults();
  syncGroupUpdateSelection();
}

function syncGroupCommonObjectives() {
  const selected = new Map(selectedGroupUpdateObjectives().map((objective) => [objective.id, objective]));
  elements.groupUpdateObjectives.querySelectorAll("[data-group-common-objective-row]").forEach((row) => {
    const checkbox = row.querySelector("[data-group-common-objective]");
    row.querySelector("[data-group-common-status]").disabled = !checkbox.checked;
  });
  elements.groupUpdateStudents.querySelectorAll("[data-group-objective-override]").forEach((row) => {
    const objective = selected.get(row.dataset.groupObjectiveOverride);
    const enabled = row.querySelector("[data-group-student-objective-enabled]");
    const status = row.querySelector("[data-group-override-status]");
    row.hidden = !objective;
    status.disabled = !objective || !enabled.checked;
    if (objective && status.dataset.overridden !== "true") status.value = objective.status;
  });
}

async function addGroupInlineObjective() {
  elements.groupObjectiveAdd.disabled = true;
  elements.groupObjectiveMessage.textContent = "Saving objective…";
  try {
    const result = await addObjectiveToLesson({
      unit: currentGroupUpdateUnit(),
      lesson: currentGroupUpdateLesson(),
      lessons: currentGroupDetails.lessons,
      title: elements.groupObjectiveTitle.value,
      category: elements.groupObjectiveSkill.value,
    });
    currentGroupDetails.units = currentGroupDetails.units.map((item) =>
      item.id === result.unit.id ? result.unit : item);
    currentGroupDetails.lessons = result.lessons;
    elements.groupObjectiveTitle.value = "";
    elements.groupObjectiveCreator.hidden = true;
    populateGroupUpdateObjectives();
    const checkbox = elements.groupUpdateObjectives.querySelector(
      `[data-group-common-objective="${result.objective.id}"]`,
    );
    if (checkbox) checkbox.checked = true;
    syncGroupCommonObjectives();
    elements.groupObjectiveMessage.textContent = "";
  } catch (error) {
    elements.groupObjectiveMessage.textContent = error.message;
  } finally {
    elements.groupObjectiveAdd.disabled = false;
  }
}

function syncGroupHomeworkDefaults() {
  const shouldAssign = elements.groupUpdateHomeworkAssigned.value === "yes";
  elements.groupUpdateHomeworkFields.hidden = !shouldAssign;
  elements.groupUpdateStudents.querySelectorAll("[data-group-student-new-homework]").forEach((section) => {
    section.hidden = !shouldAssign;
    const assign = section.querySelector("[data-group-student-assign-homework]");
    const title = section.querySelector("[data-group-student-homework-title]");
    const status = section.querySelector("[data-group-student-homework-status]");
    title.disabled = !assign.checked;
    status.disabled = !assign.checked;
    if (title.dataset.overridden !== "true") title.value = elements.groupUpdateHomeworkTitle.value;
    if (status.dataset.overridden !== "true") status.value = elements.groupUpdateHomeworkStatus.value;
  });
}

async function openGroupQuickUpdate(studentId = "", selection = null) {
  if (!currentGroupDetails) return;
  groupUpdateStudents = studentId
    ? currentGroupDetails.students.filter((student) => student.id === studentId)
    : [...currentGroupDetails.students];
  const units = currentGroupDetails.units;
  elements.groupUpdateTitle.textContent = studentId
    ? `Quick Update — ${displayValue(groupUpdateStudents[0]?.name)}`
    : `Quick Update — ${displayValue(currentGroupDetails.group.name)}`;
  elements.groupUpdateDescription.textContent = studentId
    ? `Course: ${displayValue(currentGroupDetails.course?.name)}. Use common lesson settings or customise this student.`
    : `Course: ${displayValue(currentGroupDetails.course?.name)}. Apply common settings to ${groupUpdateStudents.length} students, then customise exceptions.`;
  elements.groupUpdateDate.value = selection?.lessonDate || todayInputValue();
  elements.groupUpdateUnit.replaceChildren(
    ...units.map((unit) => createOption(unit.id, unitName(unit))),
  );
  elements.groupUpdateUnit.disabled = units.length === 0;
  const journeyUnit = currentPhysicalUnit(units, currentGroupDetails.group.courseJourney);
  if (journeyUnit) elements.groupUpdateUnit.value = journeyUnit.id;
  elements.groupUpdateCompleteLesson.checked = false;
  elements.groupUpdateHomeworkAssigned.value = "no";
  elements.groupUpdateHomeworkTitle.value = "";
  elements.groupUpdateHomeworkDescription.value = "";
  elements.groupUpdateHomeworkDueDate.value = "";
  elements.groupUpdateHomeworkResourceTitle.value = "";
  elements.groupUpdateHomeworkResourceUrl.value = "";
  elements.groupUpdateHomeworkResourceType.value = "";
  elements.groupUpdateHomeworkStatus.value = "assigned";
  elements.groupObjectiveCreator.hidden = true;
  elements.groupObjectiveTitle.value = "";
  elements.groupObjectiveMessage.textContent = "";
  elements.groupUpdateObjectives.replaceChildren();
  elements.groupUpdateObjectivesEmpty.hidden = true;
  elements.groupUpdateStudents.replaceChildren();
  elements.groupUpdateEmpty.hidden = true;
  elements.groupUpdateSave.disabled = true;
  setMessage(elements.groupUpdateMessage, "Loading student updates…");
  closeDialog(elements.detailsDialog);
  showDialog(elements.groupUpdateDialog);
  try {
    const [goals, homeworkAssignments] = await Promise.all([
      goalsRepository.list(),
      homeworkAssignmentsRepository.list(),
    ]);
    currentGroupDetails.goals = goals.filter((goal) =>
      currentGroupDetails.students.some((student) => student.id === goal.studentId));
    currentGroupDetails.homeworkAssignments = homeworkAssignments.filter((assignment) =>
      currentGroupDetails.students.some((student) => student.id === assignment.studentId));
    populateGroupUpdateLessons();
    if (selection?.unitId && units.some(({ id }) => id === selection.unitId)) {
      elements.groupUpdateUnit.value = selection.unitId;
      populateGroupUpdateLessons();
    }
    if (selection?.lessonId && [...elements.groupUpdateLesson.options]
      .some(({ value }) => value === selection.lessonId)) {
      elements.groupUpdateLesson.value = selection.lessonId;
      populateGroupUpdateObjectives();
    }
    setMessage(elements.groupUpdateMessage, "");
  } catch (error) {
    console.error("Unable to load the group quick update.", error);
    setMessage(elements.groupUpdateMessage, "Unable to load student updates. Please try again.");
  }
}

function closeGroupQuickUpdate() {
  closeDialog(elements.groupUpdateDialog);
  if (currentGroupDetails) showDialog(elements.detailsDialog);
}

async function saveGroupQuickUpdate(event) {
  event.preventDefault();
  if (!currentGroupDetails) return;
  const unit = currentGroupUpdateUnit();
  const lesson = currentGroupUpdateLesson();
  const lessonDate = dateFromInput(elements.groupUpdateDate.value);
  if (!unit) {
    setMessage(elements.groupUpdateMessage, "Select a unit.");
    return;
  }
  if (!lessonDate) {
    setMessage(elements.groupUpdateMessage, "Select a valid lesson date.");
    return;
  }
  if (!lesson) {
    setMessage(elements.groupUpdateMessage, "Select a lesson.");
    return;
  }

  const objectives = new Map(groupUpdateObjectives().map((objective) => [objective.id, objective]));
  const selectedObjectives = selectedGroupUpdateObjectives();
  const studentsById = new Map(groupUpdateStudents.map((student) => [student.id, student]));
  const homeworkById = new Map(
    (currentGroupDetails.homeworkAssignments ?? []).map((assignment) => [assignment.id, assignment]),
  );
  let plans;
  try {
    const assigningHomework = elements.groupUpdateHomeworkAssigned.value === "yes";
    const resourceUrl = elements.groupUpdateHomeworkResourceUrl.value.trim();
    const resources = normalizeHomeworkResources(assigningHomework && resourceUrl ? [{
      title: elements.groupUpdateHomeworkResourceTitle.value,
      url: resourceUrl,
      type: elements.groupUpdateHomeworkResourceType.value,
    }] : []);
    if (assigningHomework && resourceUrl && resources.length === 0) {
      throw new Error("Enter a valid HTTPS link or a PDF path from assets/materials/homework.");
    }
    const dueDate = assigningHomework && elements.groupUpdateHomeworkDueDate.value
      ? dateFromInput(elements.groupUpdateHomeworkDueDate.value)
      : null;
    if (assigningHomework && elements.groupUpdateHomeworkDueDate.value && !dueDate) {
      throw new Error("Select a valid homework due date.");
    }
    plans = [...elements.groupUpdateStudents.querySelectorAll("[data-group-update-include]:checked")]
      .map((checkbox) => {
        const card = checkbox.closest("[data-group-update-student]");
        const student = studentsById.get(checkbox.dataset.groupUpdateInclude);
        const objectiveChanges = selectedObjectives.map((objective) => {
          const row = card.querySelector(`[data-group-objective-override="${objective.id}"]`);
          if (!row.querySelector("[data-group-student-objective-enabled]").checked) return null;
          const status = row.querySelector("[data-group-override-status]").value;
          if (!status) return null;
          if (!isObjectiveStatus(status)) throw new Error(`Select a valid status for ${student.name}.`);
          return {
            objectiveId: objective.id,
            category: objective.category,
            previousStatus: row.dataset.currentStatus,
            status,
          };
        }).filter((change) => change && change.previousStatus !== change.status);
        const workedOnObjectives = selectedObjectives.filter((objective) => {
          const row = card.querySelector(`[data-group-objective-override="${objective.id}"]`);
          return row?.querySelector("[data-group-student-objective-enabled]").checked;
        });

        const assignHomework = card.querySelector("[data-group-student-assign-homework]");
        const homeworkToCreate = elements.groupUpdateHomeworkAssigned.value === "yes" && assignHomework.checked
          ? {
            title: card.querySelector("[data-group-student-homework-title]").value.trim() || "Homework",
            description: elements.groupUpdateHomeworkDescription.value.trim(),
            dueDate,
            resources,
            status: card.querySelector("[data-group-student-homework-status]").value,
          }
          : null;
        if (homeworkToCreate && !HOMEWORK_STATUSES.includes(homeworkToCreate.status)) {
          throw new Error(`Select a valid homework status for ${student.name}.`);
        }
        const homeworkChanges = [...card.querySelectorAll("[data-group-existing-homework]:checked")]
          .map((homeworkCheckbox) => ({
            id: homeworkCheckbox.dataset.groupExistingHomework,
            status: homeworkCheckbox.closest("label")
              .querySelector("[data-group-existing-homework-status]").value,
          }))
          .filter((change) => homeworkById.get(change.id)?.status !== change.status);

        const observationText = card.querySelector("[data-group-observation-text]").value.trim();
        const observationTargetIds = [...card.querySelectorAll("[data-group-observation-target]:checked")]
          .map((checkbox) => checkbox.dataset.groupObservationTarget);
        const observationTargets = observationTargetIds.map((targetId) => objectives.get(targetId)).filter(Boolean);
        if (observationText && !observationTargets.length) {
          throw new Error(`Select at least one feedback learning target for ${student.name}.`);
        }
        const observation = observationText ? {
          text: observationText,
          learningTargetIds: observationTargets.map(({ id }) => id),
        } : null;

        const goalAction = card.querySelector("[data-group-goal-action]").value;
        const activeGoal = activeGoalForStudent(student.id);
        let goalOperation = null;
        if (goalAction !== "unchanged") {
          const title = card.querySelector("[data-group-goal-title]").value.trim();
          const status = card.querySelector("[data-group-goal-status]").value;
          if (!isNonEmptyText(title)) throw new Error(`Enter a goal title for ${student.name}.`);
          if (!isGoalStatus(status)) throw new Error(`Select a valid goal status for ${student.name}.`);
          if (goalAction === "update") {
            if (!activeGoal) throw new Error(`${student.name} has no active goal to update.`);
            if (activeGoal.title !== title || activeGoal.status !== status) {
              goalOperation = { type: "update", goal: activeGoal, title, status };
            }
          } else goalOperation = { type: "create", title, status };
        }

        const physicalJourney = createJourneySnapshot({
          courseId: currentGroupDetails.group.courseId,
          unit,
          lessons: currentGroupDetails.lessons,
          previousJourney: student.courseJourney,
          selectedLessonId: lesson.id,
          completeLesson: elements.groupUpdateCompleteLesson.checked,
        });
        return {
          student,
          objectiveChanges,
          homeworkToCreate,
          homeworkChanges,
          observation,
          goalOperation,
          physicalJourney,
          workedOnObjectives,
        };
      });
  } catch (error) {
    setMessage(elements.groupUpdateMessage, error.message);
    return;
  }

  if (plans.length === 0) {
    setMessage(elements.groupUpdateMessage, "No changes to save.");
    return;
  }

  elements.groupUpdateSave.disabled = true;
  setMessage(elements.groupUpdateMessage, `Saving ${plans.length} student updates…`);
  try {
    await Promise.all(plans.map(async (plan) => {
      const progressHistoryId = await saveLearningUpdate({
        studentId: plan.student.id,
        courseId: currentGroupDetails.group.courseId,
        unitId: unit.id,
        groupId: currentGroupDetails.group.id,
        lessonId: lesson.id,
        objectiveChanges: plan.objectiveChanges,
        homeworkToCreate: plan.homeworkToCreate,
        homeworkChanges: plan.homeworkChanges,
        lessonDate,
        physicalJourney: plan.physicalJourney,
        physicalChange: {
          completeLesson: elements.groupUpdateCompleteLesson.checked,
          previousLessonCompleted: plan.student.courseJourney?.unitId === unit.id
            && Array.isArray(plan.student.courseJourney.completedLessonIds)
            && plan.student.courseJourney.completedLessonIds.includes(lesson.id),
        },
        workedOnObjectives: plan.workedOnObjectives,
      });
      if (plan.goalOperation?.type === "update") {
        await goalsRepository.update(plan.goalOperation.goal.id, {
          title: plan.goalOperation.title,
          status: plan.goalOperation.status,
        });
      } else if (plan.goalOperation?.type === "create") {
        await goalsRepository.create({
          studentId: plan.student.id,
          title: plan.goalOperation.title,
          status: plan.goalOperation.status,
          studentVisible: true,
        });
      }
      if (plan.observation) {
        const feedbackId = await feedbackDraftsRepository.createProgressDraft({
          studentId: plan.student.id,
          courseId: currentGroupDetails.group.courseId,
          unitId: unit.id,
          lessonId: lesson.id,
          progressHistoryId,
          learningTargetIds: plan.observation.learningTargetIds,
          content: {
            message: plan.observation.text,
            whatWentWell: "",
            whatToPractise: "",
            nextStep: "",
          },
        });
        await feedbackDraftsRepository.publish(feedbackId, {
          message: plan.observation.text,
          whatWentWell: "",
          whatToPractise: "",
          nextStep: "",
        });
      }
    }));
    const groupJourney = createJourneySnapshot({
      courseId: currentGroupDetails.group.courseId,
      unit,
      lessons: currentGroupDetails.lessons,
      previousJourney: currentGroupDetails.group.courseJourney,
      selectedLessonId: lesson.id,
      completeLesson: elements.groupUpdateCompleteLesson.checked,
    });
    await groupsRepository.update(currentGroupDetails.group.id, {
      courseJourney: {
        ...groupJourney,
        currentLearningTargets: selectedObjectives.map(({ id, title, category }) => ({
          id, title, category, categories: [category],
        })),
        updatedAt: new Date(),
      },
    });
    const groupId = currentGroupDetails.group.id;
    closeDialog(elements.groupUpdateDialog);
    await openDetails(
      groupId,
      `${plans.length} ${plans.length === 1 ? "student" : "students"} updated.`,
    );
  } catch (error) {
    console.error("Unable to save the group quick update.", error);
    setMessage(elements.groupUpdateMessage, "Unable to save the group update. Please try again.");
  } finally {
    elements.groupUpdateSave.disabled = false;
  }
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const addButton = target?.closest("[data-add-group]");
  const editButton = target?.closest("[data-edit-group]");
  const openButton = target?.closest("[data-open-group]");
  const studentLink = target?.closest("[data-group-student-profile]");
  const courseLink = target?.closest("[data-group-open-course]");
  const groupQuickUpdate = target?.closest("[data-group-quick-update]");
  const studentQuickUpdate = target?.closest("[data-group-student-update]");
  const homeworkAction = target?.closest("[data-group-homework-action]");

  if (homeworkAction) {
    const { groupHomeworkAction: action, groupHomeworkId: homeworkId, groupHomeworkStudent: studentId } = homeworkAction.dataset;
    if (action === "edit") {
      closeDialog(elements.detailsDialog);
      window.dispatchEvent(new CustomEvent("teacher:homework-edit-request", { detail: { studentId, homeworkId } }));
    } else if (action === "delete" && window.confirm("Delete this homework permanently?")) {
      homeworkAction.disabled = true;
      void homeworkAssignmentsRepository.remove(homeworkId)
        .then(() => openDetails(currentGroupDetails.group.id, "Homework deleted."))
        .catch((error) => {
          console.error("Unable to delete group homework.", error);
          homeworkAction.disabled = false;
          setMessage(elements.detailsState, "Unable to delete homework. Please try again.");
        });
    }
  } else if (addButton) void openForm();
  else if (editButton) {
    closeDialog(elements.detailsDialog);
    void openForm(editButton.dataset.editGroup);
  } else if (openButton) void openDetails(openButton.dataset.openGroup);
  else if (groupQuickUpdate) void openGroupQuickUpdate();
  else if (studentQuickUpdate) void openGroupQuickUpdate(studentQuickUpdate.dataset.groupStudentUpdate);
  else if (courseLink) closeDialog(elements.detailsDialog);
  else if (studentLink) {
    closeDialog(elements.detailsDialog);
    onOpenStudent(studentLink.dataset.groupStudentProfile);
  }
}

async function handleLessonProgressRequest(event) {
  const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
  if (!detail.courseId || !detail.unitId || !detail.lessonId) return;
  pendingLessonUpdate = detail;
  document.querySelector('[data-admin-link="groups"]')?.click();
  try {
    const groups = (await groupsRepository.list()).filter((group) => group.courseId === detail.courseId);
    if (groups.length === 1) {
      await openDetails(groups[0].id);
      return;
    }
    setSectionMessage(
      "groups",
      groups.length
        ? "Choose the group that completed this lesson. Quick Update will open with the lesson selected."
        : "No group currently uses this course. Assign the course to a group first.",
    );
    if (!groups.length) pendingLessonUpdate = null;
  } catch (error) {
    console.error("Unable to prepare lesson progress update.", error);
    setSectionMessage("groups", "Unable to load groups for this lesson.", "error");
  }
}

async function handleCalendarGroupProgressRequest(event) {
  const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
  if (!detail.groupId) return;
  pendingLessonUpdate = detail;
  document.querySelector('[data-admin-link="groups"]')?.click();
  try {
    await openDetails(detail.groupId);
  } catch (error) {
    console.error("Unable to open the group progress update from Calendar.", error);
    pendingLessonUpdate = null;
    setSectionMessage("groups", "Unable to open the group progress update.", "error");
  }
}

export function initializeGroupsCrud(options) {
  onEntityChanged = options.onEntityChanged;
  onOpenStudent = options.onOpenStudent;
  const dashboard = document.querySelector("[data-protected-content]");
  elements = {
    dashboard,
    dialog: dashboard?.querySelector("[data-group-dialog]"),
    form: dashboard?.querySelector("[data-group-form]"),
    title: dashboard?.querySelector("[data-group-form-title]"),
    message: dashboard?.querySelector("[data-group-form-message]"),
    course: dashboard?.querySelector("[data-group-course]"),
    save: dashboard?.querySelector("[data-group-save]"),
    groupDelete: dashboard?.querySelector("[data-group-delete]"),
    previewName: dashboard?.querySelector("[data-group-preview-name]"),
    previewCourse: dashboard?.querySelector("[data-group-preview-course]"),
    previewYear: dashboard?.querySelector("[data-group-preview-year]"),
    previewActive: dashboard?.querySelector("[data-group-preview-active]"),
    memberList: dashboard?.querySelector("[data-group-member-list]"),
    memberEmpty: dashboard?.querySelector("[data-group-member-empty]"),
    close: dashboard?.querySelector("[data-group-dialog-close]"),
    detailsDialog: dashboard?.querySelector("[data-group-details-dialog]"),
    detailsName: dashboard?.querySelector("[data-group-details-name]"),
    detailsState: dashboard?.querySelector("[data-group-details-state]"),
    detailsContent: dashboard?.querySelector("[data-group-details-content]"),
    detailsCourse: dashboard?.querySelector("[data-group-details-course]"),
    detailsYear: dashboard?.querySelector("[data-group-details-year]"),
    detailsActive: dashboard?.querySelector("[data-group-details-active]"),
    detailsJourney: dashboard?.querySelector("[data-group-course-journey]"),
    detailsCurrentLesson: dashboard?.querySelector("[data-group-current-lesson]"),
    detailsCurrentTargets: dashboard?.querySelector("[data-group-current-targets]"),
    groupProgressHistory: dashboard?.querySelector("[data-group-progress-history]"),
    groupProgressHistoryEmpty: dashboard?.querySelector("[data-group-progress-history-empty]"),
    groupFeedbackHistory: dashboard?.querySelector("[data-group-feedback-history]"),
    groupFeedbackHistoryEmpty: dashboard?.querySelector("[data-group-feedback-history-empty]"),
    groupHomeworkHistory: dashboard?.querySelector("[data-group-homework-history]"),
    groupHomeworkHistoryEmpty: dashboard?.querySelector("[data-group-homework-history-empty]"),
    studentsEmpty: dashboard?.querySelector("[data-group-students-empty]"),
    students: dashboard?.querySelector("[data-group-students]"),
    groupQuickUpdate: dashboard?.querySelector("[data-group-quick-update]"),
    detailsEdit: dashboard?.querySelector("[data-group-details-edit]"),
    detailsClose: dashboard?.querySelector("[data-group-details-close]"),
    groupUpdateDialog: dashboard?.querySelector("[data-group-quick-update-dialog]"),
    groupUpdateForm: dashboard?.querySelector("[data-group-quick-update-form]"),
    groupUpdateTitle: dashboard?.querySelector("[data-group-quick-update-title]"),
    groupUpdateDescription: dashboard?.querySelector("[data-group-quick-update-description]"),
    groupUpdateDate: dashboard?.querySelector("#group-update-date"),
    groupUpdateUnit: dashboard?.querySelector("[data-group-update-unit]"),
    groupUpdateLesson: dashboard?.querySelector("[data-group-update-lesson]"),
    groupUpdateCompleteLesson: dashboard?.querySelector("[data-group-update-complete-lesson]"),
    groupUpdateObjectives: dashboard?.querySelector("[data-group-update-objectives]"),
    groupUpdateObjectivesEmpty: dashboard?.querySelector("[data-group-update-objectives-empty]"),
    groupObjectiveAddToggle: dashboard?.querySelector("[data-group-objective-add-toggle]"),
    groupObjectiveCreator: dashboard?.querySelector("[data-group-objective-creator]"),
    groupObjectiveTitle: dashboard?.querySelector("[data-group-objective-title]"),
    groupObjectiveSkill: dashboard?.querySelector("[data-group-objective-skill]"),
    groupObjectiveAdd: dashboard?.querySelector("[data-group-objective-add]"),
    groupObjectiveAddCancel: dashboard?.querySelector("[data-group-objective-add-cancel]"),
    groupObjectiveMessage: dashboard?.querySelector("[data-group-objective-message]"),
    groupUpdateHomeworkAssigned: dashboard?.querySelector("[data-group-update-homework-assigned]"),
    groupUpdateHomeworkFields: dashboard?.querySelector("[data-group-update-homework-fields]"),
    groupUpdateHomeworkTitle: dashboard?.querySelector("#group-update-homework-title"),
    groupUpdateHomeworkDescription: dashboard?.querySelector("#group-update-homework-description"),
    groupUpdateHomeworkDueDate: dashboard?.querySelector("#group-update-homework-due-date"),
    groupUpdateHomeworkResourceTitle: dashboard?.querySelector("#group-update-homework-resource-title"),
    groupUpdateHomeworkResourceUrl: dashboard?.querySelector("#group-update-homework-resource-url"),
    groupUpdateHomeworkResourceType: dashboard?.querySelector("#group-update-homework-resource-type"),
    groupUpdateHomeworkStatus: dashboard?.querySelector("#group-update-homework-status"),
    groupUpdateSelectAll: dashboard?.querySelector("[data-group-update-select-all]"),
    groupUpdateEmpty: dashboard?.querySelector("[data-group-update-empty]"),
    groupUpdateStudents: dashboard?.querySelector("[data-group-update-students]"),
    groupUpdateMessage: dashboard?.querySelector("[data-group-quick-update-message]"),
    groupUpdateSave: dashboard?.querySelector("[data-group-quick-update-save]"),
    groupUpdateClose: dashboard?.querySelector("[data-group-quick-update-close]"),
    calendarColor: dashboard?.querySelector("[data-group-calendar-color]"),
  };

  if (Object.values(elements).some((element) => !element)) {
    console.error("Groups CRUD markup is incomplete.");
    return;
  }

  groupCalendarColorPicker = createCalendarColorPicker(elements.calendarColor);
  if (!groupCalendarColorPicker) {
    console.error("Group calendar color picker markup is incomplete.");
    return;
  }

  dashboard.addEventListener("click", handleClick);
  window.addEventListener("teacher:lesson-progress", handleLessonProgressRequest);
  window.addEventListener("teacher:group-progress-request", handleCalendarGroupProgressRequest);
  elements.form.addEventListener("submit", saveGroup);
  elements.form.addEventListener("input", syncPreview);
  elements.form.addEventListener("change", syncPreview);
  elements.groupDelete.addEventListener("click", deleteGroup);
  elements.close.addEventListener("click", () => closeDialog(elements.dialog));
  elements.detailsClose.addEventListener("click", () => closeDialog(elements.detailsDialog));
  elements.groupUpdateForm.addEventListener("submit", saveGroupQuickUpdate);
  elements.groupUpdateClose.addEventListener("click", closeGroupQuickUpdate);
  elements.groupUpdateDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeGroupQuickUpdate();
  });
  elements.groupUpdateUnit.addEventListener("change", populateGroupUpdateLessons);
  elements.groupUpdateLesson.addEventListener("change", populateGroupUpdateObjectives);
  elements.groupObjectiveAddToggle.addEventListener("click", () => {
    elements.groupObjectiveCreator.hidden = false;
    elements.groupObjectiveTitle.focus();
  });
  elements.groupObjectiveAddCancel.addEventListener("click", () => {
    elements.groupObjectiveCreator.hidden = true;
    elements.groupObjectiveMessage.textContent = "";
  });
  elements.groupObjectiveAdd.addEventListener("click", addGroupInlineObjective);
  elements.groupUpdateObjectives.addEventListener("change", (event) => {
    if (event.target.matches("[data-group-common-objective], [data-group-common-status]")) {
      syncGroupCommonObjectives();
    }
  });
  elements.groupUpdateHomeworkAssigned.addEventListener("change", syncGroupHomeworkDefaults);
  elements.groupUpdateHomeworkTitle.addEventListener("input", syncGroupHomeworkDefaults);
  elements.groupUpdateHomeworkStatus.addEventListener("change", syncGroupHomeworkDefaults);
  elements.groupUpdateSelectAll.addEventListener("change", () => {
    elements.groupUpdateStudents.querySelectorAll("[data-group-update-include]").forEach((checkbox) => {
      checkbox.checked = elements.groupUpdateSelectAll.checked;
    });
    syncGroupUpdateSelection();
  });
  elements.groupUpdateStudents.addEventListener("change", (event) => {
    if (event.target.matches("[data-group-update-include]")) syncGroupUpdateSelection();
    if (event.target.matches("[data-group-student-objective-enabled]")) {
      const row = event.target.closest("[data-group-objective-override]");
      row.querySelector("[data-group-override-status]").disabled = !event.target.checked;
    }
    if (event.target.matches("[data-group-override-status]")) {
      event.target.dataset.overridden = "true";
    }
    if (event.target.matches("[data-group-existing-homework]")) {
      event.target.closest("label").querySelector("[data-group-existing-homework-status]").disabled = !event.target.checked;
    }
    if (event.target.matches("[data-group-student-assign-homework]")) {
      const section = event.target.closest("[data-group-student-new-homework]");
      section.querySelector("[data-group-student-homework-title]").disabled = !event.target.checked;
      section.querySelector("[data-group-student-homework-status]").disabled = !event.target.checked;
    }
    if (event.target.matches("[data-group-student-homework-title], [data-group-student-homework-status]")) {
      event.target.dataset.overridden = "true";
    }
    if (event.target.matches("[data-group-goal-action]")) {
      const card = event.target.closest("[data-group-update-student]");
      const student = groupUpdateStudents.find((item) => item.id === card.dataset.groupUpdateStudent);
      const goal = activeGoalForStudent(student.id);
      const title = card.querySelector("[data-group-goal-title]");
      const status = card.querySelector("[data-group-goal-status]");
      const editable = event.target.value !== "unchanged";
      title.disabled = !editable;
      status.disabled = !editable;
      if (event.target.value === "update" && goal) {
        title.value = goal.title;
        status.value = goal.status;
      } else if (event.target.value === "create") {
        title.value = "";
        status.value = "new";
      }
    }
  });
}
