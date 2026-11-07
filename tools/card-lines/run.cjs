// Renders every card's cover frame and line G-buffer with the pinned inspector.
// usage: node tools/card-lines/run.cjs [key,key,...]
const fs = require('fs');
const path = require('path');
const { WORK, PORT, PLAYWRIGHT, KEYS, SKIP } = require('./config.cjs');
const { start } = require('./serve.cjs');
const settings = require('./settings.json');
const { chromium } = require(PLAYWRIGHT);

const only = (process.argv[2] || '').split(',').filter(Boolean);
const keys = (only.length ? only : KEYS).filter((key) => !SKIP.has(key));

(async () => {
  require('./snapshot.cjs');
  const { server, origin } = await start(PORT);
  const browser = await chromium.launch({ channel: 'chrome', headless: true,
    args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=d3d11'] });
  const log = { started: new Date().toISOString(), origin, browser: browser.version(), results: {} };
  try {
    for (const key of keys) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1200 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [], failed = [];
      page.on('console', (message) => { if (['error', 'warning'].includes(message.type())) errors.push(`${message.type()}: ${message.text().slice(0, 300)}`); });
      page.on('pageerror', (error) => errors.push(`pageerror: ${String(error).slice(0, 300)}`));
      page.on('requestfailed', (request) => failed.push(request.url()));
      page.on('response', (response) => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });
      const hide = (settings.projects[key]?.hide || []).join('|');
      const glass = (settings.projects[key]?.glass || []).join('|');
      const url = `${origin}/__lines/render.html?key=${key}&ss=${settings.supersample}${hide ? `&hide=${encodeURIComponent(hide)}` : ''}${glass ? `&glass=${encodeURIComponent(glass)}` : ''}`;
      const t0 = Date.now();
      await page.goto(url);
      const result = await page.evaluate(() => window.__lines);
      log.results[key] = { ...result, errors, failed, seconds: (Date.now() - t0) / 1000 };
      console.log(key, JSON.stringify(log.results[key]));
      await context.close();
    }
  } finally {
    await browser.close();
    server.close();
    log.finished = new Date().toISOString();
    fs.mkdirSync(WORK, { recursive: true });
    fs.writeFileSync(path.join(WORK, `render-run${only.length ? '-' + only.join('_') : ''}.json`), JSON.stringify(log, null, 1));
  }
})().catch((error) => { console.error(error); process.exit(1); });
