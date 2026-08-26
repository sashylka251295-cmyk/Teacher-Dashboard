import {
  OWN_IT_A2_UNIT_6_LESSON_PLAN,
} from "./own-it-a2-unit-6-lessons.js";

export const OWN_IT_A2_IDS = Object.freeze({
  COURSE: "own-it-a2",
  UNIT_6: "own-it-a2-unit-6",
  UNIT_7: "own-it-a2-unit-7",
  UNIT_8: "own-it-a2-unit-8",
  UNIT_9: "own-it-a2-unit-9",
});

const blankSkillGoals = () => ({
  vocabulary: "",
  grammar: "",
  reading: "",
  listening: "",
  speaking: "",
  writing: "",
});

const objective = (id, category, title, order) => ({ id, category, title, order });

function unitShell(number, title, coverName) {
  const id = OWN_IT_A2_IDS[`UNIT_${number}`];
  const cover = `./assets/images/gallery/unit-covers/${coverName}`;
  return {
    id,
    courseId: OWN_IT_A2_IDS.COURSE,
    number,
    order: number,
    title,
    active: true,
    estimatedLessons: 0,
    priority: "core",
    status: "planned",
    mainGoal: "",
    skillGoals: blankSkillGoals(),
    successCriteria: "",
    vocabulary: [],
    activeVocabulary: [],
    finalOutcome: { title: "", description: "", instructions: "" },
    resources: [],
    objectives: [],
    coverImagePath: cover,
    coverImageUrl: cover,
    programVersion: 1,
  };
}

const unit6Cover = "./assets/images/gallery/unit-covers/own-it-a2-unit-6-hidden-danger.png";

export const OWN_IT_A2_PROGRAM = Object.freeze({
  course: Object.freeze({
    id: OWN_IT_A2_IDS.COURSE,
    name: "Own It! A2",
    edition: "Own It! 2 Student's Book",
    level: "A2",
    ageRange: "",
    defaultStartingPoint: "Unit 6 — Hidden Danger",
    frequency: "1 lesson per week",
    active: true,
    description: "Active sequence: Units 6–9. Units 1–5 were completed in the previous academic year.",
    generalGoal: "Build confident A2 communication through practical vocabulary, grammar, receptive skills and speaking tasks.",
    coverImagePath: "./assets/images/gallery/course-covers/own-it-a2-cover.png",
    coverImageUrl: "./assets/images/gallery/course-covers/own-it-a2-cover.png",
    programVersion: 1,
  }),
  units: Object.freeze([
    Object.freeze({
      id: OWN_IT_A2_IDS.UNIT_6,
      courseId: OWN_IT_A2_IDS.COURSE,
      number: 6,
      order: 6,
      title: "Hidden Danger",
      active: true,
      estimatedLessons: 8,
      priority: "core",
      status: "planned",
      mainGoal: "The student can talk about accidents and injuries, give advice, explain safety rules, describe general consequences, talk about possible future dangerous situations and make suggestions.",
      skillGoals: Object.freeze({
        vocabulary: "Common accidents and injuries; key parts of the body; safety and danger chunks.",
        grammar: "Should/shouldn't; must/mustn't; Zero Conditional; First Conditional; advice versus rules and general versus possible future consequences.",
        reading: "Understand key information in texts about accidents and dangers.",
        listening: "Understand key information in conversations and accident stories.",
        speaking: "Describe and retell an accident; ask for and give advice; make suggestions.",
        writing: "",
      }),
      successCriteria: "The student describes an accident, gives appropriate advice and rules, and uses Zero or First Conditional according to meaning.",
      vocabulary: Object.freeze([]),
      activeVocabulary: Object.freeze([]),
      finalOutcome: Object.freeze({
        title: "Survival Guide for a Teenager",
        description: "A practical guide for a mountain trip, beach holiday, cycling, camping, an extreme sport or a forest trip.",
        instructions: "Explain what can go wrong, possible injuries, what someone should do, what they mustn't do, what generally happens if something occurs, and what you will do in a possible future situation.",
      }),
      resources: Object.freeze([]),
      objectives: Object.freeze([
        objective("own-it-a2-u6-objective-vocabulary-accidents", "vocabulary", "Talk about common accidents and injuries.", 1),
        objective("own-it-a2-u6-objective-vocabulary-body", "vocabulary", "Use key parts of the body when describing injuries.", 2),
        objective("own-it-a2-u6-objective-grammar-should", "grammar", "Give advice with should / shouldn't.", 3),
        objective("own-it-a2-u6-objective-grammar-must", "grammar", "Express rules and prohibition with must / mustn't.", 4),
        objective("own-it-a2-u6-objective-grammar-advice-rules", "grammar", "Distinguish advice from rules.", 5),
        objective("own-it-a2-u6-objective-grammar-zero-conditional", "grammar", "Use the Zero Conditional for general consequences.", 6),
        objective("own-it-a2-u6-objective-grammar-first-conditional", "grammar", "Use the First Conditional for possible future situations.", 7),
        objective("own-it-a2-u6-objective-grammar-conditionals", "grammar", "Distinguish Zero and First Conditional.", 8),
        objective("own-it-a2-u6-objective-receptive", "reading", "Understand key information in texts and conversations about accidents and dangers.", 9),
        objective("own-it-a2-u6-objective-speaking-retell", "speaking", "Describe and retell an accident.", 10),
        objective("own-it-a2-u6-objective-speaking-advice", "speaking", "Ask for and give advice and make suggestions.", 11),
      ]),
      coverImagePath: unit6Cover,
      coverImageUrl: unit6Cover,
      programVersion: 1,
    }),
    Object.freeze(unitShell(7, "Get Connected", "own-it-a2-unit-7-get-connected.png")),
    Object.freeze(unitShell(8, "High-flyers", "own-it-a2-unit-8-high-flyers.png")),
    Object.freeze(unitShell(9, "Show Your Moves", "own-it-a2-unit-9-show-your-moves.png")),
  ]),
  lessons: Object.freeze(OWN_IT_A2_UNIT_6_LESSON_PLAN.lessons.map((lesson) => Object.freeze({
    ...lesson,
    vocabularyItemIds: Object.freeze([]),
  }))),
});
