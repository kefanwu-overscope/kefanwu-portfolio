// Switch only the homepage's existing poster URLs and animation catalog.
// The layout, project order, descriptions, accessible names and hooks stay put.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../../', import.meta.url);
const catalog = JSON.parse(await readFile(new URL('assets/editorial/white-20261011/animation-covers.json', root), 'utf8'));
const indexPath = new URL('index.html', root);
const original = await readFile(indexPath, 'utf8');
let count = 0;
const revised = original.replace(/assets\/editorial\/(?:refined-20260930|brake-dr-20261005|white-20261011)\/([A-Za-z0-9_]+)-wide-(480|960|1800)\.webp\?v=[a-f0-9]+/g, (url, key, width) => {
  const variant = catalog.projects[key]?.variants.find(item => item.width === Number(width));
  assert(variant, `Missing white cover ${key}/${width}`);
  count++;
  return `${variant.src}?v=${variant.sha256.slice(0, 12)}`;
}).replace(/<script src="exploded\.js\?v=[^"]+" data-manifest="[^"]+"><\/script>/,
  '<script src="exploded.js?v=white-20261011" data-manifest="assets/exploded/manifest-white-20261011.json"></script>');
assert.equal(count, 64, 'All 16 src/srcset poster groups switch together');
assert(revised.includes('data-manifest="assets/exploded/manifest-white-20261011.json"'));
await writeFile(indexPath, revised);
console.log(`Switched ${count} responsive cover references and the homepage animation catalog.`);
