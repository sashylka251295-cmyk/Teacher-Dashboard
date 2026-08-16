import {
  createStudentAccount,
  refreshAuthUser,
  sendPasswordReset,
  sendVerificationEmail,
  signIn,
  signOutCurrentUser,
  waitForAuthUser,
} from "../auth/auth-service.js";
import { PAGE_PATHS, navigateTo } from "../core/navigation.js";
import { studentInvitationsRepository } from "../data/repositories/student-invitations-repository.js";
import { usersRepository } from "../data/repositories/users-repository.js";

const elements = {
  state: document.querySelector("[data-register-state]"),
  content: document.querySelector("[data-register-content]"),
  initial: document.querySelector("[data-register-initial]"),
  name: document.querySelector("[data-register-name]"),
  email: document.querySelector("[data-register-email]"),
  form: document.querySelector("[data-register-form]"),
  password: document.querySelector("#register-password"),
  confirmLabel: document.querySelector("[data-register-confirm-label]"),
  confirm: document.querySelector("[data-register-confirm]"),
  submit: document.querySelector("[data-register-submit]"),
  mode: document.querySelector("[data-register-mode]"),
  reset: document.querySelector("[data-register-reset]"),
  verification: document.querySelector("[data-register-verification]"),
  checkVerification: document.querySelector("[data-register-check-verification]"),
  resendVerification: document.querySelector("[data-register-resend-verification]"),
  verificationSignOut: document.querySelector("[data-register-sign-out]"),
  wrongAccount: document.querySelector("[data-register-wrong-account]"),
  currentEmail: document.querySelector("[data-register-current-email]"),
  wrongSignOut: document.querySelector("[data-register-wrong-sign-out]"),
  message: document.querySelector("[data-register-message]"),
};

let invitationId = "";
let invitation = null;
let mode = "create";
let currentUser = null;

function setMessage(message, type = "") {
  elements.message.textContent = message;
  if (type) elements.message.dataset.messageType = type;
  else delete elements.message.dataset.messageType;
}

function setBusy(isBusy) {
  elements.form.querySelectorAll("input, button").forEach((element) => {
    element.disabled = isBusy;
  });
  elements.checkVerification.disabled = isBusy;
  elements.resendVerification.disabled = isBusy;
}

function showStep(step) {
  elements.form.hidden = step !== "auth";
  elements.verification.hidden = step !== "verification";
  elements.wrongAccount.hidden = step !== "wrong-account";
}

function configureMode(nextMode) {
  mode = nextMode;
  const creating = mode === "create";
  elements.confirmLabel.hidden = !creating;
  elements.confirm.hidden = !creating;
  elements.confirm.required = creating;
  elements.password.autocomplete = creating ? "new-password" : "current-password";
  elements.submit.textContent = creating ? "Create account" : "Sign in and accept invitation";
  elements.mode.textContent = creating
    ? "I already have an account"
    : "Create a new account";
  elements.reset.hidden = creating;
  elements.form.reset();
  setMessage("");
}

function firebaseError(error, fallback) {
  const messages = {
    "auth/email-already-in-use": "An account with this email already exists. Sign in to accept the invitation.",
    "auth/invalid-credential": "Incorrect password for this account.",
    "auth/wrong-password": "Incorrect password for this account.",
    "auth/weak-password": "Use a password with at least 8 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a little and try again.",
    "permission-denied": "The invitation could not be accepted. It may be expired or already used.",
  };
  return messages[error?.code] ?? error?.message ?? fallback;
}

async function claimInvitation(user) {
  setBusy(true);
  setMessage("Checking email verification…");

  try {
    await refreshAuthUser(user);
    if (!user.emailVerified) {
      showStep("verification");
      setMessage("Email is not verified yet. Open the Firebase email and try again.", "error");
      return;
    }

    const existingProfile = await usersRepository.getById(user.uid);
    if (existingProfile) {
      if (
        existingProfile.role === "student" &&
        existingProfile.studentId === invitation.studentId
      ) {
        navigateTo(PAGE_PATHS.STUDENT);
        return;
      }
      throw new Error("This account is already linked to another profile.");
    }

    setMessage("Activating student access…");
    await studentInvitationsRepository.claim(invitationId, user);
    navigateTo(PAGE_PATHS.STUDENT);
  } catch (error) {
    console.error("Unable to claim the student invitation.", error);
    setMessage(firebaseError(error, "Unable to activate student access."), "error");
  } finally {
    setBusy(false);
  }
}

async function continueWithUser(user) {
  currentUser = user;
  if ((user.email ?? "").toLowerCase() !== invitation.email.toLowerCase()) {
    elements.currentEmail.textContent = user.email ?? "another account";
    showStep("wrong-account");
    setMessage("");
    return;
  }

  if (user.emailVerified) {
    await claimInvitation(user);
  } else {
    showStep("verification");
    setMessage("Verify your email before activating student access.");
  }
}

async function submitAuth(event) {
  event.preventDefault();
  const password = elements.password.value;
  const confirmation = elements.confirm.value;
  if (password.length < 8) {
    setMessage("Use a password with at least 8 characters.", "error");
    return;
  }
  if (mode === "create" && password !== confirmation) {
    setMessage("Passwords do not match.", "error");
    return;
  }

  setBusy(true);
  setMessage(mode === "create" ? "Creating account…" : "Signing in…");

  try {
    const credential = mode === "create"
      ? await createStudentAccount(invitation.email, password)
      : await signIn(invitation.email, password);
    currentUser = credential.user;

    if (mode === "create") {
      await sendVerificationEmail(currentUser);
      showStep("verification");
      setMessage("Verification email sent. Check the inbox and spam folder.");
    } else {
      await continueWithUser(currentUser);
    }
  } catch (error) {
    console.error("Unable to authenticate for invitation.", error);
    if (error?.code === "auth/email-already-in-use") {
      configureMode("sign-in");
    }
    setMessage(firebaseError(error, "Unable to continue."), "error");
  } finally {
    setBusy(false);
  }
}

async function resendVerification() {
  if (!currentUser) return;
  setBusy(true);
  try {
    await sendVerificationEmail(currentUser);
    setMessage("A new verification email was sent.");
  } catch (error) {
    console.error("Unable to resend verification email.", error);
    setMessage(firebaseError(error, "Unable to resend verification email."), "error");
  } finally {
    setBusy(false);
  }
}

async function signOutAndContinue() {
  await signOutCurrentUser();
  currentUser = null;
  configureMode("create");
  showStep("auth");
  setMessage("");
}

async function sendReset() {
  setBusy(true);
  try {
    await sendPasswordReset(invitation.email);
    setMessage("Firebase sent a password reset email.");
  } catch (error) {
    console.error("Unable to send password reset email.", error);
    setMessage(firebaseError(error, "Unable to send password reset email."), "error");
  } finally {
    setBusy(false);
  }
}

async function initializePage() {
  invitationId = new URLSearchParams(window.location.search).get("invite")?.trim() ?? "";
  if (!invitationId) {
    elements.state.textContent = "Invitation link is missing.";
    return;
  }

  try {
    invitation = await studentInvitationsRepository.getById(invitationId);
    if (!invitation || invitation.status !== "ready") {
      elements.state.textContent = "This invitation is invalid, expired, or already used.";
      return;
    }

    elements.initial.textContent = (invitation.name || "S").charAt(0).toUpperCase();
    elements.name.textContent = invitation.name || "Student";
    elements.email.textContent = invitation.email;
    elements.state.hidden = true;
    elements.content.hidden = false;
    configureMode("create");
    showStep("auth");

    const user = await waitForAuthUser();
    if (user) await continueWithUser(user);
  } catch (error) {
    console.error("Unable to load invitation.", error);
    elements.state.textContent = "Unable to open this invitation. Ask the teacher for a new link.";
  }
}

elements.form.addEventListener("submit", submitAuth);
elements.mode.addEventListener("click", () => configureMode(mode === "create" ? "sign-in" : "create"));
elements.reset.addEventListener("click", sendReset);
elements.checkVerification.addEventListener("click", () => {
  if (currentUser) void claimInvitation(currentUser);
});
elements.resendVerification.addEventListener("click", resendVerification);
elements.verificationSignOut.addEventListener("click", signOutAndContinue);
elements.wrongSignOut.addEventListener("click", signOutAndContinue);

void initializePage();
