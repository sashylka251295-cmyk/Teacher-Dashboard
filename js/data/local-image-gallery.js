const MANIFEST_URL = "./assets/images/gallery/manifest.json";
let galleryPromise = null;

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => typeof entry?.label === "string" && typeof entry?.path === "string")
    .map((entry) => ({ label: entry.label.trim(), path: entry.path.trim() }))
    .filter((entry) => entry.label && entry.path);
}

export async function loadLocalImageGallery() {
  galleryPromise ??= fetch(MANIFEST_URL, { cache: "no-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Gallery manifest returned ${response.status}.`);
      return response.json();
    })
    .then((manifest) => ({
      students: normalizeEntries(manifest.students),
      courses: normalizeEntries(manifest.courses),
      units: normalizeEntries(manifest.units),
    }))
    .catch((error) => {
      galleryPromise = null;
      throw error;
    });
  return galleryPromise;
}
