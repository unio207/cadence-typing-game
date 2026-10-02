// Headless profiler for the render path.
//
// The complaint it exists to answer is "smooth at first, choppy after a few
// seconds" - progressive degradation, which no single-frame benchmark can see. So
// it drives a whole run under a DOM shim at a fixed frame rate and reports cost
// bucketed by how long the run has been going.
//
// It reports TWO things, and the second is the one that matters. CPU time inside
// draw() is almost free here because the shim's style objects are plain JS; a real
// browser charges for every CSSOM write and re-shapes a text node every time its
// content changes. So the harness also counts mutations - textContent, className,
// style.opacity, transforms, nodes created - per frame. That count is what the
// browser's layout and paint cost is proportional to, and it is where the
// degradation shows up.
//
//   node tools/profile.js [--draft a|c] [--seconds 240] [--wpm 200] [--json]
//
// The synthetic typist is a perfect metronome, deliberately: the demand settles
// below sustained speed, so a metronomic typist never dies and the run can be
// driven for as long as we like.
'use strict';

const CHAR_W = 18;

// ---------------------------------------------------------------- DOM shim
// Same shape as test/dom.test.js, plus mutation counters.
const W = { text: 0, className: 0, opacity: 0, transform: 0, created: 0 };

function resetWrites() { for (const k in W) W[k] = 0; }

function fakeEl(tag) {
  const style = {};
  const el = {
    tagName: tag, children: [], dataset: {}, _text: '', _cn: '',
    // Counting setters: a write is only charged when the value actually changes,
    // which is exactly when a browser would invalidate style or layout.
    style: new Proxy(style, {
      set: function (t, k, v) {
        if (t[k] !== v) { if (k === 'opacity') W.opacity++; else if (k === 'transform') W.transform++; }
        t[k] = v;
        return true;
      }
    }),
    get className() { return this._cn; },
    set className(v) { if (v !== this._cn) W.className++; this._cn = v; },
    get textContent() { return this._text; },
    set textContent(v) { v = String(v); if (v !== this._text) W.text++; this._text = v; },
    appendChild: function (c) { this.children.push(c); return c; },
    remove: function () {}, addEventListener: function () {},
    getBoundingClientRect: function () { return { width: this._text.length * CHAR_W, height: 40 }; },
    getContext: function () {
      return { setTransform() {}, clearRect() {}, fillRect() {}, fillStyle: '', globalAlpha: 1 };
    }
  };
  Object.defineProperty(el, 'firstElementChild', { get() { return this.children[0] || null; } });
  return el;
}

global.document = {
  createElement: function (t) { W.created++; return fakeEl(t); },
  body: fakeEl('body'), documentElement: fakeEl('html'), fonts: null
};
global.getComputedStyle = function () {
  return {
    font: '30px mono', fontSize: '30px', fontFamily: 'mono', letterSpacing: '-0.01em',
    getPropertyValue: function () { return '#17171a'; }
  };
};
global.window = { devicePixelRatio: 2, addEventListener: function () {} };

const { createRenderer } = require('../src/render.js');
const DRAFTS = { a: require('../src/draft-a.js'), c: require('../src/draft-c.js') };

// ---------------------------------------------------------------- buckets
const EDGES = [0, 5, 15, 30, 60, 120, 240, 480];

function stats(xs) {
  if (!xs.length) return null;
  const s = xs.slice().sort(function (a, b) { return a - b; });
  let sum = 0;
  for (const x of s) sum += x;
  return {
    n: s.length, mean: sum / s.length, p50: s[s.length >> 1],
    p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))], max: s[s.length - 1]
  };
}

function profile(draftId, seconds, wpm) {
  const D = DRAFTS[draftId];
  const els = {
    line: fakeEl('div'), caret: fakeEl('div'), caretLine: fakeEl('div'), track: fakeEl('div')
  };
  const r = createRenderer(els);
  r.measure();

  const run = D.createRun(7);
  const msPerKey = 60000 / (wpm * 5);
  const dt = 1 / 60, stepMs = 1000 / 60;

  const buckets = EDGES.slice(0, -1).map(function (lo, i) {
    return { lo: lo, hi: EDGES[i + 1], draw: [], tick: [], writes: [], frames: 0, w: { text: 0, className: 0, opacity: 0, transform: 0, created: 0 } };
  });

  let now = 1000, nextKey = 1000, frames = 0;
  const totalFrames = Math.round(seconds * 60);

  for (let f = 0; f < totalFrames && !run.ended; f++) {
    while (nextKey <= now && !run.ended) {
      // draft C commits to a line on the first character typed at a junction
      let ch;
      if (draftId === 'c' && run.branch && run.branch.committed === null) ch = run.branch.safeText[0];
      else ch = run.text[run.cursor];
      D.onKey(run, ch === undefined ? ' ' : ch, nextKey);
      nextKey += msPerKey;
    }
    if (run.ended) break;

    resetWrites();
    const t0 = process.hrtime.bigint();
    D.tick(run, now, dt);
    const t1 = process.hrtime.bigint();
    r.draw(run, D, dt);
    const t2 = process.hrtime.bigint();

    const elapsed = (now - (run.startedAt === null ? now : run.startedAt)) / 1000;
    let b = null;
    for (const cand of buckets) if (elapsed >= cand.lo && elapsed < cand.hi) { b = cand; break; }
    if (b) {
      b.tick.push(Number(t1 - t0) / 1000);
      b.draw.push(Number(t2 - t1) / 1000);
      b.frames++;
      let total = 0;
      for (const k in W) { b.w[k] += W[k]; total += W[k]; }
      b.writes.push(total);
    }

    now += stepMs;
    frames++;
  }

  return {
    draft: draftId, frames: frames, keys: run.total, chars: run.text.length,
    spans: els.line.children.length, ended: run.ended, reason: run.endReason,
    buckets: buckets.filter(function (b) { return b.frames > 0; }).map(function (b) {
      return {
        lo: b.lo, hi: b.hi, frames: b.frames, draw: stats(b.draw), tick: stats(b.tick),
        writes: stats(b.writes),
        perFrame: {
          text: b.w.text / b.frames, className: b.w.className / b.frames,
          opacity: b.w.opacity / b.frames, transform: b.w.transform / b.frames
        },
        created: b.w.created
      };
    })
  };
}

function table(res) {
  const L = [];
  L.push('draft ' + res.draft + '  -  ' + res.frames + ' frames, ' + res.keys + ' keystrokes, text ' +
    res.chars + ' chars, ' + res.spans + ' spans' + (res.ended ? '  (ended: ' + res.reason + ')' : ''));
  L.push('');
  L.push('  run time     frames   draw mean   draw p95 |  DOM writes per frame               worst');
  L.push('                                             |  text  opacity  class  xform  all   frame');
  L.push('  ' + '-'.repeat(88));
  const base = res.buckets[0];
  for (const b of res.buckets) {
    L.push('  ' + (b.lo + '-' + b.hi + 's').padEnd(11) +
      String(b.frames).padStart(7) +
      (b.draw.mean.toFixed(1) + 'us').padStart(12) +
      (b.draw.p95.toFixed(1) + 'us').padStart(11) + ' | ' +
      b.perFrame.text.toFixed(1).padStart(6) +
      b.perFrame.opacity.toFixed(1).padStart(9) +
      b.perFrame.className.toFixed(1).padStart(7) +
      b.perFrame.transform.toFixed(1).padStart(7) +
      b.writes.mean.toFixed(1).padStart(7) +
      b.writes.max.toFixed(0).padStart(8) +
      '   x' + (b.writes.mean / Math.max(0.01, base.writes.mean)).toFixed(2));
  }
  return L.join('\n');
}

function main(argv) {
  const opt = { draft: null, seconds: 240, wpm: 200, json: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--draft') opt.draft = argv[++i];
    else if (argv[i] === '--seconds') opt.seconds = Number(argv[++i]);
    else if (argv[i] === '--wpm') opt.wpm = Number(argv[++i]);
    else if (argv[i] === '--json') opt.json = true;
  }
  const ids = opt.draft ? [opt.draft] : ['a', 'c'];
  const out = ids.map(function (id) { return profile(id, opt.seconds, opt.wpm); });
  if (opt.json) console.log(JSON.stringify(out, null, 2));
  else console.log(out.map(table).join('\n\n'));
}

if (require.main === module) main(process.argv.slice(2));
module.exports = { profile: profile, stats: stats, fakeEl: fakeEl, EDGES: EDGES };
