import { signIn } from "../auth/auth-service.js";
import { getSession } from "../auth/session.js";
import { PAGE_PATHS, navigateTo } from "../core/navigation.js";
import { USER_ROLES } from "../domain/constants.js";

function navigateForRole(role) {
  if (role === USER_ROLES.ADMIN) {
    navigateTo(PAGE_PATHS.ADMIN);
    return;
  }

  if (role === USER_ROLES.STUDENT) {
    navigateTo(PAGE_PATHS.STUDENT);
    return;
  }

  throw new Error(`Unsupported user role: ${String(role)}`);
}

const form = document.querySelector("[data-login-form]");
const message = document.querySelector("[data-form-message]");
const submitButton = form.querySelector('button[type="submit"]');

function setMessage(text, state = "error") {
  message.textContent = text;
  message.dataset.state = state;
}

try {
  const existingSession = await getSession();
  if (existingSession) {
    navigateForRole(existingSession.profile.role);
  }
} catch (error) {
  console.error("Unable to check the existing session.", error);
  setMessage("Unable to connect. Please try again.");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const email = String(data.get("email") ?? "").trim();
  const password = String(data.get("password") ?? "");

  if (!email || !password) {
    setMessage("Enter your email and password.");
    return;
  }

  setMessage("Signing you in…", "loading");
  submitButton.disabled = true;
  form.setAttribute("aria-busy", "true");

  try {
    await signIn(email, password);
    const session = await getSession();

    if (!session) {
      throw new Error("The authenticated user does not have a users/{uid} profile.");
    }

    navigateForRole(session.profile.role);
  } catch (error) {
    console.error("Unable to sign in.", error);
    setMessage("We couldn't sign you in. Check your details and try again.");
  } finally {
    submitButton.disabled = false;
    form.removeAttribute("aria-busy");
  }
});
