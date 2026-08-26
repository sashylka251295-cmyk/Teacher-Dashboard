import { physicalProgress } from "../domain/physical-progress.js";

function themeVariant(theme) {
  return theme === "child" ? "child" : "adult";
}

function unitLabel(unit) {
  return unit?.number ? `Unit ${unit.number}` : (unit?.title || "Current unit");
}

function createJourneyLandmark(kind, label) {
  const landmark = document.createElement("span");
  landmark.className = `course-journey-map__landmark course-journey-map__landmark--${kind}`;
  landmark.setAttribute("aria-hidden", "true");

  const icon = document.createElement("span");
  const text = document.createElement("small");
  text.textContent = label;
  landmark.append(icon, text);
  return landmark;
}

export function renderCourseJourneyMap(container, {
  unit,
  journey = null,
  lessons = [],
  theme = "adult",
  emptyMessage = "No lessons are available for this unit yet.",
} = {}) {
  container.replaceChildren();
  container.classList.add("course-journey-map");
  container.dataset.journeyTheme = themeVariant(theme);
  if (!unit) {
    const empty = document.createElement("p");
    empty.className = "course-journey-map__empty";
    empty.textContent = emptyMessage;
    container.append(empty);
    return null;
  }

  const progress = physicalProgress(unit, journey, lessons);
  if (!progress.total) {
    const empty = document.createElement("p");
    empty.className = "course-journey-map__empty";
    empty.textContent = emptyMessage;
    container.append(empty);
    return progress;
  }

  const summary = document.createElement("header");
  const identity = document.createElement("div");
  const label = document.createElement("strong");
  const count = document.createElement("span");
  const percentage = document.createElement("strong");
  const bar = document.createElement("progress");
  label.textContent = unitLabel(unit);
  count.textContent = `${progress.completed} of ${progress.total} lessons completed`;
  percentage.textContent = `${progress.percent}% complete`;
  percentage.className = "course-journey-map__percentage";
  bar.max = 100;
  bar.value = progress.percent;
  bar.className = "course-journey-map__native-progress";
  bar.setAttribute("aria-label", `${unitLabel(unit)} physical course progress`);
  identity.append(label, count);
  summary.className = "course-journey-map__summary";
  summary.append(identity, percentage, bar);

  const track = document.createElement("ol");
  track.className = "course-journey-map__track";
  progress.stops.forEach((stop) => {
    const item = document.createElement("li");
    const callout = document.createElement("span");
    const marker = document.createElement("span");
    const lessonNumber = document.createElement("small");
    const title = document.createElement("strong");
    const state = document.createElement("small");
    item.dataset.state = stop.state;
    item.setAttribute("aria-label", `Lesson ${stop.number}: ${stop.title}. ${stop.state}.`);
    callout.className = "course-journey-map__callout";
    callout.textContent = "You are here";
    callout.setAttribute("aria-hidden", "true");
    marker.className = "course-journey-map__marker";
    marker.textContent = stop.state === "completed" ? "✓" : String(stop.number);
    marker.setAttribute("aria-hidden", "true");
    lessonNumber.className = "course-journey-map__lesson-number";
    lessonNumber.textContent = String(stop.number);
    title.textContent = stop.title;
    state.className = "course-journey-map__state";
    state.textContent = stop.state === "completed"
      ? "Completed"
      : stop.state === "current"
        ? "Current"
        : "Upcoming";
    item.append(callout, marker, lessonNumber, title, state);
    track.append(item);
  });

  const route = document.createElement("div");
  const routeCanvas = document.createElement("div");
  route.className = "course-journey-map__route";
  routeCanvas.className = "course-journey-map__route-canvas";
  routeCanvas.append(
    createJourneyLandmark("start", "Start"),
    track,
    createJourneyLandmark("finish", "Finish"),
  );
  route.append(routeCanvas);

  container.style.setProperty("--journey-progress", `${progress.percent}%`);
  container.append(summary, route);
  return progress;
}
