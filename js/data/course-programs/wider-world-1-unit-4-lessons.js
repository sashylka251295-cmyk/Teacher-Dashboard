const UNIT_ID = "wider-world-1-unit-4";
const COURSE_ID = "wider-world-1";
const lessonId = (number) => `${UNIT_ID}-lesson-${number}`;
const slug = (value) => value.toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "")
  .slice(0, 60);

function vocabulary(text, type, status, category, lessons, note = "") {
  return {
    id: `vocab-${slug(text)}`,
    text,
    type,
    status,
    category,
    note,
    lessonIds: lessons.map(lessonId),
  };
}

function activity(number, text) {
  return { id: `lesson-${number}-activity-${slug(text)}`, text };
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

export const WIDER_WORLD_1_UNIT_4_VOCABULARY = Object.freeze([
  ...[
    "notebook", "pencil case", "rubber", "ruler", "scissors", "textbook", "whiteboard",
    "calculator", "dictionary", "sticky notes",
  ].map((text) => vocabulary(text, "Word", "active", "Classroom", [1, 2])),
  ...[
    "Art", "Biology", "Chemistry", "English", "Geography", "History",
    "Information Technology / IT", "Maths", "Music", "PE", "Physics",
  ].map((text) => vocabulary(text, "Word", "active", "School subjects", [1])),
  ...["poster", "rubbish bin", "sports bag", "stapler", "classroom", "desk", "chair", "school bag"]
    .map((text) => vocabulary(text, "Word", "receptive", "Classroom / school", [1, 2])),
  vocabulary("behind", "Word", "active", "Prepositions of place", [2]),
  vocabulary("between", "Word", "active", "Prepositions of place", [2]),
  vocabulary("in", "Word", "active", "Prepositions of place", [2]),
  vocabulary("in front of", "Chunk", "active", "Prepositions of place", [2]),
  vocabulary("next to", "Chunk", "active", "Prepositions of place", [2]),
  vocabulary("on", "Word", "active", "Prepositions of place", [2]),
  vocabulary("under", "Word", "active", "Prepositions of place", [2]),
  vocabulary("usually", "Word", "active", "Time expressions", [4]),
  vocabulary("every day", "Chunk", "active", "Time expressions", [4, 7]),
  vocabulary("on Mondays", "Chunk", "active", "Time expressions", [4]),
  vocabulary("now", "Word", "active", "Time expressions", [4]),
  vocabulary("at the moment", "Chunk", "active", "Time expressions", [4]),
  vocabulary("today", "Word", "active", "Time expressions", [4]),
  vocabulary("be there for someone", "Chunk", "active", "Making friends", [5]),
  vocabulary("best friend", "Collocation", "active", "Making friends", [5]),
  vocabulary("get to know someone", "Chunk", "active", "Making friends", [5]),
  vocabulary("group of friends", "Collocation", "active", "Making friends", [5]),
  vocabulary("make friends with someone", "Collocation", "active", "Making friends", [5]),
  vocabulary("make new friends", "Collocation", "active", "Making friends", [5]),
  vocabulary("meet someone for the first time", "Chunk", "active", "Making friends", [5]),
  ...["after-school club", "boarding school", "private school", "classmate", "break", "panic"]
    .map((text) => vocabulary(text, "Word", "receptive", "School and friendship", [5])),
  vocabulary("join a club", "Collocation", "receptive", "School and friendship", [5, 6]),
  vocabulary("do homework", "Collocation", "active", "Learning", [6]),
  vocabulary("go to school", "Collocation", "active", "Learning", [6]),
  vocabulary("have classes", "Collocation", "active", "Learning", [6]),
  vocabulary("revise for exams", "Collocation", "active", "Learning", [6]),
  vocabulary("start school", "Collocation", "receptive", "Learning", [6]),
  vocabulary("timetable", "Word", "receptive", "Learning", [6]),
  vocabulary("borrow", "Word", "receptive", "Learning", [6]),
  vocabulary("forget", "Word", "receptive", "Learning", [6]),
  ...[
    "Can I borrow ... ?", "Can I use ... ?", "Can I have ... ?", "Can you please ... ?",
    "Can you tell me ... ?", "Can you help me with ... ?",
  ].map((text) => vocabulary(text, "Functional phrase", "active", "Polite requests", [6])),
  ...[
    "Yes, OK.", "Yes, of course.", "Yes, no problem.", "OK, just a second.",
    "Sorry, I can't.", "Sorry, I'm using it.", "Sorry, I need it.",
  ].map((text) => vocabulary(text, "Functional phrase", "active", "Polite request responses", [6])),
  vocabulary("on Friday", "Chunk", "active", "Time expressions", [7]),
  vocabulary("once a week", "Chunk", "active", "Time expressions", [7]),
  vocabulary("twice a week", "Chunk", "active", "Time expressions", [7]),
  ...[
    "at four o'clock", "once a day", "once a month", "once a year", "twice a day",
    "twice a month", "twice a year", "four times a day/week/month/year",
  ].map((text) => vocabulary(text, "Chunk", "receptive", "Time expressions", [7])),
]);

const vocabularyIdsForLesson = (number) => WIDER_WORLD_1_UNIT_4_VOCABULARY
  .filter(({ lessonIds }) => lessonIds.includes(lessonId(number)))
  .map(({ id }) => id);

export const WIDER_WORLD_1_UNIT_4_LESSONS = Object.freeze([
  lesson(1, {
    title: "School Life",
    mainGoal: "Students can talk about their school, school subjects and things they use in lessons.",
    skillGoals: {
      vocabulary: "Introduce and activate key school and classroom vocabulary.",
      grammar: "Recycle Present Simple for school routines; this is revision, not a new presentation.",
      speaking: "Talk about favourite and least favourite subjects, describe a school day, and say what is used in different lessons.",
      listening: "", reading: "", writing: "",
    },
    vocabularyItemIds: vocabularyIdsForLesson(1),
    expectedOutcome: "Students can give a short description of their school life.",
  }),
  lesson(2, {
    title: "Where Is Everything?",
    mainGoal: "Students can describe where objects and people are.",
    skillGoals: {
      vocabulary: "Use prepositions of place and recycle classroom vocabulary from Lesson 1.",
      grammar: "Recycle there is and there are; these are revision, not the main grammar target.",
      speaking: "Describe a classroom, say where objects are, and ask and answer simple location questions.",
      listening: "", reading: "", writing: "",
    },
    vocabularyItemIds: vocabularyIdsForLesson(2),
    activities: [
      activity(2, "Classroom description"), activity(2, "Spot the difference"),
      activity(2, "Messy classroom speaking task"), activity(2, "Information gap"),
    ],
    expectedOutcome: "Students can accurately describe the position of familiar objects.",
  }),
  lesson(3, {
    title: "What’s Happening?",
    mainGoal: "Students can describe actions happening now.",
    skillGoals: {
      vocabulary: "",
      grammar: "Present Continuous: am/is/are + verb-ing; affirmative, negative, questions, short answers and common -ing spelling patterns. Treat as diagnostic, revision and activation.",
      speaking: "Describe what people are doing, ask what someone is doing, and answer Present Continuous questions.",
      listening: "", reading: "", writing: "",
    },
    activities: [
      activity(3, "Picture description"), activity(3, "Mime game"),
      activity(3, "What is happening in the classroom now?"),
      activity(3, "Find someone and guessing tasks"),
    ],
    expectedOutcome: "Students can use Present Continuous to describe current actions and ask basic questions.",
  }),
  lesson(4, {
    title: "Routines or Right Now?",
    mainGoal: "Students can choose between Present Simple and Present Continuous when talking about routines and current situations.",
    skillGoals: {
      vocabulary: "Use time expressions to signal routines and actions happening now.",
      grammar: "Contrast Present Simple for routines, repeated actions and usual situations with Present Continuous for actions happening now and temporary or current situations.",
      speaking: "Contrast what normally happens with what is happening now using connected examples.",
      listening: "", reading: "", writing: "",
    },
    vocabularyItemIds: vocabularyIdsForLesson(4),
    activities: [
      activity(4, "Routine vs now picture comparison"), activity(4, "True sentences about our class"),
      activity(4, "Spot the mistake"), activity(4, "School routine interviews"),
      activity(4, "Contrast challenge"),
    ],
    expectedOutcome: "Students can contrast what normally happens with what is happening now.",
  }),
  lesson(5, {
    title: "Problems at School",
    mainGoal: "Students can understand and discuss common school and friendship problems.",
    skillGoals: {
      vocabulary: "Use chunks and collocations for making friends and discussing school problems.",
      grammar: "",
      speaking: "Describe a friendship problem, discuss what makes a good friend, talk about making new friends, and react to simple teen problems.",
      listening: "",
      reading: "Identify the main problem, understand key details, and discuss possible reactions or advice in a teen problem-page style text.",
      writing: "",
    },
    vocabularyItemIds: vocabularyIdsForLesson(5),
    expectedOutcome: "Students can understand a simple school or friendship problem and discuss it using several Unit 4 chunks.",
  }),
  lesson(6, {
    title: "School Communication",
    mainGoal: "Students can understand information about school and make polite requests in everyday classroom situations.",
    skillGoals: {
      vocabulary: "Use learning collocations and school-related vocabulary.",
      grammar: "",
      speaking: "Make and respond to polite requests in school situations.",
      listening: "Understand the main idea and key details in a school or radio documentary and recognise school-related vocabulary.",
      reading: "", writing: "",
    },
    functionalLanguage: "Make and respond to polite requests using Can I…?, Can you…? and natural positive or negative responses.",
    vocabularyItemIds: vocabularyIdsForLesson(6),
    activities: [
      activity(6, "Role play: forgot a pen"), activity(6, "Role play: borrow a ruler"),
      activity(6, "Role play: do not understand the task"),
      activity(6, "Role play: ask someone to repeat something"),
      activity(6, "Role play: ask for help with an exercise"),
      activity(6, "Role play: ask to use something"),
    ],
    expectedOutcome: "Students can make simple polite requests naturally and respond appropriately.",
  }),
  lesson(7, {
    title: "School Survival Guide",
    mainGoal: "Students can bring together Unit 4 language to create and present useful school advice.",
    skillGoals: {
      vocabulary: "Use time expressions for routines and scheduled events.",
      grammar: "Recycle Present Continuous and Present Simple vs Present Continuous.",
      speaking: "Present the School Survival Guide briefly.",
      listening: "", reading: "",
      writing: "Write short school announcements, simple study tips, and short pieces of practical school advice.",
    },
    recycling: "School subjects; classroom vocabulary; prepositions of place; Present Continuous; Present Simple vs Present Continuous; making-friends chunks; learning collocations; polite requests.",
    vocabularyItemIds: vocabularyIdsForLesson(7),
    activities: [activity(7, "Create and present: How to Survive School and Study Better")],
    usesUnitFinalOutcome: true,
    expectedOutcome: "Students produce and present a small final product using language from across Unit 4.",
  }),
]);

export const WIDER_WORLD_1_UNIT_4_LESSON_PLAN = Object.freeze({
  courseId: COURSE_ID,
  unitId: UNIT_ID,
  estimatedLessons: 7,
  vocabulary: WIDER_WORLD_1_UNIT_4_VOCABULARY,
  lessons: WIDER_WORLD_1_UNIT_4_LESSONS,
});
