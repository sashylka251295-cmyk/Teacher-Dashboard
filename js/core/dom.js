export function setText(selector, value, root = document) {
  const element = root.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
}

export function revealProtectedContent() {
  const content = document.querySelector("[data-protected-content]");
  const status = document.querySelector("[data-page-status]");

  if (content) {
    content.hidden = false;
  }

  if (status) {
    status.hidden = true;
  }
}

