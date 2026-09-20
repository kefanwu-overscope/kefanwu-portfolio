// Apply long-lived browser caching only to content-addressed project files.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const directory = path.join(root, 'assets/studio-motion');
const index = JSON.parse(fs.readFileSync(path.join(directory, 'index.json')));
const configFile = path.join(root, 'vercel.json');
const config = JSON.parse(fs.readFileSync(configFile));
const entries = [];
const check = (relative, hash) => {
  const bytes = fs.readFileSync(path.join(directory, relative));
  const actual = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actual !== hash || !relative.includes(actual.slice(0, 16))) throw new Error(`Asset hash mismatch: ${relative}`);
  entries.push('/assets/studio-motion/' + relative);
};
for (const item of Object.values(index.projects)) {
  check(item.manifest, item.sha256);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, item.manifest)));
  for (const buffer of Object.values(manifest.buffers)) check(path.posix.join(path.posix.dirname(item.manifest), buffer.url), buffer.sha256);
}
config.headers = config.headers.filter(item => !item.source.startsWith('/assets/studio-motion/') && !item.source.startsWith('/vendor/three/'));
for (const source of [...new Set(entries)].sort()) config.headers.push({source,headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]});
config.headers.push({source:'/vendor/three/0.185.0/:path*',headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]});
fs.writeFileSync(configFile, JSON.stringify(config,null,2)+'\n');
console.log(JSON.stringify({immutableProjectFiles:entries.length,headers:config.headers.length}));
