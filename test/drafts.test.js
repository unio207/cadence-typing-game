const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createTypist } = require('../tools/typist.js');
const { makeRng } = require('../src/generator.js');

const DRAFTS = { a: require('../src/draft-a.js') };
const IDS = ['a'];

// Play a draft with a difficulty-aware typist that errs more when it cannot read.
function play(id, opts) {
  const D = DRAFTS[id];
  const o = Object.assign({ wpm: 120, jitter: 0.15, seed: 4242, maxSecs: 400, stopAfter: null, goal: null, stepUp: true }, opts);
  const rng = makeRng(o.seed);
  const typist = createTypist(o.wpm, o.jitter, rng);
  const run = D.createRun(o.seed, (o.goal || o.stepUp === false) ? { goal: o.goal || undefined, stepUp: o.stepUp } : undefined);
  let now = 1000, next = now;
  const dt = 1 / 120;
  const marks = [];
  let firstFadeAt = null;        // when the ink under the caret is half gone

  while (!run.ended && (now - 1000) < o.maxSecs * 1000) {
    const elapsed = (now - 1000) / 1000;
    const typing = o.stopAfter === null || elapsed < o.stopAfter;
    if (typing && now >= next) {
      let intended;
      intended = run.text[run.cursor];
      if (intended === undefined) intended = ' ';
      let key = intended;
      if (typist.errs(D.inkAhead(run, 0))) key = typist.wrongKey(intended);
      D.onKey(run, key, now);
      next = now + typist.intervalFor(intended);
    }
    D.tick(run, now, dt);
    if (firstFadeAt === null && run.total >= 10 && D.inkAhead(run, 0) < 0.55) firstFadeAt = elapsed;
    marks.push({ t: elapsed, strikes: D.strikesOf(run) });
    now += dt * 1000;
  }
  return { run: run, secs: (now - 1000) / 1000, marks: marks, D: D, firstFadeAt: firstFadeAt };
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

// --- draft A: the goal pacer ------------------------------------------------

test('draft A: the ink is drying inside ten seconds, at every speed', () => {
  // The player's complaint, as a test. The ink used to stay near-crisp for 28-53s
  // because the demand paced itself off the player's own sustained speed and
  // converged BELOW the ratio at which anything is visible. It now ramps to a goal
  // the player chose, so the arrival time is the same at every speed.
  for (const wpm of [60, 90, 120, 160, 200]) {
    const r = play('a', { wpm: wpm, jitter: 0.12, goal: wpm, maxSecs: 12 });
    assert.ok(r.firstFadeAt !== null,
      'at ' + wpm + ' wpm on a goal of ' + wpm + ' the ink never dried inside 12s');
    assert.ok(r.firstFadeAt < 10,
      'at ' + wpm + ' wpm the ink dried at ' + r.firstFadeAt.toFixed(1) + 's');
  }
});

test('draft A: your goal is a line you can sit on, ten per cent under it is not', () => {
  // The ladder is pinned here. With it live, holding your goal PROMOTES you to the
  // next rung and that rung is what kills you - so a run that ends quickly proves
  // nothing about whether the goal itself was sittable. Those are two different
  // questions and they have to be measured apart.
  //
  // The goal is 112 for a nominal 120 wpm typist, and the gap is the point:
  // chapter texture swings real throughput by about 7% (123 wpm on 'open field',
  // 114 on 'long form' and 'one hand') while the survivable band is 6%. A goal set
  // to a typist's best chapter is unsurvivable by the time the run reaches its
  // worst one.
  const onGoal = play('a', { wpm: 120, jitter: 0.10, goal: 112, stepUp: false, maxSecs: 120 });
  const under = play('a', { wpm: 120, jitter: 0.10, goal: 126, stepUp: false, maxSecs: 120 });
  assert.ok(onGoal.secs > 60,
    'a player on their goal lasted only ' + onGoal.secs.toFixed(0) + 's');
  assert.ok(under.secs < 30,
    'a player 10% under their goal lasted ' + under.secs.toFixed(0) + 's');
});

test('draft A: reaching the goal steps the level up instead of ending the run', () => {
  const A = DRAFTS.a;
  const r = play('a', { wpm: 150, jitter: 0.08, goal: 70, maxSecs: 120 });
  const reached = A.reachedOf(r.run);
  assert.ok(reached.length >= 2, 'cleared only ' + reached.length + ' levels at 150 wpm on a 70 goal');
  assert.equal(reached[0].goal, 70);
  assert.ok(reached[0].ms > 9000, 'reached the goal after only ' + reached[0].ms + 'ms');
  assert.ok(A.goalOf(r.run) > 70, 'the goal did not climb: ' + A.goalOf(r.run));
});

test('draft A: the page never fades the newest characters', () => {
  const A = DRAFTS.a;
  const run = A.createRun(1);
  for (const ratio of [0, 0.5, 0.9, 1.0, 3.0]) {
    run.ratio = ratio;
    assert.equal(A.inkAhead(run, 40), 1, 'faded the window edge at ratio ' + ratio);
  }
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
