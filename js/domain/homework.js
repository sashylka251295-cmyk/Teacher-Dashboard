export const HOMEWORK_RESOURCE_TYPES = Object.freeze(["link", "pdf"]);

export function isSafeHomeworkResourceUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return false;

  if (/^https?:\/\//i.test(url)) {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  }

  const localPath = url.replace(/^\.\//, "");
  return localPath.startsWith("assets/materials/homework/")
    && !localPath.includes("..")
    && !localPath.includes("\\");
}

export function homeworkResourceType(url, requestedType = "") {
  if (HOMEWORK_RESOURCE_TYPES.includes(requestedType)) return requestedType;
  return /\.pdf(?:$|[?#])/i.test(String(url ?? "")) ? "pdf" : "link";
}

export function normalizeHomeworkResources(resources) {
  if (!Array.isArray(resources)) return [];

  return resources.slice(0, 5).flatMap((resource) => {
    const url = String(resource?.url ?? "").trim();
    if (!isSafeHomeworkResourceUrl(url)) return [];
    const type = homeworkResourceType(url, resource?.type);
    const title = String(resource?.title ?? "").trim()
      || (type === "pdf" ? "PDF file" : "Web resource");
    return [{ title, url, type }];
  });
}
