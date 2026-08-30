import { readingMapForUnits } from "../domain/reading-sounds.js";

function unitLabel(unit) {
  const number = unit?.number ? `Unit ${unit.number}` : "Unit";
  const title = typeof unit?.title === "string" ? unit.title.trim() : "";
  return title ? `${number} · ${title}` : number;
}

function createSoundCard(sound) {
  const card = document.createElement("article");
  const visual = document.createElement("figure");
  const grapheme = document.createElement("span");
  const copy = document.createElement("div");
  const soundName = document.createElement("strong");
  const example = document.createElement("p");
  const extra = document.createElement("small");
  const target = document.createElement("small");
  const status = document.createElement("span");
  card.className = "reading-sound-card";
  card.dataset.status = sound.status;
  card.dataset.readingSound = sound.id;
  visual.className = "reading-sound-card__visual";
  grapheme.className = "reading-sound-card__grapheme";
  grapheme.textContent = sound.sound;
  if (sound.imageUrl) {
    const image = document.createElement("img");
    image.src = sound.imageUrl;
    image.alt = sound.exampleWord
      ? `${sound.exampleWord}, an example for ${sound.sound}`
      : `Illustration for ${sound.sound}`;
    image.addEventListener("error", () => {
      image.hidden = true;
      grapheme.hidden = false;
    }, { once: true });
    visual.append(image);
    grapheme.hidden = true;
  }
  visual.append(grapheme);
  copy.className = "reading-sound-card__copy";
  soundName.textContent = sound.sound;
  example.textContent = sound.exampleWord || "Sound card";
  extra.textContent = sound.exampleWords.length ? sound.exampleWords.join(" · ") : "";
  extra.hidden = sound.exampleWords.length === 0;
  target.className = "reading-sound-card__target";
  target.textContent = sound.learningTarget;
  status.className = "reading-sound-card__status";
  status.dataset.status = sound.status;
  status.textContent = sound.statusLabel;
  copy.append(soundName, example, extra, target);
  card.append(visual, copy, status);
  return card;
}

export function createReadingSoundChip(sound) {
  if (!sound) return null;
  const chip = document.createElement("span");
  const grapheme = document.createElement("strong");
  chip.className = "reading-sound-chip";
  grapheme.textContent = sound.sound;
  if (sound.imageUrl) {
    const image = document.createElement("img");
    image.src = sound.imageUrl;
    image.alt = "";
    image.addEventListener("error", () => image.remove(), { once: true });
    chip.append(image);
  }
  chip.append(grapheme);
  chip.title = sound.exampleWord || sound.learningTarget;
  return chip;
}

function createUnitSection(entry) {
  const section = document.createElement("section");
  const heading = document.createElement("header");
  const title = document.createElement("h3");
  const count = document.createElement("span");
  const grid = document.createElement("div");
  section.className = "reading-map-unit";
  title.textContent = unitLabel(entry.unit);
  count.textContent = `${entry.sounds.length} ${entry.sounds.length === 1 ? "sound" : "sounds"}`;
  heading.append(title, count);
  grid.className = "reading-map-grid";
  grid.append(...entry.sounds.map(createSoundCard));
  section.append(heading, grid);
  return section;
}

export function readingMapSummary(map) {
  const sounds = (Array.isArray(map) ? map : []).flatMap((entry) => entry.sounds ?? []);
  return {
    total: sounds.length,
    confident: sounds.filter(({ status }) => status === "confident").length,
    developing: sounds.filter(({ status }) => status === "developing").length,
    needsPractice: sounds.filter(({ status }) => status === "needs_practice").length,
    notStarted: sounds.filter(({ status }) => status === "not_started").length,
  };
}

export function renderReadingMap(container, {
  units = [],
  progressDocuments = [],
  theme = "adult",
  groupByUnit = true,
} = {}) {
  const map = readingMapForUnits(units, progressDocuments);
  container.dataset.readingTheme = theme === "child" ? "child" : "adult";
  if (groupByUnit) {
    container.replaceChildren(...map.map(createUnitSection));
  } else {
    container.replaceChildren(...map.flatMap(({ sounds }) => sounds.map(createSoundCard)));
  }
  return map;
}

export function renderReadingMapSummary(container, map) {
  const summary = readingMapSummary(map);
  const items = [
    ["Sounds", summary.total, "total"],
    ["Confident", summary.confident, "confident"],
    ["Developing", summary.developing, "developing"],
    ["Needs practice", summary.needsPractice, "needs_practice"],
    ["Not started", summary.notStarted, "not_started"],
  ];
  container.replaceChildren(...items.map(([label, value, status]) => {
    const item = document.createElement("span");
    const number = document.createElement("strong");
    const copy = document.createElement("small");
    item.dataset.status = status;
    number.textContent = String(value);
    copy.textContent = label;
    item.append(number, copy);
    return item;
  }));
  return summary;
}
