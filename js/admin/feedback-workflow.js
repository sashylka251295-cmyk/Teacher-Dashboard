import { feedbackDraftsRepository } from "../data/repositories/feedback-drafts-repository.js";
import { teacherNotesRepository } from "../data/repositories/teacher-notes-repository.js";
import { FEEDBACK_STATUS_LABELS, LANGUAGE_SKILL_LABELS } from "../domain/constants.js";
import {
  isFeedbackContentComplete,
  normalizeFeedbackContent,
} from "../domain/feedback.js";
import { createFeedbackGenerator } from "../feedback/feedback-generator.js";

const generator = createFeedbackGenerator();
let context = null;
let elements = null;
let activeDraft = null;
let activeObservation = null;
let initialized = false;
let generating = false;

function timestampMillis(value) {
  if (!value) return 0;
  const converted = typeof value.toDate === "function" ? value.toDate() : value;
  const date = converted instanceof Date ? converted : new Date(converted);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function unitName(unit) {
  if (typeof unit?.title === "string" && unit.title.trim()) return unit.title;
  return unit?.number ? `Unit ${unit.number}` : "Unknown unit";
}

function setMessage(message) {
  elements.message.textContent = message;
}

function setSelectionMessage(message) {
  elements.selectionMessage.textContent = message;
}

function observationCheckboxes() {
  return [...elements.observationList.querySelectorAll("[data-feedback-observation]")];
}

function selectedObservationIds() {
  return observationCheckboxes()
    .filter((checkbox) => checkbox.checked && !checkbox.disabled)
    .map((checkbox) => checkbox.dataset.feedbackObservation);
}

function updateGenerateButton() {
  const count = selectedObservationIds().length;
  const noun = count === 1 ? "observation" : "observations";
  elements.generate.textContent = `Generate from ${count} ${noun}`;
  elements.generate.disabled = generating || count === 0;
}

function sortedDrafts() {
  return [...(context?.feedbackDrafts ?? [])].sort(
    (first, second) => timestampMillis(second.updatedAt ?? second.createdAt) -
      timestampMillis(first.updatedAt ?? first.createdAt),
  );
}

function draftOptionLabel(draft) {
  if (draft.status === "published") {
    return `Published feedback · v${draft.latestVersionNumber || 1}`;
  }
  if (draft.status === "archived") return "Archived feedback";
  return "Feedback draft";
}

function renderDraftPicker(drafts) {
  elements.draftSelect.replaceChildren(...drafts.map((draft) => {
    const option = document.createElement("option");
    option.value = draft.id;
    option.textContent = draftOptionLabel(draft);
    option.selected = draft.id === activeDraft?.id;
    return option;
  }));
  elements.draftPicker.hidden = drafts.length < 2;
}

function renderContextChips(draft) {
  const observationIds = new Set(draft.sourceObservationIds ?? []);
  const observations = (context.teacherNotes ?? []).filter((note) => observationIds.has(note.id));
  const unitsById = new Map((context.units ?? []).map((unit) => [unit.id, unit]));
  const labels = [];

  observations.forEach((note) => {
    const unit = unitsById.get(note.unitId);
    if (unit) labels.push(`Unit: ${unitName(unit)}`);
  });
  observations.forEach((note) => {
    const category = LANGUAGE_SKILL_LABELS[note.skillCategory];
    if (category) labels.push(category);
  });

  const uniqueLabels = [...new Set(labels)];
  if (!uniqueLabels.length) {
    uniqueLabels.push(`${draft.sourceObservationIds?.length ?? 0} private observations`);
  }
  elements.contextChips.replaceChildren(...uniqueLabels.map((label) => {
    const chip = document.createElement("span");
    chip.textContent = label;
    return chip;
  }));
}

function renderActiveDraft() {
  const drafts = sortedDrafts();
  if (!drafts.length) {
    activeDraft = null;
    elements.empty.hidden = false;
    elements.editor.hidden = true;
    elements.status.hidden = true;
    return;
  }

  const existing = activeDraft && drafts.find((draft) => draft.id === activeDraft.id);
  activeDraft = existing ?? drafts.find((draft) => draft.status === "draft") ?? drafts[0];
  const content = normalizeFeedbackContent(activeDraft.content);
  const isDraft = activeDraft.status === "draft";
  const isPublished = activeDraft.status === "published";

  elements.empty.hidden = true;
  elements.editor.hidden = false;
  elements.status.hidden = false;
  elements.status.dataset.status = activeDraft.status;
  elements.status.textContent = FEEDBACK_STATUS_LABELS[activeDraft.status] ?? activeDraft.status;
  elements.form.elements.whatWentWell.value = content.whatWentWell;
  elements.form.elements.whatToPractise.value = content.whatToPractise;
  elements.form.elements.nextStep.value = content.nextStep;
  [...elements.form.querySelectorAll("textarea")].forEach((textarea) => {
    textarea.readOnly = !isDraft;
  });

  elements.reviewHint.textContent = isPublished
    ? `Published version ${activeDraft.latestVersionNumber || 1}`
    : activeDraft.status === "archived"
      ? "This feedback is archived"
      : "Review and edit before publishing";
  elements.visibilityIcon.textContent = isPublished ? "◉" : "⊘";
  elements.visibilityText.textContent = isPublished
    ? "Visible in the student profile"
    : "Not visible to the student yet";
  elements.visibility.dataset.visible = String(isPublished);
  elements.save.hidden = !isDraft;
  elements.publish.hidden = !isDraft;
  elements.republish.hidden = !isPublished;
  elements.moreActions.hidden = !isDraft;
  setMessage("");
  renderContextChips(activeDraft);
  renderDraftPicker(drafts);
}

function collectContent() {
  return normalizeFeedbackContent({
    whatWentWell: elements.form.elements.whatWentWell.value,
    whatToPractise: elements.form.elements.whatToPractise.value,
    nextStep: elements.form.elements.nextStep.value,
  });
}

async function generateFeedback() {
  const selectedIds = selectedObservationIds();
  const observations = context.teacherNotes.filter((note) => selectedIds.includes(note.id));
  if (!observations.length) {
    setSelectionMessage("Select at least one private observation.");
    return;
  }
  if (observations.some((note) => !note.learningTargetId || !note.skillCategory)) {
    setSelectionMessage("Only observations linked to a learning target can be used.");
    return;
  }

  generating = true;
  updateGenerateButton();
  setSelectionMessage("Creating a safe feedback draft…");
  try {
    const generated = await generator.generate({ observations });
    const draftData = {
      studentId: context.student.id,
      courseId: context.student.courseId,
      sourceObservationIds: selectedIds,
      content: generated.content,
      generator: generated.generator,
    };
    const id = await feedbackDraftsRepository.createDraft(draftData);
    activeDraft = {
      id,
      ...draftData,
      status: "draft",
      latestVersionNumber: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    context.feedbackDrafts.push(activeDraft);
    renderActiveDraft();
    setSelectionMessage("Draft created. Review and edit it before publishing.");
  } catch (error) {
    console.error("Unable to generate feedback.", error);
    setSelectionMessage("Unable to create feedback draft. Please try again.");
  } finally {
    generating = false;
    updateGenerateButton();
  }
}

async function saveDraft() {
  if (!activeDraft || activeDraft.status !== "draft") return;
  const content = collectContent();
  if (!isFeedbackContentComplete(content)) {
    setMessage("Complete all three feedback sections.");
    return;
  }
  elements.save.disabled = true;
  setMessage("Saving draft…");
  try {
    await feedbackDraftsRepository.saveDraft(activeDraft.id, content);
    activeDraft.content = content;
    activeDraft.updatedAt = new Date();
    setMessage("Draft saved. It is still private.");
    renderDraftPicker(sortedDrafts());
  } catch (error) {
    console.error("Unable to save feedback draft.", error);
    setMessage("Unable to save the draft. Please try again.");
  } finally {
    elements.save.disabled = false;
  }
}

async function publishDraft() {
  if (!activeDraft || activeDraft.status !== "draft") return;
  const content = collectContent();
  if (!isFeedbackContentComplete(content)) {
    setMessage("Complete all three feedback sections before publishing.");
    return;
  }
  elements.publish.disabled = true;
  setMessage("Publishing reviewed feedback…");
  try {
    const result = await feedbackDraftsRepository.publish(activeDraft.id, content);
    activeDraft.content = content;
    activeDraft.status = "published";
    activeDraft.latestVersionNumber = result.versionNumber;
    activeDraft.updatedAt = new Date();
    renderActiveDraft();
    setMessage("Feedback approved and published to this student.");
  } catch (error) {
    console.error("Unable to publish feedback.", error);
    setMessage("Unable to publish feedback. Please try again.");
  } finally {
    elements.publish.disabled = false;
  }
}

async function prepareRepublish() {
  if (!activeDraft || activeDraft.status !== "published") return;
  elements.republish.disabled = true;
  setMessage("Preparing a new editable version…");
  try {
    await feedbackDraftsRepository.prepareRepublish(activeDraft.id);
    activeDraft.status = "draft";
    activeDraft.updatedAt = new Date();
    renderActiveDraft();
    setMessage("Edit the draft, then approve and publish the new version.");
    elements.form.elements.whatWentWell.focus();
  } catch (error) {
    console.error("Unable to prepare feedback for republishing.", error);
    setMessage("Unable to open feedback for republishing.");
  } finally {
    elements.republish.disabled = false;
  }
}

async function archiveDraft() {
  if (!activeDraft || activeDraft.status !== "draft") return;
  elements.archive.disabled = true;
  setMessage("Archiving…");
  try {
    await feedbackDraftsRepository.archive(activeDraft.id);
    activeDraft.status = "archived";
    activeDraft.updatedAt = new Date();
    renderActiveDraft();
    setMessage("Feedback archived.");
  } catch (error) {
    console.error("Unable to archive feedback.", error);
    setMessage("Unable to archive feedback. Please try again.");
  } finally {
    elements.archive.disabled = false;
  }
}

function openObservationEditor(note) {
  activeObservation = note;
  elements.observationTarget.textContent = note.learningTargetTitle || "Observation without a linked learning target";
  elements.observationForm.elements.lessonContext.value = note.lessonContext ?? "";
  elements.observationForm.elements.text.value = note.text ?? "";
  elements.observationForm.elements.includeInFeedback.checked = note.includeInFeedback === true;
  elements.observationMessage.textContent = "";
  if (typeof elements.observationDialog.showModal === "function") elements.observationDialog.showModal();
  else elements.observationDialog.setAttribute("open", "");
}

function closeObservationEditor() {
  activeObservation = null;
  if (typeof elements.observationDialog.close === "function") elements.observationDialog.close();
  else elements.observationDialog.removeAttribute("open");
}

async function saveObservation(event) {
  event.preventDefault();
  if (!activeObservation) return;
  const data = new FormData(elements.observationForm);
  const changes = {
    lessonContext: String(data.get("lessonContext") ?? "").trim(),
    text: String(data.get("text") ?? "").trim(),
    includeInFeedback: data.get("includeInFeedback") === "on",
  };
  if (!changes.text) {
    elements.observationMessage.textContent = "Add the observation text.";
    return;
  }
  const submit = elements.observationForm.querySelector('[type="submit"]');
  submit.disabled = true;
  elements.observationMessage.textContent = "Saving observation…";
  try {
    await teacherNotesRepository.update(activeObservation.id, changes);
    Object.assign(activeObservation, changes);
    closeObservationEditor();
    await context.onSaved("Observation updated.");
  } catch (error) {
    console.error("Unable to update observation.", error);
    elements.observationMessage.textContent = "Unable to save the observation. Please try again.";
  } finally {
    submit.disabled = false;
  }
}

async function deleteObservation(note, button) {
  const confirmed = window.confirm("Delete this private observation? Published feedback will not be changed.");
  if (!confirmed) return;
  button.disabled = true;
  setSelectionMessage("Deleting observation…");
  try {
    await teacherNotesRepository.remove(note.id);
    context.teacherNotes = context.teacherNotes.filter((item) => item.id !== note.id);
    await context.onSaved("Observation deleted. Published feedback was not changed.");
  } catch (error) {
    console.error("Unable to delete observation.", error);
    setSelectionMessage("Unable to delete the observation. Please try again.");
    button.disabled = false;
  }
}

async function handleDashboardClick(event) {
  const target = event.target instanceof Element ? event.target : null;
  if (!target || !context) return;
  if (target.closest("[data-generate-feedback]")) return generateFeedback();

  const edit = target.closest("[data-edit-observation]");
  if (edit) {
    const note = context.teacherNotes.find((item) => item.id === edit.dataset.editObservation);
    if (note) openObservationEditor(note);
    return;
  }

  const remove = target.closest("[data-delete-observation]");
  if (remove) {
    const note = context.teacherNotes.find((item) => item.id === remove.dataset.deleteObservation);
    if (note) await deleteObservation(note, remove);
  }
}

async function handleObservationSelection(event) {
  if (!event.target.matches("[data-feedback-observation]") || !context) return;
  const note = context.teacherNotes.find((item) => item.id === event.target.dataset.feedbackObservation);
  if (!note) return;
  const includeInFeedback = event.target.checked;
  note.includeInFeedback = includeInFeedback;
  updateGenerateButton();
  setSelectionMessage("Saving selection…");
  try {
    await teacherNotesRepository.update(note.id, { includeInFeedback });
    setSelectionMessage(includeInFeedback
      ? "Observation included in feedback."
      : "Observation removed from feedback.");
  } catch (error) {
    console.error("Unable to update observation selection.", error);
    event.target.checked = !includeInFeedback;
    note.includeInFeedback = !includeInFeedback;
    updateGenerateButton();
    setSelectionMessage("Unable to update the observation. Please try again.");
  }
}

function initialize() {
  const dashboard = document.querySelector("[data-protected-content]");
  const observationDialog = document.querySelector("[data-observation-dialog]");
  elements = {
    dashboard,
    observationList: dashboard?.querySelector("[data-observations-list]"),
    generate: dashboard?.querySelector("[data-generate-feedback]"),
    selectionMessage: dashboard?.querySelector("[data-feedback-selection-message]"),
    empty: dashboard?.querySelector("[data-feedback-empty]"),
    editor: dashboard?.querySelector("[data-feedback-editor]"),
    status: dashboard?.querySelector("[data-feedback-status]"),
    contextChips: dashboard?.querySelector("[data-feedback-context-chips]"),
    reviewHint: dashboard?.querySelector("[data-feedback-review-hint]"),
    draftPicker: dashboard?.querySelector("[data-feedback-draft-picker]"),
    draftSelect: dashboard?.querySelector("[data-feedback-draft-select]"),
    form: dashboard?.querySelector("[data-feedback-form]"),
    message: dashboard?.querySelector("[data-feedback-form-message]"),
    visibility: dashboard?.querySelector("[data-feedback-visibility]"),
    visibilityIcon: dashboard?.querySelector("[data-feedback-visibility-icon]"),
    visibilityText: dashboard?.querySelector("[data-feedback-visibility-text]"),
    save: dashboard?.querySelector("[data-feedback-save]"),
    publish: dashboard?.querySelector("[data-feedback-publish]"),
    republish: dashboard?.querySelector("[data-feedback-republish]"),
    archive: dashboard?.querySelector("[data-feedback-archive]"),
    moreActions: dashboard?.querySelector("[data-feedback-more-actions]"),
    observationDialog,
    observationForm: observationDialog?.querySelector("[data-observation-form]"),
    observationTarget: observationDialog?.querySelector("[data-observation-target]"),
    observationMessage: observationDialog?.querySelector("[data-observation-form-message]"),
    observationClose: observationDialog?.querySelector("[data-observation-close]"),
  };
  if (Object.values(elements).some((element) => !element)) {
    console.error("Feedback workflow markup is incomplete.");
    return false;
  }

  dashboard.addEventListener("click", handleDashboardClick);
  dashboard.addEventListener("change", handleObservationSelection);
  elements.form.addEventListener("submit", (event) => event.preventDefault());
  elements.save.addEventListener("click", saveDraft);
  elements.publish.addEventListener("click", publishDraft);
  elements.republish.addEventListener("click", prepareRepublish);
  elements.archive.addEventListener("click", archiveDraft);
  elements.draftSelect.addEventListener("change", () => {
    activeDraft = context.feedbackDrafts.find((draft) => draft.id === elements.draftSelect.value) ?? null;
    renderActiveDraft();
  });
  elements.observationForm.addEventListener("submit", saveObservation);
  elements.observationClose.addEventListener("click", closeObservationEditor);
  return true;
}

export function configureFeedbackWorkflow(nextContext) {
  if (!initialized) initialized = initialize();
  if (!initialized) return;
  context = nextContext;
  activeDraft = null;
  setSelectionMessage("");
  updateGenerateButton();
  renderActiveDraft();
}
