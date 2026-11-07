// Loopback server for the card line pass.
//   /                    repository files (read-only)
//   /__lines/            this folder (render.html, render.js)
//   /__lines/inspector/  the pinned inspector snapshot (snapshot.cjs)
//   POST /__lines/out/*  writes one render result under <work>/render/
// usage: node tools/card-lines/serve.cjs [port]   (or require and call start())
const http = require('http');
const fs = require('fs');
const path = require('path');
const { REPO, WORK, PORT } = require('./config.cjs');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.gz': 'application/gzip', '.bin': 'application/octet-stream', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2' };

function start(port = PORT) {
  const origin = `http://127.0.0.1:${port}`;
  const renderDir = path.join(WORK, 'render');
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      if (req.method === 'POST' && url.pathname.startsWith('/__lines/out/')) {
        const name = url.pathname.slice('/__lines/out/'.length);
        if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+\.(png|webp|json|rgba)$/.test(name) || name.includes('..')) { res.writeHead(400).end(); return; }
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const file = path.join(renderDir, name);
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        await fs.promises.writeFile(file, Buffer.concat(chunks));
        res.writeHead(200).end('saved');
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      let base = REPO, relative = decodeURIComponent(url.pathname);
      if (relative.startsWith('/__lines/inspector/')) { base = path.join(WORK, 'inspector'); relative = relative.slice('/__lines/inspector/'.length); }
      else if (relative.startsWith('/__lines/')) { base = __dirname; relative = relative.slice('/__lines/'.length); }
      const file = path.resolve(base, '.' + path.sep + relative);
      if (!file.startsWith(base + path.sep)) { res.writeHead(403).end(); return; }
      const data = await fs.promises.readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': data.length, 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch { res.writeHead(404).end('not found'); }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, origin })));
}

if (require.main === module) start(Number(process.argv[2]) || PORT).then(({ origin }) => console.log(`card-lines server ${origin}/__lines/render.html`));
module.exports = { start };
