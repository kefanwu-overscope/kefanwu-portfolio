import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url));
const text = (path) => read(path).toString('utf8');
const arrival = text('project-motion-arrival.js');
const table = /const FRAME_DRAWINGS = (\{[\s\S]*?\});/.exec(arrival)?.[1];
const drawings = Function(`return ${table}`)();
const projects = Object.keys(Function(`return ${/const OCCUPANCY = (\{[\s\S]*?\});/.exec(text('project-motion-story.js'))[1]}`)());
const provenance = JSON.parse(text('assets/detail-drawing-20261027/provenance.json'));

test('Every project has line layers for each story step, in both published widths', () => {
  assert.equal(projects.length, 16);
  assert.deepEqual(Object.keys(drawings).sort(), [...projects].sort());
  for (const [key, [tag, steps]] of Object.entries(drawings)) {
    for (let step = 0; step < steps; step++) for (const width of [900, 1800]) {
      const file = `assets/detail-drawing-20261027/${key}.${tag}/${step}-${width}.webp`;
      assert(existsSync(new URL(`../../${file}`, import.meta.url)), `${file} exists`);
    }
  }
});

test('The provenance record matches the published layers byte for byte', () => {
  const records = provenance.projects ?? provenance;
  for (const [key, [tag, steps]] of Object.entries(drawings)) {
    const record = records[key];
    assert(record, `${key} has a provenance record`);
    assert.equal(record.dir, `assets/detail-drawing-20261027/${key}.${tag}/`);
    assert.equal(record.steps, steps);
    for (const [name, digest] of Object.entries(record.files)) {
      assert.equal(createHash('sha256').update(read(`${record.dir}${name}`)).digest('hex'), digest, `${key}/${name}`);
    }
  }
});

test('The drawing stays off the path to the stage and its cover', () => {
  for (const page of ['case-study.html', 'project-3d.html']) {
    assert.doesNotMatch(text(page), /project-motion-arrival|drafting-arrival/, `${page} does not fetch a drawing up front`);
  }
  const renderer = text('case-study.js');
  assert.match(renderer, /import\('\.\/project-motion-arrival\.js\?v=/, 'case-study.js asks for the drawing on demand');
  assert.doesNotMatch(renderer, /detail-drawing-20261027/, 'No layer path in the critical script');
  for (const file of ['case-study.js', 'project-case-3d.js', 'project-motion-story.js']) {
    assert.doesNotMatch(text(file), /drafting-arrival/, `${file} does not load the retired live pass`);
  }
});

test('The drawing stays off the page\'s contentful paints: every sheet is a canvas holding a bitmap', () => {
  assert.match(arrival, /const print = document\.createElement\('canvas'\)/);
  assert.match(arrival, /const sheet = document\.createElement\('canvas'\)/);
  assert.match(arrival, /transferFromImageBitmap\(bitmap\)/);
  assert.doesNotMatch(arrival, /\.append\([^)]*(source|new Image)/, 'The source images never enter the document');
  const css = text('project-motion-story.css');
  assert.match(css, /\.case-motion-story \.case-drawing :is\(img,canvas\) \{ object-fit:contain; \}/, 'The copy takes the cover\'s framing');
});

test('Both pages fetch the cover from the head: the same candidates and sizes as the stage writes, for every project', () => {
  const renderer = text('case-study.js');
  const directory = /const coverDirectory = (.*?);\r?\n/.exec(renderer)[1];
  const srcset = /srcset: (\[480, 960, 1200, 1800\]\.map\(.*?\.join\(', '\)),\r?\n/.exec(renderer)[1];
  const written = Function('key', `const coverDirectory = ${directory}; return ${srcset};`);
  const sizes = /sizes="([^"]+)"/.exec(renderer)[1];
  for (const page of ['case-study.html', 'project-3d.html']) {
    const html = text(page);
    const snippet = /<script>(\(function\(\)\{var k=new URLSearchParams[\s\S]*?)<\/script>/.exec(html)[1];
    assert(html.indexOf(snippet) > html.lastIndexOf('<link rel="stylesheet"'), 'It waits for the stylesheets, so it never competes with first paint');
    assert(html.indexOf(snippet) < html.indexOf('<script type="importmap">'), 'It still runs in the head, ahead of the modules');
    const run = (search) => {
      const links = [];
      Function('location', 'document', 'URLSearchParams', snippet)({ search }, { createElement: () => ({}), head: { appendChild: (link) => links.push(link) } }, URLSearchParams);
      return links;
    };
    for (const key of projects) {
      const [link] = run(`?project=${key}`);
      assert.equal(link.rel, 'preload'); assert.equal(link.as, 'image'); assert.equal(link.fetchPriority, 'high');
      assert.equal(link.imageSizes, sizes);
      assert.equal(link.imageSrcset, written(key), `${page} ${key}`);
      for (const candidate of link.imageSrcset.split(', ')) assert(existsSync(new URL(`../../${candidate.split(' ')[0]}`, import.meta.url)), candidate);
    }
    assert.equal(run('?project=nothing').length, 0, 'An unknown project fetches nothing');
    assert.equal(run('').length, 0);
  }
});

test('First paint and the stage come first in the head of both pages', () => {
  for (const page of ['case-study.html', 'project-3d.html']) {
    const html = text(page);
    assert(html.lastIndexOf('<link rel="stylesheet"') < html.indexOf('<script defer'), `${page}: every stylesheet is requested ahead of the scripts`);
    for (const file of ['project-data.js', 'case-study-data.js', 'case-study-media.js', 'case-study-supplements.js', 'case-study.js']) {
      assert(html.includes(`<script defer fetchpriority="high" src="${file}`), `${page}: ${file} builds the stage`);
    }
    assert(!html.includes('as="font"'), `${page}: no font preload (Chrome holds first paint for it)`);
  }
  assert(text('project-3d.html').includes('<link rel="modulepreload" fetchpriority="low" href="vendor/three/0.185.0/build/three.core.js">'), 'The model\'s library waits its turn');
});

// A delivered IntersectionObserver batch lists every crossing since the last delivery, oldest
// first, and no later callback corrects a stale read: reading the first entry after an early scroll
// left a phone's stage hidden for good (RDR2-N1, 2026-11-04).
test('Every stage observer reads the last entry of a batch', () => {
  const entry = (isIntersecting, top) => ({ isIntersecting, intersectionRatio: isIntersecting ? 1 : 0, boundingClientRect: { top } });
  const batch = [entry(false, 848), entry(true, 92)];
  const callback = (file, start) => {
    const source = text(file), at = source.indexOf(start);
    assert(at >= 0, `${file}: ${start}`);
    const open = source.indexOf('new IntersectionObserver(', at) + 'new IntersectionObserver('.length;
    let depth = 0, end = open;
    for (; end < source.length; end++) {
      if ('({['.includes(source[end])) depth++;
      else if (')}]'.includes(source[end])) { if (depth === 0) break; depth--; }
      else if (source[end] === ',' && depth === 0) break;
    }
    return source.slice(open, end);
  };

  const stage = Function('entries', `let inViewport = false, nearViewport = false; const syncActivity = () => {};
    (${callback('project-case-3d.js', 'const observer = new IntersectionObserver')})(entries);
    (${callback('project-case-3d.js', 'const nearObserver = new IntersectionObserver')})(entries);
    return { inViewport, nearViewport };`)(batch);
  assert.deepEqual(stage, { inViewport: true, nearViewport: true }, 'project-case-3d.js sees the stage on screen');

  const drawing = Function('entries', `let onScreen = false, triggered = false; const TRIGGER = .15, trigger = () => { triggered = true; }, holdClock = () => {};
    (${callback('project-motion-arrival.js', 'const visibility = new IntersectionObserver')})(entries);
    return { onScreen, triggered };`)(batch);
  assert.deepEqual(drawing, { onScreen: true, triggered: true }, 'project-motion-arrival.js starts the drawing');

  const held = Function('entries', `let onScreen = false; const clock = () => {};
    (${callback('case-study.js', 'const visibility = new IntersectionObserver')})(entries);
    return onScreen;`)(batch);
  assert.equal(held, true, 'case-study.js runs the print\'s clock');

  const story = Function('entries', `let intersecting = false, inView = false, free = false, eased = 0, target = .5, sent = 0, raf = 0, previousTime = 0;
    const measure = () => {}, emit = () => {}, schedule = () => {}, cancelEntrance = () => {}, suspendLeader = () => {};
    const innerHeight = 844;
    (${callback('project-motion-story.js', 'const visibility = new IntersectionObserver')})(entries);
    return { inView, eased };`)([entry(false, 2000), entry(true, 600)]);
  assert.deepEqual(story, { inView: true, eased: .5 }, 'project-motion-story.js is in view, and takes the stage of a return from below');

  // The reverse batch: the stage left again before the delivery.
  const left = Function('entries', `let inViewport = true, nearViewport = true; const syncActivity = () => {};
    (${callback('project-case-3d.js', 'const observer = new IntersectionObserver')})(entries);
    return inViewport;`)([entry(true, 92), entry(false, 2000)]);
  assert.equal(left, false);

  for (const file of ['project-case-3d.js', 'project-motion-arrival.js', 'project-motion-story.js', 'case-study.js']) {
    assert.doesNotMatch(text(file), /IntersectionObserver\(\(?\[|entries\[0\]/, `${file} has no first-entry read`);
  }
});

const frameArrivalSource = () => {
  const start = arrival.indexOf('function sheetFrames');
  let depth = 0, end = arrival.indexOf('{', start);
  for (; end < arrival.length; end++) {
    if (arrival[end] === '{') depth++;
    else if (arrival[end] === '}' && --depth === 0) break;
  }
  return arrival.slice(start, end + 1);
};

test('Each sheet has one animation of the whole sequence, so it reaches the compositor', () => {
  assert.equal((arrival.match(/image\.animate\(/g) || []).length, 2, 'One fade to pencil, one whole sequence');
  assert.match(arrival, /for \(const animation of animations\) animation\.cancel\(\);\s*animations = \[\];\s*layers\.forEach/, 'The fade to pencil ends before the sequence starts');
  assert.match(arrival, /sheetFrames\(index, fadedMs\)/, 'A one-step drawing finishes its fade to pencil within the sequence');
  for (const [INK, SPREAD, DEVELOP, RETIRE, RETIRE_SPREAD, TOTAL] of [[420, 530, 600, 550, 114, 1950], [380, 400, 520, 450, 80, 1601]]) {
    const DEVELOP_AT = SPREAD + INK, RETIRE_AT = DEVELOP_AT + Math.round(DEVELOP * .56);
    assert.equal(RETIRE_AT + RETIRE_SPREAD + RETIRE, TOTAL);
    const steps = 6, slots = Array.from({ length: steps }, (unused, index) => index * SPREAD / (steps - 1));
    for (const sweep of [false, true]) {
      const frames = Function('PENCIL,STROKE,DEVELOP_EASE,INK,SPREAD,RETIRE,RETIRE_SPREAD,RETIRE_AT,TOTAL,slots,sweep,LINES_IN',
        `${frameArrivalSource()}; return (sweep ? [0] : slots.map((u, i) => i)).map((index) => sheetFrames(index));`)(.35, 'stroke', 'develop', INK, SPREAD, RETIRE, RETIRE_SPREAD, RETIRE_AT, TOTAL, slots, sweep, 240);
      for (const list of frames) {
        for (let index = 1; index < list.length; index++) assert(list[index].offset >= list[index - 1].offset, 'Offsets ascend');
        assert.equal(list[0].offset, 0); assert.equal(list.at(-1).offset, 1);
        assert.equal(list[0].opacity, .35); assert.equal(list.at(-1).opacity, 0);
        assert(list.every(({ offset }) => offset >= 0 && offset <= 1));
      }
      if (!sweep) {
        // Timing unchanged from the separate animations it replaced: pencil until the slot, full by slot + INK, retiring in story order.
        const middle = frames[2], slot = slots[2];
        assert.deepEqual(middle.map(({ offset, opacity }) => [Math.round(offset * TOTAL), opacity]),
          [[0, .35], [Math.round(slot), .35], [Math.round(slot + INK), 1], [Math.round(RETIRE_AT + RETIRE_SPREAD * slot / SPREAD), 1], [Math.round(RETIRE_AT + RETIRE_SPREAD * slot / SPREAD + RETIRE), 0], [TOTAL, 0]]);
      }
    }
  }
});

test('The paper moves through the whole sequence, by amounts no pixel can show outside the develop', () => {
  const drift = Number(/DRIFT = (\.\d+)/.exec(arrival)?.[1]);
  assert(drift > 0 && 255 * drift < .5);
  assert.match(arrival, /paper\.animate\(\[\{ offset: 0, opacity: 1 - GHOST \+ DRIFT[\s\S]*?\{ offset: 1, opacity: 0 \}\], \{ duration: TOTAL, fill: 'both' \}\)/);
});

test('A cover that has not decoded never holds a stage', () => {
  assert.match(arrival, /on\(host, 'case-model-ready'/, 'The drawing gives way to a ready model');
  assert.match(arrival, /COVER_CAP = 3000/); assert.match(arrival, /giveBack\('cover late', 0\)/);
  assert.match(arrival, /dataset\.arrivalLayers = 'in'/, 'The layers, not the cover, start the model');
  const stage = text('project-case-3d.js'), renderer = text('case-study.js');
  assert.match(stage, /new CustomEvent\('case-model-ready'\)/);
  assert.match(stage, /attributeFilter: \['data-arrival', 'data-arrival-layers'\]/);
  assert.match(renderer, /on\(host, 'case-model-ready'/, 'Also before the drawing has claimed the stage');
});

test('The loading status never crosses the scroll cue, and a failure is never hidden', () => {
  const css = text('project-motion-story.css'), live = text('project-case-3d.css');
  assert.match(css, /\.case-motion-story \.case-3d-status \{[^}]*top:8px;[^}]*bottom:auto;/);
  assert.match(live, /\.card-media\[data-arrival\]\[data-status=loading\] > \.case-3d-status \{[^}]*clip-path:inset\(50%\)/, 'Out of sight, in the accessibility tree, only while loading');
});

test('Sheets are decoded off the main thread, with the page as the fallback', () => {
  assert.match(arrival, /new Worker\(/);
  assert.match(arrival, /createImageBitmap\(await response\.blob\(\),size\)/, 'The worker decodes and resizes');
  assert.match(arrival, /await source\.decode\(\);\s*return createImageBitmap\(source, size\);/, 'The page does it only if the worker cannot');
  assert.match(arrival, /'force-cache'/, 'The grey copy comes from the HTTP cache');
});

test('Sheets upload a few per frame before the drawing appears, without showing a pixel', () => {
  const staged = Number(/STAGED = (\.\d+)/.exec(arrival)?.[1]);
  assert(staged > 0, 'A canvas at opacity 0 is not uploaded until it can be seen, all sheets in one commit');
  assert(255 * staged < .5, 'Black on white at this opacity moves no 8-bit pixel');
  assert.match(arrival, /const sheet = document\.createElement\('canvas'\);[\s\S]*?opacity:\$\{STAGED\}/);
  assert.match(arrival, /const print = document\.createElement\('canvas'\);\s*print\.style\.cssText = `[^`]*opacity:\$\{STAGED\}`/);
  assert.match(arrival, /shown\.splice\(0, 2\)/, 'Two per frame');
  assert.match(arrival, /print\.style\.opacity = '1';\s*paper\.style\.opacity = String\(1 - GHOST\);/, 'The grey copy and its paper appear in one frame');
  assert.doesNotMatch(arrival, /drawing\.style\.cssText = '[^']*opacity/, 'The drawing itself is not hidden, or nothing under it would upload');
});

test('A live stage links its shader programs off the main thread', () => {
  const inspector = text('studio-inspector.js');
  assert.match(inspector, /warmPrograms = false/, 'Off unless asked: the export tools build at construction');
  assert.match(text('project-case-3d.js'), /warmPrograms: !\/\[\?&\]warm=off/, 'The page asks, with a kill switch');
  assert.match(inspector, /renderer\.extensions\.has\('KHR_parallel_shader_compile'\)/, 'Without the extension nothing changes');
  assert.match(inspector, /renderer\.compile\(entry\.root, camera, scene\);\s*await programsLinked\(\);/, 'Linked before the model joins the scene');
  assert(inspector.indexOf('await programsLinked();\n') < inspector.indexOf('resource = entry;\n'.replace('\n', '')), 'No frame can draw a program still linking');
  assert.match(inspector, /const cap = performance\.now\(\) \+ 4000;[\s\S]*?if \(waiting && performance\.now\(\) < cap\) setTimeout\(check, 10\);/, 'A link that never reports completion cannot hold the model');
});
