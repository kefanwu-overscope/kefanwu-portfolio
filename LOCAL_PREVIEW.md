# Local preview

The site is static: there is no build or install step. Serve the `portfolio-site/` folder and open it in a browser.

- Claude Code: start the preview config `portfolio` (from `../.claude/launch.json`).
  It runs `../serve.ps1` at http://localhost:4173/. Optional: `portfolio-py` (Python http.server, http://127.0.0.1:4174/).
- By hand, from the WEBSITE folder: `powershell -NoProfile -ExecutionPolicy Bypass -File serve.ps1`.
  Any static server works. Python and Node are not on PATH; the Codex-installed runtimes live under
  `C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\`.
- `serve.ps1` limits: single-threaded, no HTTP Range, no Vercel cache headers, unknown file types served as octet-stream.

Pages to check: `/` (homepage), `/case-study.html?project=steering`, `/project-3d.html?project=brakeSim`, `/experience.html` (3D studio).
Check desktop and phone widths (320/390/768/1024/1280/1440): no horizontal overflow and 0 console errors.
Covers, frames and models must load. On 3D pages, `window.__exp` must exist.

When the user asks for a local preview first, do not push until he explicitly approves going live.

Earlier per-task preview servers (`../.codex/*/serve.mjs`, ports 4176–4196) are Codex-era history.
