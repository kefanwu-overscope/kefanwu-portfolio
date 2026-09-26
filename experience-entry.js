// Preserve shared links while keeping the original room as the default entry.
function redirectProject() {
  let projectKey = '';
  try { projectKey = decodeURIComponent(location.hash.slice(1)); } catch {}
  if (!Object.prototype.hasOwnProperty.call(window.projectData || {}, projectKey)) return false;
  location.replace(`project-3d.html#${encodeURIComponent(projectKey)}`);
  return true;
}

window.addEventListener('hashchange', redirectProject);
if (!redirectProject()) await import('./experience.js?v=realism-20260925');
