/* Featured presentation reads the existing directory; titles, results, routes,
   covers and motion assets retain one source. No second project catalog. */
(() => {
  "use strict";
  const section = document.querySelector(".featured-work");
  const grid = section?.querySelector(".featured-grid");
  if (!grid) return;
  const keys = ["steering", "vineRobot", "scanner"];
  const fragment = document.createDocumentFragment();
  for (const [index, key] of keys.entries()) {
    const source = document.querySelector(`#project-cards .project-card[data-project="${key}"]`);
    const sourceMedia = source?.querySelector(".card-media");
    const sourceBody = source?.querySelector(".project-body");
    if (!sourceMedia || !sourceBody) return;
    const card = document.createElement("article");
    // A separate host class keeps featured cards outside directory filtering.
    card.className = "featured-project case-animation-host";
    card.dataset.project = key;
    const media = sourceMedia.cloneNode(true);
    const body = sourceBody.cloneNode(true);
    const image = media.querySelector("img");
    image.sizes = index === 0
      ? "(max-width: 720px) calc(100vw - 40px), (max-width: 1100px) calc((100vw - 72px) * .62), (max-width: 1568px) calc((100vw - 128px) * .62), 893px"
      : "(max-width: 720px) calc(100vw - 40px), (max-width: 1100px) calc((100vw - 100px) / 2), (max-width: 1568px) calc((100vw - 160px) / 2), 704px";
    const meta = body.querySelector(".project-meta");
    if (meta) meta.textContent = `${String(index + 1).padStart(2, "0")} / ${meta.textContent.trim()}`;
    const hint = document.createElement("span");
    hint.className = "featured-story-link";
    hint.textContent = "Explore the engineering story ↗";
    hint.setAttribute("aria-hidden", "true");
    body.append(hint);
    card.append(media, body);
    fragment.append(card);
  }
  grid.replaceChildren(fragment);
  section.hidden = false;
})();
