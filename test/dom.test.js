// Exercises the DOM layer (render.js, rail.js) under a hand-rolled shim. This
// cannot judge how anything looks - that needs a browser - but it does catch
// NaN geometry, runaway span creation, missing elements and bad opacity values,
// which is most of what goes wrong in a renderer.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const CHAR_W = 18;

function fakeEl(tag) {
  const el = {
    tagName: tag, children: [], style: {}, _text: '', className: '',
    dataset: {},
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    remove() {},
    addEventListener() {},
    getBoundingClientRect() {
      // 10 'm' characters wide, used by measure()
      return { width: el.rectWidth || this._text.length * CHAR_W, height: el.rectHeight || 40 };
    },
    getContext() {
      // Records every paint so a test can assert on the shape that was drawn.
      // The real canvas is unavailable headlessly; what is checkable is geometry.
      const calls = [];
      el.calls = calls;
      const ctx = {
        setTransform() {}, clearRect() {}, fillStyle: '', globalAlpha: 1,
        fillRect(x, y, w, h) { calls.push({ x, y, w, h, fill: ctx.fillStyle, alpha: ctx.globalAlpha }); }
      };
      return ctx;
    }
  };
  Object.defineProperty(el, 'firstElementChild', { get() { return this.children[0] || null; } });
  return el;
}

// Mutable so a test can "switch theme" and check the canvas follows the variables.
const THEME = { '--ink': '#17171a', '--rule': '#e6e2d7' };

function railCanvas() {
  const c = fakeEl('canvas');
  c.rectWidth = 900; c.rectHeight = 22;
  c.clientWidth = 900;            // rail.js re-measures when this drifts from w
  return c;
}

global.document = {
  createElement: fakeEl,
  body: fakeEl('body'),
  documentElement: fakeEl('html'),
  fonts: null
};
global.getComputedStyle = () => ({
  font: '30px mono', fontSize: '30px', fontFamily: 'mono', letterSpacing: '-0.01em',
  getPropertyValue: (name) => (name in THEME ? THEME[name] : '#17171a')
});
global.window = { devicePixelRatio: 2, addEventListener() {} };

const { createRenderer } = require('../src/render.js');
const { createRail } = require('../src/rail.js');
const DRAFTS = { a: require('../src/draft-a.js') };

function harness() {
  const els = {
    line: fakeEl('div'), caret: fakeEl('div'),
    caretLine: fakeEl('div'), track: fakeEl('div')
  };
  return { els: els, r: createRenderer(els) };
}

test('measure derives a sane character width', () => {
  const h = harness();
  assert.equal(h.r.measure(), CHAR_W);
});

for (const id of ['a']) {
  test('draft ' + id + ': the renderer produces finite geometry and valid opacity', () => {
    const D = DRAFTS[id];
    const h = harness();
    const run = D.createRun(99);
    let now = 1000;
    for (let i = 0; i < 300; i++) {
      D.onKey(run, run.text[run.cursor], now);
      D.tick(run, now, 1 / 60);
      const info = h.r.draw(run, D, 1 / 60);
      assert.ok(Number.isFinite(info.scrollX), 'scrollX was ' + info.scrollX + ' at key ' + i);
      assert.ok(Number.isFinite(info.caretOffset), 'caretOffset was ' + info.caretOffset);
      assert.ok(Number.isFinite(info.charWidth) && info.charWidth > 0);
      now += 70;
      if (run.ended) break;
    }
    for (const sp of h.els.line.children) {
      if (sp.style.opacity === '' || sp.style.opacity === undefined) continue;
      const o = Number(sp.style.opacity);
      assert.ok(Number.isFinite(o) && o >= 0 && o <= 1, 'bad opacity "' + sp.style.opacity + '"');
    }
  });

  test('draft ' + id + ': the span pool is bounded, not accumulating', () => {
    // The window grows to its steady size (70 behind + 110 ahead) and must then
    // stop: spans are reused by index, never created per keystroke.
    const D = DRAFTS[id];
    const h = harness();
    const run = D.createRun(99);
    let now = 1000;
    function typeFor(keys) {
      for (let i = 0; i < keys && !run.ended; i++) {
        D.onKey(run, run.text[run.cursor], now);
        D.tick(run, now, 1 / 60);
        h.r.draw(run, D, 1 / 60);
        now += 70;
      }
    }
    typeFor(250);
    const settled = h.els.line.children.length;
    typeFor(400);
    const later = h.els.line.children.length;
    assert.equal(later, settled,
      'span pool grew from ' + settled + ' to ' + later + ' after settling');
    assert.ok(settled <= 181, 'window larger than the 180-character design: ' + settled);
  });
}

test('draft a: a chapter change rewrites only the text past the visible edge', () => {
  // On a step-up into a new chapter the buffered old-chapter text is cut and
  // regenerated. Everything typed, and everything a player can see ahead of the
  // caret (43 characters, measured in Chrome at the widest stage), must survive,
  // and spans already holding the discarded characters must be redrawn.
  const D = DRAFTS.a;
  const { poolFor } = require('../src/generator.js');
  const h = harness();
  const run = D.createRun(99, { goal: 55 });
  let now = 1000;
  for (let i = 0; i < 40; i++) {
    D.onKey(run, run.text[run.cursor], now);
    D.tick(run, now, 1 / 60);
    h.r.draw(run, D, 1 / 60);
    now += 70;
  }
  assert.equal(run.chapterIndex, 0);
  const before = run.text, marks = run.marks.slice();

  run.demand.goal = 70;               // what stepUp does to the goal: chapter 0 -> 1
  D.tick(run, now, 1 / 60);
  // stale slots are recycled a few per frame; the visible ones must never be stale
  for (let f = 0; f < 30; f++) {
    h.r.draw(run, D, 1 / 60);
    for (const sp of h.els.line.children) {
      if (sp.__idx < 0 || sp.__idx > run.cursor + 43 || sp.textContent === '') continue;
      assert.equal(sp.textContent, run.text[sp.__idx], 'visible stale glyph at ' + sp.__idx);
    }
  }

  assert.equal(run.chapterIndex, 1);
  assert.ok(run.textCut >= run.cursor + 43, 'cut at ' + run.textCut + ' is on screen');
  assert.equal(run.text.slice(0, run.textCut + 1), before.slice(0, run.textCut + 1));
  assert.deepEqual(run.marks, marks);
  assert.notEqual(run.text.slice(run.textCut), before.slice(run.textCut));
  const pool = new Set(poolFor(1).map(t => t.word));
  for (const w of run.text.slice(run.textCut + 1).split(' ')) {
    assert.ok(pool.has(w), '"' + w + '" after the cut is not from the new chapter');
  }
  for (const sp of h.els.line.children) {
    if (sp.__idx < 0 || sp.textContent === '') continue;
    assert.equal(sp.textContent, run.text[sp.__idx], 'stale glyph in slot for ' + sp.__idx);
  }
});

test('the rail draws without throwing and keeps a bounded buffer', () => {
  const canvas = railCanvas();
  const rail = createRail(canvas);
  for (let i = 0; i < 2000; i++) rail.mark(i * 50);
  assert.ok(rail._marks.length <= 500, 'ring buffer grew to ' + rail._marks.length);
  assert.doesNotThrow(() => rail.draw(100000, 85));
  assert.doesNotThrow(() => rail.draw(100000, 0));
  rail.reset();
  assert.equal(rail._marks.length, 0);
  assert.doesNotThrow(() => rail.draw(100000, 50));
});

// --- the rail's visual treatment: marks hang from a top rule, length = deviation

// Feeds a rail a list of inter-keystroke intervals and returns the marks it drew.
function railHeights(intervals) {
  const canvas = railCanvas();
  const rail = createRail(canvas);
  let t = 1000;
  rail.mark(t);
  for (const d of intervals) { t += d; rail.mark(t); }
  canvas.calls.length = 0;
  rail.draw(t, 100);
  return marksOnly(canvas).map(m => m.h);
}

function marksOnly(canvas) {
  // the first fillRect of every frame is the ruled line; the rest are keystrokes
  return canvas.calls.filter(c => c.h !== 1 || c.w !== 900);
}

test('the rail paints a top rule in --rule and one mark per visible keystroke', () => {
  const canvas = railCanvas();
  const rail = createRail(canvas);
  let t = 1000;
  for (let i = 0; i < 40; i++) { rail.mark(t); t += 100; }
  canvas.calls.length = 0;
  rail.draw(t, 90);

  const rule = canvas.calls[0];
  assert.deepEqual([rule.x, rule.y, rule.w, rule.h], [0, 0, 900, 1], 'no rule at the top edge');
  assert.equal(rule.fill, '#e6e2d7', 'the rule is not --rule');

  const marks = marksOnly(canvas);
  // 40 keystrokes 100ms apart = 4s at 0.2px/ms = 800px, all inside a 900px rail
  assert.equal(marks.length, 40, 'expected 40 marks, got ' + marks.length);
  for (const m of marks) {
    assert.equal(m.fill, '#17171a', 'marks must be --ink');
    assert.equal(m.w, 2, 'marks are 2px wide so they hold at 180 wpm');
    assert.equal(m.y, 2, 'marks must hang from the shared top edge');
    assert.ok(m.h >= 4 && m.h <= 17, 'mark length out of range: ' + m.h);
    assert.ok(m.h + m.y <= 22, 'mark overflows the rail');
    assert.ok(Number.isFinite(m.x) && Number.isFinite(m.alpha));
    assert.ok(m.alpha > 0 && m.alpha <= 1, 'bad alpha ' + m.alpha);
  }
});

test('even typing draws a flat comb of stubs; a lurch draws a spike', () => {
  const flat = railHeights(new Array(30).fill(100));
  assert.deepEqual([...new Set(flat)], [4],
    'even intervals must all draw the 4px stub, got ' + [...new Set(flat)]);

  // twenty even keystrokes, one 500ms stall, then four more even ones
  const ragged = railHeights(
    new Array(20).fill(100).concat([500], new Array(4).fill(100)));
  assert.ok(Math.max(...ragged) > 10,
    'the stall should spike well past the stub, max was ' + Math.max(...ragged));
  assert.equal(Math.min(...ragged), 4, 'the even keystrokes should still be stubs');
});

test('mark length tracks deviation over the range the rhythm metric scores', () => {
  // SPREAD is tied to metrics.js's cv saturation (0.35), so a deviation that the
  // metric calls "rhythm 0" must also be a mark at full length, and the gentler
  // deviations in between must be visibly, monotonically taller than the stub.
  const stub = railHeights(new Array(24).fill(100));
  const mild = railHeights(flipFlop(24, 100, 112));    // ~+-6%
  const hard = railHeights(flipFlop(24, 100, 140));    // ~+-17%
  const gone = railHeights(flipFlop(24, 100, 400));    // past saturation

  const peak = a => Math.max(...a);
  assert.equal(peak(stub), 4);
  assert.ok(peak(mild) > peak(stub) + 1, 'a mild wobble is invisible: ' + peak(mild));
  assert.ok(peak(hard) > peak(mild), 'not monotonic: ' + peak(mild) + ' -> ' + peak(hard));
  assert.equal(peak(gone), 17, 'full deviation must saturate at the spike length');

  function flipFlop(n, a, b) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(i % 2 ? b : a);
    return out;
  }
});

test('older marks are fainter than newer ones', () => {
  const canvas = railCanvas();
  const rail = createRail(canvas);
  let t = 1000;
  for (let i = 0; i < 60; i++) { rail.mark(t); t += 70; }
  canvas.calls.length = 0;
  rail.draw(t, 100);
  const marks = marksOnly(canvas).slice().sort((a, b) => a.x - b.x);
  assert.ok(marks.length > 10);
  assert.ok(marks[0].alpha < marks[marks.length - 1].alpha,
    'the leftmost mark is not fainter than the rightmost');
});

test('the rail follows the theme variables', () => {
  THEME['--ink'] = '#f0e7d4';
  THEME['--rule'] = '#2c261c';
  try {
    const canvas = railCanvas();
    const rail = createRail(canvas);
    rail.mark(1000); rail.mark(1100); rail.mark(1200);
    canvas.calls.length = 0;
    rail.draw(1200, 80);
    assert.equal(canvas.calls[0].fill, '#2c261c', 'rule did not follow --rule');
    assert.ok(marksOnly(canvas).every(m => m.fill === '#f0e7d4'), 'marks did not follow --ink');

    // a live toggle re-reads without a resize
    THEME['--ink'] = '#17171a';
    rail.readColours();
    canvas.calls.length = 0;
    rail.draw(1200, 80);
    assert.ok(marksOnly(canvas).every(m => m.fill === '#17171a'), 'readColours did not take');
  } finally {
    THEME['--ink'] = '#17171a';
    THEME['--rule'] = '#e6e2d7';
  }
});

test('a rail with zero width paints nothing rather than NaN geometry', () => {
  const canvas = fakeEl('canvas');
  canvas.rectWidth = 0; canvas.rectHeight = 0;
  const rail = createRail(canvas);
  rail.mark(1000);
  assert.doesNotThrow(() => rail.draw(1000, 50));
  assert.equal(canvas.calls.length, 0);
});
