const COURSE_ID = "own-it-a2";
const UNIT_ID = "own-it-a2-unit-6";
const lessonId = (number) => `${UNIT_ID}-lesson-${number}`;
const slug = (value) => value.toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 64);

function vocabulary(text, type, status, category, lessons, note = "") {
  return {
    id: `own-it-a2-u6-vocab-${slug(text)}`,
    text,
    type,
    status,
    category,
    note,
    lessonIds: lessons.map(lessonId),
  };
}

function activity(number, text) {
  return { id: `own-it-a2-u6-lesson-${number}-activity-${slug(text)}`, text };
}

function lesson(number, data) {
  return {
    id: lessonId(number),
    courseId: COURSE_ID,
    unitId: UNIT_ID,
    number,
    order: number,
    status: "planned",
    pronunciation: "",
    functionalLanguage: "",
    recycling: "",
    vocabularyItemIds: [],
    activities: [],
    resources: [],
    teacherNotes: "",
    resultNotes: "",
    plannedDate: "",
    actualDate: "",
    ...data,
  };
}

export const OWN_IT_A2_UNIT_6_VOCABULARY = Object.freeze([
  ...[
    "be bitten by a mosquito / animal",
    "be stung by a bee",
    "break your leg / arm / finger",
    "bruise your leg / knee / arm",
    "burn your hand / fingers",
    "cut your finger / hand",
    "fall off a bike / horse",
    "hit your head",
    "scratch your arm / leg",
    "slip on ice / a wet floor",
    "sprain your ankle / wrist",
    "trip over a chair / bag",
  ].map((text) => vocabulary(text, "Chunk", "active", "Accidents and injuries", [1, 3, 5, 6, 7, 8])),
  ...[
    "cheek", "chest", "chin", "elbow", "forehead", "heel",
    "knee", "neck", "shoulder", "teeth", "toe", "wrist",
  ].map((text) => vocabulary(text, "Word", "active", "Parts of the body", [4, 8])),
  ...[
    "hurt your wrist",
    "injure your shoulder",
    "hit your forehead",
    "hurt your knee",
    "break your toe",
    "break your wrist",
    "sprain your wrist",
    "sprain your ankle",
  ].map((text) => vocabulary(text, "Collocation", "active", "Injury combinations", [1, 4, 8])),
  ...[
    "You should ...",
    "You shouldn't ...",
    "You must ...",
    "You mustn't ...",
    "How about + -ing ...?",
    "Why don't you ...?",
    "Make sure you don't ...",
    "You should definitely ...",
  ].map((text) => vocabulary(text, "Functional phrase", "active", "Advice and rules", [2, 3, 7, 8])),
  ...[
    "be careful",
    "take care",
    "be in danger",
    "stay calm",
    "run away",
    "get lost",
    "go straight to hospital",
    "wear a helmet",
    "wear a seatbelt",
    "ride a bike",
    "get ill",
    "have an accident",
  ].map((text) => vocabulary(text, "Chunk", "active", "Safety and danger", [2, 3, 6, 7, 8])),
  ...[
    "danger", "dangerous", "safe", "safety", "fatal", "venom", "threatened",
    "cubs", "sharks", "jellyfish", "crocodile", "mosquito", "rip current",
    "quicksand", "survive", "injury", "accident",
  ].map((text) => vocabulary(text, "Word", "receptive", "Danger contexts", [2, 6, 8])),
  ...[
    "hurt", "head", "arm", "hand", "finger", "leg", "ankle", "foot", "eye", "back",
  ].map((text) => vocabulary(
    text,
    "Word",
    "receptive",
    "Recycled vocabulary",
    [1, 4, 8],
    "Recycled from Units 1–5; not new Unit 6 vocabulary.",
  )),
]);

const vocabularyIdsForLesson = (number) => OWN_IT_A2_UNIT_6_VOCABULARY
  .filter(({ lessonIds }) => lessonIds.includes(lessonId(number)))
  .map(({ id }) => id);

export const OWN_IT_A2_UNIT_6_LESSONS = Object.freeze([
  lesson(1, {
    title: "Accidents happen",
    learningTargetIds: ["own-it-a2-u6-objective-vocabulary-accidents", "own-it-a2-u6-objective-speaking-retell"],
    mainGoal: "The student can describe common accidents and injuries and explain what happened.",
    skillGoals: {
      vocabulary: "Use common accidents and injuries chunks.",
      grammar: "Recycle Past Simple naturally while describing what happened.",
      speaking: "Describe a past accident in a short connected account.",
      listening: "", reading: "", writing: "",
    },
    recycling: "Past Simple is observed and activated through the new Unit 6 topic, not taught as a formal revision lesson.",
    vocabularyItemIds: vocabularyIdsForLesson(1),
    activities: [
      activity(1, "Match accident situations to injury chunks"),
      activity(1, "Tell a short accident story from picture prompts"),
      activity(1, "Explain what happened and what was injured"),
    ],
    expectedOutcome: "The student can say, for example: I slipped on the ice and hurt my knee.",
    teacherNotes: "Do not turn this into a formal revision lesson. Use the topic to diagnose how confidently the student still uses Past Simple.",
  }),
  lesson(2, {
    title: "Dangers at the beach",
    learningTargetIds: ["own-it-a2-u6-objective-receptive", "own-it-a2-u6-objective-grammar-should"],
    mainGoal: "The student can understand beach safety information and give appropriate advice.",
    skillGoals: {
      vocabulary: "Understand key danger and safety language in context.",
      grammar: "Give advice with should and shouldn't.",
      reading: "Understand main ideas and key safety information in a text about beach dangers.",
      speaking: "Explain what someone should or shouldn't do in a dangerous situation.",
      listening: "", writing: "",
    },
    functionalLanguage: "You should stay calm. You shouldn't swim there.",
    vocabularyItemIds: vocabularyIdsForLesson(2),
    activities: [
      activity(2, "Read for the main idea and key safety details"),
      activity(2, "Give advice for rip currents, dangerous sea animals and unsafe behaviour"),
    ],
    expectedOutcome: "The student can identify a beach danger and give clear should/shouldn't advice.",
  }),
  lesson(3, {
    title: "Rules or advice?",
    learningTargetIds: ["own-it-a2-u6-objective-grammar-should", "own-it-a2-u6-objective-grammar-must", "own-it-a2-u6-objective-grammar-advice-rules"],
    mainGoal: "The student can distinguish friendly advice from strong safety rules and prohibition.",
    skillGoals: {
      vocabulary: "Recycle accident, equipment and safety language.",
      grammar: "Contrast should/shouldn't with must/mustn't.",
      speaking: "Give advice, explain rules and express prohibition for different activities.",
      listening: "", reading: "", writing: "",
    },
    functionalLanguage: "You should drink more water. You must wear a seatbelt. You mustn't use your phone while cycling.",
    vocabularyItemIds: vocabularyIdsForLesson(3),
    activities: [
      activity(3, "Sort statements into advice, rules and prohibition"),
      activity(3, "Create safety guidance for cycling, ice skating, climbing and surfing"),
    ],
    expectedOutcome: "The student chooses should or must according to the strength of the message.",
  }),
  lesson(4, {
    title: "What happened to Jamie?",
    learningTargetIds: ["own-it-a2-u6-objective-vocabulary-body", "own-it-a2-u6-objective-receptive", "own-it-a2-u6-objective-speaking-retell"],
    mainGoal: "The student can understand and retell an accident, including the injured parts of the body.",
    skillGoals: {
      vocabulary: "Name relevant parts of the body and use natural injury combinations.",
      listening: "Understand key events and injuries in an accident story.",
      speaking: "Retell an accident in a clear sequence.",
      grammar: "", reading: "", writing: "",
    },
    recycling: "Past Simple and Past Continuous for what happened, what the person was doing and what happened next.",
    vocabularyItemIds: vocabularyIdsForLesson(4),
    activities: [
      activity(4, "Identify body parts and injuries from the story"),
      activity(4, "Sequence the events in Jamie's accident"),
      activity(4, "Retell the accident from prompts"),
    ],
    expectedOutcome: "The student explains what happened, what Jamie was doing, what was injured and what happened next.",
  }),
  lesson(5, {
    title: "What happens if...?",
    learningTargetIds: ["own-it-a2-u6-objective-grammar-zero-conditional"],
    mainGoal: "The student can explain general facts and usual consequences with the Zero Conditional.",
    skillGoals: {
      vocabulary: "Recycle accident and injury vocabulary in consequence chains.",
      grammar: "Use the Zero Conditional for situation → usual or general result.",
      speaking: "Explain what usually happens in familiar safety situations.",
      listening: "", reading: "", writing: "",
    },
    vocabularyItemIds: vocabularyIdsForLesson(5),
    activities: [
      activity(5, "Match situations to general consequences"),
      activity(5, "Complete and explain safety consequence chains"),
    ],
    expectedOutcome: "The student can say, for example: If you touch something hot, you burn your hand.",
  }),
  lesson(6, {
    title: "What will you do if...?",
    learningTargetIds: ["own-it-a2-u6-objective-grammar-first-conditional", "own-it-a2-u6-objective-grammar-conditionals"],
    mainGoal: "The student can describe realistic future responses to possible dangerous situations.",
    skillGoals: {
      vocabulary: "Use safety and danger chunks in future scenarios.",
      grammar: "Use the First Conditional and distinguish it from the Zero Conditional.",
      speaking: "Explain what the student will do in a possible dangerous situation.",
      listening: "", reading: "", writing: "",
    },
    vocabularyItemIds: vocabularyIdsForLesson(6),
    activities: [
      activity(6, "Choose a response to getting lost, bad weather or a dangerous animal"),
      activity(6, "Contrast general consequences with one possible future situation"),
    ],
    expectedOutcome: "The student can say, for example: If I get lost, I'll call my parents.",
  }),
  lesson(7, {
    title: "Give me some advice",
    learningTargetIds: ["own-it-a2-u6-objective-speaking-advice", "own-it-a2-u6-objective-grammar-should", "own-it-a2-u6-objective-grammar-must"],
    mainGoal: "The student can ask for advice, give advice and make suggestions naturally.",
    skillGoals: {
      vocabulary: "Recycle safety equipment, accidents and injuries vocabulary.",
      speaking: "Ask for and give advice, make suggestions and respond naturally.",
      grammar: "Recycle should/shouldn't and must/mustn't.",
      listening: "", reading: "", writing: "",
    },
    functionalLanguage: "How about + -ing ...? Why don't you ...? Make sure you don't ... You should definitely ...",
    vocabularyItemIds: vocabularyIdsForLesson(7),
    activities: [
      activity(7, "Role play: ask for advice about a new sport or activity"),
      activity(7, "Give advice about equipment, safety, dangers and things not to do"),
      activity(7, "Swap roles and respond to suggestions naturally"),
    ],
    expectedOutcome: "The student sustains a short advice exchange using several functional phrases.",
  }),
  lesson(8, {
    title: "Hidden Danger Challenge",
    learningTargetIds: ["own-it-a2-u6-objective-speaking-retell", "own-it-a2-u6-objective-speaking-advice", "own-it-a2-u6-objective-grammar-conditionals"],
    mainGoal: "The student can integrate Unit 6 language in a practical survival guide.",
    skillGoals: {
      vocabulary: "Retrieve and use accidents, injuries, body parts and safety language.",
      grammar: "Use should, must, Zero Conditional and First Conditional appropriately.",
      speaking: "Present and explain a practical survival guide.",
      writing: "Optionally turn the final guide into a short blog post or information leaflet.",
      listening: "", reading: "",
    },
    recycling: "Accidents and injuries; parts of the body; should/shouldn't; must/mustn't; Zero Conditional; First Conditional.",
    vocabularyItemIds: vocabularyIdsForLesson(8),
    activities: [
      activity(8, "Retrieval check and diagnosis using Unit 6 review material"),
      activity(8, "Create a Survival Guide for a Teenager"),
      activity(8, "Optional extension: write a short blog post or information leaflet"),
    ],
    usesUnitFinalOutcome: true,
    expectedOutcome: "The student explains risks, possible injuries, advice, rules and conditional consequences for one chosen trip or activity.",
    teacherNotes: "Use review material for retrieval and diagnosis, but do not make the whole lesson a traditional workbook review. Update Unit 6 learning-target statuses after the final task.",
  }),
]);

export const OWN_IT_A2_UNIT_6_LESSON_PLAN = Object.freeze({
  courseId: COURSE_ID,
  unitId: UNIT_ID,
  estimatedLessons: 8,
  vocabulary: OWN_IT_A2_UNIT_6_VOCABULARY,
  lessons: OWN_IT_A2_UNIT_6_LESSONS,
});
