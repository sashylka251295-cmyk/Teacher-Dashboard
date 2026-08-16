export function field(form, name) {
  return form.elements.namedItem(name);
}

export function showDialog(dialog) {
  if (dialog.open) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

export function closeDialog(dialog) {
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  else dialog.removeAttribute("open");
}

export function setMessage(element, message) {
  element.textContent = message;
}

export function setSectionMessage(sectionName, message) {
  const element = document.querySelector(`[data-section-message="${sectionName}"]`);
  if (element) element.textContent = message;
}

export function displayValue(value) {
  if (value === true) return "active";
  if (value === false) return "inactive";
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

export function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

export function populateDocumentSelect(select, documents, placeholder) {
  select.replaceChildren(createOption("", placeholder));
  for (const document of documents) {
    select.append(createOption(document.id, displayValue(document.name)));
  }
}
