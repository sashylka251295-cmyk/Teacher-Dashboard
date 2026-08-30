import assert from "node:assert/strict";
import test from "node:test";

import {
  isAllowedReadingSoundImage,
  mergeReadingSoundObjectives,
  normalizeReadingSounds,
  readingMapForUnits,
} from "../js/domain/reading-sounds.js";

const image = "./assets/images/gallery/reading-sounds/ship.png";

test("reading sound cards accept only the public local sound gallery", () => {
  assert.equal(isAllowedReadingSoundImage(image), true);
  assert.equal(isAllowedReadingSoundImage("./assets/images/gallery/unit-covers/ship.png"), false);
  assert.equal(isAllowedReadingSoundImage("https://example.com/ship.png"), false);
});

test("reading sounds keep a stable objective link and safe image pair", () => {
  assert.deepEqual(normalizeReadingSounds([{
    id: "sound-sh",
    objectiveId: "objective-sh",
    sound: "sh",
    exampleWord: "ship",
    exampleWords: ["shop", "fish"],
    imagePath: image,
    imageUrl: image,
  }])[0], {
    id: "sound-sh",
    objectiveId: "objective-sh",
    sound: "sh",
    exampleWord: "ship",
    exampleWords: ["shop", "fish"],
    learningTarget: "Read sh in words such as ship",
    imagePath: image,
    imageUrl: image,
    order: 1,
  });
});

test("sound cards reuse the existing Reading objective progress model", () => {
  const sounds = normalizeReadingSounds([{
    id: "sound-ee",
    objectiveId: "objective-ee",
    sound: "ee",
    exampleWord: "tree",
  }]);
  const objectives = mergeReadingSoundObjectives([], sounds);
  assert.deepEqual(objectives[0], {
    id: "objective-ee",
    category: "reading",
    categories: ["reading"],
    title: "Read ee in words such as tree",
    readingSoundId: "sound-ee",
    order: 1,
  });
  assert.equal(readingMapForUnits([{ id: "unit-1", readingSounds: sounds }], [
    { objectiveId: "objective-ee", status: "developing" },
  ])[0].sounds[0].statusLabel, "Developing");
});

test("unassessed sounds are student-friendly Not started and never a percentage", () => {
  const map = readingMapForUnits([{ id: "unit-1", readingSounds: [{
    id: "sound-ch",
    objectiveId: "objective-ch",
    sound: "ch",
  }] }], []);
  assert.equal(map[0].sounds[0].status, "not_started");
  assert.equal(map[0].sounds[0].statusLabel, "Not started");
});
