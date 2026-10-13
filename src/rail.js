(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // The rhythm rail. One mark per keystroke on a leftward-scrolling time axis.
  //
  // Three treatments were considered; this is the third.
  //
  //   1. REJECTED - the original comb: uniform 1px x 13px ticks centred on a
  //      hairline baseline, whole-rail opacity driven by rhythm. Spacing was the
  //      only signal, and spacing alone is the hardest thing in the world to read
  //      at a glance: at 180 wpm the ticks sit ~13px apart and the eye sees an
  //      even grey texture whether or not the run was even. The baseline ran
  //      through the ticks' middles, so it crossed every mark and read as noise.
  //
  //   2. REJECTED - an interval plot: a filled step/area shape whose height is
  //      each interval's duration. Legible, but it stops being one-mark-per-
  //      keystroke and becomes a chart, and a chart of a noisy signal is a
  //      decorative squiggle. Also it never rests: even perfect typing draws a
  //      wobbling band, which contradicts "playing well makes the page calm".
  //
  //   3. CHOSEN - deviation marks hanging from a ruled line. The rule sits at the
  //      top of the rail, so it reads as an underline of the text above it, and
  //      every mark hangs down from it. A mark's LENGTH encodes how far that
  //      keystroke's interval deviated from the local median - the same window
  //      the rhythm metric scores (metrics.js, 16 intervals). An even run draws a
  //      row of identical short stubs, a flat dotted edge under the line. A
  //      lurching run draws spikes exactly where the lurches were. Unevenness
  //      becomes a silhouette you can read in one glance instead of a spacing
  //      judgement, and the shared top edge gives every length the same baseline
  //      to be compared against, which centring would not.
  //
  //      Marks are 2px so they hold at 180 wpm, and fade with age toward the left
  //      so the newest few hundred milliseconds are the darkest thing in the rail
  //      and old marks leave without popping out of existence. A gentle global
  //      rhythm term remains, so a steady run reads darker overall - but rhythm's
  //      real expression is now the shape, not the ink.
  //
  // No red here: the rail never signals an error. Red stays reserved.
  // ---------------------------------------------------------------------------

  // 200 px/s. At 0.09 the marks sat ~6px apart at 160 wpm and read as a texture
  // rather than a cadence; this shows roughly the last six seconds, legibly.
  const PX_PER_MS = 0.2;
  const CAPACITY = 500;
  const WINDOW = 16;          // same interval window the rhythm metric uses
  const CLAMP_MS = 600;       // same per-interval clamp as the rhythm metric
  const STUB = 4;             // a keystroke bang on the local median
  const SPIKE = 17;           // a keystroke a full median late (or early)
  // |d/m - 1| at which a mark reaches full length. 0.35 is not a free parameter:
  // it is the same cv the rhythm metric saturates at (metrics.js clamps cv/0.35),
  // so a run that scores rhythm 0 is exactly a run whose rail is all spikes. At
  // the 0.9 first tried, +-15% jitter - which scores rhythm 74 - drew a mean mark
  // of 5.0px against the 4px stub, i.e. nothing you could see.
  const SPREAD = 0.35;

  function median(sorted) {
    const n = sorted.length;
    if (!n) return 0;
    const h = n >> 1;
    return n % 2 ? sorted[h] : (sorted[h - 1] + sorted[h]) / 2;
  }

  function createRail(canvas) {
    const ctx = canvas.getContext('2d');
    const marks = [];           // { t, dev } - dev in 0..1, computed once at mark()
    const intervals = [];       // trailing WINDOW intervals, for the local median
    const steps = [];           // times of goal step-ups, drawn as full-height ticks
    let w = 0, h = 0, ink = '#17171a', rule = '#e6e2d7';

    function readColours() {
      const st = getComputedStyle(document.documentElement);
      ink = (st.getPropertyValue('--ink') || '#17171a').trim();
      rule = (st.getPropertyValue('--rule') || '#e6e2d7').trim();
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readColours();
    }

    // Deviation is resolved here, not in draw(): it needs a median over a 16-wide
    // window, and doing that for ~400 visible marks every frame would be 6400
    // comparisons a frame for a number that can never change once written.
    function mark(nowMs) {
      let dev = 0;
      if (marks.length) {
        const d = Math.min(CLAMP_MS, Math.max(0, nowMs - marks[marks.length - 1].t));
        intervals.push(d);
        if (intervals.length > WINDOW) intervals.shift();
        // Below four intervals there is no meaningful "local median" yet, so the
        // opening keystrokes draw as even rather than as wild spikes.
        if (intervals.length >= 4) {
          const m = median(intervals.slice().sort((a, b) => a - b));
          if (m > 0) dev = Math.min(1, Math.abs(d / m - 1) / SPREAD);
        }
      }
      marks.push({ t: nowMs, dev: dev });
      if (marks.length > CAPACITY) marks.shift();
    }

    function step(nowMs) { steps.push(nowMs); }

    // Reading canvas.clientWidth every frame to spot a size change forces a
    // synchronous layout, and it lands immediately after the renderer has dirtied
    // its span window - the worst possible moment. A ResizeObserver delivers the
    // same information only when the size actually changes, including the moment
    // a canvas created inside a display:none section first gets a size, which is
    // the case that made the rail silently never paint at all.
    let dirty = true;
    if (typeof ResizeObserver === 'function') {
      new ResizeObserver(function () { dirty = true; }).observe(canvas);
    }

    function draw(nowMs, rhythm) {
      if (dirty || !w) {
        resize();
        dirty = false;
        if (typeof ResizeObserver !== 'function' && Math.abs(canvas.clientWidth - w) > 0.5) {
          resize();   // no observer: fall back to measuring each frame
        }
      }
      if (!w) return;
      ctx.clearRect(0, 0, w, h);

      // The ruled line the marks hang from. It is the shared edge that makes the
      // lengths comparable, which is why it is at the top and not through them.
      ctx.globalAlpha = 1;
      ctx.fillStyle = rule;
      ctx.fillRect(0, 0, w, 1);

      const steady = 0.55 + 0.45 * Math.max(0, Math.min(100, rhythm || 0)) / 100;
      const top = 2;
      ctx.fillStyle = ink;
      for (let i = marks.length - 1; i >= 0; i--) {
        const x = w - (nowMs - marks[i].t) * PX_PER_MS;
        if (x < -2) break;
        if (x > w) continue;
        const age = Math.pow(Math.max(0, x) / w, 0.8);      // newest = darkest
        ctx.globalAlpha = steady * (0.15 + 0.85 * age);
        const len = STUB + (SPIKE - STUB) * marks[i].dev;
        ctx.fillRect(Math.round(x) - 1, top, 2, Math.min(len, h - top));
      }

      // a cleared goal: one 1px tick through the rule and the marks, scrolling
      // and ageing with them, so the clear sits in the run's own timeline
      while (steps.length && w - (nowMs - steps[0]) * PX_PER_MS < -2) steps.shift();
      for (let i = 0; i < steps.length; i++) {
        const x = w - (nowMs - steps[i]) * PX_PER_MS;
        if (x > w) continue;
        ctx.globalAlpha = 0.15 + 0.85 * Math.pow(Math.max(0, x) / w, 0.8);
        ctx.fillRect(Math.round(x), 0, 1, h);
      }
      ctx.globalAlpha = 1;
    }

    function reset() { marks.length = 0; intervals.length = 0; steps.length = 0; }

    resize();
    return {
      resize: resize, mark: mark, step: step, draw: draw, reset: reset,
      readColours: readColours,
      // test seam: the drawn shape is entirely a function of these
      _marks: marks
    };
  }

  const api = { createRail };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
