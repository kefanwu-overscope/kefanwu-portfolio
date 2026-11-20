// A small, conservative JS minifier for engine.js (the repo has no npm and no build step at run time).
// Tokenises the source (strings, comments, numbers, identifiers, punctuators; regex literals after an operator),
// drops comments and whitespace, and optionally renames listed local identifiers. Template literals are rejected:
// the engine does not use them. The output is checked by `node --check` and by the browser tests.
'use strict';

const PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--',
  '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>'];
const WORD = /[A-Za-z0-9_$]/;
const REGEX_AFTER = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^', '&&', '||', '=>', 'return', 'typeof', '==', '===', '!=', '!==']);

function tokenize(src) {
  const out = [];
  let i = 0;
  const n = src.length;
  const last = () => { for (let k = out.length - 1; k >= 0; k--) return out[k]; return null; };
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (e < 0) throw Error('unterminated comment'); i = e + 2; continue; }
    if (c === '`') throw Error('template literal at ' + i);
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) { if (src[j] === '\\') j++; if (src[j] === '\n') throw Error('newline in string at ' + i); j++; }
      out.push({ t: 's', v: src.slice(i, j + 1) });
      i = j + 1;
      continue;
    }
    if (c === '/') {
      const p = last();
      if (!p || (p.t === 'p' && REGEX_AFTER.has(p.v)) || (p.t === 'w' && REGEX_AFTER.has(p.v))) {
        let j = i + 1, cls = false;
        while (j < n && (src[j] !== '/' || cls)) { if (src[j] === '\\') j++; else if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; if (src[j] === '\n') throw Error('newline in regex at ' + i); j++; }
        j++;
        while (j < n && /[a-z]/.test(src[j])) j++;
        out.push({ t: 'r', v: src.slice(i, j) });
        i = j;
        continue;
      }
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      let j = i;
      while (j < n && /[0-9a-fA-FxXoObB._]/.test(src[j])) { if ((src[j] === 'e' || src[j] === 'E') && (src[j + 1] === '+' || src[j + 1] === '-') && !/^0[xX]/.test(src.slice(i, j))) j++; j++; }
      let v = src.slice(i, j);
      if (/^0\.\d/.test(v)) v = v.slice(1);            // 0.5 -> .5
      out.push({ t: 'n', v });
      i = j;
      continue;
    }
    if (WORD.test(c)) {
      let j = i;
      while (j < n && WORD.test(src[j])) j++;
      out.push({ t: 'w', v: src.slice(i, j) });
      i = j;
      continue;
    }
    let m = PUNCT.find((p) => src.startsWith(p, i));
    if (!m) m = c;
    out.push({ t: 'p', v: m });
    i += m.length;
  }
  return out;
}

// "const a = 1; const b = 2;" -> "const a = 1, b = 2;" for consecutive declarations of the same kind in one block.
// A statement's first token is recorded per brace level; ';' outside parentheses ends it; a '}' that returns to a
// level whose statement is not a declaration may end a compound statement there.
function mergeDecls(toks) {
  const lv = [{ kw: null, start: true, par: 0 }];
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k], L = lv[lv.length - 1];
    if (t.t === 'p' && t.v === '{') { if (L.start) { L.kw = '{'; L.start = false; } lv.push({ kw: null, start: true, par: 0 }); continue; }
    if (t.t === 'p' && t.v === '}') { lv.pop(); const U = lv[lv.length - 1]; if (U && U.par === 0 && U.kw !== 'const' && U.kw !== 'let') U.start = true; continue; }
    if (t.t === 'p' && (t.v === '(' || t.v === '[')) { if (L.start) { L.kw = t.v; L.start = false; } L.par++; continue; }
    if (t.t === 'p' && (t.v === ')' || t.v === ']')) { L.par--; continue; }
    if (L.start) { L.kw = t.v; L.start = false; continue; }
    if (t.t === 'p' && t.v === ';' && L.par === 0) {
      const n = toks[k + 1];
      if ((L.kw === 'const' || L.kw === 'let') && n && n.t === 'w' && n.v === L.kw) { t.v = ','; n.drop = true; k++; continue; }
      L.start = true;
    }
  }
}

// rename: { name: short } applied to identifier tokens that are not property names (after '.' or before ':' in an
// object literal key position is not detected, so only rename names never used as keys or properties).
function minify(src, rename = {}, props = {}, opts = {}) {
  const toks = tokenize(src);
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k];
    if (t.t === 'w' && Object.prototype.hasOwnProperty.call(props, t.v)) {
      const p = toks[k - 1], n = toks[k + 1];
      if ((p && p.t === 'p' && (p.v === '.' || p.v === '?.')) || (n && n.v === ':' && p && (p.v === '{' || p.v === ','))) { t.v = props[t.v]; continue; }
    }
    if (t.t === 'w' && Object.prototype.hasOwnProperty.call(rename, t.v)) {
      const prev = toks[k - 1];
      if (prev && prev.t === 'p' && (prev.v === '.' || prev.v === '?.')) continue;
      t.v = rename[t.v];
    }
  }
  // const -> let; (x) => -> x =>; no ';' before '}'
  for (let k = 0; k < toks.length; k++) {
    const t = toks[k], n = toks[k + 1];
    if (t.t === 'w' && t.v === 'const') t.v = 'let';
    // true -> !0, false -> !1 (never a property name: not after '.', never before ':')
    if (t.t === 'w' && (t.v === 'true' || t.v === 'false') && !(toks[k - 1] && toks[k - 1].t === 'p' && (toks[k - 1].v === '.' || toks[k - 1].v === '?.')) && !(n && n.v === ':')) { t.v = t.v === 'true' ? '!0' : '!1'; t.t = 'p'; }
    if (t.t === 'p' && t.v === '(' && n && n.t === 'w' && toks[k + 2] && toks[k + 2].v === ')' && toks[k + 3] && toks[k + 3].v === '=>') { t.drop = true; toks[k + 2].drop = true; }
    if (t.t === 'p' && t.v === ';' && n && n.t === 'p' && n.v === '}') t.drop = true;
  }
  if (opts.merge !== false) mergeDecls(toks);
  let s = '';
  for (const t of toks) {
    if (t.drop) continue;
    if (s) {
      const a = s[s.length - 1], b = t.v[0];
      if ((WORD.test(a) && (WORD.test(b) || t.t === 'n')) || (a === '+' && b === '+') || (a === '-' && b === '-') || (a === '/' && t.t === 'r')) s += ' ';
    }
    s += t.v;
  }
  return s;
}

// Automatic renaming of local identifiers to names that occur nowhere in the source. Never renamed: keywords,
// globals (GLOBALS), names used as a property (after '.') or as an object key, or in a shorthand position.
const KEYWORDS = new Set('break case catch class const continue debugger default delete do else export extends false finally for function if import in instanceof let new null of return super switch this throw true try typeof var void while with yield async await undefined NaN Infinity arguments'.split(' '));
const GLOBALS = new Set('Math window document performance navigation Promise PerformanceObserver ResizeObserver IntersectionObserver requestAnimationFrame cancelAnimationFrame setTimeout clearTimeout getComputedStyle matchMedia addEventListener removeEventListener innerHeight innerWidth devicePixelRatio location history Error String Object Number Array JSON parseFloat parseInt isFinite Float64Array Map Set CSS console globalThis self'.split(' '));
function autoRename(src) {
  const toks = tokenize(src), used = new Set(), props = new Set(), cand = new Map();
  // bracket stack: an object-literal '{' follows ( , = : [ ? && || ?? or return; any other '{' opens a block
  const stack = [], OBJ_AFTER = new Set(['(', ',', '=', ':', '[', '?', '&&', '||', '??', 'return']);
  toks.forEach((t, k) => {
    const p = toks[k - 1], n = toks[k + 1];
    if (t.t === 'p') {
      if (t.v === '{') stack.push(p && OBJ_AFTER.has(p.v) ? 'o' : 'b');
      else if (t.v === '(' || t.v === '[') stack.push(t.v);
      else if (t.v === '}' || t.v === ')' || t.v === ']') stack.pop();
      return;
    }
    if (t.t !== 'w') return;
    used.add(t.v);
    if (p && p.t === 'p' && (p.v === '.' || p.v === '?.')) props.add(t.v);
    // object keys and shorthand properties (only inside an object literal; a block brace or call argument is not one)
    if (stack[stack.length - 1] === 'o' && n && n.t === 'p' && (n.v === ':' || n.v === ',' || n.v === '}') && p && p.t === 'p' && (p.v === '{' || p.v === ',')) props.add(t.v);
  });
  toks.forEach((t) => { if (t.t === 'w' && t.v.length >= 2 && !/^[0-9]/.test(t.v) && !KEYWORDS.has(t.v) && !GLOBALS.has(t.v) && !props.has(t.v)) cand.set(t.v, (cand.get(t.v) || 0) + t.v.length); });
  const names = [], A = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_$';
  for (const a of A) names.push(a);
  for (const a of A) for (const b of A + '0123456789') names.push(a + b);
  const free = names.filter((x) => !used.has(x) && !KEYWORDS.has(x) && !GLOBALS.has(x));
  const map = {};
  [...cand.entries()].sort((a, b) => b[1] - a[1]).forEach(([v], i) => { if (i < free.length && free[i].length < v.length) map[v] = free[i]; });
  return map;
}
// props: internal property names to shorten everywhere they are accessed or used as keys (the caller guarantees
// they never meet a DOM or API property of the same name).
function minifyAuto(src, props = {}) { src = inlineConsts(src); const map = autoRename(src); for (const k of Object.keys(props)) delete map[k]; return { code: minify(src, map, props), map }; }

// Inline numeric SCREAMING_CASE constants declared alone on a line ("  const A = 1, B_2 = 0.5;"): the line goes and each
// use of the name (not after '.', never as an object key) becomes the number. A name used any other way stays.
function inlineConsts(src) {
  const vals = Object.create(null), lines = src.split('\n');
  const RX = /^\s*const ((?:[A-Z][A-Z0-9_]* = -?\d*\.?\d+(?:e-?\d+)?(?:, )?)+);\s*$/;
  const keep = lines.map((l) => {
    const m = RX.exec(l);
    if (!m) return l;
    for (const d of m[1].split(', ')) { const [k, v] = d.split(' = '); vals[k] = v; }
    return '';
  });
  let out = keep.join('\n');
  const toks = tokenize(out);
  toks.forEach((t, k) => {
    if (t.t !== 'w' || vals[t.v] === undefined) return;
    const p = toks[k - 1], n = toks[k + 1];
    if ((p && p.t === 'p' && (p.v === '.' || p.v === '?.')) || (n && n.t === 'p' && n.v === ':' && p && (p.v === '{' || p.v === ','))) throw Error('inlineConsts: ' + t.v + ' used as a key or property');
    if (n && n.t === 'p' && /^(=|\+=|-=|\+\+|--)$/.test(n.v)) throw Error('inlineConsts: ' + t.v + ' assigned');
  });
  // replace whole words only, outside strings and comments: rebuild from tokens is lossy, so substitute by regex on
  // code that tokenises the same way (names are long SCREAMING_CASE words, never inside the engine's strings)
  for (const [k, v] of Object.entries(vals)) {
    if (toks.some((t) => (t.t === 's' || t.t === 'r') && new RegExp('\\b' + k + '\\b').test(t.v))) throw Error('inlineConsts: ' + k + ' inside a string');
    out = out.replace(new RegExp('(^|[^.\\w$])' + k + '(?![\\w$])', 'g'), (m0, a) => a + (/^-/.test(v) ? '(' + v + ')' : v));
  }
  return out;
}

module.exports = { tokenize, minify, autoRename, minifyAuto, inlineConsts };
