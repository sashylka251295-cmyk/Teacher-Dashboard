import { loadLocalImageGallery } from "../data/local-image-gallery.js";
import { ENTITY_IMAGE_CONFIG, readEntityImage } from "../domain/entity-images.js";

export function createEntityImageField(root, entityType) {
  const config = ENTITY_IMAGE_CONFIG[entityType];
  if (!root || !config) throw new Error("Image field markup or configuration is missing.");
  const elements = {
    preview: root.querySelector("[data-image-preview]"),
    choose: root.querySelector("[data-image-choose]"),
    remove: root.querySelector("[data-image-remove]"),
    message: root.querySelector("[data-image-message]"),
    library: root.querySelector("[data-image-library]"),
    librarySelect: root.querySelector("[data-image-library-select]"),
    libraryUse: root.querySelector("[data-image-library-use]"),
    libraryCancel: root.querySelector("[data-image-library-cancel]"),
  };
  if (Object.values(elements).some((element) => !element)) {
    throw new Error("Image field markup is incomplete.");
  }

  let current = { path: "", url: "" };
  let selected = null;
  let removeRequested = false;

  function setMessage(message, state = "") {
    elements.message.textContent = message;
    elements.message.dataset.state = state;
  }

  function stagedImage() {
    if (removeRequested) return { path: "", url: "" };
    return selected ?? current;
  }

  function render() {
    const image = stagedImage();
    elements.preview.src = image.url || config.fallbackUrl;
    elements.preview.alt = `${config.label} preview`;
    elements.remove.disabled = !image.url;
  }

  function reset(entity = null) {
    current = readEntityImage(entityType, entity);
    selected = null;
    removeRequested = false;
    elements.library.hidden = true;
    setMessage("");
    render();
  }

  async function openLibrary() {
    elements.choose.disabled = true;
    setMessage("Loading local gallery…", "loading");
    try {
      const gallery = await loadLocalImageGallery();
      const assets = gallery[config.galleryKey] ?? [];
      elements.librarySelect.replaceChildren(...assets.map((asset) => {
        const option = document.createElement("option");
        option.value = asset.path;
        option.textContent = asset.label;
        return option;
      }));
      elements.libraryUse.disabled = assets.length === 0;
      elements.library.hidden = false;
      setMessage(assets.length
        ? "Choose an image already stored with the project."
        : "This gallery is empty. Add an image to the project gallery and manifest first.");
    } catch (error) {
      console.error("Unable to load the local image gallery.", error);
      setMessage("Unable to load the local image gallery.", "error");
    } finally {
      elements.choose.disabled = false;
    }
  }

  function useLibraryImage() {
    const path = elements.librarySelect.value;
    if (!path) return;
    selected = { path, url: path };
    removeRequested = false;
    elements.library.hidden = true;
    setMessage("Image selected. Save the form to apply it.", "ready");
    render();
  }

  elements.choose.addEventListener("click", openLibrary);
  elements.libraryUse.addEventListener("click", useLibraryImage);
  elements.libraryCancel.addEventListener("click", () => {
    elements.library.hidden = true;
    setMessage("");
  });
  elements.remove.addEventListener("click", () => {
    selected = null;
    removeRequested = true;
    setMessage("The default image will be used after you save.", "ready");
    render();
  });
  elements.preview.addEventListener("error", () => {
    elements.preview.onerror = null;
    elements.preview.src = config.fallbackUrl;
    setMessage("The selected file is missing from the local gallery.", "error");
  });

  return Object.freeze({
    reset,
    async prepare() {
      return { ...stagedImage(), uploaded: false };
    },
    async commit(prepared) {
      current = { path: prepared?.path ?? "", url: prepared?.url ?? "" };
      selected = null;
      removeRequested = false;
      setMessage("");
      render();
    },
    async rollback() {},
    currentPath() {
      return current.path;
    },
  });
}
