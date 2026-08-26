import test from "node:test";
import assert from "node:assert/strict";

import {
  ENTITY_IMAGE_TYPES,
  entityImageFields,
  isAllowedLocalEntityImage,
  readEntityImage,
} from "../js/domain/entity-images.js";

test("entity images accept only the matching local gallery folder", () => {
  assert.equal(
    isAllowedLocalEntityImage(
      ENTITY_IMAGE_TYPES.COURSE,
      "./assets/images/gallery/course-covers/outcomes-1.webp",
    ),
    true,
  );
  assert.equal(
    isAllowedLocalEntityImage(
      ENTITY_IMAGE_TYPES.COURSE,
      "./assets/images/gallery/unit-covers/outcomes-1.webp",
    ),
    false,
  );
  assert.equal(isAllowedLocalEntityImage(ENTITY_IMAGE_TYPES.STUDENT, "https://example.com/a.png"), false);
});

test("stable Firestore image fields use the same local path and URL", () => {
  const path = "./assets/images/gallery/student-avatars/avatar-girl.png";
  assert.deepEqual(
    entityImageFields(ENTITY_IMAGE_TYPES.STUDENT, { path, url: path }),
    { avatarImagePath: path, avatarImageUrl: path },
  );
  assert.throws(() => entityImageFields(
    ENTITY_IMAGE_TYPES.STUDENT,
    { path, url: "https://example.com/avatar.png" },
  ));
});

test("legacy remote image references fall back safely", () => {
  assert.deepEqual(readEntityImage(ENTITY_IMAGE_TYPES.UNIT, {
    coverImagePath: "entity-images/units/course/unit/image.png",
    coverImageUrl: "https://example.com/image.png",
  }), { path: "", url: "" });
});
