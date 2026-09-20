// Pin the exact Three.js runtime already used by the site to this origin.
// Copies package bytes unchanged and records SHA-256 for reproducibility.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const version = '0.185.0';
const base = `https://cdn.jsdelivr.net/npm/three@${version}/`;
const directory = path.join(repo, 'vendor', 'three', version);
const queue = ['LICENSE', 'build/three.module.js', 'build/three.core.js'];
const seeds = ['OrbitControls:controls', 'GLTFLoader:loaders', 'HDRLoader:loaders', 'RoomEnvironment:environments',
  'RoundedBoxGeometry:geometries', 'EffectComposer:postprocessing', 'RenderPass:postprocessing',
  'UnrealBloomPass:postprocessing', 'OutputPass:postprocessing', 'GTAOPass:postprocessing',
  'BokehPass:postprocessing', 'RectAreaLightUniformsLib:lights', 'BufferGeometryUtils:utils'];
for (const seed of seeds) { const [name, folder] = seed.split(':'); queue.push(`examples/jsm/${folder}/${name}.js`); }
const seen = new Set();
const files = [];
for (let index = 0; index < queue.length; index++) {
  const name = queue[index];
  if (seen.has(name)) continue;
  if (name.startsWith('../') || path.posix.isAbsolute(name)) throw new Error(`Unsafe dependency ${name}`);
  seen.add(name);
  const response = await fetch(new URL(name, base));
  if (!response.ok) throw new Error(`Three.js dependency ${name}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const target = path.join(directory, name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  files.push({ file: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
  if (name.endsWith('.js')) {
    const code = bytes.toString('utf8');
    const imports = [...code.matchAll(/^\s*(?:import|export)\s+[^;'"]+?\s+from\s*['"]([^'"]+)['"]/gm),
      ...code.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)];
    for (const [, dependency] of imports) {
      if (dependency === 'three') queue.push('build/three.module.js');
      else if (dependency.startsWith('three/addons/')) queue.push(dependency.replace('three/addons/', 'examples/jsm/'));
      else if (dependency.startsWith('.')) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(name), dependency)));
      else throw new Error(`Unmapped dependency ${dependency} in ${name}`);
    }
  }
}
files.sort((a,b)=>a.file.localeCompare(b.file));
await fs.writeFile(path.join(directory, 'integrity.json'), JSON.stringify({ version, source: base, files }, null, 2)+'\n');
console.log(JSON.stringify({ version, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }));
