# Kefan Wu Portfolio Site

Fresh static rebuild of `www.kefanwu.com`.

See `PROJECT_DOCUMENTATION.md` for the full project brief, content strategy,
site structure, QA checklist, and maintenance notes.

## Local Preview

```powershell
cd C:\Users\oc\Desktop\WEBSITE\portfolio-site
python -m http.server 4173
```

If Python is not on PATH, use the bundled runtime:

```powershell
& 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy

This is a static site. You can deploy the contents of this folder to Vercel,
Netlify, Cloudflare Pages, GitHub Pages, or any static host, then point
`kefanwu.com` at that host.
