export const ENTITY_IMAGE_TYPES = Object.freeze({
  STUDENT: "students",
  COURSE: "courses",
  UNIT: "units",
});

export const ENTITY_IMAGE_CONFIG = Object.freeze({
  [ENTITY_IMAGE_TYPES.STUDENT]: Object.freeze({
    pathField: "avatarImagePath",
    urlField: "avatarImageUrl",
    fallbackUrl: "./assets/images/icon-students.png.png",
    galleryKey: "students",
    label: "Student avatar",
  }),
  [ENTITY_IMAGE_TYPES.COURSE]: Object.freeze({
    pathField: "coverImagePath",
    urlField: "coverImageUrl",
    fallbackUrl: "./assets/images/neutral-study-illustration.png",
    galleryKey: "courses",
    label: "Course cover",
  }),
  [ENTITY_IMAGE_TYPES.UNIT]: Object.freeze({
    pathField: "coverImagePath",
    urlField: "coverImageUrl",
    fallbackUrl: "./assets/images/child-learning-garden-illustration.png",
    galleryKey: "units",
    label: "Unit cover",
  }),
});

export function isEntityImageType(value) {
  return Object.values(ENTITY_IMAGE_TYPES).includes(value);
}

const LOCAL_GALLERY_FOLDERS = Object.freeze({
  [ENTITY_IMAGE_TYPES.STUDENT]: "student-avatars",
  [ENTITY_IMAGE_TYPES.COURSE]: "course-covers",
  [ENTITY_IMAGE_TYPES.UNIT]: "unit-covers",
});

export function isAllowedLocalEntityImage(entityType, value) {
  if (value === "") return true;
  const folder = LOCAL_GALLERY_FOLDERS[entityType];
  if (!folder || typeof value !== "string") return false;
  return new RegExp(
    `^\\./assets/images/gallery/${folder}/[A-Za-z0-9._-]+\\.(?:jpe?g|png|webp)$`,
    "i",
  ).test(value);
}

export function entityImageFields(entityType, image = null) {
  const config = ENTITY_IMAGE_CONFIG[entityType];
  if (!config) throw new Error("Unsupported image entity type.");
  const path = typeof image?.path === "string" ? image.path : "";
  const url = typeof image?.url === "string" ? image.url : "";
  if (path !== url || !isAllowedLocalEntityImage(entityType, path)) {
    throw new Error("Choose an image from the local gallery.");
  }
  return { [config.pathField]: path, [config.urlField]: url };
}

export function readEntityImage(entityType, entity) {
  const config = ENTITY_IMAGE_CONFIG[entityType];
  if (!config) throw new Error("Unsupported image entity type.");
  const path = typeof entity?.[config.pathField] === "string" ? entity[config.pathField] : "";
  const url = typeof entity?.[config.urlField] === "string" ? entity[config.urlField] : "";
  return path === url && isAllowedLocalEntityImage(entityType, path)
    ? { path, url }
    : { path: "", url: "" };
}
