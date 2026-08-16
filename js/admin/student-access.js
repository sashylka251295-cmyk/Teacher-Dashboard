import {
  disableStudentAccess,
  enableStudentAccess,
  getStudentAccessStatus,
  inviteStudent,
  sendStudentPasswordReset,
} from "./student-access-service.js";

const STATE_LABELS = Object.freeze({
  "no-account": "No account",
  "invitation-ready": "Invitation ready",
  "account-active": "Account active",
  "access-disabled": "Access disabled",
  error: "Unable to load access",
});

let elements = null;
let activeStudentId = null;
let activeRequestId = 0;
let activeStatus = { state: "no-account", email: "" };
let initialized = false;

function setMessage(message, type = "") {
  elements.message.textContent = message;
  if (type) elements.message.dataset.messageType = type;
  else delete elements.message.dataset.messageType;
}

function setBusy(isBusy) {
  elements.email.disabled = isBusy;
  elements.invite.disabled = isBusy;
  elements.disable.disabled = isBusy;
}

function hideSetupLink() {
  elements.link.value = "";
  elements.linkContainer.hidden = true;
}

function renderStatus(status) {
  activeStatus = status;
  const state = status?.state ?? "no-account";
  elements.status.textContent = STATE_LABELS[state] ?? "Unknown state";
  elements.status.dataset.accessState = state;
  if (typeof status?.email === "string" && status.email) {
    elements.email.value = status.email;
  }

  elements.email.readOnly = ["account-active", "access-disabled"].includes(state);
  elements.disable.hidden = state !== "account-active";

  const buttonLabels = {
    "no-account": "Invite Student",
    "invitation-ready": "Create New Invite Link",
    "account-active": "Send Password Reset Email",
    "access-disabled": "Enable Student Access",
    error: "Try Again",
  };
  elements.invite.textContent = buttonLabels[state] ?? "Invite Student";
}

function readableError(error, fallback) {
  if (error?.code === "permission-denied") {
    return "Invitations are not available yet. Deploy the updated Firestore Rules and reload this page.";
  }
  const message = typeof error?.message === "string" ? error.message : "";
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?$/, "") || fallback;
}

async function loadStatus(studentId) {
  const requestId = ++activeRequestId;
  setBusy(true);
  setMessage("Loading access status…");
  hideSetupLink();

  try {
    const status = await getStudentAccessStatus(studentId);
    if (requestId !== activeRequestId || studentId !== activeStudentId) return;
    renderStatus(status);
    setMessage("");
  } catch (error) {
    if (requestId !== activeRequestId || studentId !== activeStudentId) return;
    console.error("Unable to load student access status.", error);
    renderStatus({ state: "error", email: elements.email.value });
    setMessage(readableError(error, "Unable to load access status."), "error");
  } finally {
    if (requestId === activeRequestId && studentId === activeStudentId) setBusy(false);
  }
}

async function performAccessAction(event) {
  event.preventDefault();
  if (!activeStudentId) return;

  if (activeStatus.state === "error") {
    void loadStatus(activeStudentId);
    return;
  }

  const email = elements.email.value.trim();
  if (!email) {
    setMessage("Enter the student’s email.", "error");
    elements.email.focus();
    return;
  }

  const studentId = activeStudentId;
  const requestId = ++activeRequestId;
  setBusy(true);
  hideSetupLink();

  try {
    let result;
    let successMessage;
    let setupLink = "";
    if (activeStatus.state === "account-active") {
      setMessage("Sending a password reset email…");
      result = await sendStudentPasswordReset(email);
      successMessage = "Firebase sent a password reset email to the student.";
    } else if (activeStatus.state === "access-disabled") {
      setMessage("Enabling student access…");
      result = await enableStudentAccess(studentId);
      successMessage = "Student access enabled.";
    } else {
      setMessage("Creating a secure registration link…");
      result = await inviteStudent(studentId, email);
      setupLink = result.setupLink;
      successMessage = "Registration link ready. Copy it and send it to the student.";
    }

    if (requestId !== activeRequestId || studentId !== activeStudentId) return;
    renderStatus(result);
    if (setupLink) {
      elements.link.value = setupLink;
      elements.linkContainer.hidden = false;
    }
    setMessage(successMessage);
  } catch (error) {
    if (requestId !== activeRequestId || studentId !== activeStudentId) return;
    console.error("Unable to update student access.", error);
    setMessage(readableError(error, "Unable to update student access."), "error");
  } finally {
    if (requestId === activeRequestId && studentId === activeStudentId) setBusy(false);
  }
}

async function disableAccess() {
  if (!activeStudentId) return;
  if (!window.confirm("Disable this student’s access to learning data?")) return;

  const studentId = activeStudentId;
  const requestId = ++activeRequestId;
  setBusy(true);
  setMessage("Disabling student access…");
  hideSetupLink();

  try {
    const result = await disableStudentAccess(studentId);
    if (requestId !== activeRequestId || studentId !== activeStudentId) return;
    renderStatus(result);
    setMessage("Student access disabled.");
  } catch (error) {
    if (requestId !== activeRequestId || studentId !== activeStudentId) return;
    console.error("Unable to disable student access.", error);
    setMessage(readableError(error, "Unable to disable student access."), "error");
  } finally {
    if (requestId === activeRequestId && studentId === activeStudentId) setBusy(false);
  }
}

async function copySetupLink() {
  const link = elements.link.value;
  if (!link) return;

  try {
    await navigator.clipboard.writeText(link);
    setMessage("Registration link copied.");
  } catch (error) {
    console.error("Unable to copy the registration link.", error);
    elements.link.focus();
    elements.link.select();
    setMessage("Copy the selected registration link manually.");
  }
}

function initialize(root) {
  if (initialized) return true;
  elements = {
    form: root.querySelector("[data-student-access-form]"),
    status: root.querySelector("[data-student-access-status]"),
    email: root.querySelector("[data-student-access-email]"),
    invite: root.querySelector("[data-student-access-invite]"),
    disable: root.querySelector("[data-student-access-disable]"),
    message: root.querySelector("[data-student-access-message]"),
    linkContainer: root.querySelector("[data-student-setup-link-container]"),
    link: root.querySelector("[data-student-setup-link]"),
    copy: root.querySelector("[data-student-setup-link-copy]"),
  };

  if (Object.values(elements).some((element) => !element)) {
    console.error("Student access markup is incomplete.");
    elements = null;
    return false;
  }

  elements.form.addEventListener("submit", performAccessAction);
  elements.disable.addEventListener("click", disableAccess);
  elements.copy.addEventListener("click", copySetupLink);
  initialized = true;
  return true;
}

export function configureStudentAccess(root, student) {
  if (!initialize(root)) return;
  activeStudentId = student.id;
  activeStatus = { state: "no-account", email: "" };
  elements.form.reset();
  elements.email.readOnly = false;
  elements.status.textContent = "Loading…";
  elements.status.dataset.accessState = "loading";
  elements.disable.hidden = true;
  elements.invite.textContent = "Invite Student";
  setMessage("");
  hideSetupLink();
  void loadStatus(student.id);
}

export function clearStudentAccess() {
  activeRequestId += 1;
  activeStudentId = null;
  activeStatus = { state: "no-account", email: "" };
  if (!elements) return;
  elements.form.reset();
  elements.email.readOnly = false;
  setBusy(false);
  setMessage("");
  hideSetupLink();
}
