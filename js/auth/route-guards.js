import { getSession } from "./session.js";
import { signOutCurrentUser } from "./auth-service.js";
import { PAGE_PATHS, navigateTo } from "../core/navigation.js";
import { USER_ROLES } from "../domain/constants.js";

function pageForRole(role) {
  if (role === USER_ROLES.ADMIN) return PAGE_PATHS.ADMIN;
  if (role === USER_ROLES.STUDENT) return PAGE_PATHS.STUDENT;
  return PAGE_PATHS.LOGIN;
}

export async function redirectToSessionPage() {
  const session = await getSession();
  navigateTo(session ? pageForRole(session.profile.role) : PAGE_PATHS.LOGIN);
}

export async function requireRole(requiredRole) {
  const session = await getSession();

  if (!session) {
    navigateTo(PAGE_PATHS.LOGIN);
    return null;
  }

  if (
    session.profile.role === USER_ROLES.STUDENT &&
    session.profile.accessDisabled === true
  ) {
    await signOutCurrentUser();
    navigateTo(PAGE_PATHS.LOGIN);
    return null;
  }

  if (session.profile.role !== requiredRole) {
    navigateTo(pageForRole(session.profile.role));
    return null;
  }

  return session;
}
