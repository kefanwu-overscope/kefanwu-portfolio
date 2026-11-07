// Snapshot of the live project-inspector render path for the card line pass.
//
// The covers were rendered by studio-inspector.js through the white-studio
// exporter. Other work edits those modules in the working tree, so the line
// pass renders from the bytes of one pinned commit instead: every module is
// read with `git show <commit>:<file>` and written to <work>/inspector/.
// studio-inspector.js receives two harness-only edits (both asserted to apply
// exactly once): the asset root is absolute, and an afterRender callback hands
// the finished frame's renderer, scene, camera and nodes to the line pass.
//
// usage: node tools/card-lines/snapshot.cjs [workDir]
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { REPO, WORK, COMMIT } = require('./config.cjs');

const work = path.resolve((require.main === module && process.argv[2]) || WORK);
const out = path.join(work, 'inspector');
const FILES = ['studio-inspector.js', 'studio-inspector-loader.js', 'studio-inspector-materials.js', 'studio-inspector-camera.js',
  'studio-motion-runtime.js', 'studio-steering-motion.js', 'studio-photo-materials.js'];
const PATCHES = {
  'studio-inspector.js': [
    ["const ASSET_ROOT = new URL('./assets/studio-motion/', import.meta.url);",
      "const ASSET_ROOT = new URL('/assets/studio-motion/', location.origin); // card-lines snapshot: served from the repository root"],
    ['  onFrame = () => {},\n',
      '  onFrame = () => {},\n  afterRender = null, // card-lines snapshot: line pass hook\n'],
    ['      renderer.render(scene, camera);\n',
      '      renderer.render(scene, camera);\n      afterRender?.({ renderer, scene, camera, nodes: resource?.nodes || [], resource });\n'],
  ],
};
const sha = (data) => crypto.createHash('sha256').update(data).digest('hex');
fs.mkdirSync(out, { recursive: true });
const record = { commit: COMMIT, files: {} };
for (const file of FILES) {
  const source = execFileSync('git', ['-C', REPO, 'show', `${COMMIT}:${file}`]);
  let text = source.toString('utf8');
  for (const [from, to] of PATCHES[file] || []) {
    const count = text.split(from).length - 1;
    if (count !== 1) throw new Error(`${file}: patch anchor found ${count} times`);
    text = text.replace(from, to);
  }
  fs.writeFileSync(path.join(out, file), text);
  record.files[file] = { sourceSha256: sha(source), snapshotSha256: sha(Buffer.from(text)), patched: !!PATCHES[file] };
}
fs.writeFileSync(path.join(out, 'snapshot.json'), JSON.stringify(record, null, 2));
console.log(`inspector snapshot of ${COMMIT.slice(0, 8)} -> ${out}`);
