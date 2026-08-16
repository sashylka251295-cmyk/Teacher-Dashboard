import { coursesRepository } from "../data/repositories/courses-repository.js";
import { groupsRepository } from "../data/repositories/groups-repository.js";
import { progressRepository } from "../data/repositories/progress-repository.js";
import { studentsRepository } from "../data/repositories/students-repository.js";
import { calculateOverallProgress } from "../domain/progress.js";
import { isNonEmptyText, isStudentStatus } from "../domain/validation.js";
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

async function openForm(groupId = null) {
  editingGroupId = groupId;
  elements.form.reset();
  field(elements.form, "active").checked = true;
  elements.title.textContent = groupId ? "Edit Group" : "Add Group";
  elements.groupDelete.hidden = !groupId;
  elements.groupDelete.disabled = Boolean(groupId);
  syncPreview();
  elements.save.disabled = true;
  setMessage(elements.message, "Loading…");
  showDialog(elements.dialog);

  try {
    const [courses, group] = await Promise.all([
      coursesRepository.list(),
      groupId ? groupsRepository.getById(groupId) : Promise.resolve(null),
    ]);
    availableCourses = courses;
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
      elements.groupDelete.disabled = false;
    }

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

  const payload = {
    name,
    courseId,
    academicYear: field(elements.form, "academicYear").value.trim(),
    active: field(elements.form, "active").checked,
  };
  elements.save.disabled = true;
  setMessage(elements.message, "Saving…");

  try {
    if (editingGroupId) await groupsRepository.update(editingGroupId, payload);
    else await groupsRepository.create(payload);

    const message = editingGroupId ? "Group updated." : "Group added successfully.";
    closeDialog(elements.dialog);
    await onEntityChanged("groups");
    setSectionMessage("groups", message);
  } catch (error) {
    console.error("Unable to save the group.", error);
    setMessage(elements.message, "Unable to save changes. Please try again.");
  } finally {
    elements.save.disabled = false;
  }
}

function createStudentItem(student, progressDocuments) {
  const item = document.createElement("li");
  const marker = document.createElement("span");
  const identity = document.createElement("span");
  const link = document.createElement("button");
  const details = document.createElement("span");
  const progress = document.createElement("strong");
  const overall = calculateOverallProgress(progressDocuments);
  marker.className = "group-student-avatar";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = displayValue(student.name).trim().charAt(0).toUpperCase();
  if (typeof student.color === "string" && globalThis.CSS?.supports?.("color", student.color)) {
    marker.style.backgroundColor = student.color;
  }
  link.type = "button";
  link.dataset.groupStudentProfile = student.id;
  link.textContent = displayValue(student.name);
  details.textContent = studentStatus(student);
  progress.textContent = overall === null ? "—" : `${overall}%`;
  progress.setAttribute("aria-label", "Overall progress");
  identity.append(link, details);
  item.append(marker, identity, progress);
  return item;
}

async function openDetails(groupId) {
  elements.detailsEdit.dataset.editGroup = groupId;
  elements.detailsEdit.disabled = true;
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

    const [course, students, progressDocuments] = await Promise.all([
      group.courseId ? coursesRepository.getById(group.courseId) : Promise.resolve(null),
      studentsRepository.listByGroup(groupId),
      progressRepository.list(),
    ]);
    setMessage(elements.detailsName, displayValue(group.name));
    setMessage(elements.detailsCourse, course?.name ?? "Unknown course");
    setMessage(elements.detailsYear, displayValue(group.academicYear));
    setMessage(elements.detailsActive, displayValue(group.active));
    elements.students.replaceChildren(
      ...students.map((student) =>
        createStudentItem(
          student,
          progressDocuments.filter((progress) => progress.studentId === student.id),
        ),
      ),
    );
    elements.studentsEmpty.hidden = students.length > 0;
    elements.detailsState.hidden = true;
    elements.detailsContent.hidden = false;
    elements.detailsEdit.disabled = false;
  } catch (error) {
    console.error("Unable to load group details.", error);
    setMessage(elements.detailsState, "Unable to load group. Please try again.");
  }
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const addButton = target?.closest("[data-add-group]");
  const editButton = target?.closest("[data-edit-group]");
  const openButton = target?.closest("[data-open-group]");
  const studentLink = target?.closest("[data-group-student-profile]");

  if (addButton) void openForm();
  else if (editButton) {
    closeDialog(elements.detailsDialog);
    void openForm(editButton.dataset.editGroup);
  } else if (openButton) void openDetails(openButton.dataset.openGroup);
  else if (studentLink) {
    closeDialog(elements.detailsDialog);
    onOpenStudent(studentLink.dataset.groupStudentProfile);
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
    close: dashboard?.querySelector("[data-group-dialog-close]"),
    detailsDialog: dashboard?.querySelector("[data-group-details-dialog]"),
    detailsName: dashboard?.querySelector("[data-group-details-name]"),
    detailsState: dashboard?.querySelector("[data-group-details-state]"),
    detailsContent: dashboard?.querySelector("[data-group-details-content]"),
    detailsCourse: dashboard?.querySelector("[data-group-details-course]"),
    detailsYear: dashboard?.querySelector("[data-group-details-year]"),
    detailsActive: dashboard?.querySelector("[data-group-details-active]"),
    studentsEmpty: dashboard?.querySelector("[data-group-students-empty]"),
    students: dashboard?.querySelector("[data-group-students]"),
    detailsEdit: dashboard?.querySelector("[data-group-details-edit]"),
    detailsClose: dashboard?.querySelector("[data-group-details-close]"),
  };

  if (Object.values(elements).some((element) => !element)) {
    console.error("Groups CRUD markup is incomplete.");
    return;
  }

  dashboard.addEventListener("click", handleClick);
  elements.form.addEventListener("submit", saveGroup);
  elements.form.addEventListener("input", syncPreview);
  elements.form.addEventListener("change", syncPreview);
  elements.groupDelete.addEventListener("click", deleteGroup);
  elements.close.addEventListener("click", () => closeDialog(elements.dialog));
  elements.detailsClose.addEventListener("click", () => closeDialog(elements.detailsDialog));
}
