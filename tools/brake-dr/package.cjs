'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {optimizeProject} = require('../studio-export/optimize_packages.cjs');
const root = path.resolve(__dirname, '../..');
const evidence = path.resolve(root, '../.codex/brake-dr-20261005');
const source = path.join(evidence, 'source-export/package');
const directory = path.join(root, 'assets/studio-motion/brake-dr-20261005');
fs.mkdirSync(directory, {recursive:true});
const result = optimizeProject('brakeSim', {
  readSource: relative => {
    const name = path.basename(relative);
    if (!['manifest.json','geometry.bin.gz','motion.bin.gz'].includes(name)) throw new Error('Unexpected source package member');
    return fs.readFileSync(path.join(source, name));
  }, directory, indexPrefix:'brake-dr-20261005', sourceCommit:null,
});
const indexPath = path.join(root, 'assets/studio-motion/index.json');
const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
index.projects.brakeSim = result.index;
index.release = 'brake-dr-20261005';
fs.writeFileSync(indexPath, JSON.stringify(index,null,2)+'\n');
fs.writeFileSync(path.join(evidence,'package-verification.json'),JSON.stringify(result,null,2)+'\n');
