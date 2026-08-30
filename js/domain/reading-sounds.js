import { OBJECTIVE_STATUS_LABELS } from "./constants.js";

const READING_SOUND_IMAGE_PATTERN = /^\.\/assets\/images\/gallery\/reading-sounds\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i;

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value) {
  const items = Array.isArray(value) ? value : String(value ?? "").split(",");
  return [...new Set(items.map(text).filter(Boolean))];
}

export function isAllowedReadingSoundImage(value) {
  return value === "" || (typeof value === "string" && READING_SOUND_IMAGE_PATTERN.test(value));
}

export function readingSoundObjectiveTitle(sound, exampleWord = "") {
  const grapheme = text(sound);
  const example = text(exampleWord);
  if (!grapheme) return "Reading sound";
  return example ? `Read ${grapheme} in words such as ${example}` : `Read the sound ${grapheme}`;
}

export function normalizeReadingSounds(sounds) {
  if (!Array.isArray(sounds)) return [];
  return sounds
    .filter((sound) => sound && text(sound.id) && text(sound.objectiveId) && text(sound.sound))
    .map((sound, index) => {
      const imagePath = text(sound.imagePath);
      const imageUrl = text(sound.imageUrl);
      const safeImage = imagePath === imageUrl && isAllowedReadingSoundImage(imagePath)
        ? imagePath
        : "";
      const exampleWord = text(sound.exampleWord);
      return {
        id: text(sound.id),
        objectiveId: text(sound.objectiveId),
        sound: text(sound.sound),
        exampleWord,
        exampleWords: stringList(sound.exampleWords).filter((word) => word !== exampleWord),
        learningTarget: text(sound.learningTarget)
          || readingSoundObjectiveTitle(sound.sound, exampleWord),
        imagePath: safeImage,
        imageUrl: safeImage,
        order: Number.isFinite(Number(sound.order)) ? Number(sound.order) : index + 1,
      };
    })
    .sort((first, second) => first.order - second.order);
}

export function mergeReadingSoundObjectives(objectives, sounds) {
  const normalizedSounds = normalizeReadingSounds(sounds);
  const next = Array.isArray(objectives) ? objectives.map((objective) => ({ ...objective })) : [];
  const byId = new Map(next.map((objective) => [objective.id, objective]));

  normalizedSounds.forEach((sound) => {
    const existing = byId.get(sound.objectiveId);
    if (existing) {
      existing.category = "reading";
      existing.categories = [...new Set(["reading", ...(existing.categories ?? [])])];
      existing.title = sound.learningTarget;
      existing.readingSoundId = sound.id;
      return;
    }
    const objective = {
      id: sound.objectiveId,
      category: "reading",
      categories: ["reading"],
      title: sound.learningTarget,
      readingSoundId: sound.id,
      order: next.length + 1,
    };
    next.push(objective);
    byId.set(objective.id, objective);
  });

  return next.map((objective, index) => ({ ...objective, order: index + 1 }));
}

export function readingMapForUnits(units, progressDocuments) {
  const progress = new Map(
    (Array.isArray(progressDocuments) ? progressDocuments : [])
      .filter((document) => text(document?.objectiveId))
      .map((document) => [document.objectiveId, document]),
  );
  return (Array.isArray(units) ? units : []).map((unit) => ({
    unit,
    sounds: normalizeReadingSounds(unit?.readingSounds).map((sound) => {
      const document = progress.get(sound.objectiveId);
      const status = document?.status ?? "not_started";
      return {
        ...sound,
        status,
        statusLabel: status === "not_started"
          ? "Not started"
          : OBJECTIVE_STATUS_LABELS[status] ?? "Not started",
      };
    }),
  })).filter(({ sounds }) => sounds.length > 0);
}

export function readingSoundForObjective(unit, objectiveId) {
  const id = text(objectiveId);
  return normalizeReadingSounds(unit?.readingSounds).find((sound) => sound.objectiveId === id) ?? null;
}
