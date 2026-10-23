import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

// experience.html preloads the room's whole static module graph. A preload whose
// href differs from the import specifier (a stale ?v label) downloads the module
// twice, and a missing one brings the import waterfall back.
const site = new URL('../../', import.meta.url);
const base = 'http://site/';
const read = (path) => readFile(new URL(path, site), 'utf8');
const html = await read('experience.html');
const entry = await read('experience-entry.js');

const importMap = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
function resolve(specifier, from) {
  if (importMap[specifier]) return new URL(importMap[specifier], base).href;
  for (const [prefix, target] of Object.entries(importMap)) {
    if (prefix.endsWith('/') && specifier.startsWith(prefix)) {
      return new URL(target + specifier.slice(prefix.length), base).href;
    }
  }
  return new URL(specifier, from).href;
}
const stripComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const STATIC_IMPORT = /(?:^|[;\n])\s*(?:import|export)\s*(?:[\w*{}\s,$]+?\s*from\s*)?["']([^"']+)["']/g;

async function staticGraph(rootURL) {
  const seen = new Set();
  const queue = [rootURL];
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const source = stripComments(await read(new URL(url).pathname.slice(1)));
    for (const match of source.matchAll(STATIC_IMPORT)) queue.push(resolve(match[1], url));
  }
  return seen;
}

const roomSpecifier = entry.match(/import\(\s*['"]([^'"]+)['"]\s*\)/)[1];
const roomURL = resolve(roomSpecifier, new URL('experience-entry.js', base).href);
const graph = await staticGraph(roomURL);
const preloads = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)"/g)].map((match) => new URL(match[1], base).href);

test('The room entry imports experience.js through a preloaded URL', () => {
  assert.ok(preloads.includes(roomURL), `missing modulepreload for ${roomURL}`);
});

test('Every module in the room static graph is preloaded with its exact import URL', () => {
  const missing = [...graph].filter((url) => !preloads.includes(url));
  assert.deepEqual(missing, []);
});

test('No modulepreload points outside the graph (a stale ?v label would load twice)', () => {
  const stray = preloads.filter((url) => !graph.has(url));
  assert.deepEqual(stray, []);
  assert.equal(new Set(preloads).size, preloads.length, 'duplicate modulepreload');
});
