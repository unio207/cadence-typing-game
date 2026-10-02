// Guards the render path against progressive degradation - the shape of bug a
// player reports as "smooth at first, then choppy after a few seconds".
//
// It measures with tools/profile.js rather than reimplementing a harness, and it
// asserts on DOM WRITE VOLUME, not on wall-clock time. Wall-clock is the wrong
// instrument twice over: under the DOM shim a style write is a plain property set,
// so the shim cannot price what a browser charges for; and timings on a loaded CI
// box are noisy enough that any threshold tight enough to catch a real regression
// would be flaky. Write counts are deterministic and are what the browser's layout
// and paint cost is actually proportional to.
//
// The regression this exists for: the window used to start at exactly
// `cursor - WINDOW_BEHIND`, so once the cursor passed 70 characters it slid one
// character per keystroke and rewrote the textContent of all 180 spans plus all
// 180 caret-line twins on every frame the cursor moved - 360 text-node writes a
// frame, with the cliff a few seconds into every run. The timings barely moved;
// the write count went up more than four-fold.
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Requiring the profiler installs the DOM shim on the globals, which is why this
// file has no shim of its own. Each test file runs in its own process.
const { profile } = require('../tools/profile.js');

const SECONDS = 120;
const WPM = 200;

// Amortised budget: the window is 180 spans and rebasing it rewrites every span and
// its twin, so one rebase costs 360 text writes. Rebasing every REBASE=24 characters
// amortises to ~15 per character. 40 leaves room for a smaller REBASE or a wider
// window while still being nine times under the 360-per-character regression.
// The ring buffer writes one span per character entering the window, so the real
// figure is ~0.5 a frame. 3 leaves room without tolerating a sliding window, which
// measured 337 per character.
const TEXT_WRITES_PER_CHAR = 3;

// The number that actually matters for "it randomly turns choppy". A mean can look
// fine while one frame in every two seconds does ten times the work: the previous
// renderer averaged 45 writes a frame but spiked to 433 every 24 characters when
// the window rebased, and a 433-write frame is a dropped frame.
//
// This has to be a RATIO, not an absolute. The mean legitimately rises later in a
// run because the ink is genuinely moving by then, so an absolute budget tuned to
// the quiet early buckets fails on honest work (measured: a 48-write worst frame
// against a 29.7 mean, which is 1.6x and perfectly smooth). A burst is 10x.
// Bucket 0 is excluded: it contains the one-time build of the 180-span pool.
const WORST_FRAME_RATIO = 3;
const WORST_FRAME_FLOOR = 40;   // never fail on tiny means

for (const id of ['a']) {
  test('draft ' + id + ': the renderer does not slide the whole span window per character', () => {
    const res = profile(id, SECONDS, WPM);
    let text = 0, frames = 0;
    for (const b of res.buckets) { text += b.perFrame.text * b.frames; frames += b.frames; }

    assert.ok(res.keys > 500, 'the run was too short to measure: ' + res.keys + ' keystrokes');
    const perChar = text / res.keys;
    assert.ok(perChar <= TEXT_WRITES_PER_CHAR,
      'textContent writes per character typed was ' + perChar.toFixed(1) +
      ', budget ' + TEXT_WRITES_PER_CHAR + ' (the whole window is being rewritten as it slides)');
  });

  test('draft ' + id + ': per-frame render cost does not grow over a run', () => {
    const res = profile(id, SECONDS, WPM);
    const buckets = res.buckets;
    assert.ok(buckets.length >= 4, 'not enough run time to bucket: ' + buckets.length);

    const firstB = buckets[0];
    const lastB = buckets[buckets.length - 1];

    // Writes. The step that remains between the opening seconds and the rest of the
    // run is inline opacity, which is information: during warm-up the ratio is pinned
    // so the ink does not change, and after it the ink genuinely moves every frame.
    // 6x is generous against that and still well under the 4.2x -> far worse that a
    // sliding window produces on top of it.
    const wGrowth = lastB.writes.mean / Math.max(1, firstB.writes.mean);
    assert.ok(wGrowth <= 6,
      'DOM writes per frame grew ' + wGrowth.toFixed(2) + 'x from the ' +
      firstB.lo + '-' + firstB.hi + 's bucket (' + firstB.writes.mean.toFixed(1) + ') to ' +
      lastB.lo + '-' + lastB.hi + 's (' + lastB.writes.mean.toFixed(1) + ')');

    // Time. Deliberately loose - this is here to catch work that is O(run length),
    // which shows up as a multiple, not as a few percent.
    const tGrowth = lastB.draw.mean / firstB.draw.mean;
    assert.ok(tGrowth <= 3,
      'mean draw() cost grew ' + tGrowth.toFixed(2) + 'x from ' + firstB.draw.mean.toFixed(1) +
      'us to ' + lastB.draw.mean.toFixed(1) + 'us over the run');

    // No bucket may be an outlier either: a cost that grows and then saturates is
    // still a cost that grows.
    for (const b of buckets) {
      assert.ok(b.writes.mean / Math.max(1, firstB.writes.mean) <= 6,
        'bucket ' + b.lo + '-' + b.hi + 's writes ' + b.writes.mean.toFixed(1) +
        ' per frame against ' + firstB.writes.mean.toFixed(1) + ' at the start');
    }
  });

  test('draft ' + id + ': no single frame does a burst of work', () => {
    const res = profile(id, SECONDS, WPM);
    for (let i = 1; i < res.buckets.length; i++) {
      const b = res.buckets[i];
      const budget = Math.max(WORST_FRAME_FLOOR, b.writes.mean * WORST_FRAME_RATIO);
      assert.ok(b.writes.max <= budget,
        'worst frame in the ' + b.lo + '-' + b.hi + 's bucket did ' + b.writes.max +
        ' DOM writes against a ' + b.writes.mean.toFixed(1) + ' mean (' +
        (b.writes.max / Math.max(1, b.writes.mean)).toFixed(1) + 'x) - that is a hitch');
    }
  });

  test('draft ' + id + ': the span pool is allocated once and never grows', () => {
    const res = profile(id, SECONDS, WPM);
    assert.equal(res.spans, 180, 'span pool was ' + res.spans + ', expected the full 180 window');
    // Every span is created on the first frame, so no later bucket may create any.
    for (let i = 1; i < res.buckets.length; i++) {
      assert.equal(res.buckets[i].created, 0,
        res.buckets[i].created + ' nodes created during the ' + res.buckets[i].lo + '-' +
        res.buckets[i].hi + 's bucket');
    }
  });
}
