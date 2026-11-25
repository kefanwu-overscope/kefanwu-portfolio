// Preserve shared links while keeping the original room as the default entry.
function redirectProject() {
  if (document.body.classList.contains('studio-project-open')) return false;
  let projectKey = '';
  try { projectKey = decodeURIComponent(location.hash.slice(1)); } catch {}
  if (!Object.prototype.hasOwnProperty.call(window.projectData || {}, projectKey)) return false;
  location.replace(`project-3d.html#${encodeURIComponent(projectKey)}`);
  return true;
}

window.addEventListener('hashchange', redirectProject);
if (!redirectProject()) {
  prefetchStartupDrawing();
  await import('./experience.js?v=arrows-20261125');
}

// 2026-10-27 ("Drawn, then built", #5): the optional startup drawing downloads
// alongside the room's modules (experience.js imports the same URL, so it is
// fetched once); today's startup screen never asks for it.
function prefetchStartupDrawing() {
  if (document.documentElement.dataset.loader !== 'drawing') return;
  import('./experience-loader-drawing.js?v=dtb-20261027').catch(() => {});
}
