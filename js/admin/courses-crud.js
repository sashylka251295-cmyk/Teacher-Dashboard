import { coursesRepository } from "../data/repositories/courses-repository.js";
import { OWN_IT_A2_PROGRAM } from "../data/course-programs/own-it-a2-course.js";
import { WIDER_WORLD_1_UNIT_4_LESSON_PLAN } from "../data/course-programs/wider-world-1-unit-4-lessons.js";
import { courseProgramPrivateRepository } from "../data/repositories/course-program-private-repository.js";
import { lessonsRepository } from "../data/repositories/lessons-repository.js";
import { unitsRepository } from "../data/repositories/units-repository.js";
import {
  LESSON_STATUSES,
  RESOURCE_TYPES,
  UNIT_PRIORITIES,
  UNIT_STATUSES,
  VOCABULARY_STATUSES,
  VOCABULARY_TYPES,
  WIDER_WORLD_1_PILOT,
  activeVocabularyCompatibility,
  createProgramItemId,
  lessonFocuses,
  normalizeResources,
  normalizeSkillGoals,
  normalizeTextItems,
  normalizeVocabularyItems,
} from "../domain/course-program.js";
import {
  LANGUAGE_SKILL_CATEGORIES,
  LANGUAGE_SKILL_LABELS,
} from "../domain/constants.js";
import {
  ENTITY_IMAGE_CONFIG,
  ENTITY_IMAGE_TYPES,
  entityImageFields,
} from "../domain/entity-images.js";
import {
  isLanguageSkillCategory,
  learningObjectivesForLesson,
  learningObjectivesForUnit,
  normalizeUnitObjectives,
} from "../domain/learning-objectives.js";
import { lessonStopsForUnit } from "../domain/physical-progress.js";
import { isNonEmptyText, isPositiveInteger } from "../domain/validation.js";
import {
  CourseCreationError,
  courseIdForName,
  createCourseRecord,
} from "./course-records.js";
import {
  closeDialog,
  displayValue,
  field,
  setMessage,
  setSectionMessage,
  showDialog,
} from "./crud-helpers.js";
import { createEntityImageField } from "./entity-image-field.js";
import { installCourseProgram } from "./course-program-installer.js";

let onEntityChanged = null;
let elements = null;
let editingCourseId = null;
let editingUnitId = null;
let unitCourseId = null;
let unitObjectives = [];
let unitVocabulary = [];
let unitResources = [];
let lessonVocabulary = [];
let lessonActivities = [];
let lessonResources = [];
let currentUnitDetails = null;
let currentUnitLessons = [];
let editingLessonId = null;
let creatingLesson = false;
let unitVocabularyQuickFilter = "all";
let visibleUnitVocabulary = [];
let courseImageField = null;
let unitImageField = null;

const titleCase = (value) => typeof value === "string" && value
  ? `${value.charAt(0).toUpperCase()}${value.slice(1)}`
  : "—";

function textField(form, name, value = "") {
  field(form, name).value = typeof value === "string" ? value : "";
}

async function optionalProgramData(promise, label, fallback) {
  try {
    return await promise;
  } catch (error) {
    console.warn(`Optional course-program data is unavailable: ${label}.`, error);
    return fallback;
  }
}

function unitName(unit) {
  if (isNonEmptyText(unit?.title)) return unit.title;
  return unit?.number ? `Unit ${unit.number}` : "Untitled unit";
}

async function openCourseForm(courseId = null) {
  editingCourseId = courseId;
  elements.courseForm.reset();
  courseImageField.reset();
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
    const [course, privateData] = await Promise.all([
      coursesRepository.getById(courseId),
      optionalProgramData(
        courseProgramPrivateRepository.getById(
          courseProgramPrivateRepository.courseId(courseId),
        ),
        "course teacher notes",
        null,
      ),
    ]);
    if (!course) {
      setMessage(elements.courseFormMessage, "Course not found.");
      return;
    }
    field(elements.courseForm, "name").value = course.name ?? "";
    textField(elements.courseForm, "edition", course.edition);
    field(elements.courseForm, "level").value = course.level ?? "";
    textField(elements.courseForm, "ageRange", course.ageRange);
    textField(elements.courseForm, "defaultStartingPoint", course.defaultStartingPoint);
    textField(elements.courseForm, "frequency", course.frequency);
    textField(elements.courseForm, "description", course.description);
    textField(elements.courseForm, "generalGoal", course.generalGoal);
    textField(elements.courseForm, "teacherNotes", privateData?.teacherNotes);
    field(elements.courseForm, "active").checked = course.active !== false;
    courseImageField.reset(course);
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
    await courseProgramPrivateRepository.remove(
      courseProgramPrivateRepository.courseId(courseId),
    );
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
    edition: field(elements.courseForm, "edition").value.trim(),
    level: field(elements.courseForm, "level").value.trim(),
    ageRange: field(elements.courseForm, "ageRange").value.trim(),
    defaultStartingPoint: field(elements.courseForm, "defaultStartingPoint").value.trim(),
    frequency: field(elements.courseForm, "frequency").value.trim(),
    description: field(elements.courseForm, "description").value.trim(),
    generalGoal: field(elements.courseForm, "generalGoal").value.trim(),
    active: field(elements.courseForm, "active").checked,
  };
  const teacherNotes = field(elements.courseForm, "teacherNotes").value.trim();
  const courseId = editingCourseId ?? courseIdForName(name);
  if (!courseId) {
    setMessage(elements.courseFormMessage, "Unable to create a course identifier.");
    return;
  }
  elements.courseSave.disabled = true;
  setMessage(elements.courseFormMessage, "Saving…");

  let preparedImage = null;
  let courseSaved = false;
  let createdCourseDocument = false;
  try {
    preparedImage = await courseImageField.prepare(courseId);
    Object.assign(payload, entityImageFields(ENTITY_IMAGE_TYPES.COURSE, preparedImage));
    if (editingCourseId) {
      await coursesRepository.update(editingCourseId, payload);
    } else {
      await createCourseRecord(payload);
      createdCourseDocument = true;
    }
    await courseProgramPrivateRepository.createWithId(
      courseProgramPrivateRepository.courseId(courseId),
      { entityType: "course", entityId: courseId, teacherNotes },
    );
    courseSaved = true;
    await courseImageField.commit(preparedImage);

    const message = editingCourseId ? "Course updated." : "Course added successfully.";
    closeDialog(elements.courseDialog);
    await onEntityChanged("courses");
    setSectionMessage("courses", message);
  } catch (error) {
    if (createdCourseDocument && !courseSaved) {
      await coursesRepository.remove(courseId).catch(() => {});
    }
    if (!courseSaved) await courseImageField.rollback(preparedImage);
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

function widerWorldProgram() {
  const unit = structuredClone(WIDER_WORLD_1_PILOT.unit);
  unit.estimatedLessons = WIDER_WORLD_1_UNIT_4_LESSON_PLAN.estimatedLessons;
  unit.vocabulary = [];
  unit.activeVocabulary = [];
  return {
    course: structuredClone(WIDER_WORLD_1_PILOT.course),
    units: [unit],
    lessons: structuredClone(WIDER_WORLD_1_UNIT_4_LESSON_PLAN.lessons).map((lesson) => ({
      ...lesson,
      vocabularyItemIds: [],
    })),
  };
}

async function installProgram(button, program, pendingMessage, successMessage) {
  button.disabled = true;
  setSectionMessage("courses", pendingMessage);
  try {
    await installCourseProgram(program);
    await onEntityChanged("courses");
    await onEntityChanged("units");
    setSectionMessage("courses", successMessage);
  } catch (error) {
    console.error(`Unable to create ${program.course?.name || "the course"}.`, error);
    setSectionMessage("courses", error.message || "Unable to create the course.", "error");
  } finally {
    button.disabled = false;
  }
}

function installWiderWorldPilot(button) {
  return installProgram(
    button,
    widerWorldProgram(),
    "Creating Wider World 1 and Unit 4…",
    "Wider World 1 pilot created. Open the course to review Unit 4.",
  );
}

function installOwnItA2(button) {
  return installProgram(
    button,
    OWN_IT_A2_PROGRAM,
    "Creating Own It! A2 and Units 6–9…",
    "Own It! A2 created. Unit 6 is ready; Units 7–9 are planned shells.",
  );
}

async function clearLegacyVocabulary(button) {
  button.disabled = true;
  setSectionMessage("courses", "Checking stored vocabulary…");
  try {
    const [units, lessons] = await Promise.all([
      unitsRepository.list(),
      lessonsRepository.list(),
    ]);
    const unitsToClear = units.filter((unit) =>
      (Array.isArray(unit.vocabulary) && unit.vocabulary.length)
      || (Array.isArray(unit.activeVocabulary) && unit.activeVocabulary.length));
    const lessonsToClear = lessons.filter((lesson) =>
      (Array.isArray(lesson.vocabularyItemIds) && lesson.vocabularyItemIds.length)
      || (Array.isArray(lesson.targetVocabulary) && lesson.targetVocabulary.length));
    const unitUpdates = units.map((unit) => {
      const unitLessons = lessons.filter((lesson) => lesson.unitId === unit.id);
      return {
        unit,
        lessonStops: unitLessons.length
          ? lessonStopsForUnit({ ...unit, lessonStops: [] }, unitLessons)
          : [],
        clearVocabulary: unitsToClear.some(({ id }) => id === unit.id),
      };
    }).filter(({ unit, lessonStops, clearVocabulary }) =>
      clearVocabulary || JSON.stringify(unit.lessonStops ?? []) !== JSON.stringify(lessonStops));
    if (!unitUpdates.length && !lessonsToClear.length) {
      setSectionMessage("courses", "Course content is already simplified and lesson journeys are up to date.");
      return;
    }
    const confirmed = window.confirm(
      `Remove embedded vocabulary from ${unitsToClear.length} units and ${lessonsToClear.length} lessons, and sync safe lesson journeys for ${unitUpdates.length} units? This does not remove learning targets or observations.`,
    );
    if (!confirmed) {
      setSectionMessage("courses", "Vocabulary cleanup cancelled.");
      return;
    }
    await Promise.all([
      ...unitUpdates.map(({ unit, lessonStops, clearVocabulary }) => unitsRepository.update(unit.id, {
        ...(clearVocabulary ? { vocabulary: [], activeVocabulary: [] } : {}),
        lessonStops,
      })),
      ...lessonsToClear.map((lesson) => lessonsRepository.update(lesson.id, {
        vocabularyItemIds: [],
        targetVocabulary: [],
      })),
    ]);
    await onEntityChanged("units");
    setSectionMessage(
      "courses",
      `Vocabulary removed from ${unitsToClear.length} units and ${lessonsToClear.length} lessons. ${unitUpdates.length} unit journeys synced.`,
    );
  } catch (error) {
    console.error("Unable to clear legacy vocabulary.", error);
    setSectionMessage("courses", "Unable to clear stored vocabulary. Please try again.", "error");
  } finally {
    button.disabled = false;
  }
}

function createUnitItem(unit, lessons = []) {
  const item = document.createElement("li");
  const cover = document.createElement("figure");
  const image = document.createElement("img");
  const content = document.createElement("div");
  const number = document.createElement("span");
  const heading = document.createElement("h4");
  const details = document.createElement("p");
  const menu = document.createElement("details");
  const menuToggle = document.createElement("summary");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");
  const fallback = ENTITY_IMAGE_CONFIG[ENTITY_IMAGE_TYPES.UNIT].fallbackUrl;
  item.className = "unit-card";
  item.dataset.openUnit = unit.id;
  item.tabIndex = 0;
  item.setAttribute("role", "link");
  item.setAttribute("aria-label", `Open Unit ${unit.number ?? ""}: ${unitName(unit)}`);
  image.src = unit.coverImageUrl || fallback;
  image.alt = `${unitName(unit)} cover`;
  image.addEventListener("error", () => { image.src = fallback; }, { once: true });
  cover.append(image);
  number.className = "unit-card__number";
  number.textContent = `Unit ${unit.number ?? unit.order ?? "—"}`;
  heading.textContent = unitName(unit);
  const summary = [
    `${lessons.length || Number(unit.estimatedLessons) || "—"} lessons`,
    `${learningObjectivesForUnit(unit).length} learning targets`,
  ];
  details.textContent = summary.join(" · ");
  details.className = "unit-card__details";
  const goal = document.createElement("p");
  goal.className = "unit-card__goal";
  goal.textContent = isNonEmptyText(unit.mainGoal) ? unit.mainGoal : "Content coming next";
  if (!isNonEmptyText(unit.mainGoal)) goal.dataset.empty = "true";
  content.append(number, heading, details, goal);
  content.className = "unit-card__content";
  menu.className = "unit-card__menu";
  menuToggle.setAttribute("aria-label", `Actions for ${unitName(unit)}`);
  menuToggle.textContent = "•••";
  editButton.type = "button";
  editButton.dataset.editUnit = unit.id;
  editButton.textContent = "Edit";
  deleteButton.type = "button";
  deleteButton.dataset.deleteUnit = unit.id;
  deleteButton.textContent = "Delete";
  menu.append(menuToggle, editButton, deleteButton);
  item.append(cover, content, menu);
  return item;
}

function createObjectiveId() {
  return globalThis.crypto?.randomUUID?.() ??
    `objective-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function moveObjective(objectiveId, direction) {
  const currentIndex = unitObjectives.findIndex(({ id }) => id === objectiveId);
  if (currentIndex < 0) return;
  const category = unitObjectives[currentIndex].category;
  const categoryIndexes = unitObjectives
    .map((objective, index) => ({ objective, index }))
    .filter(({ objective }) => objective.category === category)
    .map(({ index }) => index);
  const position = categoryIndexes.indexOf(currentIndex);
  const nextIndex = categoryIndexes[position + direction];
  if (nextIndex === undefined) return;
  [unitObjectives[currentIndex], unitObjectives[nextIndex]] = [
    unitObjectives[nextIndex],
    unitObjectives[currentIndex],
  ];
  renderObjectiveEditor();
}

function createObjectiveRow(objective, index, categoryObjectives) {
  const row = document.createElement("div");
  const input = document.createElement("input");
  const up = document.createElement("button");
  const down = document.createElement("button");
  const remove = document.createElement("button");
  const skills = document.createElement("details");
  const skillsSummary = document.createElement("summary");
  const skillsList = document.createElement("div");
  row.className = "unit-objective-row";
  row.dataset.objectiveId = objective.id;
  input.type = "text";
  input.value = objective.title;
  input.placeholder = `Add a ${LANGUAGE_SKILL_LABELS[objective.category].toLowerCase()} objective`;
  input.setAttribute("aria-label", `${LANGUAGE_SKILL_LABELS[objective.category]} objective`);
  input.dataset.objectiveTitle = objective.id;
  skills.className = "objective-skill-picker";
  skillsSummary.textContent = "Skills";
  const selectedSkills = new Set(objective.categories ?? [objective.category]);
  LANGUAGE_SKILL_CATEGORIES.forEach((skill) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = skill;
    checkbox.checked = selectedSkills.has(skill);
    checkbox.disabled = skill === objective.category;
    checkbox.dataset.objectiveSkill = objective.id;
    label.append(checkbox, document.createTextNode(` ${LANGUAGE_SKILL_LABELS[skill]}`));
    skillsList.append(label);
  });
  skills.append(skillsSummary, skillsList);
  up.type = down.type = remove.type = "button";
  up.textContent = "↑";
  down.textContent = "↓";
  remove.textContent = "Delete";
  up.dataset.moveObjective = "up";
  down.dataset.moveObjective = "down";
  remove.dataset.removeObjective = objective.id;
  up.disabled = index === 0;
  down.disabled = index === categoryObjectives.length - 1;
  row.append(input, skills, up, down, remove);
  return row;
}

function renderObjectiveEditor() {
  elements.unitObjectives.replaceChildren();
  LANGUAGE_SKILL_CATEGORIES.forEach((category) => {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    const list = document.createElement("div");
    const add = document.createElement("button");
    const objectives = unitObjectives.filter((objective) => objective.category === category);
    section.className = "unit-objective-category";
    section.dataset.objectiveCategory = category;
    heading.textContent = LANGUAGE_SKILL_LABELS[category];
    list.append(...objectives.map((objective, index) =>
      createObjectiveRow(objective, index, objectives),
    ));
    add.type = "button";
    add.dataset.addObjective = category;
    add.textContent = `+ Add ${LANGUAGE_SKILL_LABELS[category]} objective`;
    section.append(heading, list, add);
    elements.unitObjectives.append(section);
  });
}

function syncObjectiveTitles() {
  for (const input of elements.unitObjectives.querySelectorAll("[data-objective-title]")) {
    const objective = unitObjectives.find(({ id }) => id === input.dataset.objectiveTitle);
    if (objective) objective.title = input.value;
  }
  for (const objective of unitObjectives) {
    objective.categories = [
      objective.category,
      ...elements.unitObjectives
        .querySelectorAll(`[data-objective-skill="${objective.id}"]:checked`),
    ].map((value) => typeof value === "string" ? value : value.value)
      .filter((category, index, values) =>
        isLanguageSkillCategory(category) && values.indexOf(category) === index);
  }
}

function handleObjectiveEditorClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const add = target?.closest("[data-add-objective]");
  const remove = target?.closest("[data-remove-objective]");
  const move = target?.closest("[data-move-objective]");
  syncObjectiveTitles();

  if (add && isLanguageSkillCategory(add.dataset.addObjective)) {
    unitObjectives.push({
      id: createObjectiveId(),
      category: add.dataset.addObjective,
      categories: [add.dataset.addObjective],
      title: "",
      order: unitObjectives.length + 1,
    });
    renderObjectiveEditor();
    elements.unitObjectives.querySelector(
      `[data-objective-category="${add.dataset.addObjective}"] input:last-of-type`,
    )?.focus();
  } else if (remove) {
    unitObjectives = unitObjectives.filter(({ id }) => id !== remove.dataset.removeObjective);
    renderObjectiveEditor();
  } else if (move) {
    const row = move.closest("[data-objective-id]");
    moveObjective(row?.dataset.objectiveId, move.dataset.moveObjective === "up" ? -1 : 1);
  }
}

function createVocabularyEditorRow(item, scope) {
  const row = document.createElement("div");
  const text = document.createElement("input");
  const type = document.createElement("select");
  const status = document.createElement("select");
  const category = document.createElement("input");
  const note = document.createElement("input");
  const remove = document.createElement("button");
  row.className = "program-vocabulary-row";
  row.dataset.vocabularyId = item.id;
  text.value = item.text;
  text.placeholder = "Word, chunk or phrase";
  text.dataset.vocabularyField = "text";
  type.append(...resourceOptions(VOCABULARY_TYPES, item.type));
  type.dataset.vocabularyField = "type";
  status.append(...resourceOptions(VOCABULARY_STATUSES, item.status));
  status.dataset.vocabularyField = "status";
  category.value = item.category;
  category.placeholder = "Optional category";
  category.dataset.vocabularyField = "category";
  note.value = item.note;
  note.placeholder = "Optional note";
  note.dataset.vocabularyField = "note";
  remove.type = "button";
  remove.dataset[scope === "lesson" ? "removeLessonVocabulary" : "removeVocabulary"] = item.id;
  remove.textContent = scope === "lesson" ? "Remove from lesson" : "Delete";
  row.append(text, type, status, category, note, remove);
  return row;
}

function renderVocabularyEditor() {
  elements.unitVocabularyEditor.replaceChildren(
    ...unitVocabulary.map((item) => createVocabularyEditorRow(item, "unit")),
  );
}

function resourceOptions(values, selected = "") {
  return values.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value ? (LANGUAGE_SKILL_LABELS[value] ?? titleCase(value)) : "No skill";
    option.selected = value === selected;
    return option;
  });
}

function renderResourcesEditor() {
  elements.unitResourcesEditor.replaceChildren(...unitResources.map((resource) => {
    const row = document.createElement("div");
    const title = document.createElement("input");
    const url = document.createElement("input");
    const type = document.createElement("select");
    const skill = document.createElement("select");
    const note = document.createElement("input");
    const remove = document.createElement("button");
    row.className = "program-resource-row";
    title.value = resource.title;
    title.placeholder = "Resource title";
    title.dataset.resourceField = "title";
    url.type = "text";
    url.inputMode = "url";
    url.value = resource.url;
    url.placeholder = "https://… or internal path";
    url.dataset.resourceField = "url";
    type.append(...resourceOptions(RESOURCE_TYPES, resource.type));
    type.dataset.resourceField = "type";
    skill.append(...resourceOptions(["", ...LANGUAGE_SKILL_CATEGORIES], resource.skill));
    skill.dataset.resourceField = "skill";
    note.value = resource.note;
    note.placeholder = "Optional note";
    note.dataset.resourceField = "note";
    remove.type = "button";
    remove.textContent = "Delete";
    remove.dataset.removeResource = resource.id;
    row.dataset.resourceId = resource.id;
    row.append(title, url, type, skill, note, remove);
    return row;
  }));
}

function syncProgramLists() {
  for (const row of elements.unitVocabularyEditor.querySelectorAll("[data-vocabulary-id]")) {
    const item = unitVocabulary.find(({ id }) => id === row.dataset.vocabularyId);
    if (!item) continue;
    for (const input of row.querySelectorAll("[data-vocabulary-field]")) {
      item[input.dataset.vocabularyField] = input.value;
    }
  }
  for (const row of elements.unitResourcesEditor.querySelectorAll("[data-resource-id]")) {
    const resource = unitResources.find(({ id }) => id === row.dataset.resourceId);
    if (!resource) continue;
    for (const input of row.querySelectorAll("[data-resource-field]")) {
      resource[input.dataset.resourceField] = input.value;
    }
  }
}

function addVocabularyItem() {
  syncProgramLists();
  unitVocabulary.push({
    id: createProgramItemId("vocabulary"),
    text: "",
    type: "Word",
    status: "active",
    category: "",
    note: "",
    lessonIds: [],
  });
  renderVocabularyEditor();
  elements.unitVocabularyEditor.querySelector("input:last-of-type")?.focus();
}

function addResourceItem() {
  syncProgramLists();
  unitResources.push({
    id: createProgramItemId("resource"), title: "", url: "", type: "Other", note: "", skill: "",
  });
  renderResourcesEditor();
  elements.unitResourcesEditor.querySelector("input")?.focus();
}

function renderLessonVocabularyEditor() {
  elements.lessonVocabularyEditor.replaceChildren(
    ...lessonVocabulary.map((item) => createVocabularyEditorRow(item, "lesson")),
  );
}

function renderLessonActivitiesEditor() {
  elements.lessonActivitiesEditor.replaceChildren(...lessonActivities.map((activity) => {
    const row = document.createElement("div");
    const input = document.createElement("input");
    const remove = document.createElement("button");
    row.className = "program-editable-row";
    row.dataset.lessonActivityId = activity.id;
    input.value = activity.text;
    input.placeholder = "Activity";
    input.dataset.lessonActivityText = "";
    remove.type = "button";
    remove.dataset.removeLessonActivity = activity.id;
    remove.textContent = "Delete";
    row.append(input, remove);
    return row;
  }));
}

function renderLessonResourcesEditor() {
  elements.lessonResourcesEditor.replaceChildren(...lessonResources.map((resource) => {
    const row = document.createElement("div");
    row.className = "program-resource-row";
    row.dataset.lessonResourceId = resource.id;
    const definitions = [
      ["title", "Resource title", "text"],
      ["url", "https://… or internal path", "text"],
      ["note", "Optional note", "text"],
    ];
    const inputs = definitions.map(([name, placeholder, type]) => {
      const input = document.createElement("input");
      input.type = type;
      input.value = resource[name];
      input.placeholder = placeholder;
      input.dataset.lessonResourceField = name;
      return input;
    });
    const type = document.createElement("select");
    const skill = document.createElement("select");
    const remove = document.createElement("button");
    type.append(...resourceOptions(RESOURCE_TYPES, resource.type));
    type.dataset.lessonResourceField = "type";
    skill.append(...resourceOptions(["", ...LANGUAGE_SKILL_CATEGORIES], resource.skill));
    skill.dataset.lessonResourceField = "skill";
    remove.type = "button";
    remove.dataset.removeLessonResource = resource.id;
    remove.textContent = "Delete";
    row.append(inputs[0], inputs[1], type, skill, inputs[2], remove);
    return row;
  }));
}

function syncLessonLists() {
  for (const row of elements.lessonVocabularyEditor.querySelectorAll("[data-vocabulary-id]")) {
    const item = lessonVocabulary.find(({ id }) => id === row.dataset.vocabularyId);
    if (!item) continue;
    for (const input of row.querySelectorAll("[data-vocabulary-field]")) {
      item[input.dataset.vocabularyField] = input.value;
    }
  }
  for (const row of elements.lessonActivitiesEditor.querySelectorAll("[data-lesson-activity-id]")) {
    const item = lessonActivities.find(({ id }) => id === row.dataset.lessonActivityId);
    if (item) item.text = row.querySelector("[data-lesson-activity-text]")?.value ?? "";
  }
  for (const row of elements.lessonResourcesEditor.querySelectorAll("[data-lesson-resource-id]")) {
    const item = lessonResources.find(({ id }) => id === row.dataset.lessonResourceId);
    if (!item) continue;
    for (const input of row.querySelectorAll("[data-lesson-resource-field]")) {
      item[input.dataset.lessonResourceField] = input.value;
    }
  }
}

function addLessonVocabularyItem() {
  syncLessonLists();
  lessonVocabulary.push({
    id: createProgramItemId("vocabulary"), text: "", type: "Word", status: "active",
    category: "", note: "", lessonIds: [editingLessonId],
  });
  renderLessonVocabularyEditor();
}

function addLessonActivityItem() {
  syncLessonLists();
  lessonActivities.push({ id: createProgramItemId("activity"), text: "" });
  renderLessonActivitiesEditor();
}

function addLessonResourceItem() {
  syncLessonLists();
  lessonResources.push({
    id: createProgramItemId("resource"), title: "", url: "", type: "Other", note: "", skill: "",
  });
  renderLessonResourcesEditor();
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
  if (!elements.courseDetailsDialog.open) showDialog(elements.courseDetailsDialog);

  try {
    const course = await coursesRepository.getById(courseId);
    if (!course) {
      setMessage(elements.courseDetailsState, "Course not found.");
      return;
    }

    const [units, allLessons, privateData] = await Promise.all([
      unitsRepository.listByCourse(courseId),
      optionalProgramData(lessonsRepository.list(), "lessons", []),
      optionalProgramData(
        courseProgramPrivateRepository.getById(
          courseProgramPrivateRepository.courseId(courseId),
        ),
        "course teacher notes",
        null,
      ),
    ]);
    setMessage(elements.courseDetailsName, displayValue(course.name));
    setMessage(elements.courseDetailsEdition, "");
    elements.courseDetailsEdition.hidden = true;
    setMessage(elements.courseDetailsLevel, displayValue(course.level));
    elements.courseDetailsAge.hidden = true;
    elements.courseDetailsStartingPoint.hidden = true;
    elements.courseDetailsFrequency.hidden = true;
    setMessage(elements.courseDetailsDescription, course.description || "No description added yet.");
    setMessage(elements.courseDetailsGeneralGoal, course.generalGoal || "No general goal added yet.");
    setMessage(elements.courseDetailsTeacherNotes, privateData?.teacherNotes || "No private notes added yet.");
    setMessage(elements.courseDetailsActive, course.active === false ? "Inactive" : "Active");
    elements.courseDetailsActive.dataset.status = course.active === false ? "inactive" : "active";
    elements.courseDetailsUnitCount.textContent = String(units.length);
    elements.courseDetailsUnitLabel.textContent = units.length === 1 ? "unit" : "units";
    const fallback = ENTITY_IMAGE_CONFIG[ENTITY_IMAGE_TYPES.COURSE].fallbackUrl;
    elements.courseDetailsCover.src = course.coverImageUrl || fallback;
    elements.courseDetailsCover.alt = `${displayValue(course.name)} cover`;
    elements.courseDetailsCover.onerror = () => {
      elements.courseDetailsCover.onerror = null;
      elements.courseDetailsCover.src = fallback;
    };
    elements.units.replaceChildren(...units.map((unit) => createUnitItem(
      unit,
      allLessons.filter((lesson) => lesson.unitId === unit.id),
    )));
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

async function openUnitForm(courseId, unitId = null, focusSection = "") {
  unitCourseId = courseId;
  editingUnitId = unitId;
  elements.unitForm.reset();
  unitImageField.reset();
  unitObjectives = [];
  unitVocabulary = [];
  unitResources = [];
  renderObjectiveEditor();
  renderVocabularyEditor();
  renderResourcesEditor();
  field(elements.unitForm, "active").checked = true;
  field(elements.unitForm, "status").value = "planned";
  elements.unitFormTitle.textContent = unitId ? "Edit Unit" : "Add Unit";
  elements.unitFormBack.textContent = unitId ? "← Back to Unit" : "← Back to Course";
  elements.unitDelete.hidden = !unitId;
  elements.unitSave.disabled = true;
  setMessage(elements.unitFormMessage, "Loading…");
  showDialog(elements.unitDialog);

  try {
    const [course, units, unit, privateData] = await Promise.all([
      coursesRepository.getById(courseId),
      unitsRepository.listByCourse(courseId),
      unitId ? unitsRepository.getById(unitId) : Promise.resolve(null),
      unitId
        ? optionalProgramData(
          courseProgramPrivateRepository.getById(courseProgramPrivateRepository.unitId(unitId)),
          "unit teacher notes",
          null,
        )
        : Promise.resolve(null),
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
      field(elements.unitForm, "estimatedLessons").value = unit.estimatedLessons ?? 1;
      field(elements.unitForm, "priority").value = UNIT_PRIORITIES.includes(unit.priority)
        ? unit.priority
        : "core";
      field(elements.unitForm, "status").value = UNIT_STATUSES.includes(unit.status)
        ? unit.status
        : "planned";
      textField(elements.unitForm, "mainGoal", unit.mainGoal);
      const skillGoals = normalizeSkillGoals(unit.skillGoals);
      LANGUAGE_SKILL_CATEGORIES.forEach((skill) => {
        textField(
          elements.unitForm,
          `skillGoal${LANGUAGE_SKILL_LABELS[skill]}`,
          skillGoals[skill],
        );
      });
      textField(elements.unitForm, "successCriteria", unit.successCriteria);
      // Vocabulary is managed in Miro. Saving the simplified Unit removes the
      // legacy embedded catalog instead of carrying textbook lists forward.
      unitVocabulary = [];
      textField(elements.unitForm, "finalOutcomeTitle", unit.finalOutcome?.title);
      textField(elements.unitForm, "finalOutcomeDescription", unit.finalOutcome?.description);
      textField(elements.unitForm, "finalOutcomeInstructions", unit.finalOutcome?.instructions);
      unitResources = normalizeResources(unit.resources);
      textField(elements.unitForm, "teacherNotes", privateData?.teacherNotes);
      const more = privateData?.moreDetails ?? {};
      ["pronunciation", "functionalLanguage", "recycling", "commonMistakes", "assessmentEvidence"]
        .forEach((name) => textField(elements.unitForm, name, more[name]));
      unitObjectives = normalizeUnitObjectives(unit.objectives);
      unitImageField.reset(unit);
    } else {
      const nextOrder = units.reduce(
        (highest, current) => Math.max(highest, Number(current.order) || 0),
        0,
      ) + 1;
      field(elements.unitForm, "number").value = nextOrder;
      field(elements.unitForm, "order").value = nextOrder;
      field(elements.unitForm, "estimatedLessons").value = 1;
    }

    renderObjectiveEditor();
    renderVocabularyEditor();
    renderResourcesEditor();

    if (focusSection === "vocabulary") {
      requestAnimationFrame(() => {
        elements.unitVocabularyEditor.closest("fieldset")?.scrollIntoView({ block: "start" });
        elements.unitVocabularyEditor.querySelector("input")?.focus({ preventScroll: true });
      });
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
  const estimatedLessons = Number(field(elements.unitForm, "estimatedLessons").value);
  syncObjectiveTitles();
  syncProgramLists();

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
  if (!Number.isInteger(estimatedLessons) || estimatedLessons < 0) {
    setMessage(elements.unitFormMessage, "Estimated lessons must be zero or a positive integer.");
    return;
  }
  if (!unitCourseId) {
    setMessage(elements.unitFormMessage, "Course is required.");
    return;
  }
  if (unitObjectives.some((objective) => !isNonEmptyText(objective.title))) {
    setMessage(elements.unitFormMessage, "Every learning objective needs a description.");
    return;
  }
  if (unitVocabulary.some((item) => !isNonEmptyText(item.text))) {
    setMessage(elements.unitFormMessage, "Complete or delete every vocabulary item.");
    return;
  }
  if (unitResources.some((resource) => !isNonEmptyText(resource.title))) {
    setMessage(elements.unitFormMessage, "Every resource needs a title.");
    return;
  }

  const skillGoals = Object.fromEntries(LANGUAGE_SKILL_CATEGORIES.map((skill) => [
    skill,
    field(elements.unitForm, `skillGoal${LANGUAGE_SKILL_LABELS[skill]}`).value.trim(),
  ]));

  const payload = {
    courseId: unitCourseId,
    number,
    title,
    order,
    active: field(elements.unitForm, "active").checked,
    estimatedLessons,
    priority: field(elements.unitForm, "priority").value,
    status: field(elements.unitForm, "status").value,
    mainGoal: field(elements.unitForm, "mainGoal").value.trim(),
    skillGoals,
    successCriteria: field(elements.unitForm, "successCriteria").value.trim(),
    vocabulary: unitVocabulary.map((item) => ({
      ...item,
      text: item.text.trim(),
      category: item.category.trim(),
      note: item.note.trim(),
    })),
    activeVocabulary: activeVocabularyCompatibility(unitVocabulary),
    finalOutcome: {
      title: field(elements.unitForm, "finalOutcomeTitle").value.trim(),
      description: field(elements.unitForm, "finalOutcomeDescription").value.trim(),
      instructions: field(elements.unitForm, "finalOutcomeInstructions").value.trim(),
    },
    resources: unitResources.map((resource) => ({
      ...resource,
      title: resource.title.trim(),
      url: resource.url.trim(),
      note: resource.note.trim(),
    })),
    objectives: unitObjectives.map((objective, index) => ({
      id: objective.id,
      category: objective.category,
      categories: objective.categories,
      title: objective.title.trim(),
      order: index + 1,
    })),
  };
  const unitId = editingUnitId ?? unitsRepository.createId();
  elements.unitSave.disabled = true;
  setMessage(elements.unitFormMessage, "Saving…");

  let preparedImage = null;
  let unitSaved = false;
  let createdUnitDocument = false;
  try {
    const existingLessons = editingUnitId
      ? await lessonsRepository.listByUnit(editingUnitId)
      : [];
    payload.lessonStops = existingLessons.length
      ? lessonStopsForUnit({ id: unitId, ...payload }, existingLessons)
      : [];
    preparedImage = await unitImageField.prepare(unitId, { parentId: unitCourseId });
    Object.assign(payload, entityImageFields(ENTITY_IMAGE_TYPES.UNIT, preparedImage));
    if (editingUnitId) await unitsRepository.update(editingUnitId, payload);
    else {
      await unitsRepository.createWithId(unitId, payload);
      createdUnitDocument = true;
    }
    await courseProgramPrivateRepository.createWithId(
      courseProgramPrivateRepository.unitId(unitId),
      {
        entityType: "unit",
        entityId: unitId,
        teacherNotes: field(elements.unitForm, "teacherNotes").value.trim(),
        moreDetails: Object.fromEntries(
          ["pronunciation", "functionalLanguage", "recycling", "commonMistakes", "assessmentEvidence"]
            .map((name) => [name, field(elements.unitForm, name).value.trim()]),
        ),
      },
    );
    unitSaved = true;
    await unitImageField.commit(preparedImage);

    const message = editingUnitId ? "Unit updated." : "Unit added successfully.";
    const courseId = unitCourseId;
    closeDialog(elements.unitDialog);
    await onEntityChanged("units");
    await openCourseDetails(courseId, message);
  } catch (error) {
    if (createdUnitDocument && !unitSaved) {
      await unitsRepository.remove(unitId).catch(() => {});
    }
    if (!unitSaved) await unitImageField.rollback(preparedImage);
    console.error("Unable to save the unit.", error);
    setMessage(elements.unitFormMessage, "Unable to save changes. Please try again.");
  } finally {
    elements.unitSave.disabled = false;
  }
}

function appendEmptyAwareText(element, value, fallback = "Not added yet.") {
  setMessage(element, isNonEmptyText(value) ? value : fallback);
}

function renderUnitSkillGoals(unit) {
  const goals = normalizeSkillGoals(unit.skillGoals);
  const cards = LANGUAGE_SKILL_CATEGORIES
    .filter((skill) => isNonEmptyText(goals[skill]))
    .map((skill) => {
      const card = document.createElement("article");
      const heading = document.createElement("h4");
      const text = document.createElement("p");
      heading.textContent = LANGUAGE_SKILL_LABELS[skill];
      text.textContent = goals[skill];
      card.append(heading, text);
      return card;
    });
  if (cards.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No skill goals added yet.";
    cards.push(empty);
  }
  elements.unitDetailsSkillGoals.replaceChildren(...cards);
}

function renderUnitVocabulary(unit) {
  const vocabulary = normalizeVocabularyItems(unit.vocabulary, unit.activeVocabulary);
  elements.unitVocabularyTotal.textContent = String(vocabulary.length);
  elements.unitVocabularyActive.textContent = String(
    vocabulary.filter(({ status }) => status === "active").length,
  );
  elements.unitVocabularyReceptive.textContent = String(
    vocabulary.filter(({ status }) => status === "receptive").length,
  );
  unitVocabularyQuickFilter = "all";
  elements.unitVocabularySummary.hidden = false;
  elements.unitVocabularyExpanded.hidden = true;
  elements.unitVocabularyFilters.hidden = true;
  elements.unitVocabularyFiltersToggle.setAttribute("aria-expanded", "false");
  elements.unitVocabularyQuickButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.unitVocabularyQuick === "all"));
  });
  const filterOptions = (select, options, allLabel) => {
    select.replaceChildren(...["", ...options].map((optionValue) => {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = optionValue ? titleCase(optionValue) : allLabel;
      return option;
    }));
  };
  filterOptions(
    elements.unitVocabularyLessonFilter,
    currentUnitLessons.map((lesson) => lesson.id),
    "All lessons",
  );
  [...elements.unitVocabularyLessonFilter.options].forEach((option) => {
    if (!option.value) return;
    const lesson = currentUnitLessons.find(({ id }) => id === option.value);
    option.textContent = lesson ? `Lesson ${lesson.number}: ${lesson.title}` : option.value;
  });
  filterOptions(
    elements.unitVocabularyCategoryFilter,
    [...new Set(vocabulary.map(({ category }) => category).filter(Boolean))].sort(),
    "All categories",
  );
  filterOptions(elements.unitVocabularyTypeFilter, VOCABULARY_TYPES, "All types");
  filterOptions(elements.unitVocabularyStatusFilter, VOCABULARY_STATUSES, "All statuses");
  renderFilteredUnitVocabulary();
}

function renderFilteredUnitVocabulary() {
  if (!currentUnitDetails) return;
  setMessage(elements.unitVocabularyCopyStatus, "");
  const lessonId = elements.unitVocabularyLessonFilter.value;
  const category = elements.unitVocabularyCategoryFilter.value;
  const type = elements.unitVocabularyTypeFilter.value;
  const status = elements.unitVocabularyStatusFilter.value;
  const vocabulary = normalizeVocabularyItems(
    currentUnitDetails.vocabulary,
    currentUnitDetails.activeVocabulary,
  ).filter((entry) =>
    (!lessonId || entry.lessonIds.includes(lessonId))
    && (!category || entry.category === category)
    && (!type || entry.type === type)
    && (!status || entry.status === status)
    && (unitVocabularyQuickFilter === "all"
      || unitVocabularyQuickFilter === entry.status
      || (unitVocabularyQuickFilter === "chunks" && entry.type === "Chunk")));
  visibleUnitVocabulary = vocabulary;
  const groups = new Map();
  vocabulary.forEach((entry) => {
    const categoryName = entry.category || "Uncategorized";
    const entries = groups.get(categoryName) ?? [];
    entries.push(entry);
    groups.set(categoryName, entries);
  });
  elements.unitDetailsVocabulary.replaceChildren(...[...groups.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([categoryName, entries]) => {
      const section = document.createElement("section");
      const heading = document.createElement("h4");
      const list = document.createElement("ul");
      section.className = "unit-vocabulary-group";
      heading.textContent = `${categoryName} · ${entries.length}`;
      list.className = "program-chip-list";
      list.append(...entries.map((entry) => {
        const item = document.createElement("li");
        const text = document.createElement("strong");
        text.textContent = entry.text;
        item.append(text);
        return item;
      }));
      section.append(heading, list);
      return section;
    }));
  elements.unitDetailsVocabulary.hidden = vocabulary.length === 0;
  elements.unitDetailsVocabularyEmpty.hidden = vocabulary.length > 0;
}

async function copyVisibleUnitVocabulary() {
  const text = visibleUnitVocabulary.map((entry) => entry.text).join("\n");
  if (!text) {
    setMessage(elements.unitVocabularyCopyStatus, "There are no visible words to copy.");
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setMessage(
      elements.unitVocabularyCopyStatus,
      `Copied ${visibleUnitVocabulary.length} ${visibleUnitVocabulary.length === 1 ? "item" : "items"}.`,
    );
  } catch (error) {
    console.error("Unable to copy vocabulary.", error);
    setMessage(elements.unitVocabularyCopyStatus, "Unable to copy the list. Please try again.");
  }
}

function renderUnitResources(unit) {
  const resources = normalizeResources(unit.resources);
  elements.unitDetailsResourceCount.textContent = String(resources.length);
  elements.unitDetailsResources.replaceChildren(...resources.map((resource) => {
    const item = document.createElement("li");
    const heading = document.createElement("strong");
    const meta = document.createElement("small");
    heading.textContent = resource.title;
    meta.textContent = [resource.type, resource.skill && LANGUAGE_SKILL_LABELS[resource.skill], resource.note]
      .filter(Boolean)
      .join(" · ");
    if (/^(https?:\/\/|\.\.?\/)/i.test(resource.url)) {
      const link = document.createElement("a");
      link.href = resource.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = resource.title;
      heading.replaceChildren(link);
    }
    item.append(heading, meta);
    return item;
  }));
  elements.unitDetailsResources.hidden = resources.length === 0;
  elements.unitDetailsResourcesEmpty.hidden = resources.length > 0;
}

function createLessonCard(lesson, vocabulary) {
  const card = document.createElement("article");
  const number = document.createElement("span");
  const content = document.createElement("div");
  const heading = document.createElement("div");
  const title = document.createElement("h4");
  const status = document.createElement("span");
  const goal = document.createElement("p");
  const meta = document.createElement("div");
  const focusList = document.createElement("div");
  const dates = document.createElement("small");
  const actions = document.createElement("details");
  const actionsToggle = document.createElement("summary");
  const edit = document.createElement("button");
  card.className = "unit-lesson-card";
  card.dataset.openLesson = lesson.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open lesson ${lesson.number}: ${lesson.title}`);
  number.className = "unit-lesson-card__number";
  number.textContent = String(lesson.number ?? lesson.order ?? "—").padStart(2, "0");
  content.className = "unit-lesson-card__content";
  heading.className = "unit-lesson-card__heading";
  title.textContent = lesson.title || `Lesson ${lesson.number}`;
  status.className = "status-badge";
  status.dataset.status = lesson.status;
  status.textContent = titleCase(lesson.status);
  heading.append(title);
  focusList.className = "lesson-focus-list";
  focusList.append(...lessonFocuses(lesson, vocabulary).map((skill) => {
    const tag = document.createElement("span");
    tag.textContent = LANGUAGE_SKILL_LABELS[skill];
    return tag;
  }));
  goal.textContent = lesson.mainGoal || "No lesson goal added yet.";
  goal.title = goal.textContent;
  const dateText = [
    lesson.plannedDate && `Planned ${lesson.plannedDate}`,
    lesson.actualDate && `Actual ${lesson.actualDate}`,
  ].filter(Boolean).join(" · ");
  dates.className = "unit-lesson-card__dates";
  dates.textContent = dateText;
  meta.className = "unit-lesson-card__meta";
  meta.append(focusList, status);
  if (dateText) meta.append(dates);
  actions.className = "lesson-action-menu";
  actionsToggle.setAttribute("aria-label", `Actions for lesson ${lesson.number}`);
  actionsToggle.textContent = "•••";
  edit.type = "button";
  edit.dataset.editLesson = lesson.id;
  edit.textContent = "Edit";
  actions.append(actionsToggle, edit);
  content.append(heading, goal, meta);
  card.append(number, content, actions);
  return card;
}

function renderLessonList(unit, lessons) {
  const vocabulary = normalizeVocabularyItems(unit.vocabulary, unit.activeVocabulary);
  elements.unitDetailsLessonList.replaceChildren(
    ...lessons.map((lesson) => createLessonCard(lesson, vocabulary)),
  );
  elements.unitDetailsLessonList.hidden = lessons.length === 0;
  elements.unitDetailsLessonsEmpty.hidden = lessons.length > 0;
  elements.unitDetailsProgress.hidden = false;
  elements.unitDetailsProgress.textContent = `${lessons.length || Number(unit.estimatedLessons) || 0} lessons in the course structure`;
}

function renderMoreDetails(privateData) {
  const labels = {
    pronunciation: "Pronunciation",
    functionalLanguage: "Functional language",
    recycling: "Recycling from previous Units",
    commonMistakes: "Common mistakes / watch list",
    assessmentEvidence: "Assessment / evidence",
  };
  const entries = Object.entries(labels).filter(([key]) => isNonEmptyText(privateData?.moreDetails?.[key]));
  elements.unitDetailsMore.replaceChildren(...entries.flatMap(([key, label]) => {
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = privateData.moreDetails[key];
    return [term, detail];
  }));
  elements.unitDetailsMore.closest("details").hidden = entries.length === 0;
}

async function openUnitDetails(courseId, unitId, successMessage = "") {
  elements.unitDetailsState.hidden = false;
  elements.unitDetailsContent.hidden = true;
  setMessage(elements.unitDetailsState, "Loading…");
  setMessage(elements.unitDetailsMessage, successMessage);
  if (!elements.unitDetailsDialog.open) showDialog(elements.unitDetailsDialog);
  try {
    const [course, unit, lessons, privateData] = await Promise.all([
      coursesRepository.getById(courseId),
      unitsRepository.getById(unitId),
      optionalProgramData(lessonsRepository.listByUnit(unitId), "unit lessons", []),
      optionalProgramData(
        courseProgramPrivateRepository.getById(courseProgramPrivateRepository.unitId(unitId)),
        "unit teacher notes",
        null,
      ),
    ]);
    if (!course || !unit || unit.courseId !== courseId) {
      setMessage(elements.unitDetailsState, "Unit not found.");
      return;
    }
    currentUnitDetails = { ...unit, course };
    currentUnitLessons = lessons;
    elements.unitDetailsEdit.dataset.editUnit = unit.id;
    elements.unitDetailsEdit.dataset.courseId = course.id;
    elements.addLesson.dataset.unitId = unit.id;
    elements.addLesson.dataset.courseId = course.id;
    setMessage(elements.unitDetailsNumber, `${course.name} › Unit ${unit.number ?? unit.order ?? "—"}`);
    setMessage(elements.unitDetailsTitle, unitName(unit));
    setMessage(elements.unitDetailsPriority, titleCase(unit.priority || "core"));
    setMessage(elements.unitDetailsStatus, titleCase(unit.status || "planned"));
    elements.unitDetailsStatus.dataset.status = unit.status || "planned";
    setMessage(elements.unitDetailsLessons, `${Number(unit.estimatedLessons) || "—"} estimated lessons`);
    appendEmptyAwareText(elements.unitDetailsMainGoal, unit.mainGoal, "No main goal added yet.");
    appendEmptyAwareText(elements.unitDetailsSuccessCriteria, unit.successCriteria, "No success criteria added yet.");
    const fallback = ENTITY_IMAGE_CONFIG[ENTITY_IMAGE_TYPES.UNIT].fallbackUrl;
    elements.unitDetailsCover.src = unit.coverImageUrl || fallback;
    elements.unitDetailsCover.alt = `${unitName(unit)} cover`;
    elements.unitDetailsCover.onerror = () => {
      elements.unitDetailsCover.onerror = null;
      elements.unitDetailsCover.src = fallback;
    };
    renderUnitSkillGoals(unit);
    renderUnitVocabulary(unit);
    renderLessonList(unit, lessons);
    appendEmptyAwareText(elements.unitDetailsOutcomeTitle, unit.finalOutcome?.title, "No final outcome added yet.");
    appendEmptyAwareText(elements.unitDetailsOutcomeDescription, unit.finalOutcome?.description, "");
    appendEmptyAwareText(elements.unitDetailsOutcomeInstructions, unit.finalOutcome?.instructions, "");
    renderUnitResources(unit);
    appendEmptyAwareText(elements.unitDetailsTeacherNotes, privateData?.teacherNotes, "No private notes added yet.");
    renderMoreDetails(privateData);
    elements.unitDetailsState.hidden = true;
    elements.unitDetailsContent.hidden = false;
  } catch (error) {
    console.error("Unable to load unit details.", error);
    setMessage(elements.unitDetailsState, "Unable to load unit. Please try again.");
  }
}

function renderLessonDetailsList(root, entries) {
  root.replaceChildren(...entries.flatMap(([label, value]) => {
    const term = document.createElement("dt");
    const detail = document.createElement("dd");
    term.textContent = label;
    detail.textContent = value;
    return [term, detail];
  }));
}

function renderLessonTargetsEditor(lesson) {
  const objectives = learningObjectivesForUnit(currentUnitDetails);
  const explicitIds = Array.isArray(lesson?.learningTargetIds) ? lesson.learningTargetIds : [];
  const selectedIds = new Set(explicitIds.length
    ? explicitIds
    : learningObjectivesForLesson(currentUnitDetails, lesson).slice(0, 3).map(({ id }) => id));
  elements.lessonTargetEditor.replaceChildren(...objectives.map((objective) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    const text = document.createElement("span");
    const category = document.createElement("small");
    checkbox.type = "checkbox";
    checkbox.value = objective.id;
    checkbox.checked = selectedIds.has(objective.id);
    checkbox.dataset.lessonTarget = objective.id;
    text.textContent = objective.title;
    category.textContent = LANGUAGE_SKILL_LABELS[objective.category] ?? objective.category;
    label.append(checkbox, text, category);
    return label;
  }));
  elements.lessonTargetEditor.hidden = objectives.length === 0;
  elements.lessonTargetEmpty.hidden = objectives.length > 0;
}

function openLessonDetails(lessonId) {
  if (!currentUnitDetails) return;
  const lesson = currentUnitLessons.find(({ id }) => id === lessonId);
  if (!lesson) return;
  const vocabulary = normalizeVocabularyItems(
    currentUnitDetails.vocabulary,
    currentUnitDetails.activeVocabulary,
  );
  const lessonVocabularyItems = vocabulary.filter(({ id, lessonIds }) =>
    lesson?.vocabularyItemIds?.includes(id) || lessonIds.includes(lesson.id));
  setMessage(elements.lessonDetailsNumber, `Lesson ${lesson.number}`);
  setMessage(elements.lessonDetailsTitle, lesson.title);
  setMessage(elements.lessonDetailsStatus, titleCase(lesson.status));
  elements.lessonDetailsStatus.dataset.status = lesson.status;
  elements.lessonDetailsEdit.dataset.editLesson = lesson.id;
  elements.lessonDetailsFocuses.replaceChildren(...lessonFocuses(lesson, vocabulary).map((skill) => {
    const tag = document.createElement("span");
    tag.textContent = LANGUAGE_SKILL_LABELS[skill];
    return tag;
  }));
  appendEmptyAwareText(elements.lessonDetailsMainGoal, lesson.mainGoal, "No main goal added yet.");
  const lessonTargets = learningObjectivesForLesson(currentUnitDetails, lesson);
  elements.lessonDetailsTargets.replaceChildren(...lessonTargets.map((objective) => {
    const item = document.createElement("span");
    item.textContent = objective.title;
    item.dataset.skill = objective.category;
    return item;
  }));
  elements.lessonDetailsTargets.hidden = lessonTargets.length === 0;
  elements.lessonDetailsTargetsEmpty.hidden = lessonTargets.length > 0;
  const goals = normalizeSkillGoals(lesson.skillGoals);
  const goalCards = LANGUAGE_SKILL_CATEGORIES.filter((skill) => isNonEmptyText(goals[skill]))
    .map((skill) => {
      const card = document.createElement("article");
      const heading = document.createElement("h4");
      const text = document.createElement("p");
      heading.textContent = LANGUAGE_SKILL_LABELS[skill];
      text.textContent = goals[skill];
      card.append(heading, text);
      return card;
    });
  elements.lessonDetailsSkillGoals.replaceChildren(...goalCards);
  const language = [
    ["Pronunciation", lesson.pronunciation],
    ["Functional language", lesson.functionalLanguage],
    ["Recycling", lesson.recycling],
  ].filter(([, value]) => isNonEmptyText(value));
  renderLessonDetailsList(elements.lessonDetailsLanguage, language);
  elements.lessonDetailsLanguageSection.hidden = language.length === 0;
  elements.lessonDetailsVocabulary.replaceChildren(...lessonVocabularyItems.map((item) => {
    const card = document.createElement("article");
    const text = document.createElement("strong");
    const meta = document.createElement("small");
    text.textContent = item.text;
    meta.textContent = [item.type, titleCase(item.status), item.category].filter(Boolean).join(" · ");
    card.append(text, meta);
    return card;
  }));
  elements.lessonDetailsVocabulary.hidden = lessonVocabularyItems.length === 0;
  elements.lessonDetailsVocabularyEmpty.hidden = lessonVocabularyItems.length > 0;
  const activities = normalizeTextItems(lesson.activities);
  elements.lessonDetailsActivities.replaceChildren(...activities.map(({ text }) => {
    const item = document.createElement("li");
    item.textContent = text;
    return item;
  }));
  elements.lessonDetailsActivities.hidden = activities.length === 0;
  elements.lessonDetailsActivitiesEmpty.hidden = activities.length > 0;
  const resources = normalizeResources(lesson.resources);
  elements.lessonDetailsResources.replaceChildren(...resources.map((resource) => {
    const item = document.createElement("li");
    const hasSafeUrl = /^(https?:\/\/|\.\.?\/)/i.test(resource.url);
    const title = document.createElement(hasSafeUrl ? "a" : "strong");
    const meta = document.createElement("small");
    title.textContent = resource.title;
    if (hasSafeUrl) {
      title.href = resource.url;
      title.target = "_blank";
      title.rel = "noopener noreferrer";
    }
    meta.textContent = [resource.type, resource.skill && LANGUAGE_SKILL_LABELS[resource.skill], resource.note]
      .filter(Boolean).join(" · ");
    item.append(title, meta);
    return item;
  }));
  elements.lessonDetailsResources.hidden = resources.length === 0;
  elements.lessonDetailsResourcesEmpty.hidden = resources.length > 0;
  appendEmptyAwareText(elements.lessonDetailsOutcome, lesson.expectedOutcome, "No lesson outcome added yet.");
  const notes = [
    ["Teacher notes", lesson.teacherNotes],
    ["Result / reflection", lesson.resultNotes],
  ].filter(([, value]) => isNonEmptyText(value));
  renderLessonDetailsList(elements.lessonDetailsNotes, notes.length ? notes : [["Notes", "No notes added yet."]]);
  setMessage(
    elements.lessonDetailsDates,
    [lesson.plannedDate && `Planned ${lesson.plannedDate}`, lesson.actualDate && `Actual ${lesson.actualDate}`]
      .filter(Boolean).join(" · ") || "Dates not set",
  );
  closeDialog(elements.unitDetailsDialog);
  showDialog(elements.lessonDetailsDialog);
}

async function openLessonForm(lessonId = null) {
  if (!currentUnitDetails) return;
  creatingLesson = !lessonId;
  editingLessonId = lessonId ?? lessonsRepository.createId();
  elements.lessonForm.reset();
  elements.lessonFormTitle.textContent = lessonId ? "Edit Lesson" : "Add Lesson";
  elements.lessonDelete.hidden = creatingLesson;
  setMessage(elements.lessonFormMessage, "");
  const lesson = lessonId ? currentUnitLessons.find(({ id }) => id === lessonId) : null;
  if (lessonId && !lesson) return;
  const nextOrder = currentUnitLessons.reduce(
    (highest, item) => Math.max(highest, Number(item.order ?? item.number) || 0),
    0,
  ) + 1;
  field(elements.lessonForm, "number").value = lesson?.number ?? nextOrder;
  field(elements.lessonForm, "order").value = lesson?.order ?? lesson?.number ?? nextOrder;
  textField(elements.lessonForm, "title", lesson?.title);
  field(elements.lessonForm, "status").value = LESSON_STATUSES.includes(lesson?.status)
    ? lesson.status
    : "planned";
  textField(elements.lessonForm, "mainGoal", lesson?.mainGoal);
  renderLessonTargetsEditor(lesson);
  const skillGoals = normalizeSkillGoals(lesson?.skillGoals);
  LANGUAGE_SKILL_CATEGORIES.forEach((skill) => textField(
    elements.lessonForm,
    `skillGoal${LANGUAGE_SKILL_LABELS[skill]}`,
    skillGoals[skill],
  ));
  [
    "pronunciation", "functionalLanguage", "recycling", "expectedOutcome", "teacherNotes",
    "resultNotes", "plannedDate", "actualDate",
  ]
    .forEach((name) => textField(elements.lessonForm, name, lesson?.[name]));
  const selectedSkillTags = new Set(lessonFocuses(lesson, []));
  elements.lessonForm.querySelectorAll("[data-lesson-skill-tag]").forEach((checkbox) => {
    checkbox.checked = selectedSkillTags.has(checkbox.value);
  });
  lessonVocabulary = [];
  lessonActivities = Array.isArray(lesson?.activities)
    ? normalizeTextItems(lesson.activities)
    : (typeof lesson?.activities === "string" && lesson.activities.trim()
      ? [{ id: createProgramItemId("activity"), text: lesson.activities.trim() }]
      : []);
  lessonResources = normalizeResources(lesson?.resources);
  renderLessonVocabularyEditor();
  renderLessonActivitiesEditor();
  renderLessonResourcesEditor();
  closeDialog(elements.unitDetailsDialog);
  showDialog(elements.lessonDialog);
}

function closeLessonForm() {
  closeDialog(elements.lessonDialog);
  if (currentUnitDetails) {
    void openUnitDetails(currentUnitDetails.courseId, currentUnitDetails.id);
  }
}

async function saveLesson(event) {
  event.preventDefault();
  if (!currentUnitDetails) return;
  const number = Number(field(elements.lessonForm, "number").value);
  const order = Number(field(elements.lessonForm, "order").value);
  const title = field(elements.lessonForm, "title").value.trim();
  syncLessonLists();
  if (!isPositiveInteger(number) || !isPositiveInteger(order) || !isNonEmptyText(title)) {
    setMessage(elements.lessonFormMessage, "Lesson number, order and title are required.");
    return;
  }
  if (lessonVocabulary.some(({ text }) => !isNonEmptyText(text))) {
    setMessage(elements.lessonFormMessage, "Complete or remove every vocabulary item.");
    return;
  }
  if (lessonActivities.some(({ text }) => !isNonEmptyText(text))) {
    setMessage(elements.lessonFormMessage, "Complete or remove every activity.");
    return;
  }
  if (lessonResources.some(({ title: resourceTitle }) => !isNonEmptyText(resourceTitle))) {
    setMessage(elements.lessonFormMessage, "Every resource needs a title.");
    return;
  }
  const learningTargetIds = [...elements.lessonTargetEditor.querySelectorAll("[data-lesson-target]:checked")]
    .map((checkbox) => checkbox.value);
  const availableTargets = learningObjectivesForUnit(currentUnitDetails);
  if (availableTargets.length > 0 && learningTargetIds.length === 0) {
    setMessage(elements.lessonFormMessage, "Select at least one key learning target.");
    return;
  }
  if (learningTargetIds.length > 3) {
    setMessage(elements.lessonFormMessage, "Select no more than three key learning targets.");
    return;
  }
  const selectedTargets = availableTargets.filter(({ id }) => learningTargetIds.includes(id));
  const selectedSkillTags = [...elements.lessonForm.querySelectorAll("[data-lesson-skill-tag]:checked")]
    .map((checkbox) => checkbox.value);
  const skillTags = selectedSkillTags.length
    ? selectedSkillTags
    : [...new Set(selectedTargets.flatMap((target) => target.categories ?? [target.category]))];
  const payload = {
    courseId: currentUnitDetails.courseId,
    unitId: currentUnitDetails.id,
    number,
    order,
    title,
    status: field(elements.lessonForm, "status").value,
    mainGoal: field(elements.lessonForm, "mainGoal").value.trim(),
    learningTargetIds,
    skillTags,
    skillGoals: Object.fromEntries(LANGUAGE_SKILL_CATEGORIES.map((skill) => [
      skill,
      field(elements.lessonForm, `skillGoal${LANGUAGE_SKILL_LABELS[skill]}`).value.trim(),
    ])),
    pronunciation: field(elements.lessonForm, "pronunciation").value.trim(),
    functionalLanguage: field(elements.lessonForm, "functionalLanguage").value.trim(),
    recycling: field(elements.lessonForm, "recycling").value.trim(),
    vocabularyItemIds: lessonVocabulary.map(({ id }) => id),
    activities: lessonActivities.map(({ id, text }) => ({ id, text: text.trim() })),
    resources: lessonResources.map((resource) => ({
      ...resource,
      title: resource.title.trim(), url: resource.url.trim(), note: resource.note.trim(),
    })),
    expectedOutcome: field(elements.lessonForm, "expectedOutcome").value.trim(),
    teacherNotes: field(elements.lessonForm, "teacherNotes").value.trim(),
    resultNotes: field(elements.lessonForm, "resultNotes").value.trim(),
    plannedDate: field(elements.lessonForm, "plannedDate").value,
    actualDate: field(elements.lessonForm, "actualDate").value,
  };
  elements.lessonSave.disabled = true;
  setMessage(elements.lessonFormMessage, "Saving…");
  try {
    const catalog = [];
    for (const lessonItem of lessonVocabulary) {
      const existing = catalog.find(({ id }) => id === lessonItem.id);
      const normalized = {
        ...lessonItem,
        text: lessonItem.text.trim(),
        category: lessonItem.category.trim(),
        note: lessonItem.note.trim(),
        lessonIds: [...new Set([...lessonItem.lessonIds, editingLessonId])],
      };
      if (existing) Object.assign(existing, normalized);
      else catalog.push(normalized);
    }
    const savedLesson = { id: editingLessonId, ...payload };
    const nextLessons = creatingLesson
      ? [...currentUnitLessons, savedLesson]
      : currentUnitLessons.map((lesson) => lesson.id === editingLessonId ? savedLesson : lesson);
    if (creatingLesson) await lessonsRepository.createWithId(editingLessonId, payload);
    else await lessonsRepository.update(editingLessonId, payload);
    await unitsRepository.update(currentUnitDetails.id, {
      vocabulary: catalog,
      activeVocabulary: activeVocabularyCompatibility(catalog),
      lessonStops: lessonStopsForUnit(currentUnitDetails, nextLessons),
    });
    const { courseId, id: unitId } = currentUnitDetails;
    closeDialog(elements.lessonDialog);
    await openUnitDetails(courseId, unitId, creatingLesson ? "Lesson added." : "Lesson updated.");
  } catch (error) {
    console.error("Unable to save lesson.", error);
    setMessage(elements.lessonFormMessage, "Unable to save the lesson. Please try again.");
  } finally {
    elements.lessonSave.disabled = false;
  }
}

async function deleteLesson() {
  if (creatingLesson || !editingLessonId || !currentUnitDetails || !window.confirm("Delete this lesson permanently?")) return;
  elements.lessonDelete.disabled = true;
  try {
    const catalog = normalizeVocabularyItems(
      currentUnitDetails.vocabulary,
      currentUnitDetails.activeVocabulary,
    ).map((item) => ({
      ...item,
      lessonIds: item.lessonIds.filter((id) => id !== editingLessonId),
    }));
    await lessonsRepository.remove(editingLessonId);
    await unitsRepository.update(currentUnitDetails.id, {
      vocabulary: catalog,
      activeVocabulary: activeVocabularyCompatibility(catalog),
      lessonStops: lessonStopsForUnit(
        currentUnitDetails,
        currentUnitLessons.filter(({ id }) => id !== editingLessonId),
      ),
    });
    const { courseId, id: unitId } = currentUnitDetails;
    closeDialog(elements.lessonDialog);
    await openUnitDetails(courseId, unitId, "Lesson deleted.");
  } catch (error) {
    console.error("Unable to delete lesson.", error);
    setMessage(elements.lessonFormMessage, "Unable to delete the lesson.");
  } finally {
    elements.lessonDelete.disabled = false;
  }
}

async function removeUnit(unitId, courseId, button, messageElement) {
  if (!unitId || !courseId) return;
  const confirmed = window.confirm(
    "Delete this unit permanently? Existing student progress records will be preserved.",
  );
  if (!confirmed) return;
  button.disabled = true;
  setMessage(messageElement, "Deleting unit…");
  try {
    const lessons = await lessonsRepository.listByUnit(unitId);
    await Promise.all([
      ...lessons.map((lesson) => lessonsRepository.remove(lesson.id)),
      courseProgramPrivateRepository.remove(
        courseProgramPrivateRepository.unitId(unitId),
      ),
    ]);
    await unitsRepository.remove(unitId);
    closeDialog(elements.unitDialog);
    await onEntityChanged("units");
    await openCourseDetails(courseId, "Unit deleted.");
  } catch (error) {
    console.error("Unable to delete the unit.", error);
    setMessage(messageElement, "Unable to delete the unit. Please try again.");
  } finally {
    button.disabled = false;
  }
}

function handleClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  const addCourse = target?.closest("[data-add-course]");
  const installWiderWorld = target?.closest("[data-install-wider-world]");
  const installOwnIt = target?.closest("[data-install-own-it-a2]");
  const clearVocabulary = target?.closest("[data-clear-legacy-vocabulary]");
  const editCourse = target?.closest("[data-edit-course]");
  const openCourse = target?.closest("[data-open-course]");
  const addUnit = target?.closest("[data-add-unit]");
  const editUnit = target?.closest("[data-edit-unit]");
  const deleteUnitButton = target?.closest("[data-delete-unit]");
  const openUnit = target?.closest("[data-open-unit]");
  const backToCourse = target?.closest("[data-unit-details-back]");
  const addLesson = target?.closest("[data-add-lesson]");
  const editLesson = target?.closest("[data-edit-lesson]");
  const openLesson = target?.closest("[data-open-lesson]");
  const backToUnit = target?.closest("[data-lesson-details-back]");
  const updateLessonProgress = target?.closest("[data-lesson-details-update-progress]");
  const openUnitVocabulary = target?.closest("[data-unit-vocabulary-open]");
  const closeUnitVocabulary = target?.closest("[data-unit-vocabulary-close]");
  const toggleUnitVocabularyFilters = target?.closest("[data-unit-vocabulary-filters-toggle]");
  const unitVocabularyQuick = target?.closest("[data-unit-vocabulary-quick]");
  const editUnitVocabulary = target?.closest("[data-unit-vocabulary-edit]");
  const copyUnitVocabulary = target?.closest("[data-unit-vocabulary-copy]");
  const addVocabulary = target?.closest("[data-add-vocabulary]");
  const addResource = target?.closest("[data-add-resource]");
  const addLessonVocabulary = target?.closest("[data-add-lesson-vocabulary]");
  const addLessonActivity = target?.closest("[data-add-lesson-activity]");
  const addLessonResource = target?.closest("[data-add-lesson-resource]");
  const removeVocabulary = target?.closest("[data-remove-vocabulary]");
  const removeResource = target?.closest("[data-remove-resource]");
  const removeLessonVocabulary = target?.closest("[data-remove-lesson-vocabulary]");
  const removeLessonActivity = target?.closest("[data-remove-lesson-activity]");
  const removeLessonResource = target?.closest("[data-remove-lesson-resource]");
  const unitSectionTarget = target?.closest("[data-unit-section-target]");

  if (target?.closest(".unit-card__menu") && !editUnit && !deleteUnitButton) return;
  if (target?.closest(".lesson-action-menu") && !editLesson) return;

  if (unitSectionTarget) {
    document.getElementById(unitSectionTarget.dataset.unitSectionTarget)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } else if (installWiderWorld) void installWiderWorldPilot(installWiderWorld);
  else if (installOwnIt) void installOwnItA2(installOwnIt);
  else if (clearVocabulary) void clearLegacyVocabulary(clearVocabulary);
  else if (addCourse) void openCourseForm();
  else if (editCourse) {
    closeDialog(elements.courseDetailsDialog);
    void openCourseForm(editCourse.dataset.editCourse);
  } else if (openCourse) void openCourseDetails(openCourse.dataset.openCourse);
  else if (addUnit) {
    closeDialog(elements.courseDetailsDialog);
    void openUnitForm(addUnit.dataset.addUnit);
  } else if (editUnit) {
    const courseId = editUnit.dataset.courseId || elements.addUnit.dataset.addUnit;
    closeDialog(elements.courseDetailsDialog);
    closeDialog(elements.unitDetailsDialog);
    void openUnitForm(courseId, editUnit.dataset.editUnit);
  } else if (deleteUnitButton) {
    void removeUnit(
      deleteUnitButton.dataset.deleteUnit,
      elements.addUnit.dataset.addUnit,
      deleteUnitButton,
      elements.courseDetailsMessage,
    );
  } else if (openUnit) {
    const courseId = elements.addUnit.dataset.addUnit;
    closeDialog(elements.courseDetailsDialog);
    void openUnitDetails(courseId, openUnit.dataset.openUnit);
  } else if (backToCourse && currentUnitDetails) {
    const courseId = currentUnitDetails.courseId;
    closeDialog(elements.unitDetailsDialog);
    void openCourseDetails(courseId);
  } else if (addLesson) {
    void openLessonForm();
  } else if (editLesson) {
    closeDialog(elements.lessonDetailsDialog);
    void openLessonForm(editLesson.dataset.editLesson);
  } else if (openLesson) {
    openLessonDetails(openLesson.dataset.openLesson);
  } else if (backToUnit && currentUnitDetails) {
    closeDialog(elements.lessonDetailsDialog);
    void openUnitDetails(currentUnitDetails.courseId, currentUnitDetails.id);
  } else if (updateLessonProgress) {
    const lessonId = elements.lessonDetailsEdit.dataset.editLesson;
    closeDialog(elements.lessonDetailsDialog);
    window.dispatchEvent(new CustomEvent("teacher:lesson-progress", {
      detail: {
        courseId: currentUnitDetails?.courseId,
        unitId: currentUnitDetails?.id,
        lessonId,
      },
    }));
  } else if (openUnitVocabulary) {
    elements.unitVocabularySummary.hidden = true;
    elements.unitVocabularyExpanded.hidden = false;
    renderFilteredUnitVocabulary();
  } else if (closeUnitVocabulary) {
    elements.unitVocabularyExpanded.hidden = true;
    elements.unitVocabularySummary.hidden = false;
    elements.unitVocabularyFilters.hidden = true;
    elements.unitVocabularyFiltersToggle.setAttribute("aria-expanded", "false");
  } else if (toggleUnitVocabularyFilters) {
    const willOpen = elements.unitVocabularyFilters.hidden;
    elements.unitVocabularyFilters.hidden = !willOpen;
    elements.unitVocabularyFiltersToggle.setAttribute("aria-expanded", String(willOpen));
  } else if (unitVocabularyQuick) {
    unitVocabularyQuickFilter = unitVocabularyQuick.dataset.unitVocabularyQuick;
    elements.unitVocabularyQuickButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button === unitVocabularyQuick));
    });
    renderFilteredUnitVocabulary();
  } else if (editUnitVocabulary && currentUnitDetails) {
    closeDialog(elements.unitDetailsDialog);
    void openUnitForm(currentUnitDetails.courseId, currentUnitDetails.id, "vocabulary");
  } else if (copyUnitVocabulary) {
    void copyVisibleUnitVocabulary();
  } else if (addVocabulary) {
    addVocabularyItem();
  } else if (addResource) {
    addResourceItem();
  } else if (addLessonVocabulary) {
    addLessonVocabularyItem();
  } else if (addLessonActivity) {
    addLessonActivityItem();
  } else if (addLessonResource) {
    addLessonResourceItem();
  } else if (removeVocabulary) {
    syncProgramLists();
    unitVocabulary = unitVocabulary.filter(({ id }) => id !== removeVocabulary.dataset.removeVocabulary);
    renderVocabularyEditor();
  } else if (removeResource) {
    syncProgramLists();
    unitResources = unitResources.filter(({ id }) => id !== removeResource.dataset.removeResource);
    renderResourcesEditor();
  } else if (removeLessonVocabulary) {
    syncLessonLists();
    lessonVocabulary = lessonVocabulary.filter(({ id }) => id !== removeLessonVocabulary.dataset.removeLessonVocabulary);
    renderLessonVocabularyEditor();
  } else if (removeLessonActivity) {
    syncLessonLists();
    lessonActivities = lessonActivities.filter(({ id }) => id !== removeLessonActivity.dataset.removeLessonActivity);
    renderLessonActivitiesEditor();
  } else if (removeLessonResource) {
    syncLessonLists();
    lessonResources = lessonResources.filter(({ id }) => id !== removeLessonResource.dataset.removeLessonResource);
    renderLessonResourcesEditor();
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
    courseDetailsEdition: dashboard?.querySelector("[data-course-details-edition]"),
    courseDetailsState: dashboard?.querySelector("[data-course-details-state]"),
    courseDetailsMessage: dashboard?.querySelector("[data-course-details-message]"),
    courseDetailsContent: dashboard?.querySelector("[data-course-details-content]"),
    courseDetailsLevel: dashboard?.querySelector("[data-course-details-level]"),
    courseDetailsAge: dashboard?.querySelector("[data-course-details-age]"),
    courseDetailsStartingPoint: dashboard?.querySelector("[data-course-details-starting-point]"),
    courseDetailsFrequency: dashboard?.querySelector("[data-course-details-frequency]"),
    courseDetailsDescription: dashboard?.querySelector("[data-course-details-description]"),
    courseDetailsGeneralGoal: dashboard?.querySelector("[data-course-details-general-goal]"),
    courseDetailsTeacherNotes: dashboard?.querySelector("[data-course-details-teacher-notes]"),
    courseDetailsActive: dashboard?.querySelector("[data-course-details-active]"),
    courseDetailsCover: dashboard?.querySelector("[data-course-details-cover]"),
    courseDetailsUnitCount: dashboard?.querySelector("[data-course-details-unit-count]"),
    courseDetailsUnitLabel: dashboard?.querySelector("[data-course-details-unit-label]"),
    addUnit: dashboard?.querySelector("[data-course-details-add-unit]"),
    unitsEmpty: dashboard?.querySelector("[data-course-units-empty]"),
    units: dashboard?.querySelector("[data-course-units]"),
    courseDetailsEdit: dashboard?.querySelector("[data-course-details-edit]"),
    courseDetailsClose: dashboard?.querySelector("[data-course-details-close]"),
    unitDialog: dashboard?.querySelector("[data-unit-dialog]"),
    unitForm: dashboard?.querySelector("[data-unit-form]"),
    unitFormTitle: dashboard?.querySelector("[data-unit-form-title]"),
    unitFormBack: dashboard?.querySelector("[data-unit-form-back]"),
    unitFormMessage: dashboard?.querySelector("[data-unit-form-message]"),
    unitCourseName: dashboard?.querySelector("[data-unit-course-name]"),
    unitSave: dashboard?.querySelector("[data-unit-save]"),
    unitDelete: dashboard?.querySelector("[data-unit-delete]"),
    unitClose: dashboard?.querySelector("[data-unit-dialog-close]"),
    unitObjectives: dashboard?.querySelector("[data-unit-objectives]"),
    unitVocabularyEditor: dashboard?.querySelector("[data-unit-vocabulary-editor]"),
    unitResourcesEditor: dashboard?.querySelector("[data-unit-resources-editor]"),
    unitDetailsDialog: dashboard?.querySelector("[data-unit-details-dialog]"),
    unitDetailsClose: dashboard?.querySelector("[data-unit-details-close]"),
    unitDetailsBack: dashboard?.querySelector("[data-unit-details-back]"),
    unitDetailsState: dashboard?.querySelector("[data-unit-details-state]"),
    unitDetailsMessage: dashboard?.querySelector("[data-unit-details-message]"),
    unitDetailsContent: dashboard?.querySelector("[data-unit-details-content]"),
    unitDetailsCover: dashboard?.querySelector("[data-unit-details-cover]"),
    unitDetailsNumber: dashboard?.querySelector("[data-unit-details-number]"),
    unitDetailsTitle: dashboard?.querySelector("[data-unit-details-title]"),
    unitDetailsPriority: dashboard?.querySelector("[data-unit-details-priority]"),
    unitDetailsStatus: dashboard?.querySelector("[data-unit-details-status]"),
    unitDetailsLessons: dashboard?.querySelector("[data-unit-details-lessons]"),
    unitDetailsProgress: dashboard?.querySelector("[data-unit-details-progress]"),
    unitDetailsEdit: dashboard?.querySelector("[data-unit-details-edit]"),
    unitDetailsMainGoal: dashboard?.querySelector("[data-unit-details-main-goal]"),
    unitDetailsSkillGoals: dashboard?.querySelector("[data-unit-details-skill-goals]"),
    unitDetailsSuccessCriteria: dashboard?.querySelector("[data-unit-details-success-criteria]"),
    unitDetailsVocabulary: dashboard?.querySelector("[data-unit-details-vocabulary]"),
    unitDetailsVocabularyEmpty: dashboard?.querySelector("[data-unit-details-vocabulary-empty]"),
    unitVocabularySummary: dashboard?.querySelector("[data-unit-vocabulary-summary]"),
    unitVocabularyExpanded: dashboard?.querySelector("[data-unit-vocabulary-expanded]"),
    unitVocabularyTotal: dashboard?.querySelector("[data-unit-vocabulary-total]"),
    unitVocabularyActive: dashboard?.querySelector("[data-unit-vocabulary-active]"),
    unitVocabularyReceptive: dashboard?.querySelector("[data-unit-vocabulary-receptive]"),
    unitVocabularyFilters: dashboard?.querySelector("[data-unit-vocabulary-filters]"),
    unitVocabularyFiltersToggle: dashboard?.querySelector("[data-unit-vocabulary-filters-toggle]"),
    unitVocabularyCopyStatus: dashboard?.querySelector("[data-unit-vocabulary-copy-status]"),
    unitVocabularyQuickButtons: dashboard
      ? [...dashboard.querySelectorAll("[data-unit-vocabulary-quick]")]
      : null,
    unitVocabularyLessonFilter: dashboard?.querySelector("[data-unit-vocabulary-filter=\"lesson\"]"),
    unitVocabularyCategoryFilter: dashboard?.querySelector("[data-unit-vocabulary-filter=\"category\"]"),
    unitVocabularyTypeFilter: dashboard?.querySelector("[data-unit-vocabulary-filter=\"type\"]"),
    unitVocabularyStatusFilter: dashboard?.querySelector("[data-unit-vocabulary-filter=\"status\"]"),
    addLesson: dashboard?.querySelector("[data-add-lesson]"),
    unitDetailsLessonsEmpty: dashboard?.querySelector("[data-unit-details-lessons-empty]"),
    unitDetailsLessonList: dashboard?.querySelector("[data-unit-details-lesson-list]"),
    unitDetailsOutcomeTitle: dashboard?.querySelector("[data-unit-details-outcome-title]"),
    unitDetailsOutcomeDescription: dashboard?.querySelector("[data-unit-details-outcome-description]"),
    unitDetailsOutcomeInstructions: dashboard?.querySelector("[data-unit-details-outcome-instructions]"),
    unitDetailsResources: dashboard?.querySelector("[data-unit-details-resources]"),
    unitDetailsResourcesEmpty: dashboard?.querySelector("[data-unit-details-resources-empty]"),
    unitDetailsResourceCount: dashboard?.querySelector("[data-unit-details-resource-count]"),
    unitDetailsTeacherNotes: dashboard?.querySelector("[data-unit-details-teacher-notes]"),
    unitDetailsMore: dashboard?.querySelector("[data-unit-details-more]"),
    lessonDialog: dashboard?.querySelector("[data-lesson-dialog]"),
    lessonForm: dashboard?.querySelector("[data-lesson-form]"),
    lessonFormTitle: dashboard?.querySelector("[data-lesson-form-title]"),
    lessonFormMessage: dashboard?.querySelector("[data-lesson-form-message]"),
    lessonTargetEditor: dashboard?.querySelector("[data-lesson-target-editor]"),
    lessonTargetEmpty: dashboard?.querySelector("[data-lesson-target-empty]"),
    lessonVocabularyEditor: dashboard?.querySelector("[data-lesson-vocabulary-editor]"),
    lessonActivitiesEditor: dashboard?.querySelector("[data-lesson-activities-editor]"),
    lessonResourcesEditor: dashboard?.querySelector("[data-lesson-resources-editor]"),
    lessonSave: dashboard?.querySelector("[data-lesson-save]"),
    lessonDelete: dashboard?.querySelector("[data-lesson-delete]"),
    lessonClose: dashboard?.querySelector("[data-lesson-dialog-close]"),
    lessonDetailsDialog: dashboard?.querySelector("[data-lesson-details-dialog]"),
    lessonDetailsClose: dashboard?.querySelector("[data-lesson-details-close]"),
    lessonDetailsNumber: dashboard?.querySelector("[data-lesson-details-number]"),
    lessonDetailsTitle: dashboard?.querySelector("[data-lesson-details-title]"),
    lessonDetailsFocuses: dashboard?.querySelector("[data-lesson-details-focuses]"),
    lessonDetailsStatus: dashboard?.querySelector("[data-lesson-details-status]"),
    lessonDetailsEdit: dashboard?.querySelector("[data-lesson-details-edit]"),
    lessonDetailsUpdateProgress: dashboard?.querySelector("[data-lesson-details-update-progress]"),
    lessonDetailsMainGoal: dashboard?.querySelector("[data-lesson-details-main-goal]"),
    lessonDetailsTargets: dashboard?.querySelector("[data-lesson-details-targets]"),
    lessonDetailsTargetsEmpty: dashboard?.querySelector("[data-lesson-details-targets-empty]"),
    lessonDetailsSkillGoals: dashboard?.querySelector("[data-lesson-details-skill-goals]"),
    lessonDetailsLanguageSection: dashboard?.querySelector("[data-lesson-details-language-section]"),
    lessonDetailsLanguage: dashboard?.querySelector("[data-lesson-details-language]"),
    lessonDetailsVocabulary: dashboard?.querySelector("[data-lesson-details-vocabulary]"),
    lessonDetailsVocabularyEmpty: dashboard?.querySelector("[data-lesson-details-vocabulary-empty]"),
    lessonDetailsActivities: dashboard?.querySelector("[data-lesson-details-activities]"),
    lessonDetailsActivitiesEmpty: dashboard?.querySelector("[data-lesson-details-activities-empty]"),
    lessonDetailsResources: dashboard?.querySelector("[data-lesson-details-resources]"),
    lessonDetailsResourcesEmpty: dashboard?.querySelector("[data-lesson-details-resources-empty]"),
    lessonDetailsOutcome: dashboard?.querySelector("[data-lesson-details-outcome]"),
    lessonDetailsNotes: dashboard?.querySelector("[data-lesson-details-notes]"),
    lessonDetailsDates: dashboard?.querySelector("[data-lesson-details-dates]"),
  };

  if (Object.values(elements).some((element) => !element)) {
    console.error("Courses CRUD markup is incomplete.");
    return;
  }

  courseImageField = createEntityImageField(
    dashboard.querySelector("[data-course-image-field]"),
    ENTITY_IMAGE_TYPES.COURSE,
  );
  unitImageField = createEntityImageField(
    dashboard.querySelector("[data-unit-image-field]"),
    ENTITY_IMAGE_TYPES.UNIT,
  );

  dashboard.addEventListener("click", handleClick);
  elements.courseForm.addEventListener("submit", saveCourse);
  elements.courseDelete.addEventListener("click", deleteCourse);
  elements.unitForm.addEventListener("submit", saveUnit);
  elements.lessonForm.addEventListener("submit", saveLesson);
  elements.lessonDelete.addEventListener("click", deleteLesson);
  elements.unitDelete.addEventListener("click", () => {
    void removeUnit(editingUnitId, unitCourseId, elements.unitDelete, elements.unitFormMessage);
  });
  elements.unitObjectives.addEventListener("click", handleObjectiveEditorClick);
  elements.courseClose.addEventListener("click", () => closeDialog(elements.courseDialog));
  elements.courseDetailsClose.addEventListener("click", () =>
    closeDialog(elements.courseDetailsDialog),
  );
  elements.unitClose.addEventListener("click", () => closeDialog(elements.unitDialog));
  elements.unitFormBack.addEventListener("click", () => {
    const courseId = unitCourseId;
    const unitId = editingUnitId;
    closeDialog(elements.unitDialog);
    if (!courseId) return;
    if (unitId) void openUnitDetails(courseId, unitId);
    else void openCourseDetails(courseId);
  });
  elements.unitDetailsClose.addEventListener("click", () => closeDialog(elements.unitDetailsDialog));
  elements.lessonClose.addEventListener("click", closeLessonForm);
  elements.lessonDetailsClose.addEventListener("click", () => closeDialog(elements.lessonDetailsDialog));
  [
    elements.unitVocabularyLessonFilter,
    elements.unitVocabularyCategoryFilter,
    elements.unitVocabularyTypeFilter,
    elements.unitVocabularyStatusFilter,
  ].forEach((select) => select.addEventListener("change", renderFilteredUnitVocabulary));
  dashboard.addEventListener("keydown", (event) => {
    const lessonCard = event.target instanceof Element
      ? event.target.closest("[data-open-lesson]")
      : null;
    if (lessonCard && !event.target.closest("button, summary, select, input, textarea")) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openLessonDetails(lessonCard.dataset.openLesson);
      return;
    }
    const card = event.target instanceof Element ? event.target.closest("[data-open-unit]") : null;
    if (!card || event.target.closest("button, summary, select, input, textarea")) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    closeDialog(elements.courseDetailsDialog);
    void openUnitDetails(elements.addUnit.dataset.addUnit, card.dataset.openUnit);
  });
}
