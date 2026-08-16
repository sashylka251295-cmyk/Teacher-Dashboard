export const PAGE_PATHS = Object.freeze({
  HOME: "./index.html",
  LOGIN: "./login.html",
  ADMIN: "./admin.html",
  STUDENT: "./student.html",
});

export function navigateTo(pagePath) {
  window.location.assign(new URL(pagePath, document.baseURI));
}

