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
  const o = Object.assign({ wpm: 120, jitter: 0.15, seed: 4242, maxSecs: 400, stopAfter: null, goal: null }, opts);
  const rng = makeRng(o.seed);
  const typist = createTypist(o.wpm, o.jitter, rng);
  const run = D.createRun(o.seed, o.goal ? { goal: o.goal } : undefined);
  let now = 1000, next = now;
  const dt = 1 / 120;
  const marks = [];
  let firstFadeAt = null;        // when the ink under the caret is half gone

  while (!run.ended && (now - 1000) < o.maxSecs * 1000) {
    const elapsed = (now - 1000) / 1000;
    const typing = o.stopAfter === null || elapsed < o.stopAfter;
    if (typing && now >= next) {
      let intended;
      if (id === 'c' && D.atJunction(run)) {
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

test('draft A: typing at your goal is survivable, ten per cent under it is not', () => {
  // The pacer only works if the goal is a line you can sit on. Measured: a steady
  // player on their goal lasts minutes, while the same player under a goal 10%
  // above them is reading from memory within seconds and gone inside 25.
  const onGoal = play('a', { wpm: 120, jitter: 0.10, goal: 118, maxSecs: 120 });
  const under = play('a', { wpm: 120, jitter: 0.10, goal: 132, maxSecs: 120 });
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

// --- draft C specifics ------------------------------------------------------

test('draft C: one keystroke commits you to a line', () => {
  const C = DRAFTS.c;
  const run = C.createRun(5);
  let now = 1000;
  while (!C.atJunction(run)) { C.onKey(run, run.text[run.cursor], now); now += 70; }
  const branch = run.branch;
  assert.equal(branch.committed, null);
  assert.notEqual(branch.safeText[0], branch.greedyText[0]);
  C.onKey(run, branch.greedyText[0], now);
  assert.equal(branch.committed, 'greedy');
  assert.equal(run.greedyTaken, 1);
});

// --- draft C: read-ahead ----------------------------------------------------

test('draft C: both lines are on screen a whole segment before the junction', () => {
  // Regression test for the flaw the player reported: the two candidate lines used
  // to appear at the instant the cursor reached the junction, so you had to stop,
  // read both and choose. The junction must now be open - and the page must
  // already run past it - well before your fingers arrive.
  const C = DRAFTS.c;
  const run = C.createRun(11);
  let now = 1000;
  const leads = [];
  for (let i = 0; i < 600 && !run.ended; i++) {
    assert.notEqual(run.branch, null, 'no junction open at cursor ' + run.cursor);
    assert.equal(run.branch.committed, null, 'the open junction was already resolved');
    assert.ok(run.branch.at >= run.cursor,
      'the cursor ran past an unresolved junction by ' + (run.cursor - run.branch.at));
    // the page must never end at or before the junction: there is always a
    // provisional continuation to read, so the line never stalls.
    assert.ok(run.text.length > run.branch.at,
      'the page ended at the junction (length ' + run.text.length + ')');
    const res = C.onKey(run, run.text[run.cursor], now);
    // a junction just resolved: the next one is already open, and its run-up is
    // how much warning the player gets.
    if (res.chose !== null) leads.push(run.branch.at - run.cursor);
    C.tick(run, now, 1 / 60);
    now += 70;
  }
  assert.ok(leads.length > 5, 'passed only ' + leads.length + ' junctions');
  // the commit keystroke itself has already been struck, so the lead is one less
  // than draft C's MIN_RUNUP
  const minLead = Math.min.apply(null, leads);
  assert.ok(minLead >= 17,
    'the shortest run-up to a junction was only ' + minLead + ' characters');
});

test('draft C: taking the greedy line never rewrites anything already typed', () => {
  const C = DRAFTS.c;
  const run = C.createRun(23);
  let now = 1000;
  while (!C.atJunction(run)) { C.onKey(run, run.text[run.cursor], now); now += 70; }
  const typed = run.text.slice(0, run.cursor);
  const greedy = run.branch.greedyText;
  C.onKey(run, greedy[0], now);
  assert.equal(run.text.slice(0, typed.length), typed, 'the committed page changed');
  assert.equal(run.text.slice(typed.length, typed.length + greedy.length), greedy,
    'the greedy line is not on the page after committing to it');
  // and the payout follows the swap, character for character
  for (let i = 0; i < greedy.length; i++) {
    assert.equal(run.payoutAt[typed.length + i], C.TUNING.greedyPayout,
      'payout at ' + i + ' did not follow the greedy swap');
  }
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
