import { coursesRepository } from "../data/repositories/courses-repository.js";
import { feedbackDraftsRepository } from "../data/repositories/feedback-drafts-repository.js";
import { groupsRepository } from "../data/repositories/groups-repository.js";
import { objectiveProgressRepository } from "../data/repositories/objective-progress-repository.js";
import { studentsRepository } from "../data/repositories/students-repository.js";
import { unitsRepository } from "../data/repositories/units-repository.js";
import { OBJECTIVE_STATUS_LABELS } from "../domain/constants.js";
import { ENTITY_IMAGE_CONFIG, ENTITY_IMAGE_TYPES } from "../domain/entity-images.js";
import { overallObjectiveStatus } from "../domain/learning-objectives.js";
import { initializeCalendar, invalidateCalendar, showCalendar } from "./calendar.js?v=20260905-student-modes";
import { initializeAdminCrud } from "./admin-crud.js?v=20260905-student-modes";
import { clearStudentAccess } from "./student-access.js";
import { loadAdminStudentProfile } from "./student-profile.js?v=20260905-homework-links";

const DEFAULT_SECTION = "overview";
const STUDENT_PROFILE_SECTION = "student-profile";
const CALENDAR_SECTION = "calendar";
let pendingStudentProgress = null;
let pendingHomeworkEdit = null;

const SECTION_CONFIG = Object.freeze({
  groups: {
    loadDocuments: loadGroupsWithCourseNames,
    loadingMessage: "Loading groups…",
    emptyMessage: "No groups yet.",
    errorMessage: "Unable to load groups. Please try again.",
    renderItem: renderGroup,
  },
  students: {
    loadDocuments: loadStudentsWithRelatedNames,
    filterDocuments: filterStudents,
    loadingMessage: "Loading students…",
    emptyMessage: "No students yet.",
    errorMessage: "Unable to load students. Please try again.",
    renderItem: renderStudent,
  },
  courses: {
    loadDocuments: loadCoursesWithCounts,
    loadingMessage: "Loading courses…",
    emptyMessage: "No courses yet.",
    errorMessage: "Unable to load courses. Please try again.",
    renderItem: renderCourse,
  },
});

const loadedSections = new Set();
const pendingLoads = new Map();
const collectionLoads = new Map();
const sectionDocuments = new Map();

function loadCollectionOnce(collectionName, repository) {
  if (!collectionLoads.has(collectionName)) {
    const request = repository.list().catch((error) => {
      collectionLoads.delete(collectionName);
      throw error;
    });
    collectionLoads.set(collectionName, request);
  }

  return collectionLoads.get(collectionName);
}

function loadGroups() {
  return loadCollectionOnce("groups", groupsRepository);
}

function loadStudents() {
  return loadCollectionOnce("students", studentsRepository);
}

function loadCourses() {
  return loadCollectionOnce("courses", coursesRepository);
}

function loadUnits() {
  return loadCollectionOnce("units", unitsRepository);
}

function setOverviewText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = String(value);
}

function createAttentionItem(student, overallStatus) {
  const item = document.createElement("li");
  const marker = createEntityMarker(student.name, "student");
  const identity = document.createElement("span");
  const name = document.createElement("a");
  const group = document.createElement("small");
  const progress = document.createElement("strong");

  name.href = `#student/${encodeURIComponent(student.id)}`;
  name.dataset.studentProfileLink = student.id;
  name.textContent = displayValue(student.name);
  group.textContent = `Group: ${displayValue(student.groupName)}`;
  progress.textContent = OBJECTIVE_STATUS_LABELS[overallStatus];
  progress.setAttribute("aria-label", `Overall status ${OBJECTIVE_STATUS_LABELS[overallStatus]}`);
  identity.append(name, group);
  item.append(marker, identity, progress);
  setStudentColor(item, student.color);
  return item;
}

function createFeedbackDraftItem(draft, student) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  const detail = document.createElement("small");
  link.href = `#student/${encodeURIComponent(draft.studentId)}`;
  link.dataset.studentProfileLink = draft.studentId;
  link.textContent = displayValue(student?.name ?? "Unknown student");
  detail.textContent = `${draft.sourceObservationIds?.length ?? 0} observations · Review draft`;
  item.append(link, detail);
  return item;
}

async function loadOverview() {
  const state = document.querySelector("[data-overview-state]");
  const content = document.querySelectorAll("[data-overview-content]");
  const list = document.querySelector("[data-overview-attention-list]");
  const empty = document.querySelector("[data-overview-attention-empty]");
  if (!state || !list || !empty || content.length === 0) return;

  state.textContent = "Loading dashboard…";
  state.hidden = false;
  content.forEach((element) => {
    element.hidden = true;
  });

  try {
    const [students, groups, courses, progressDocuments, feedbackDrafts] = await Promise.all([
      loadStudentsWithRelatedNames(),
      loadGroups(),
      loadCourses(),
      objectiveProgressRepository.list(),
      feedbackDraftsRepository.listWaiting(),
    ]);
    const progressByStudent = new Map();
    progressDocuments.forEach((progress) => {
      const documents = progressByStudent.get(progress.studentId) ?? [];
      documents.push(progress);
      progressByStudent.set(progress.studentId, documents);
    });
    const attention = students
      .filter((student) => studentStatus(student) === "active")
      .map((student) => ({
        student,
        overall: overallObjectiveStatus(progressByStudent.get(student.id) ?? []),
      }))
      .filter((item) => item.overall === "needs_practice");
    const studentsById = new Map(students.map((student) => [student.id, student]));
    const feedbackList = document.querySelector("[data-overview-feedback-list]");
    const feedbackEmpty = document.querySelector("[data-overview-feedback-empty]");

    setOverviewText(
      "[data-overview-active-students]",
      students.filter((student) => studentStatus(student) === "active").length,
    );
    setOverviewText("[data-overview-groups]", groups.length);
    setOverviewText(
      "[data-overview-active-courses]",
      courses.filter((course) => course.active !== false).length,
    );
    setOverviewText("[data-overview-attention-count]", attention.length);
    setOverviewText("[data-overview-feedback-count]", feedbackDrafts.length);
    list.replaceChildren(
      ...attention.slice(0, 4).map((item) => createAttentionItem(item.student, item.overall)),
    );
    list.hidden = attention.length === 0;
    empty.hidden = attention.length > 0;
    feedbackList?.replaceChildren(
      ...feedbackDrafts.slice(0, 5).map((draft) =>
        createFeedbackDraftItem(draft, studentsById.get(draft.studentId)),
      ),
    );
    if (feedbackList) feedbackList.hidden = feedbackDrafts.length === 0;
    if (feedbackEmpty) feedbackEmpty.hidden = feedbackDrafts.length > 0;
    state.hidden = true;
    content.forEach((element) => {
      element.hidden = false;
    });
  } catch (error) {
    console.error("Unable to load the dashboard overview.", error);
    state.textContent = "Unable to load dashboard data. Please try again.";
  }
}

function createNameLookup(documents) {
  return new Map(documents.map((document) => [document.id, document.name]));
}

function resolveName(lookup, documentId, fallback) {
  const name = lookup.get(documentId);
  return typeof name === "string" && name.trim() ? name : fallback;
}

function effectiveStudentCourseId(student, groupsById) {
  const groupCourseId = student.groupId ? groupsById.get(student.groupId)?.courseId : "";
  return groupCourseId || student.courseId || "";
}

async function loadGroupsWithCourseNames() {
  const [groups, courses, students] = await Promise.all([
    loadGroups(),
    loadCourses(),
    loadStudents(),
  ]);
  const courseNames = createNameLookup(courses);

  return groups.map((group) => ({
    ...group,
    courseName: resolveName(courseNames, group.courseId, "Unknown course"),
    studentCount: students.filter((student) => student.groupId === group.id).length,
  }));
}

async function loadCoursesWithCounts() {
  const [courses, groups, students, units] = await Promise.all([
    loadCourses(),
    loadGroups(),
    loadStudents(),
    loadUnits(),
  ]);

  const groupsById = new Map(groups.map((group) => [group.id, group]));
  return courses.map((course) => ({
    ...course,
    groupCount: groups.filter((group) => group.courseId === course.id).length,
    studentCount: students.filter(
      (student) => effectiveStudentCourseId(student, groupsById) === course.id,
    ).length,
    unitCount: units.filter((unit) => unit.courseId === course.id).length,
  }));
}

async function loadStudentsWithRelatedNames() {
  const [students, groups, courses] = await Promise.all([
    loadStudents(),
    loadGroups(),
    loadCourses(),
  ]);
  const groupNames = createNameLookup(groups);
  const courseNames = createNameLookup(courses);
  const groupsById = new Map(groups.map((group) => [group.id, group]));

  return students.map((student) => {
    const courseId = effectiveStudentCourseId(student, groupsById);
    return {
      ...student,
      courseId,
      groupName: student.groupId
        ? resolveName(groupNames, student.groupId, "Unknown group")
        : "Individual",
      courseName: courseId ? resolveName(courseNames, courseId, "Unknown course") : "Independent learning",
    };
  });
}

function displayValue(value) {
  if (value === true) return "Active";
  if (value === false) return "Inactive";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function studentStatus(student) {
  if (student.status === "active" || student.status === "paused" || student.status === "archived") {
    return student.status;
  }
  return student.active === false ? "paused" : "active";
}

function studentLessonMode(student) {
  return student.lessonMode === "offline" ? "offline" : "online";
}

function filterStudents(students) {
  const filter = document.querySelector("[data-student-filter]")?.value ?? "active";
  const mode = document.querySelector('[data-student-mode-filter][aria-pressed="true"]')
    ?.dataset.studentModeFilter ?? "all";
  const searchTerm = document
    .querySelector("[data-student-search]")
    ?.value.trim()
    .toLocaleLowerCase() ?? "";

  return students.filter((student) => {
    const matchesStatus = filter === "all" || studentStatus(student) === filter;
    const matchesMode = mode === "all" || studentLessonMode(student) === mode;
    const searchableValues = [student.name, student.groupName, student.courseName];
    const matchesSearch =
      !searchTerm ||
      searchableValues.some((value) =>
        String(value ?? "").toLocaleLowerCase().includes(searchTerm),
      );
    return matchesStatus && matchesMode && matchesSearch;
  });
}

function createDataItem(title, fields) {
  const item = document.createElement("li");
  const heading = document.createElement("h3");
  const details = document.createElement("dl");

  heading.textContent = displayValue(title);

  for (const [label, value] of fields) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = displayValue(value);
    description.dataset.field = label.toLowerCase().replaceAll(" ", "-");
    details.append(term, description);
  }

  item.append(heading, details);
  return item;
}

function createEntityMarker(title, modifier) {
  const marker = document.createElement("span");
  const visibleTitle = displayValue(title).trim();
  marker.className = `entity-marker entity-marker--${modifier}`;
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = visibleTitle === "—" ? "·" : visibleTitle.charAt(0).toUpperCase();
  return marker;
}

function addMarkerImage(marker, source, fallback, alt) {
  const image = document.createElement("img");
  image.src = source || fallback;
  image.alt = alt;
  image.addEventListener("error", () => {
    if (source && fallback) {
      image.src = fallback;
      return;
    }
    image.remove();
  }, { once: true });
  marker.prepend(image);
  marker.classList.add("entity-marker--image");
}

function setStudentColor(element, color) {
  if (typeof color === "string" && globalThis.CSS?.supports?.("color", color)) {
    element.style.setProperty("--student-color", color);
  }
}

function renderGroup(group) {
  const item = createDataItem(group.name, [
    ["Course", group.courseName],
    ["Students", group.studentCount],
    ["Academic year", group.academicYear],
    ["Active", group.active],
  ]);
  const heading = item.querySelector("h3");
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "entity-name-button";
  openButton.dataset.openGroup = group.id;
  openButton.textContent = displayValue(group.name);
  heading?.replaceChildren(createEntityMarker(group.name, "group"), openButton);
  return item;
}

function renderStudent(student) {
  const item = createDataItem(student.name, [
    ["Group", student.groupName],
    ["Course", student.courseName],
    ["Status", studentStatus(student)],
  ]);
  const heading = item.querySelector("h3");
  const link = document.createElement("a");
  link.href = `#student/${encodeURIComponent(student.id)}`;
  link.dataset.studentProfileLink = student.id;
  link.textContent = displayValue(student.name);
  const marker = createEntityMarker(student.name, "student");
  const mode = document.createElement("span");
  mode.className = "student-mode-badge";
  mode.dataset.mode = studentLessonMode(student);
  mode.textContent = studentLessonMode(student) === "offline" ? "Offline" : "Online";
  if (student.avatarImageUrl) addMarkerImage(marker, student.avatarImageUrl, "", `${displayValue(student.name)} avatar`);
  heading.replaceChildren(marker, link, mode);
  setStudentColor(item, student.color);

  const actions = document.createElement("div");
  if (studentStatus(student) !== "archived") {
    const archiveButton = document.createElement("button");
    archiveButton.type = "button";
    archiveButton.dataset.archiveStudent = student.id;
    archiveButton.textContent = "Archive";
    actions.append(archiveButton);
  }

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.dataset.deleteStudent = student.id;
  deleteButton.textContent = "Delete";
  actions.append(deleteButton);

  item.append(actions);
  return item;
}

function renderCourse(course) {
  const item = createDataItem(course.name, [
    ["Level", course.level],
    ["Groups", course.groupCount],
    ["Students", course.studentCount],
    ["Units", course.unitCount],
    ["Active", course.active],
  ]);
  const heading = item.querySelector("h3");
  const openButton = document.createElement("button");
  openButton.type = "button";
  openButton.className = "entity-name-button";
  openButton.dataset.openCourse = course.id;
  openButton.textContent = displayValue(course.name);
  const marker = createEntityMarker(course.name, "course");
  addMarkerImage(
    marker,
    course.coverImageUrl,
    ENTITY_IMAGE_CONFIG[ENTITY_IMAGE_TYPES.COURSE].fallbackUrl,
    `${displayValue(course.name)} cover`,
  );
  heading?.replaceChildren(marker, openButton);
  return item;
}

function getSectionElements(sectionName) {
  const section = document.querySelector(`[data-admin-section="${sectionName}"]`);
  return {
    section,
    state: section?.querySelector("[data-section-state]"),
    content: section?.querySelector("[data-section-content]"),
  };
}

function showState(elements, message, state = "loading") {
  elements.state.textContent = message;
  elements.state.dataset.state = state;
  elements.state.hidden = false;
  elements.content.hidden = true;
}

function renderSectionDocuments(sectionName, documents) {
  const config = SECTION_CONFIG[sectionName];
  const elements = getSectionElements(sectionName);
  if (!config || !elements.state || !elements.content) return;

  const visibleDocuments = config.filterDocuments
    ? config.filterDocuments(documents)
    : documents;
  renderSectionSummary(sectionName, documents);
  elements.content.replaceChildren();

  if (visibleDocuments.length === 0) {
    showState(elements, config.emptyMessage, "empty");
    return;
  }

  elements.content.append(...visibleDocuments.map(config.renderItem));
  elements.content.hidden = false;
  elements.state.hidden = true;
}

function setSummaryValue(key, value) {
  const element = document.querySelector(`[data-summary-value="${key}"]`);
  if (element) element.textContent = String(value);
}

function renderSectionSummary(sectionName, documents) {
  if (sectionName === "students") {
    setSummaryValue("students-total", documents.length);
    setSummaryValue(
      "students-active",
      documents.filter((student) => studentStatus(student) === "active").length,
    );
    setSummaryValue(
      "students-paused",
      documents.filter((student) => studentStatus(student) === "paused").length,
    );
    setSummaryValue(
      "students-archived",
      documents.filter((student) => studentStatus(student) === "archived").length,
    );
    setSummaryValue("student-mode-all", documents.length);
    setSummaryValue(
      "student-mode-online",
      documents.filter((student) => studentLessonMode(student) === "online").length,
    );
    setSummaryValue(
      "student-mode-offline",
      documents.filter((student) => studentLessonMode(student) === "offline").length,
    );
  } else if (sectionName === "groups") {
    setSummaryValue("groups-total", documents.length);
    setSummaryValue(
      "groups-active",
      documents.filter((group) => group.active !== false).length,
    );
    setSummaryValue(
      "groups-courses",
      new Set(documents.map((group) => group.courseId).filter(Boolean)).size,
    );
  } else if (sectionName === "courses") {
    const activeCount = documents.filter((course) => course.active !== false).length;
    setSummaryValue("courses-total", documents.length);
    setSummaryValue("courses-active", activeCount);
    setSummaryValue("courses-inactive", documents.length - activeCount);
  }
}

async function loadSection(sectionName) {
  const config = SECTION_CONFIG[sectionName];
  if (!config || loadedSections.has(sectionName)) return;
  if (pendingLoads.has(sectionName)) return pendingLoads.get(sectionName);

  const elements = getSectionElements(sectionName);
  if (!elements.section || !elements.state || !elements.content) {
    console.error(`Admin section markup is incomplete: ${sectionName}`);
    return;
  }

  showState(elements, config.loadingMessage, "loading");

  const request = config
    .loadDocuments()
    .then((documents) => {
      sectionDocuments.set(sectionName, documents);
      renderSectionDocuments(sectionName, documents);
      loadedSections.add(sectionName);
    })
    .catch((error) => {
      console.error(`Unable to load Firestore collection for ${sectionName}.`, error);
      showState(elements, config.errorMessage, "error");
    })
    .finally(() => {
      pendingLoads.delete(sectionName);
    });

  pendingLoads.set(sectionName, request);
  return request;
}

function activeSectionName() {
  return document.querySelector("[data-admin-section]:not([hidden])")?.dataset.adminSection;
}

async function refreshAfterEntityChange(entityName) {
  const dependencies = {
    students: {
      collections: ["students"],
      sections: ["students", "groups", "courses"],
    },
    groups: {
      collections: ["groups"],
      sections: ["groups", "students", "courses"],
    },
    courses: {
      collections: ["courses"],
      sections: ["courses", "groups", "students"],
    },
    units: { collections: ["units"], sections: ["courses"] },
  };
  const dependency = dependencies[entityName];
  if (!dependency) return;
  invalidateCalendar();

  dependency.collections.forEach((collectionName) => collectionLoads.delete(collectionName));
  dependency.sections.forEach((sectionName) => {
    loadedSections.delete(sectionName);
    sectionDocuments.delete(sectionName);
  });

  const currentSection = activeSectionName();
  if (dependency.sections.includes(currentSection)) {
    await loadSection(currentSection);
  }
}

function isKnownSection(sectionName) {
  return Boolean(document.querySelector(`[data-admin-section="${sectionName}"]`));
}

function routeFromHash() {
  const hashValue = window.location.hash.slice(1);

  if (hashValue.startsWith("student/")) {
    try {
      const studentId = decodeURIComponent(hashValue.slice("student/".length));
      if (studentId) {
        return { sectionName: STUDENT_PROFILE_SECTION, studentId };
      }
    } catch (error) {
      console.error("Unable to read the student profile URL.", error);
    }
  }

  return {
    sectionName: isKnownSection(hashValue) ? hashValue : DEFAULT_SECTION,
    studentId: null,
  };
}

function activateRoute(route) {
  const activeSection = isKnownSection(route.sectionName)
    ? route.sectionName
    : DEFAULT_SECTION;

  document.querySelectorAll("[data-admin-section]").forEach((section) => {
    section.hidden = section.dataset.adminSection !== activeSection;
  });

  document.querySelectorAll("[data-admin-link]").forEach((link) => {
    if (link.dataset.adminLink === activeSection) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  if (activeSection === STUDENT_PROFILE_SECTION && route.studentId) {
    const selection = pendingStudentProgress?.studentId === route.studentId
      ? pendingStudentProgress
      : null;
    pendingStudentProgress = null;
    const homeworkId = pendingHomeworkEdit?.studentId === route.studentId
      ? pendingHomeworkEdit.homeworkId
      : "";
    pendingHomeworkEdit = null;
    void loadAdminStudentProfile(route.studentId, "", selection, homeworkId);
  } else if (activeSection === CALENDAR_SECTION) {
    clearStudentAccess();
    void showCalendar();
  } else if (activeSection === DEFAULT_SECTION) {
    clearStudentAccess();
    void loadOverview();
  } else {
    clearStudentAccess();
    void loadSection(activeSection);
  }
}

function navigateWithinAdmin(hash) {
  window.history.pushState(null, "", hash);
  activateRoute(routeFromHash());
}

export function initializeAdminDashboard() {
  const navigation = document.querySelector("[data-admin-navigation]");
  const dashboard = document.querySelector("[data-protected-content]");
  const globalSearch = document.querySelector("[data-admin-global-search]");
  if (!navigation || !dashboard) {
    console.error("Admin dashboard markup was not found.");
    return;
  }

  window.addEventListener("teacher:homework-edit-request", (event) => {
    const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
    if (!detail.studentId || !detail.homeworkId) return;
    pendingHomeworkEdit = { studentId: detail.studentId, homeworkId: detail.homeworkId };
    navigateWithinAdmin(`#student/${encodeURIComponent(detail.studentId)}`);
  });

  navigation.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const link = target?.closest("[data-admin-link]");
    if (!link) return;

    event.preventDefault();
    navigateWithinAdmin(`#${link.dataset.adminLink}`);
  });

  dashboard.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const dashboardLink = target?.closest("[data-dashboard-link]");
    const studentLink = target?.closest("[data-student-profile-link]");
    const backLink = target?.closest("[data-student-profile-back]");

    if (dashboardLink) {
      event.preventDefault();
      navigateWithinAdmin(`#${dashboardLink.dataset.dashboardLink}`);
    } else if (studentLink) {
      event.preventDefault();
      navigateWithinAdmin(studentLink.getAttribute("href"));
    } else if (backLink) {
      event.preventDefault();
      navigateWithinAdmin("#students");
    }
  });

  document.querySelector("[data-student-filter]")?.addEventListener("change", () => {
    const students = sectionDocuments.get("students");
    if (students) renderSectionDocuments("students", students);
  });

  document.querySelectorAll("[data-student-mode-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-student-mode-filter]").forEach((candidate) => {
        candidate.setAttribute("aria-pressed", String(candidate === button));
      });
      const students = sectionDocuments.get("students");
      if (students) renderSectionDocuments("students", students);
    });
  });

  document.querySelector("[data-student-search]")?.addEventListener("input", () => {
    const students = sectionDocuments.get("students");
    if (students) renderSectionDocuments("students", students);
  });

  globalSearch?.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = document.querySelector("[data-admin-global-search-input]")?.value ?? "";
    const studentSearch = document.querySelector("[data-student-search]");
    if (studentSearch) studentSearch.value = value;
    navigateWithinAdmin("#students");
    studentSearch?.dispatchEvent(new Event("input"));
    studentSearch?.focus();
  });

  initializeAdminCrud({
    onEntityChanged: refreshAfterEntityChange,
    onOpenStudent(studentId) {
      navigateWithinAdmin(`#student/${encodeURIComponent(studentId)}`);
    },
  });

  initializeCalendar();
  window.addEventListener("teacher:student-progress-request", (event) => {
    const detail = event.detail && typeof event.detail === "object" ? event.detail : {};
    if (!detail.studentId) return;
    pendingStudentProgress = detail;
    navigateWithinAdmin(`#student/${encodeURIComponent(detail.studentId)}`);
  });

  window.addEventListener("popstate", () => activateRoute(routeFromHash()));
  activateRoute(routeFromHash());
}
