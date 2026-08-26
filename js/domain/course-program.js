import { LANGUAGE_SKILL_CATEGORIES } from "./constants.js";

export const UNIT_STATUSES = Object.freeze(["planned", "active", "completed", "paused"]);
export const LESSON_STATUSES = Object.freeze(["planned", "active", "completed", "paused"]);
export const UNIT_PRIORITIES = Object.freeze(["core", "optional", "extension"]);
export const RESOURCE_TYPES = Object.freeze([
  "YouTube",
  "Wordwall",
  "Baamboozle",
  "Canva",
  "Google Drive",
  "Worksheet",
  "Game",
  "Website",
  "Audio",
  "Video",
  "Other",
]);
export const VOCABULARY_TYPES = Object.freeze([
  "Word",
  "Chunk",
  "Collocation",
  "Functional phrase",
]);
export const VOCABULARY_STATUSES = Object.freeze(["active", "receptive"]);

export const COURSE_PROGRAM_IDS = Object.freeze({
  WIDER_WORLD_1: "wider-world-1",
  WIDER_WORLD_1_UNIT_4: "wider-world-1-unit-4",
});

export const WIDER_WORLD_1_PILOT = Object.freeze({
  course: Object.freeze({
    id: COURSE_PROGRAM_IDS.WIDER_WORLD_1,
    name: "Wider World 1",
    edition: "Second Edition",
    level: "A1 → A2",
    ageRange: "11–12",
    defaultStartingPoint: "Unit 4",
    active: true,
    description: "",
    generalGoal: "",
    coverImagePath: "./assets/images/gallery/course-covers/wider-world-1-course-cover.png",
    coverImageUrl: "./assets/images/gallery/course-covers/wider-world-1-course-cover.png",
    programVersion: 1,
  }),
  unit: Object.freeze({
    id: COURSE_PROGRAM_IDS.WIDER_WORLD_1_UNIT_4,
    courseId: COURSE_PROGRAM_IDS.WIDER_WORLD_1,
    number: 4,
    order: 4,
    title: "Live and Learn",
    active: true,
    estimatedLessons: 7,
    priority: "core",
    status: "planned",
    mainGoal: "Students can talk about school and learning and distinguish between routines and actions happening now.",
    skillGoals: Object.freeze({
      vocabulary: "School and learning, classroom objects, school subjects, prepositions of place, making friends.",
      grammar: "Present Continuous; Present Simple vs Present Continuous.",
      speaking: "Talk about school life and make polite requests.",
      listening: "Understand short conversations and school-related listening tasks.",
      reading: "Understand school-related texts and a teen problem-page style text.",
      writing: "Write a short school announcement.",
    }),
    successCriteria: "Students can describe what they usually do and what is happening now, and can make simple polite requests.",
    activeVocabulary: Object.freeze([]),
    finalOutcome: Object.freeze({
      title: "School Survival Guide",
      description: "",
      instructions: "",
    }),
    resources: Object.freeze([]),
    objectives: Object.freeze([]),
    coverImagePath: "./assets/images/gallery/unit-covers/wider-world-1-unit-4-live-and-learn.png",
    coverImageUrl: "./assets/images/gallery/unit-covers/wider-world-1-unit-4-live-and-learn.png",
    programVersion: 1,
  }),
});

export function createProgramItemId(prefix = "item") {
  return globalThis.crypto?.randomUUID?.()
    ?? `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeSkillGoals(value) {
  const source = value && typeof value === "object" ? value : {};
  return Object.fromEntries(LANGUAGE_SKILL_CATEGORIES.map((skill) => [
    skill,
    typeof source[skill] === "string" ? source[skill] : "",
  ]));
}

export function normalizeTextItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: typeof item?.id === "string" && item.id ? item.id : `item-${index + 1}`,
      text: typeof item?.text === "string" ? item.text : "",
    }))
    .filter(({ text }) => text.trim());
}

export function normalizeVocabularyItems(value, legacyActiveVocabulary = []) {
  const source = Array.isArray(value) && value.length > 0
    ? value
    : (Array.isArray(legacyActiveVocabulary) ? legacyActiveVocabulary : []).map((item) => ({
      ...item,
      type: "Word",
      status: "active",
    }));
  return source.map((item, index) => ({
    id: typeof item?.id === "string" && item.id ? item.id : `vocabulary-${index + 1}`,
    text: typeof item?.text === "string" ? item.text : "",
    type: VOCABULARY_TYPES.includes(item?.type) ? item.type : "Word",
    status: VOCABULARY_STATUSES.includes(item?.status) ? item.status : "active",
    category: typeof item?.category === "string" ? item.category : "",
    note: typeof item?.note === "string" ? item.note : "",
    lessonIds: Array.isArray(item?.lessonIds)
      ? [...new Set(item.lessonIds.filter((id) => typeof id === "string" && id))]
      : [],
  })).filter(({ text }) => text.trim());
}

export function activeVocabularyCompatibility(vocabulary) {
  return normalizeVocabularyItems(vocabulary)
    .filter(({ status }) => status === "active")
    .map(({ id, text }) => ({ id, text }));
}

export function normalizeResources(value) {
  if (!Array.isArray(value)) return [];
  return value.map((resource, index) => ({
    id: typeof resource?.id === "string" && resource.id ? resource.id : `resource-${index + 1}`,
    title: typeof resource?.title === "string" ? resource.title : "",
    url: typeof resource?.url === "string" ? resource.url : "",
    type: RESOURCE_TYPES.includes(resource?.type) ? resource.type : "Other",
    note: typeof resource?.note === "string" ? resource.note : "",
    skill: LANGUAGE_SKILL_CATEGORIES.includes(resource?.skill) ? resource.skill : "",
  })).filter(({ title }) => title.trim());
}

export function lessonFocuses(lesson, vocabulary = []) {
  const explicit = Array.isArray(lesson?.skillTags)
    ? lesson.skillTags.filter((skill) => LANGUAGE_SKILL_CATEGORIES.includes(skill))
    : [];
  if (explicit.length) return [...new Set(explicit)];
  const goals = normalizeSkillGoals(lesson?.skillGoals);
  const focuses = LANGUAGE_SKILL_CATEGORIES.filter((skill) => goals[skill].trim());
  if (
    !focuses.includes("vocabulary")
    && normalizeVocabularyItems(vocabulary).some(({ id }) => lesson?.vocabularyItemIds?.includes(id))
  ) {
    focuses.unshift("vocabulary");
  }
  return focuses;
}
