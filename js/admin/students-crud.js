import { coursesRepository } from "../data/repositories/courses-repository.js";
import { groupsRepository } from "../data/repositories/groups-repository.js";
import { studentsRepository } from "../data/repositories/students-repository.js";
import {
  DEFAULT_STUDENT_VISUAL_THEME,
  STUDENT_STATUSES,
} from "../domain/constants.js";
import {
  isNonEmptyText,
  isStudentStatus,
  isStudentVisualTheme,
  isValidHexColor,
} from "../domain/validation.js";
import {
  closeDialog,
  field,
  populateDocumentSelect,
  setMessage,
  setSectionMessage,
  showDialog,
} from "./crud-helpers.js";
import { CourseCreationError, createCourseRecord } from "./course-records.js";

let onEntityChanged = null;
let elements = null;
let editingStudentId = null;
let availableGroups = [];
let availableCourses = [];

function studentStatus(student) {
  if (isStudentStatus(student.status)) return student.status;
  return student.active === false ? "paused" : "active";
}

function syncCourseToGroup() {
  const group = availableGroups.find(
    (candidate) => candidate.id === elements.group.value,
  );
  if (group && availableCourses.some((course) => course.id === group.courseId)) {
    elements.course.value = group.courseId;
  }
  syncPreview();
}

function selectedLabel(select, fallback) {
  const label = select.selectedOptions[0]?.textContent?.trim();
  return label && select.value ? label : fallback;
}

function syncPreview() {
  const name = field(elements.form, "name").value.trim() || "Student name";
  const color = field(elements.form, "color").value;
  elements.previewName.textContent = name;
  elements.previewInitial.textContent = name.charAt(0).toUpperCase();
  elements.previewInitial.style.backgroundColor = isValidHexColor(color)
    ? color
    : "#4f46e5";
  elements.previewGroup.textContent = selectedLabel(elements.group, "Individual");
  elements.previewCourse.textContent = selectedLabel(elements.course, "Select course");
  elements.previewStatus.textContent = field(elements.form, "status").selectedOptions[0]?.textContent ?? "Active";
  elements.previewTheme.textContent = elements.visualTheme.selectedOptions[0]?.textContent ?? "Neutral / Teen / Adult";
}

function setCourseCreatorOpen(isOpen) {
  elements.courseCreator.hidden = !isOpen;
  elements.courseCreatorToggle.setAttribute("aria-expanded", String(isOpen));
  if (!isOpen) {
    elements.newCourseName.value = "";
    elements.newCourseLevel.value = "";
    elements.newCourseActive.checked = true;
    setMessage(elements.courseCreatorMessage, "");
  }
}

async function createCourseForStudent() {
  if (elements.createCourse.disabled) return;
  elements.createCourse.disabled = true;
  setMessage(elements.courseCreatorMessage, "Saving…");

  try {
    const course = await createCourseRecord({
      name: elements.newCourseName.value,
      level: elements.newCourseLevel.value,
      active: elements.newCourseActive.checked,
    });
    availableCourses = [...availableCourses, course];
    populateDocumentSelect(elements.course, availableCourses, "Select course");
    elements.course.value = course.id;
    setCourseCreatorOpen(false);
    syncPreview();
    setMessage(elements.message, `Course “${course.name}” created and selected.`);

    try {
      await onEntityChanged("courses");
    } catch (error) {
      console.error("Course created, but dashboard data could not be refreshed.", error);
    }
  } catch (error) {
    console.error("Unable to create the course from the student form.", error);
    setMessage(
      elements.courseCreatorMessage,
      error instanceof CourseCreationError
        ? error.message
        : "Unable to create the course. Please try again.",
    );
  } finally {
    elements.createCourse.disabled = false;
  }
}

async function openForm(studentId = null) {
  editingStudentId = studentId;
  elements.form.reset();
  field(elements.form, "color").value = "#4f46e5";
  field(elements.form, "status").value = "active";
  elements.visualTheme.value = DEFAULT_STUDENT_VISUAL_THEME;
  setCourseCreatorOpen(false);
  elements.title.textContent = studentId ? "Edit Student" : "Add Student";
  syncPreview();
  elements.save.disabled = true;
  setMessage(elements.message, "Loading…");
  showDialog(elements.dialog);

  try {
    const [groups, courses, student] = await Promise.all([
      groupsRepository.list(),
      coursesRepository.list(),
      studentId ? studentsRepository.getById(studentId) : Promise.resolve(null),
    ]);
    availableGroups = groups;
    availableCourses = courses;
    populateDocumentSelect(elements.group, groups, "Individual — no group");
    populateDocumentSelect(elements.course, courses, "Select course");

    if (studentId && !student) {
      setMessage(elements.message, "Student not found.");
      return;
    }

    if (student) {
      field(elements.form, "name").value = student.name ?? "";
      elements.group.value = student.groupId ?? "";
      elements.course.value = student.courseId ?? "";
      field(elements.form, "color").value = isValidHexColor(student.color)
        ? student.color
        : "#4f46e5";
      field(elements.form, "status").value = studentStatus(student);
      elements.visualTheme.value = isStudentVisualTheme(student.visualTheme)
        ? student.visualTheme
        : DEFAULT_STUDENT_VISUAL_THEME;
    }

    syncPreview();
    elements.save.disabled = false;
    setMessage(elements.message, "");
  } catch (error) {
    console.error("Unable to load the student form.", error);
    setMessage(elements.message, "Unable to load form data. Please try again.");
  }
}

async function saveStudent(event) {
  event.preventDefault();
  const name = field(elements.form, "name").value.trim();
  const groupId = elements.group.value;
  const courseId = elements.course.value;
  const color = field(elements.form, "color").value;
  const status = field(elements.form, "status").value;
  const visualTheme = elements.visualTheme.value;
  const group = availableGroups.find((candidate) => candidate.id === groupId);
  const course = availableCourses.find((candidate) => candidate.id === courseId);

  if (!isNonEmptyText(name)) {
    setMessage(elements.message, "Student name is required.");
    return;
  }
  if (!course) {
    setMessage(elements.message, "Select a course.");
    return;
  }
  if (group && group.courseId !== courseId) {
    setMessage(elements.message, "Selected group belongs to a different course.");
    return;
  }
  if (!isValidHexColor(color)) {
    setMessage(elements.message, "Select a valid color.");
    return;
  }
  if (!STUDENT_STATUSES.includes(status)) {
    setMessage(elements.message, "Select a valid status.");
    return;
  }
  if (!isStudentVisualTheme(visualTheme)) {
    setMessage(elements.message, "Select a valid student interface.");
    return;
  }

  const payload = {
    name,
    groupId,
    courseId,
    color,
    status,
    active: status === "active",
    visualTheme,
  };
  elements.save.disabled = true;
  setMessage(elements.message, "Saving…");

  try {
    if (editingStudentId) await studentsRepository.update(editingStudentId, payload);
    else await studentsRepository.create(payload);

    const message = editingStudentId
      ? "Student updated."
      : "Student added successfully.";
    closeDialog(elements.dialog);
    await onEntityChanged("students");
    setSectionMessage("students", message);
  } catch (error) {
    console.error("Unable to save the student.", error);
    setMessage(elements.message, "Unable to save changes. Please try again.");
  } finally {
    elements.save.disabled = false;
  }
}

async function archiveStudent(studentId) {
  if (!window.confirm("Archive this student?")) return;

  try {
    await studentsRepository.update(studentId, { status: "archived", active: false });
    await onEntityChanged("students");
    setSectionMessage("students", "Student archived.");
  } catch (error) {
    console.error("Unable to archive the student.", error);
    setSectionMessage("students", "Unable to save changes. Please try again.");
  }
}

async function deleteStudent(studentId) {
  const confirmed = window.confirm(
    "Delete this student permanently? Related progress, goals, and teacher notes will not be deleted.",
  );
  if (!confirmed) return;

  try {
    await studentsRepository.remove(studentId);
    await onEntityChanged("students");
    setSectionMessage("students", "Student deleted.");
  } catch (error) {
    console.error("Unable to delete the student.", error);
    setSectionMessage("students", "Unable to delete the student. Please try again.");
  }
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const addButton = target?.closest("[data-add-student]");
  const editButton = target?.closest("[data-edit-student]");
  const archiveButton = target?.closest("[data-archive-student]");
  const deleteButton = target?.closest("[data-delete-student]");

  if (addButton) void openForm();
  else if (editButton) void openForm(editButton.dataset.editStudent);
  else if (archiveButton) void archiveStudent(archiveButton.dataset.archiveStudent);
  else if (deleteButton) void deleteStudent(deleteButton.dataset.deleteStudent);
}

export function initializeStudentsCrud(options) {
  onEntityChanged = options.onEntityChanged;
  const dashboard = document.querySelector("[data-protected-content]");
  elements = {
    dashboard,
    dialog: dashboard?.querySelector("[data-student-dialog]"),
    form: dashboard?.querySelector("[data-student-form]"),
    title: dashboard?.querySelector("[data-student-form-title]"),
    message: dashboard?.querySelector("[data-student-form-message]"),
    group: dashboard?.querySelector("[data-student-group]"),
    course: dashboard?.querySelector("[data-student-course]"),
    visualTheme: dashboard?.querySelector("[data-student-visual-theme]"),
    previewInitial: dashboard?.querySelector("[data-student-preview-initial]"),
    previewName: dashboard?.querySelector("[data-student-preview-name]"),
    previewGroup: dashboard?.querySelector("[data-student-preview-group]"),
    previewCourse: dashboard?.querySelector("[data-student-preview-course]"),
    previewStatus: dashboard?.querySelector("[data-student-preview-status]"),
    previewTheme: dashboard?.querySelector("[data-student-preview-theme]"),
    save: dashboard?.querySelector("[data-student-save]"),
    close: dashboard?.querySelector("[data-student-dialog-close]"),
    courseCreator: dashboard?.querySelector("[data-student-course-creator]"),
    courseCreatorToggle: dashboard?.querySelector("[data-student-course-create-toggle]"),
    courseCreatorMessage: dashboard?.querySelector("[data-student-course-create-message]"),
    newCourseName: dashboard?.querySelector("[data-student-new-course-name]"),
    newCourseLevel: dashboard?.querySelector("[data-student-new-course-level]"),
    newCourseActive: dashboard?.querySelector("[data-student-new-course-active]"),
    createCourse: dashboard?.querySelector("[data-student-course-create]"),
    cancelCourseCreation: dashboard?.querySelector("[data-student-course-create-cancel]"),
  };

  if (Object.values(elements).some((element) => !element)) {
    console.error("Students CRUD markup is incomplete.");
    return;
  }

  dashboard.addEventListener("click", handleClick);
  elements.group.addEventListener("change", syncCourseToGroup);
  elements.form.addEventListener("input", syncPreview);
  elements.form.addEventListener("change", syncPreview);
  elements.form.addEventListener("submit", saveStudent);
  elements.courseCreatorToggle.addEventListener("click", () => {
    const shouldOpen = elements.courseCreator.hidden;
    setCourseCreatorOpen(shouldOpen);
    if (shouldOpen) elements.newCourseName.focus();
  });
  elements.courseCreator.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.target === elements.createCourse) return;
    event.preventDefault();
    void createCourseForStudent();
  });
  elements.createCourse.addEventListener("click", createCourseForStudent);
  elements.cancelCourseCreation.addEventListener("click", () => setCourseCreatorOpen(false));
  elements.close.addEventListener("click", () => closeDialog(elements.dialog));
}
