import { requireRole } from "../auth/route-guards.js";
import { signOutCurrentUser } from "../auth/auth-service.js";
import { revealProtectedContent, setText } from "../core/dom.js";
import { PAGE_PATHS, navigateTo } from "../core/navigation.js";
import { USER_ROLES } from "../domain/constants.js";
import { initializeStudentView } from "../student/student-view.js?v=20260827-homework-details";

try {
  const session = await requireRole(USER_ROLES.STUDENT);
  if (session) {
    revealProtectedContent();
    await initializeStudentView(session);
  }
} catch (error) {
  console.error("Unable to protect the student page.", error);
  setText("[data-page-status]", "Не удалось проверить права доступа.");
}

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await signOutCurrentUser();
  navigateTo(PAGE_PATHS.LOGIN);
});
