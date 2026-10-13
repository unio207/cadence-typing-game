// Key handling in shell.js, under the same kind of hand-rolled shim as
// dom.test.js. What it checks is routing - which screen a key lands on and
// whether it reaches the run - not how anything looks.
const { test } = require('node:test');
const assert = require('node:assert/strict');

function fakeEl(tag) {
  const el = {
    tagName: tag, children: [], style: { setProperty() {} }, _text: '', className: '', dataset: {},
    innerHTML: '',
    get textContent() { return this._text; },
    set textContent(v) { this._text = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    remove() {}, addEventListener() {}, querySelector() { return null; },
    getBoundingClientRect() { return { width: this._text.length * 18 || 900, height: 40 }; },
    getContext() {
      return { setTransform() {}, clearRect() {}, fillRect() {}, fillStyle: '', globalAlpha: 1 };
    }
  };
  return el;
}

const byId = {};
let keydown = null;
let frameCb = null;
global.document = {
  readyState: 'complete', fonts: null,
  createElement: fakeEl, body: fakeEl('body'), documentElement: fakeEl('html'),
  getElementById(id) { return byId[id] || (byId[id] = fakeEl('div')); }
};
global.window = {
  devicePixelRatio: 1,
  addEventListener(type, fn) { if (type === 'keydown') keydown = fn; }
};
global.getComputedStyle = () => ({
  font: '30px mono', fontSize: '30px', fontFamily: 'mono', letterSpacing: '0',
  getPropertyValue: () => '#17171a'
});
global.requestAnimationFrame = fn => { frameCb = fn; };
for (let i = 0; i < 3; i++) document.getElementById('strikes').appendChild(fakeEl('i'));

global.cadence = Object.assign({},
  require('../src/metrics.js'), require('../src/survival.js'), require('../src/generator.js'),
  require('../src/render.js'), require('../src/rail.js'),
  { draftA: require('../src/draft-a.js') });
global.cadenceScreens = require('../src/screens.js');
require('../src/shell.js');
const A = global.cadenceApp.app;

function key(k) {
  keydown({ key: k, preventDefault() {}, ctrlKey: false, metaKey: false, altKey: false });
}
function frame(ms) { frameCb(ms); }

// strike out: three wrong keys while the page is blind
function dieByStrikes() {
  const run = A.run;
  for (let i = 0; i < 3 && !run.ended; i++) {
    run.ratio = 0;                        // blind, so a wrong key is a strike
    const ch = run.text[run.cursor];
    key(ch === 'q' ? 'z' : 'q');
  }
  assert.equal(run.endReason, 'strikes');
  return run;
}

test('a letter on the title starts the run without spending itself as keystroke one', () => {
  key('Escape');
  assert.equal(A.screen, 'title');
  key('e');
  assert.equal(A.screen, 'run');
  assert.equal(A.run.total, 0);
  assert.equal(A.run.cursor, 0);
});

test('typing through a death does not skip the death beat or the result', () => {
  key('Tab');
  const run = dieByStrikes();
  assert.equal(A.screen, 'dying');
  for (const k of ['e', ' ', 'a']) key(k);    // the player is still mid-word
  assert.equal(A.run, run);
  assert.equal(A.screen, 'dying');

  const t0 = A.diedAt;
  frame(t0 + 100);
  assert.equal(A.screen, 'dying');
  frame(t0 + 450);
  assert.match(byId['screen-run'].className, /is-leaving/);
  frame(t0 + 650);
  assert.equal(A.screen, 'result');
  assert.match(byId['screen-result'].className, /is-active/);

  for (const k of ['e', ' ', 'a']) key(k);
  assert.equal(A.screen, 'result');
  assert.equal(A.run, run);
});

test('the death glyph is marked: the struck character, or the caret when the page dried', () => {
  key('Tab');
  const run = dieByStrikes();
  const struck = byId['line'].children.find(sp => sp.__idx === run.cursor - 1);
  assert.match(struck.className, /\bdeath\b/);
  assert.equal(byId['caret'].className, '');

  key('Tab');
  assert.equal(byId['caret'].className, '');
  A.run.startedAt = 0; A.run.ended = true; A.run.endReason = 'dried';
  global.cadenceApp.finishRun();
  assert.equal(byId['caret'].className, 'death');
});

test('tab skips the death beat on any frame, and enter restarts from the result', () => {
  key('Tab');
  let run = dieByStrikes();
  key('Tab');
  assert.equal(A.screen, 'run');
  assert.notEqual(A.run, run);
  assert.equal(byId['screen-run'].className, 'screen is-active');

  run = dieByStrikes();
  frame(A.diedAt + 450);
  key('Tab');                                  // mid fade-out
  assert.equal(A.screen, 'run');
  assert.equal(byId['screen-run'].className, 'screen is-active');

  run = dieByStrikes();
  frame(A.diedAt + 650);
  assert.equal(A.screen, 'result');
  key('Enter');
  assert.equal(A.screen, 'run');
  assert.notEqual(A.run, run);
});
