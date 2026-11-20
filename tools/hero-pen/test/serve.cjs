#!/usr/bin/env node
// Static server for hero pen test pages: files come from a git tree of portfolio-site (default HEAD, read with
// `git cat-file --batch`, so a working tree that another task is editing never leaks in), with an overlay folder
// whose files win (the test page's index.html). Cache headers follow the tree's vercel.json immutable rules.
// usage: node serve.cjs <port> <overlayDir|-> [treeish=HEAD]
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process');
const SITE = path.resolve(__dirname, '../../..');
const [portArg, ovArg, treeArg] = process.argv.slice(2);
const port = +portArg, overlay = ovArg && ovArg !== '-' ? path.resolve(ovArg) : null, tree = treeArg || 'HEAD';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.pdf': 'application/pdf', '.glb': 'model/gltf-binary', '.gz': 'application/gzip', '.txt': 'text/plain', '.ico': 'image/x-icon' };

// git cat-file --batch: one request at a time, answers in order
const git = cp.spawn('git', ['-C', SITE, 'cat-file', '--batch'], { stdio: ['pipe', 'pipe', 'inherit'] });
let buf = Buffer.alloc(0);
const queue = [];
git.stdout.on('data', (d) => { buf = Buffer.concat([buf, d]); pump(); });
function pump() {
  while (queue.length) {
    const nl = buf.indexOf(10);
    if (nl < 0) return;
    const head = buf.slice(0, nl).toString();
    if (/ missing$/.test(head)) { buf = buf.slice(nl + 1); queue.shift()(null); continue; }
    const size = +head.split(' ')[2];
    if (buf.length < nl + 1 + size + 1) return;
    const body = buf.slice(nl + 1, nl + 1 + size);
    buf = buf.slice(nl + 1 + size + 1);
    queue.shift()(head.split(' ')[1] === 'blob' ? body : null);
  }
}
const cache = new Map();
function blob(p) {
  if (cache.has(p)) return Promise.resolve(cache.get(p));
  return new Promise((res) => { queue.push((b) => { cache.set(p, b); res(b); }); git.stdin.write(`${tree}:${p}\n`); });
}
let immutable = [];
blob('vercel.json').then((b) => {
  const v = b ? JSON.parse(b.toString()) : {};
  const esc = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  immutable = (v.headers || []).map((h) => new RegExp('^' + esc(h.source).replace(/\/:path\*$/, '/.*') + '$'));
});
const gz = new Map();
http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    let body = null;
    if (overlay) { const f = path.join(overlay, p); if (f.startsWith(overlay) && fs.existsSync(f) && fs.statSync(f).isFile()) body = fs.readFileSync(f); }
    if (!body) body = await blob(p.replace(/^\//, ''));
    if (!body) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('404'); }
    const type = TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream';
    const cc = immutable.some((re) => re.test(p)) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate';
    const headers = { 'content-type': type, 'cache-control': cc };
    if (/^text|json|javascript|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '')) {
      let z = gz.get(p);
      if (!z || z.src !== body) { z = { src: body, b: zlib.gzipSync(body, { level: 6 }) }; gz.set(p, z); }
      res.writeHead(200, { ...headers, 'content-encoding': 'gzip', 'content-length': z.b.length, vary: 'accept-encoding' });
      return res.end(req.method === 'HEAD' ? undefined : z.b);
    }
    res.writeHead(200, { ...headers, 'content-length': body.length });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (e) { res.writeHead(500); res.end(String(e)); }
}).listen(port, '127.0.0.1', () => console.log(`hero-pen test server ${port}: ${tree} of ${SITE}` + (overlay ? ` + overlay ${overlay}` : '') + `; pid ${process.pid}`));
