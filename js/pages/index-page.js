import { redirectToSessionPage } from "../auth/route-guards.js";
import { setText } from "../core/dom.js";

try {
  await redirectToSessionPage();
} catch (error) {
  console.error("Unable to resolve the current session.", error);
  setText("[data-page-status]", "Не удалось проверить сессию. Проверьте Firebase configuration.");
}

