import { physicalProgress } from "../domain/physical-progress.js";

function themeVariant(theme) {
  return theme === "child" ? "child" : "adult";
}

function unitLabel(unit) {
  return unit?.number ? `Unit ${unit.number}` : (unit?.title || "Current unit");
}

export function journeyLessonTitle(title, number) {
  const value = typeof title === "string" ? title.trim() : "";
  if (!value) return `Lesson ${number}`;
  const numberedPrefix = new RegExp(`^(?:lesson\\s+)?${number}\\s*[.:\\-\\u2013\\u2014]\\s*`, "i");
  return value.replace(numberedPrefix, "").trim() || value;
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

function smoothRoutePath(points) {
  return points.slice(0, -1).reduce((path, point, index) => {
    const previous = points[index - 1] ?? point;
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    const controlOne = {
      x: point.x + (next.x - previous.x) / 6,
      y: point.y + (next.y - previous.y) / 6,
    };
    const controlTwo = {
      x: next.x - (afterNext.x - point.x) / 6,
      y: next.y - (afterNext.y - point.y) / 6,
    };
    return `${path} C ${controlOne.x.toFixed(1)} ${controlOne.y.toFixed(1)} ${controlTwo.x.toFixed(1)} ${controlTwo.y.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function journeyRoutePath(theme, stopCount) {
  const child = themeVariant(theme) === "child";
  const left = child ? 112 : 72;
  const right = child ? 90 : 72;
  const stopY = child
    ? [223, 174, 130, 138, 174, 156, 178, 227]
    : [229, 208, 232, 228, 209, 240, 243, 230];
  const count = Math.max(1, stopCount);
  const trackWidth = 1000 - left - right;
  const stops = Array.from({ length: count }, (_, index) => ({
    x: left + ((index + 0.5) * trackWidth) / count,
    y: stopY[index % stopY.length],
  }));
  return smoothRoutePath([
    { x: child ? 48 : 30, y: child ? 236 : 244 },
    ...stops,
    { x: child ? 952 : 970, y: child ? 226 : 242 },
  ]);
}

function createJourneyProgressRoute(theme, percent, stopCount) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  const underlay = document.createElementNS(namespace, "path");
  const base = document.createElementNS(namespace, "path");
  const completed = document.createElementNS(namespace, "path");
  const path = journeyRoutePath(theme, stopCount);
  svg.classList.add("course-journey-map__progress-route");
  svg.setAttribute("viewBox", "0 0 1000 300");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  [underlay, base, completed].forEach((routePath) => {
    routePath.setAttribute("d", path);
    routePath.setAttribute("vector-effect", "non-scaling-stroke");
  });
  underlay.classList.add("course-journey-map__progress-route-underlay");
  base.classList.add("course-journey-map__progress-route-base");
  completed.classList.add("course-journey-map__progress-route-completed");
  completed.style.strokeDasharray = "1000 1000";
  completed.style.strokeDashoffset = String(1000 * (1 - Math.max(0, Math.min(100, percent)) / 100));
  svg.append(underlay, base, completed);
  return svg;
}

export function renderCourseJourneyMap(container, {
  unit,
  journey = null,
  lessons = [],
  theme = "adult",
  showCurrent = true,
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
  progress.stops.forEach((progressStop) => {
    const stop = !showCurrent && progressStop.state === "current"
      ? { ...progressStop, state: "upcoming" }
      : progressStop;
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
    title.textContent = journeyLessonTitle(stop.title, stop.number);
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
    createJourneyProgressRoute(theme, progress.percent, progress.stops.length),
    createJourneyLandmark("start", "Start"),
    track,
    createJourneyLandmark("finish", "Finish"),
  );
  route.append(routeCanvas);

  container.style.setProperty("--journey-progress", `${progress.percent}%`);
  container.append(summary, route);
  return progress;
}
