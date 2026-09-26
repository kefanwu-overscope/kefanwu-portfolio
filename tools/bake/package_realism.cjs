// Package verified Cycles outputs. --prepare-only leaves runtime integration to review.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const repo = path.resolve(__dirname, '../..');
const { values: args } = parseArgs({ options: {
  input: { type: 'string' }, output: { type: 'string' }, evidence: { type: 'string' },
  version: { type: 'string' }, geometry: { type: 'string' },
  'previous-initial-bytes': { type: 'string', default: '7311915' },
  'prepare-only': { type: 'boolean', default: false },
  'check-only': { type: 'boolean', default: false },
} });
const output = path.resolve(repo, args.output || 'models/baked/realism-20260925');
const input = path.resolve(repo, args.input || args.output || 'models/baked/realism-20260925');
const evidence = path.resolve(repo, args.evidence || '../.codex/realism-20260925');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const relativeUrl = file => {
  const relative = path.relative(repo, file).replaceAll('\\', '/');
  if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) throw Error('Runtime asset must stay inside the site');
  return relative;
};
relativeUrl(output);
const encoding = readJson(path.join(input, 'lighting.json'));
const desk = readJson(path.join(input, 'desk-lighting.json'));
const bake = readJson(path.join(evidence, 'bake-final/bake-manifest.json'));
const approvedGeometry = fs.readFileSync(path.join(repo, 'models/baked/room-baked.glb'));
if (encoding.range !== 16 || encoding.units !== 'irradiance/pi' || encoding.version !== bake.version) throw Error('Unexpected bake encoding or version');
if (bake.nativeResolution !== 4096 || bake.samples !== 256 || bake.diffuseBounces !== 6 || bake.repackedUv1 !== false || bake.sourceSha256 !== sha(approvedGeometry)) throw Error('Unverified room bake quality or geometry');
if (desk.range !== 16 || desk.units !== 'irradiance/pi' || desk.resolution !== 512 || desk.samples !== 256 || desk.premultiplyAlpha !== false) throw Error('Unexpected desktop encoding');
if (desk.version && desk.version !== bake.version) throw Error('Desktop and room bake versions differ');
if (desk.sourceCasterSha256 && desk.sourceCasterSha256 !== bake.casterSha256) throw Error('Desktop and room caster exports differ');
const verifyFile = (record, label) => {
  if (!record || record.clippedChannels !== 0 || record.diskRoundtripExact !== true) throw Error('Unverified image: ' + label);
  const bytes = fs.readFileSync(path.join(input, record.file));
  if (sha(bytes) !== record.sha256 || bytes.length !== record.bytes) throw Error('Bake integrity mismatch: ' + label);
  return record.file;
};
const sources = {};
for (const quality of ['2k', '4k']) {
  const record = encoding.qualities[quality];
  if (!record || record.range !== 16 || record.sourceNativeResolution !== 4096 || record.resolution !== (quality === '2k' ? 2048 : 4096) || record.colorSpace !== 'NoColorSpace' || record.premultiplyAlpha !== false || record.flipY !== false || record.uvChannel !== 1 || record.mipmaps !== false) throw Error('Unexpected lightmap contract: ' + quality);
  for (const state of ['off', 'on']) sources[state + quality] = verifyFile(record.states[state], state + quality);
}
for (const state of ['off', 'on']) {
  const name = encoding.probes[state];
  const bytes = fs.readFileSync(path.join(input, name));
  const proof = bake.states[state]?.probe;
  const expected = proof?.sha256 || sha(fs.readFileSync(path.join(evidence, 'bake-final', name)));
  if (sha(bytes) !== expected || !bytes.subarray(0, 1000).toString('ascii').includes('-Y 256 +X 512')) throw Error('Probe integrity or resolution mismatch: ' + state);
  sources[state === 'off' ? 'probeOff' : 'probeOn'] = name;
  sources[state === 'off' ? 'deskOff' : 'deskOn'] = verifyFile(desk.states[state], 'desk ' + state);
}
const assets = { version: args.version || 'cycles-' + bake.version, range: 16, deskBounds: [-0.925, -0.45, 1.85, 0.9] };
const records = [], pending = [];
const addRecord = (key, bytes, url, reused) => {
  assets[key] = url;
  records.push({ key, path: url, bytes: bytes.length, sha256: sha(bytes), reused });
};
if (args.geometry) {
  const file = path.resolve(repo, args.geometry), bytes = fs.readFileSync(file);
  if (sha(bytes) !== sha(approvedGeometry)) throw Error('Reused geometry differs from the approved room');
  addRecord('geometry', bytes, relativeUrl(file), true);
} else {
  sources.geometry = 'room-baked.glb';
  if (sha(fs.readFileSync(path.join(input, sources.geometry))) !== sha(approvedGeometry)) throw Error('Approved room geometry changed');
}
for (const [key, file] of Object.entries(sources)) {
  const bytes = fs.readFileSync(path.join(input, file)), hash = sha(bytes), ext = path.extname(file);
  const name = path.basename(file, ext) + '.' + hash.slice(0, 16) + ext;
  const target = path.join(output, name);
  if (fs.existsSync(target) && sha(fs.readFileSync(target)) !== hash) throw Error('Refusing to overwrite an immutable asset');
  addRecord(key, bytes, relativeUrl(target), false);
  pending.push({ target, bytes });
}
const initialKeys = new Set(['geometry', 'off2k', 'probeOff', 'deskOff']);
const previousInitialBytes = Number(args['previous-initial-bytes']);
if (!Number.isSafeInteger(previousInitialBytes) || previousInitialBytes <= 0) throw Error('Invalid previous initial byte count');
const report = {
  version: assets.version, geometryPreserved: true,
  encoding: 'RGBM16, straight RGBA8, scene-linear, no generated mipmaps',
  bake: { engine: 'Blender ' + bake.blender + ' ' + bake.engine, device: bake.device, nativeResolution: bake.nativeResolution, samples: bake.samples, diffuseBounces: bake.diffuseBounces, desktopDetail: desk.resolution, casterSha256: bake.casterSha256, casterObjects: bake.casterObjects },
  initialBytes: records.filter(x => initialKeys.has(x.key)).reduce((n, x) => n + x.bytes, 0),
  previousInitialBytes, newAssetBytes: records.filter(x => !x.reused).reduce((n, x) => n + x.bytes, 0), assets: records,
};
const moduleText = '// Content-addressed Cycles assets; generated by tools/bake/package_realism.cjs.\nexport const ROOM_BAKE = ' + JSON.stringify(assets, null, 2) + ';\n';
const headers = records.map(r => ({ source: '/' + r.path, headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }));
if (!args['check-only']) {
  fs.mkdirSync(output, { recursive: true });
  fs.mkdirSync(evidence, { recursive: true });
  for (const { target, bytes } of pending) fs.writeFileSync(target, bytes);
  fs.writeFileSync(path.join(evidence, 'experience-baked-assets.js'), moduleText);
  fs.writeFileSync(path.join(evidence, 'runtime-assets.json'), JSON.stringify(assets, null, 2) + '\n');
  fs.writeFileSync(path.join(evidence, 'immutable-headers.json'), JSON.stringify(headers, null, 2) + '\n');
  fs.writeFileSync(path.join(evidence, 'packaged-assets.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(evidence, 'asset-commit-files.txt'), records.filter(x => !x.reused).map(x => x.path).join('\n') + '\n');
  if (!args['prepare-only']) {
    fs.writeFileSync(path.join(repo, 'experience-baked-assets.js'), moduleText);
    const configPath = path.join(repo, 'vercel.json'), config = readJson(configPath);
    const replaced = new Set(headers.map(x => x.source));
    config.headers = [...config.headers.filter(x => !replaced.has(x.source)), ...headers];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  }
}
console.log(JSON.stringify({ checkedOnly: args['check-only'], preparedOnly: args['prepare-only'], files: records.length, newFiles: pending.length, initialBytes: report.initialBytes, previousInitialBytes, changeBytes: report.initialBytes - previousInitialBytes }));
