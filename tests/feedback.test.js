import assert from "node:assert/strict";
import test from "node:test";

import {
  hasFeedbackContent,
  isFeedbackContentComplete,
  mergeFeedbackContent,
  normalizeFeedbackContent,
} from "../js/domain/feedback.js";
import { TemplateFeedbackGenerator } from "../js/feedback/feedback-generator.js";

test("feedback requires all three reviewed sections", () => {
  assert.equal(isFeedbackContentComplete({
    whatWentWell: "Clear speaking",
    whatToPractise: "Word order",
    nextStep: "Use it in a dialogue",
  }), true);
  assert.equal(isFeedbackContentComplete({ whatWentWell: "Clear speaking" }), false);
});

test("a lightweight lesson feedback can contain any student-facing section", () => {
  assert.equal(hasFeedbackContent({ message: "Great effort today" }), true);
  assert.equal(hasFeedbackContent({ whatToPractise: "Question forms" }), true);
  assert.equal(hasFeedbackContent({}), false);
});

test("editing visible feedback preserves legacy sections that are not in the compact editor", () => {
  assert.deepEqual(mergeFeedbackContent({
    message: "Original message",
    whatWentWell: "Clear speaking",
    whatToPractise: "Longer answers",
    nextStep: "Try the next dialogue",
  }, {
    message: "Updated message",
    whatWentWell: "Confident speaking",
    whatToPractise: "",
  }), {
    message: "Updated message",
    whatWentWell: "Confident speaking",
    whatToPractise: "",
    nextStep: "Try the next dialogue",
  });
});

test("template generator does not copy private observation text", async () => {
  const privateText = "Teacher-only detail that must never reach the student";
  const generator = new TemplateFeedbackGenerator();
  const generated = await generator.generate({
    observations: [{
      learningTargetId: "target-1",
      learningTargetTitle: "Use the present continuous",
      skillCategory: "grammar",
      targetStatus: "developing",
      text: privateText,
    }],
  });
  const visibleText = Object.values(generated.content).join(" ");
  assert.equal(visibleText.includes(privateText), false);
  assert.equal(generated.generator, "template-v1");
});

test("published content can be snapshotted independently from observations", async () => {
  const observation = {
    learningTargetId: "target-1",
    learningTargetTitle: "Write a short description",
    skillCategory: "writing",
    targetStatus: "confident",
    text: "Original private note",
  };
  const generated = await new TemplateFeedbackGenerator().generate({ observations: [observation] });
  const publishedSnapshot = structuredClone(normalizeFeedbackContent(generated.content));
  observation.text = "Edited private note";
  observation.learningTargetTitle = "Changed target title";
  assert.deepEqual(publishedSnapshot, normalizeFeedbackContent(generated.content));
});
