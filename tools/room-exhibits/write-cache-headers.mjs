import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../../', import.meta.url));
const index = JSON.parse(fs.readFileSync(path.join(root, 'models/room-current/index.json')));
const configPath = path.join(root, 'vercel.json');
const config = JSON.parse(fs.readFileSync(configPath));
for (const [key, entry] of Object.entries(index.projects)) {
  if (!entry.url.startsWith(`models/room-current/${key}.`) || !entry.url.endsWith('.glb.gz')) throw Error('Unexpected exhibit URL');
  const bytes = fs.readFileSync(path.join(root, entry.url));
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== entry.sha256 || !entry.url.includes(hash.slice(0, 16))) throw Error('Exhibit hash mismatch');
  const source = '/' + entry.url;
  config.headers = config.headers.filter(rule => rule.source !== source);
  config.headers.push({ source, headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] });
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`Verified immutable cache headers for ${Object.keys(index.projects).length} exhibits.`);
