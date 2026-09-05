import { requireRole } from "../auth/route-guards.js";
import { signOutCurrentUser } from "../auth/auth-service.js";
import { initializeAdminDashboard } from "../admin/admin-dashboard.js?v=20260905-calendar-organizer";
import { revealProtectedContent, setText } from "../core/dom.js";
import { PAGE_PATHS, navigateTo } from "../core/navigation.js";
import { USER_ROLES } from "../domain/constants.js";

try {
  const session = await requireRole(USER_ROLES.ADMIN);
  if (session) {
    revealProtectedContent();
    initializeAdminDashboard();
  }
} catch (error) {
  console.error("Unable to protect the admin page.", error);
  setText("[data-page-status]", "Не удалось проверить права доступа.");
}

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await signOutCurrentUser();
  navigateTo(PAGE_PATHS.LOGIN);
});
