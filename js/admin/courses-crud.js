import { coursesRepository } from "../data/repositories/courses-repository.js";
import { unitsRepository } from "../data/repositories/units-repository.js";
import { isNonEmptyText, isPositiveInteger } from "../domain/validation.js";
import { CourseCreationError, createCourseRecord } from "./course-records.js";
import {
  closeDialog,
  displayValue,
  field,
  setMessage,
  setSectionMessage,
  showDialog,
} from "./crud-helpers.js";

let onEntityChanged = null;
let elements = null;
let editingCourseId = null;
let editingUnitId = null;
let unitCourseId = null;

function unitName(unit) {
  if (isNonEmptyText(unit?.title)) return unit.title;
  return unit?.number ? `Unit ${unit.number}` : "Untitled unit";
}

async function openCourseForm(courseId = null) {
  editingCourseId = courseId;
  elements.courseForm.reset();
  field(elements.courseForm, "active").checked = true;
  elements.courseFormTitle.textContent = courseId ? "Edit Course" : "Add Course";
  elements.courseDelete.hidden = !courseId;
  elements.courseDelete.disabled = Boolean(courseId);
  elements.courseSave.disabled = true;
  setMessage(elements.courseFormMessage, courseId ? "Loading…" : "");
  showDialog(elements.courseDialog);

  if (!courseId) {
    elements.courseSave.disabled = false;
    return;
  }

  try {
    const course = await coursesRepository.getById(courseId);
    if (!course) {
      setMessage(elements.courseFormMessage, "Course not found.");
      return;
    }
    field(elements.courseForm, "name").value = course.name ?? "";
    field(elements.courseForm, "level").value = course.level ?? "";
    field(elements.courseForm, "active").checked = course.active !== false;
    elements.courseDelete.disabled = false;
    elements.courseSave.disabled = false;
    setMessage(elements.courseFormMessage, "");
  } catch (error) {
    console.error("Unable to load the course form.", error);
    setMessage(elements.courseFormMessage, "Unable to load form data. Please try again.");
  }
}

async function deleteCourse() {
  if (!editingCourseId) return;

  const confirmed = window.confirm(
    "Delete this course permanently? Related groups, students, and units will not be deleted and will keep their existing course references.",
  );
  if (!confirmed) return;

  const courseId = editingCourseId;
  elements.courseDelete.disabled = true;
  setMessage(elements.courseFormMessage, "Deleting…");

  try {
    await coursesRepository.remove(courseId);
    closeDialog(elements.courseDialog);
    await onEntityChanged("courses");
    setSectionMessage("courses", "Course deleted.");
  } catch (error) {
    console.error("Unable to delete the course.", error);
    setMessage(elements.courseFormMessage, "Unable to delete the course. Please try again.");
  } finally {
    elements.courseDelete.disabled = false;
  }
}

async function saveCourse(event) {
  event.preventDefault();
  const name = field(elements.courseForm, "name").value.trim();
  if (!isNonEmptyText(name)) {
    setMessage(elements.courseFormMessage, "Course name is required.");
    return;
  }

  const payload = {
    name,
    level: field(elements.courseForm, "level").value.trim(),
    active: field(elements.courseForm, "active").checked,
  };
  elements.courseSave.disabled = true;
  setMessage(elements.courseFormMessage, "Saving…");

  try {
    if (editingCourseId) {
      await coursesRepository.update(editingCourseId, payload);
    } else {
      await createCourseRecord(payload);
    }

    const message = editingCourseId ? "Course updated." : "Course added successfully.";
    closeDialog(elements.courseDialog);
    await onEntityChanged("courses");
    setSectionMessage("courses", message);
  } catch (error) {
    console.error("Unable to save the course.", error);
    setMessage(
      elements.courseFormMessage,
      error instanceof CourseCreationError
        ? error.message
        : "Unable to save changes. Please try again.",
    );
  } finally {
    elements.courseSave.disabled = false;
  }
}

function createUnitItem(unit) {
  const item = document.createElement("li");
  const heading = document.createElement("strong");
  const details = document.createElement("span");
  const editButton = document.createElement("button");
  heading.textContent = unitName(unit);
  details.className = "unit-technical-details";
  details.textContent = ` — number ${displayValue(unit.number)}, order ${displayValue(unit.order)}, ${displayValue(unit.active)}`;
  editButton.type = "button";
  editButton.dataset.editUnit = unit.id;
  editButton.textContent = "Edit Unit";
  item.append(heading, details, editButton);
  return item;
}

async function openCourseDetails(courseId, successMessage = "") {
  elements.courseDetailsEdit.dataset.editCourse = courseId;
  elements.addUnit.dataset.addUnit = courseId;
  elements.courseDetailsEdit.disabled = true;
  elements.addUnit.disabled = true;
  setMessage(elements.courseDetailsState, "Loading…");
  elements.courseDetailsState.hidden = false;
  setMessage(elements.courseDetailsMessage, successMessage);
  elements.courseDetailsContent.hidden = true;
  showDialog(elements.courseDetailsDialog);

  try {
    const course = await coursesRepository.getById(courseId);
    if (!course) {
      setMessage(elements.courseDetailsState, "Course not found.");
      return;
    }

    const units = await unitsRepository.listByCourse(courseId);
    setMessage(elements.courseDetailsName, displayValue(course.name));
    setMessage(elements.courseDetailsLevel, displayValue(course.level));
    setMessage(elements.courseDetailsActive, displayValue(course.active));
    elements.units.replaceChildren(...units.map(createUnitItem));
    elements.unitsEmpty.hidden = units.length > 0;
    elements.courseDetailsState.hidden = true;
    elements.courseDetailsContent.hidden = false;
    elements.courseDetailsEdit.disabled = false;
    elements.addUnit.disabled = false;
  } catch (error) {
    console.error("Unable to load course details.", error);
    setMessage(elements.courseDetailsState, "Unable to load course. Please try again.");
  }
}

async function openUnitForm(courseId, unitId = null) {
  unitCourseId = courseId;
  editingUnitId = unitId;
  elements.unitForm.reset();
  field(elements.unitForm, "active").checked = true;
  elements.unitFormTitle.textContent = unitId ? "Edit Unit" : "Add Unit";
  elements.unitSave.disabled = true;
  setMessage(elements.unitFormMessage, "Loading…");
  showDialog(elements.unitDialog);

  try {
    const [course, units, unit] = await Promise.all([
      coursesRepository.getById(courseId),
      unitsRepository.listByCourse(courseId),
      unitId ? unitsRepository.getById(unitId) : Promise.resolve(null),
    ]);
    if (!course) {
      setMessage(elements.unitFormMessage, "Course not found.");
      return;
    }
    if (unitId && (!unit || unit.courseId !== courseId)) {
      setMessage(elements.unitFormMessage, "Unit not found.");
      return;
    }

    setMessage(elements.unitCourseName, displayValue(course.name));
    if (unit) {
      field(elements.unitForm, "number").value = unit.number ?? "";
      field(elements.unitForm, "title").value = unit.title ?? "";
      field(elements.unitForm, "order").value = unit.order ?? "";
      field(elements.unitForm, "active").checked = unit.active !== false;
    } else {
      const nextOrder = units.reduce(
        (highest, current) => Math.max(highest, Number(current.order) || 0),
        0,
      ) + 1;
      field(elements.unitForm, "number").value = nextOrder;
      field(elements.unitForm, "order").value = nextOrder;
    }

    elements.unitSave.disabled = false;
    setMessage(elements.unitFormMessage, "");
  } catch (error) {
    console.error("Unable to load the unit form.", error);
    setMessage(elements.unitFormMessage, "Unable to load form data. Please try again.");
  }
}

async function saveUnit(event) {
  event.preventDefault();
  const number = Number(field(elements.unitForm, "number").value);
  const title = field(elements.unitForm, "title").value.trim();
  const order = Number(field(elements.unitForm, "order").value);

  if (!isPositiveInteger(number)) {
    setMessage(elements.unitFormMessage, "Unit number must be a positive integer.");
    return;
  }
  if (!isNonEmptyText(title)) {
    setMessage(elements.unitFormMessage, "Unit title is required.");
    return;
  }
  if (!isPositiveInteger(order)) {
    setMessage(elements.unitFormMessage, "Order must be a positive integer.");
    return;
  }
  if (!unitCourseId) {
    setMessage(elements.unitFormMessage, "Course is required.");
    return;
  }

  const payload = {
    courseId: unitCourseId,
    number,
    title,
    order,
    active: field(elements.unitForm, "active").checked,
  };
  elements.unitSave.disabled = true;
  setMessage(elements.unitFormMessage, "Saving…");

  try {
    if (editingUnitId) await unitsRepository.update(editingUnitId, payload);
    else await unitsRepository.create(payload);

    const message = editingUnitId ? "Unit updated." : "Unit added successfully.";
    const courseId = unitCourseId;
    closeDialog(elements.unitDialog);
    await onEntityChanged("units");
    await openCourseDetails(courseId, message);
  } catch (error) {
    console.error("Unable to save the unit.", error);
    setMessage(elements.unitFormMessage, "Unable to save changes. Please try again.");
  } finally {
    elements.unitSave.disabled = false;
  }
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const addCourse = target?.closest("[data-add-course]");
  const editCourse = target?.closest("[data-edit-course]");
  const openCourse = target?.closest("[data-open-course]");
  const addUnit = target?.closest("[data-add-unit]");
  const editUnit = target?.closest("[data-edit-unit]");

  if (addCourse) void openCourseForm();
  else if (editCourse) {
    closeDialog(elements.courseDetailsDialog);
    void openCourseForm(editCourse.dataset.editCourse);
  } else if (openCourse) void openCourseDetails(openCourse.dataset.openCourse);
  else if (addUnit) {
    closeDialog(elements.courseDetailsDialog);
    void openUnitForm(addUnit.dataset.addUnit);
  } else if (editUnit) {
    const courseId = elements.addUnit.dataset.addUnit;
    closeDialog(elements.courseDetailsDialog);
    void openUnitForm(courseId, editUnit.dataset.editUnit);
  }
}

export function initializeCoursesCrud(options) {
  onEntityChanged = options.onEntityChanged;
  const dashboard = document.querySelector("[data-protected-content]");
  elements = {
    dashboard,
    courseDialog: dashboard?.querySelector("[data-course-dialog]"),
    courseForm: dashboard?.querySelector("[data-course-form]"),
    courseFormTitle: dashboard?.querySelector("[data-course-form-title]"),
    courseFormMessage: dashboard?.querySelector("[data-course-form-message]"),
    courseSave: dashboard?.querySelector("[data-course-save]"),
    courseDelete: dashboard?.querySelector("[data-course-delete]"),
    courseClose: dashboard?.querySelector("[data-course-dialog-close]"),
    courseDetailsDialog: dashboard?.querySelector("[data-course-details-dialog]"),
    courseDetailsName: dashboard?.querySelector("[data-course-details-name]"),
    courseDetailsState: dashboard?.querySelector("[data-course-details-state]"),
    courseDetailsMessage: dashboard?.querySelector("[data-course-details-message]"),
    courseDetailsContent: dashboard?.querySelector("[data-course-details-content]"),
    courseDetailsLevel: dashboard?.querySelector("[data-course-details-level]"),
    courseDetailsActive: dashboard?.querySelector("[data-course-details-active]"),
    addUnit: dashboard?.querySelector("[data-course-details-add-unit]"),
    unitsEmpty: dashboard?.querySelector("[data-course-units-empty]"),
    units: dashboard?.querySelector("[data-course-units]"),
    courseDetailsEdit: dashboard?.querySelector("[data-course-details-edit]"),
    courseDetailsClose: dashboard?.querySelector("[data-course-details-close]"),
    unitDialog: dashboard?.querySelector("[data-unit-dialog]"),
    unitForm: dashboard?.querySelector("[data-unit-form]"),
    unitFormTitle: dashboard?.querySelector("[data-unit-form-title]"),
    unitFormMessage: dashboard?.querySelector("[data-unit-form-message]"),
    unitCourseName: dashboard?.querySelector("[data-unit-course-name]"),
    unitSave: dashboard?.querySelector("[data-unit-save]"),
    unitClose: dashboard?.querySelector("[data-unit-dialog-close]"),
  };

  if (Object.values(elements).some((element) => !element)) {
    console.error("Courses CRUD markup is incomplete.");
    return;
  }

  dashboard.addEventListener("click", handleClick);
  elements.courseForm.addEventListener("submit", saveCourse);
  elements.courseDelete.addEventListener("click", deleteCourse);
  elements.unitForm.addEventListener("submit", saveUnit);
  elements.courseClose.addEventListener("click", () => closeDialog(elements.courseDialog));
  elements.courseDetailsClose.addEventListener("click", () =>
    closeDialog(elements.courseDetailsDialog),
  );
  elements.unitClose.addEventListener("click", () => closeDialog(elements.unitDialog));
}
