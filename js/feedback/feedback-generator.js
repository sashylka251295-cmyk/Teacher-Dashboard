import { LANGUAGE_SKILL_LABELS } from "../domain/constants.js";

export class FeedbackGenerator {
  async generate() {
    throw new Error("FeedbackGenerator.generate must be implemented.");
  }
}

function uniqueTargets(observations) {
  const targets = new Map();
  observations.forEach((observation) => {
    const title = typeof observation.learningTargetTitle === "string"
      ? observation.learningTargetTitle.trim()
      : "";
    if (!title) return;
    targets.set(observation.learningTargetId || title, {
      title,
      status: observation.targetStatus,
      category: observation.skillCategory,
    });
  });
  return [...targets.values()];
}

function readableList(items) {
  if (items.length <= 1) return items[0] ?? "your current learning targets";
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export class TemplateFeedbackGenerator extends FeedbackGenerator {
  async generate({ observations }) {
    const targets = uniqueTargets(observations);
    const confident = targets.filter(({ status }) => status === "confident");
    const practice = targets.filter(({ status }) =>
      status === "needs_practice" || status === "developing",
    );
    const allTitles = targets.map(({ title }) => title);
    const confidentTitles = confident.map(({ title }) => title);
    const practiceTitles = practice.map(({ title }) => title);
    const focus = practice[0] ?? targets[0] ?? null;
    const focusLabel = focus?.category
      ? LANGUAGE_SKILL_LABELS[focus.category] ?? "English"
      : "English";

    return {
      generator: "template-v1",
      content: {
        whatWentWell: confidentTitles.length
          ? `You showed confidence with ${readableList(confidentTitles)}.`
          : `You worked on ${readableList(allTitles)} and built useful practice during the lesson.`,
        whatToPractise: practiceTitles.length
          ? `Keep practising ${readableList(practiceTitles)}.`
          : `Continue reviewing ${readableList(allTitles)} so the new skills stay secure.`,
        nextStep: focus
          ? `Next, focus on “${focus.title}” and use it in another ${focusLabel.toLowerCase()} task.`
          : "Choose one clear learning target for the next lesson and practise it in context.",
      },
    };
  }
}

export function createFeedbackGenerator() {
  // Replace this implementation with a server-backed adapter when a secure AI endpoint exists.
  return new TemplateFeedbackGenerator();
}
