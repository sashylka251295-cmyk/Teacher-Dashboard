import {
  CALENDAR_COLORS,
  calendarColorUsage,
  isCalendarPaletteColor,
} from "../domain/calendar.js";

function usageLabel(entries) {
  if (!entries?.length) return "Available";
  const names = entries.slice(0, 2).map(({ name }) => name).join(", ");
  return entries.length > 2 ? `Used by ${names} +${entries.length - 2}` : `Used by ${names}`;
}

export function createCalendarColorPicker(root, options = {}) {
  const input = root?.querySelector("[data-calendar-color-value]");
  const swatches = root?.querySelector("[data-calendar-color-swatches]");
  const message = root?.querySelector("[data-calendar-color-message]");
  const availabilityMessage = root?.querySelector("[data-calendar-color-availability]");
  const chooseAnother = root?.querySelector("[data-calendar-color-choose-another]");
  const useAnyway = root?.querySelector("[data-calendar-color-use-anyway]");
  if (!root || !input || !swatches || !message || !chooseAnother || !useAnyway) return null;

  let usage = new Map();
  let pendingColor = "";
  let disabled = false;

  function notify() {
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    options.onChange?.(input.value);
  }

  function clearWarning() {
    pendingColor = "";
    message.textContent = "";
    root.dataset.warning = "false";
    chooseAnother.hidden = true;
    useAnyway.hidden = true;
  }

  function selectColor(value, shouldNotify = true) {
    if (!isCalendarPaletteColor(value)) return;
    input.value = value.toLowerCase();
    clearWarning();
    render();
    if (shouldNotify) notify();
  }

  function requestColor(value) {
    if (disabled) return;
    const entries = usage.get(value.toLowerCase()) ?? [];
    if (!entries.length || value.toLowerCase() === input.value.toLowerCase()) {
      selectColor(value);
      return;
    }
    pendingColor = value.toLowerCase();
    message.textContent = `This color is already used by ${entries.map(({ name }) => name).join(", ")}.`;
    root.dataset.warning = "true";
    chooseAnother.hidden = false;
    useAnyway.hidden = false;
  }

  function render() {
    swatches.replaceChildren(...CALENDAR_COLORS.map(({ name, value }) => {
      const button = document.createElement("button");
      const entries = usage.get(value.toLowerCase()) ?? [];
      const availability = usageLabel(entries);
      button.type = "button";
      button.className = "calendar-color-swatch";
      button.dataset.calendarColor = value;
      button.dataset.occupied = entries.length ? "true" : "false";
      button.style.setProperty("--swatch-color", value);
      button.setAttribute("aria-label", `${name}. ${availability}`);
      button.title = `${name} · ${availability}`;
      button.setAttribute("aria-pressed", String(input.value.toLowerCase() === value.toLowerCase()));
      button.disabled = disabled;
      button.addEventListener("click", () => requestColor(value));
      const showAvailability = () => {
        if (availabilityMessage) availabilityMessage.textContent = `${name} · ${availability}`;
      };
      button.addEventListener("mouseenter", showAvailability);
      button.addEventListener("focus", showAvailability);
      return button;
    }));
    const selected = CALENDAR_COLORS.find(({ value }) => value.toLowerCase() === input.value.toLowerCase());
    if (selected && availabilityMessage) {
      availabilityMessage.textContent = `${selected.name} · ${usageLabel(usage.get(selected.value.toLowerCase()))}`;
    }
  }

  chooseAnother.addEventListener("click", clearWarning);
  useAnyway.addEventListener("click", () => {
    if (pendingColor) selectColor(pendingColor);
  });

  const api = {
    get value() {
      return input.value;
    },
    firstAvailable() {
      return CALENDAR_COLORS.find(({ value }) => !(usage.get(value.toLowerCase()) ?? []).length)?.value
        ?? CALENDAR_COLORS[0].value;
    },
    setValue(value, shouldNotify = false) {
      selectColor(isCalendarPaletteColor(value) ? value : CALENDAR_COLORS[0].value, shouldNotify);
    },
    setUsage(students = [], groups = [], excluded = {}) {
      usage = calendarColorUsage(students, groups, excluded);
      clearWarning();
      render();
    },
    setDisabled(value) {
      disabled = Boolean(value);
      root.dataset.disabled = String(disabled);
      render();
    },
    reset() {
      usage = new Map();
      disabled = false;
      selectColor(CALENDAR_COLORS[0].value, false);
    },
  };
  api.reset();
  return api;
}
