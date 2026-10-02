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
      return { width: this._text.length * CHAR_W, height: 40 };
    },
    getContext() {
      return {
        setTransform() {}, clearRect() {}, fillRect() {}, fillStyle: '', globalAlpha: 1
      };
    }
  };
  Object.defineProperty(el, 'firstElementChild', { get() { return this.children[0] || null; } });
  return el;
}

global.document = {
  createElement: fakeEl,
  body: fakeEl('body'),
  documentElement: fakeEl('html'),
  fonts: null
};
global.getComputedStyle = () => ({
  font: '30px mono', fontSize: '30px', fontFamily: 'mono', letterSpacing: '-0.01em',
  getPropertyValue: () => '#17171a'
});
global.window = { devicePixelRatio: 2, addEventListener() {} };

const { createRenderer } = require('../src/render.js');
const { createRail } = require('../src/rail.js');
const DRAFTS = {
  a: require('../src/draft-a.js'),
  b: require('../src/draft-b.js'),
  c: require('../src/draft-c.js')
};

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

for (const id of ['a', 'b', 'c']) {
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

test('draft B marks bar state onto the characters', () => {
  const B = DRAFTS.b;
  const h = harness();
  const run = B.createRun(5);
  let now = 1000;
  for (let i = 0; i < 90; i++) { B.onKey(run, run.text[run.cursor], now); B.tick(run, now, 1 / 60); now += 60; }
  h.r.draw(run, B, 1 / 60);
  const classes = h.els.line.children.map(s => s.className).join(' ');
  assert.ok(/bar-locked|bar-loose/.test(classes), 'no bar underline classes were applied: ' + classes);
});

test('draft C blanks everything the edge has consumed', () => {
  const C = DRAFTS.c;
  const h = harness();
  const run = C.createRun(5);
  let now = 1000;
  for (let i = 0; i < 120; i++) { C.onKey(run, run.text[run.cursor], now); C.tick(run, now, 1 / 60); now += 60; }
  run.edge = run.cursor - 10;               // force the edge close behind the caret
  h.r.draw(run, C, 1 / 60);
  const consumed = h.els.line.children.filter(s => s.className === 'miss');
  assert.ok(consumed.length > 0, 'the edge consumed nothing');
});

test('the rail draws without throwing and keeps a bounded buffer', () => {
  const canvas = fakeEl('canvas');
  const rail = createRail(canvas);
  for (let i = 0; i < 2000; i++) rail.mark(i * 50);
  assert.doesNotThrow(() => rail.draw(100000, 85));
  assert.doesNotThrow(() => rail.draw(100000, 0));
  rail.reset();
  assert.doesNotThrow(() => rail.draw(100000, 50));
});
