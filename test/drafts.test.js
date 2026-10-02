const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTypist } = require('../tools/typist.js');
const { makeRng } = require('../src/generator.js');

const DRAFTS = {
  a: require('../src/draft-a.js'),
  c: require('../src/draft-c.js')
};
const IDS = ['a', 'c'];

// Play a draft with a difficulty-aware typist that errs more when it cannot read.
function play(id, opts) {
  const D = DRAFTS[id];
  const o = Object.assign({ wpm: 120, jitter: 0.15, seed: 4242, maxSecs: 400, stopAfter: null }, opts);
  const rng = makeRng(o.seed);
  const typist = createTypist(o.wpm, o.jitter, rng);
  const run = D.createRun(o.seed);
  let now = 1000, next = now;
  const dt = 1 / 120;
  const marks = [];

  while (!run.ended && (now - 1000) < o.maxSecs * 1000) {
    const elapsed = (now - 1000) / 1000;
    const typing = o.stopAfter === null || elapsed < o.stopAfter;
    if (typing && now >= next) {
      let intended;
      if (id === 'c' && run.branch && run.branch.committed === null) {
        intended = (o.greedy ? run.branch.greedyText : run.branch.safeText)[0];
      } else {
        intended = run.text[run.cursor];
      }
      if (intended === undefined) intended = ' ';
      let key = intended;
      if (typist.errs(D.inkAhead(run, 0))) key = typist.wrongKey(intended);
      D.onKey(run, key, now);
      next = now + typist.intervalFor(intended);
    }
    D.tick(run, now, dt);
    marks.push({ t: elapsed, strikes: D.strikesOf(run) });
    now += dt * 1000;
  }
  return { run: run, secs: (now - 1000) / 1000, marks: marks, D: D };
}

// --- the cold-start bug: the opening of a run must be survivable ------------

for (const id of IDS) {
  test('draft ' + id + ': the first two seconds cost nothing, at any speed', () => {
    // Regression test. Rolling wpm over a fixed 3s window reads ~4 wpm at the
    // second keystroke of a run however fast you type, because it counts
    // characters you have not had time to type yet. That pinned draft A's ratio
    // at 0.1, blanked the page, and spent all three strikes in 0.6s.
    for (const wpm of [60, 90, 120, 160, 200]) {
      const r = play(id, { wpm: wpm, jitter: 0.1, maxSecs: 2 });
      const early = r.marks.filter(m => m.t <= 2.0);
      const worst = Math.max(...early.map(m => m.strikes));
      assert.equal(worst, 0,
        'draft ' + id + ' at ' + wpm + 'wpm lost ' + worst + ' within the first 2s');
      assert.equal(r.run.ended, false, 'draft ' + id + ' at ' + wpm + 'wpm ended inside 2s');
    }
  });
}

// --- every run must actually end --------------------------------------------

for (const id of IDS) {
  test('draft ' + id + ': every run ends, even for a very fast player', () => {
    // Regression test. With a synthetic typist that never errs, draft A ran
    // forever: strikes only come from mistakes and a correct keystroke resets the
    // stall timer, so a blind-but-lucky player was immortal.
    for (const wpm of [70, 110, 150, 200]) {
      const r = play(id, { wpm: wpm, jitter: 0.12, maxSecs: 400 });
      assert.equal(r.run.ended, true, 'draft ' + id + ' at ' + wpm + 'wpm survived 400s');
      assert.ok(r.secs > 20, 'draft ' + id + ' at ' + wpm + 'wpm died in only ' + r.secs + 's');
    }
  });

  test('draft ' + id + ': taking your hands off the keys ends it within 6s', () => {
    const r = play(id, { wpm: 130, jitter: 0.1, stopAfter: 8, maxSecs: 60 });
    assert.equal(r.run.ended, true);
    assert.ok(r.secs < 14, 'draft ' + id + ' took ' + r.secs.toFixed(1) + 's to notice a full stop');
  });

  test('draft ' + id + ': faster players last longer and score more', () => {
    const slow = play(id, { wpm: 75, jitter: 0.15 });
    const fast = play(id, { wpm: 165, jitter: 0.15 });
    assert.ok(fast.secs > slow.secs,
      'draft ' + id + ': fast lasted ' + fast.secs.toFixed(0) + 's, slow ' + slow.secs.toFixed(0) + 's');
    assert.ok(fast.run.score > slow.run.score * 1.5, 'draft ' + id + ': score did not scale with speed');
  });

  test('draft ' + id + ': rhythm separates two players of identical speed', () => {
    const tight = play(id, { wpm: 115, jitter: 0.06 });
    const ragged = play(id, { wpm: 115, jitter: 0.60 });
    assert.ok(tight.run.score > ragged.run.score * 1.15,
      'draft ' + id + ': tight ' + Math.round(tight.run.score) +
      ' vs ragged ' + Math.round(ragged.run.score) + ' - rhythm is not paying off');
  });
}

// --- draft A specifics ------------------------------------------------------

test('draft A: a typo on legible ink costs no strike, a blind one does', () => {
  const A = DRAFTS.a;
  const run = A.createRun(1);
  const typist = createTypist(170, 0, makeRng(9));
  let now = 1000;
  for (let i = 0; i < 40; i++) {
    A.onKey(run, run.text[run.cursor], now);
    A.tick(run, now, 1 / 120);
    now += typist.intervalFor('a');
  }
  assert.ok(run.ratio > 1.0, 'expected to be ahead, ratio ' + run.ratio);
  const wrong = run.text[run.cursor] === 'q' ? 'z' : 'q';
  assert.equal(A.onKey(run, wrong, now).strike, false);
  assert.equal(run.strikes, 0);

  // now fall behind until blind, then mistype three times
  for (let i = 0; i < 4000 && !A.inkAhead(run, 0) < 0.18; i++) { now += 10; A.tick(run, now, 0.01); }
  let guard = 0;
  while (!require('../src/survival.js').isBlind(run.ratio) && guard++ < 20000) {
    now += 10; A.tick(run, now, 0.01);
  }
  for (let i = 0; i < 3 && !run.ended; i++) {
    const w = run.text[run.cursor] === 'q' ? 'z' : 'q';
    assert.equal(A.onKey(run, w, now + i).strike, true);
  }
  assert.equal(run.ended, true);
  assert.equal(run.endReason, 'strikes');
});

test('draft A: the page never fades the newest characters', () => {
  const A = DRAFTS.a;
  const run = A.createRun(1);
  for (const ratio of [0, 0.5, 0.9, 1.0, 3.0]) {
    run.ratio = ratio;
    assert.equal(A.inkAhead(run, 40), 1, 'faded the window edge at ratio ' + ratio);
  }
});

// --- draft C specifics ------------------------------------------------------

test('draft C: one keystroke commits you to a line', () => {
  const C = DRAFTS.c;
  const run = C.createRun(5);
  assert.equal(run.branch.committed, null);
  assert.notEqual(run.branch.safeText[0], run.branch.greedyText[0]);
  C.onKey(run, run.branch.greedyText[0], 1000);
  assert.equal(run.branch.committed, 'greedy');
  assert.equal(run.greedyTaken, 1);
});

test('draft C: the greedy line pays double and quickens the edge', () => {
  const C = DRAFTS.c;
  assert.equal(C.TUNING.greedyPayout, 2.0);
  assert.equal(C.TUNING.edgeGreedyMult, 1.25);

  const safe = play('c', { wpm: 130, jitter: 0.12, greedy: false, seed: 77 });
  const greedy = play('c', { wpm: 130, jitter: 0.12, greedy: true, seed: 77 });
  // the explicit cost has to bite: always-greedy must die sooner than always-safe
  assert.ok(greedy.secs < safe.secs,
    'greedy lasted ' + greedy.secs.toFixed(0) + 's vs safe ' + safe.secs.toFixed(0) + 's');
});

test('draft C: the edge catching you three times ends the run', () => {
  const C = DRAFTS.c;
  const r = play('c', { wpm: 80, jitter: 0.2, greedy: true, maxSecs: 400 });
  assert.equal(r.run.ended, true);
  assert.equal(r.run.endReason, 'caught');
  assert.equal(r.run.touches, 3);
});

// --- elapsed time comes from the engine clock, not the wall clock ------------

for (const id of IDS) {
  test('draft ' + id + ': elapsed time is measured on the clock the run was driven with', () => {
    // Regression test. finishRun() used performance.now() while the engine ran on
    // whatever timestamps it was handed, so a stepped or replayed run reported a
    // duration from a different clock entirely - 0:05 and 1548 wpm in testing.
    const D = DRAFTS[id];
    const { elapsedMs } = require('../src/metrics.js');
    const run = D.createRun(3);
    assert.equal(elapsedMs(run), 0, 'a run that has not started must read zero');

    const start = 500000;                     // deliberately not near performance.now()
    let now = start;
    for (let i = 0; i < 120 && !run.ended; i++) {
      D.onKey(run, run.text[run.cursor], now);
      D.tick(run, now, 0.08);
      now += 80;
    }
    const expected = now - 80 - start;
    assert.ok(Math.abs(elapsedMs(run) - expected) < 100,
      'elapsed was ' + elapsedMs(run) + ', expected about ' + expected);
  });
}
