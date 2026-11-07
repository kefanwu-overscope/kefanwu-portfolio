// Paths and fixed inputs of the card line pass (see README.md).
const path = require('path');

const REPO = path.resolve(__dirname, '../..');
const WEBSITE = path.resolve(REPO, '..');
// Evidence and intermediate renders live outside the repository and outside .codex.
const EVIDENCE = path.resolve(process.env.CARD_LINES_EVIDENCE || path.join(WEBSITE, 'releases/drawn-then-built-20261027/card-lines'));
if (EVIDENCE.split(path.sep).includes('.codex')) throw new Error('Card-line evidence must stay outside .codex');
const WORK = path.join(EVIDENCE, 'work');
// The commit whose inspector rendered (or reproduces byte for byte) today's covers.
const COMMIT = process.env.CARD_LINES_COMMIT || 'e42a05b49b44d563fb635b4994e68834ab6982fa';
const PORT = Number(process.env.CARD_LINES_PORT || 4641);
const PLAYWRIGHT = process.env.CARD_LINES_PLAYWRIGHT || 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright';
const KEYS = ['steering', 'vineRobot', 'brakeSim', 'scanner', 'javelin', 'materialTest', 'aura', 'carbonSeat',
  'seat', 'ansysCfd', 'pool', 'lineFollower', 'formlabs', 'telecaster', 'education', 'ftc'];
// Scientific results are never traced.
const SKIP = new Set(['ansysCfd']);

module.exports = { REPO, WEBSITE, EVIDENCE, WORK, COMMIT, PORT, PLAYWRIGHT, KEYS, SKIP };
