// Runs every draft against a range of typist profiles and reports how long each
// run lasts and what it scores. This is how the drafts get compared - by
// measurement, not by feel.
'use strict';

const { createTypist, effectiveWpm } = require('./typist.js');
const { makeRng, createGenerator, chapterAt } = require('../src/generator.js');
const { isBlind } = require('../src/survival.js');
const { isWarm } = require('../src/metrics.js');

const DRAFTS = { a: require('../src/draft-a.js') };

const PROFILES = [
  { label: 'metronome 200', wpm: 200, jitter: 0.00 },
  { label: 'tight 150',     wpm: 150, jitter: 0.10 },
  { label: 'normal 110',    wpm: 110, jitter: 0.22 },
  { label: 'ragged 110',    wpm: 110, jitter: 0.55 },
  { label: 'slow 70',       wpm: 70,  jitter: 0.25 }
];

// strategy: for draft C only - 'safe' | 'greedy' | 'adaptive'
// goal: for draft A only - the wpm the player is pacing against
function play(draft, profile, seed, strategy, maxSecs, goal) {
  const D = DRAFTS[draft];
  const rng = makeRng(seed);
  const typist = createTypist(profile.wpm, profile.jitter, rng);
  const run = D.createRun(seed, { goal: goal });

  let now = 1000;
  let next = now;
  const dt = 1 / 120;
  // When the pressure arrives, which for draft A is the whole question: `fade` is
  // the first moment the ink under the caret is half gone, `hole` the first moment
  // the page is actually unreadable there. Reported because the pacing this
  // replaced put them at 28-53s and 45-98s - most of a run with nothing happening.
  let fadeAt = null, holeAt = null, strikeAt = null;
  // the mean of the rolling wpm the game itself judges you on - keystrokes, not
  // correct keystrokes, which is what `ratio` is computed from
  let vSum = 0, vN = 0;

  while (!run.ended && (now - 1000) < maxSecs * 1000) {
    if (now >= next) {
      let key;
      if (draft === 'c' && D.atJunction(run)) {
        let takeGreedy;
        if (strategy === 'greedy') takeGreedy = true;
        else if (strategy === 'safe') takeGreedy = false;
        else takeGreedy = D.gapOf(run) > 18;          // adaptive: only when safe to
        key = takeGreedy ? run.branch.greedyText[0] : run.branch.safeText[0];
      } else {
        key = run.text[run.cursor];
      }
      if (key === undefined) key = ' ';

      // a player cannot read what has dried off the page, so legibility at the
      // caret drives how often this typist is wrong
      const legibility = D.inkAhead(run, 0);
      const intended = key;
      if (typist.errs(legibility)) key = typist.wrongKey(intended);

      D.onKey(run, key, now);
      next = now + typist.intervalFor(intended);
    }
    D.tick(run, now, dt);
    const elapsed = (now - 1000) / 1000;
    if (fadeAt === null && isWarm(run.speed) && D.inkAhead(run, 0) < 0.55) fadeAt = elapsed;
    if (holeAt === null && isBlind(run.ratio)) holeAt = elapsed;
    if (strikeAt === null && draft === 'a' && run.strikes > 0) strikeAt = elapsed;
    if (isWarm(run.speed)) { vSum += run.v; vN++; }
    now += dt * 1000;
  }

  const ms = now - 1000;
  return {
    secs: ms / 1000,
    score: Math.round(run.score),
    reason: run.endReason || 'survived',
    fadeAt: fadeAt, holeAt: holeAt, strikeAt: strikeAt,
    wpm: vN ? vSum / vN : 0,
    reached: draft === 'a' ? run.demand.reached.length : 0,
    firstReachAt: draft === 'a' && run.demand.reached.length
      ? run.demand.reached[0].ms / 1000 : null,
    topGoal: draft === 'a' ? run.demand.goal : 0,
    extra: draft === 'c'
      ? 'safe ' + run.safeTaken + ' greedy ' + run.greedyTaken + ' touches ' + run.touches
      : 'strikes ' + run.strikes + ' combo ' + run.maxCombo
  };
}

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function secsOf(runs, key) {
  const xs = runs.map(r => r[key]).filter(x => x !== null);
  return xs.length ? mean(xs).toFixed(0) + 's' : '-';
}

function report(draft, strategy) {
  const D = DRAFTS[draft];
  const title = draft.toUpperCase() + ' - ' + D.META.name +
    (strategy ? ' [' + strategy + ']' : '') + '   (pressure: ' + D.META.pressure + ')';
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
  for (const p of PROFILES) {
    const runs = [];
    for (let s = 0; s < 5; s++) runs.push(play(draft, p, 1000 + s * 77, strategy, 400));
    console.log(
      '  ' + p.label.padEnd(15) +
      String(mean(runs.map(r => r.secs)).toFixed(0) + 's').padStart(5) +
      '   ' + Math.round(mean(runs.map(r => r.score))).toLocaleString().padStart(9) +
      '   ' + runs[0].reason.padEnd(9) +
      '   ' + runs[0].extra
    );
  }
}

// Draft A is paced against a goal the player chose, so the only question that
// matters is how a run goes relative to that goal.
//
// The goals have to be set against each typist's MEASURED speed, not its nominal
// one. A typist's nominal wpm is its speed on easy alternating text; on real
// generated text the hand and finger transitions cost it 10-12%, so "metronome
// 200" actually types at 178. Banding off the nominal number silently made every
// "on goal" row a 10%-under-goal row, and they all died in 10-23s.
const MAX_SECS_A = 240;

// A typist's speed depends on WHAT it is typing, and in draft A what you type is
// set by the goal: chapters key off the goal, so a 190 goal means the top-row
// texture and a 55 goal means alternating hands. So the goal for a band has to be
// solved for, not assumed - two passes is plenty, since the chapter boundaries are
// coarse. Without this every "on goal" row was really a 10%-under-goal row: a
// nominal 200 wpm typist types generated text at 178 and thin-air text at 150.
function sampleText(chapterIndex) {
  const gen = createGenerator(4242);
  return gen.words(chapterIndex, 120).join(' ');
}

function goalFor(profile, factor) {
  let goal = profile.wpm;
  for (let pass = 0; pass < 2; pass++) {
    const ch = chapterAt(goal);
    goal = effectiveWpm(sampleText(ch), profile.wpm) * factor;
  }
  return Math.round(goal);
}

function reportA() {
  const D = DRAFTS.a;
  const title = 'A - ' + D.META.name + '   (pressure: legibility, paced by a goal wpm)';
  console.log('\n' + title);
  console.log('-'.repeat(title.length));
  console.log('  typist                     goal    wpm   fade    hole    strike  reached   ends       ending');
  for (const p of PROFILES) {
    for (const band of [
      { label: 'on goal',   factor: 1.00 },
      { label: '10% under', factor: 1.10 },   // goal above the player: they are under it
      { label: '10% over',  factor: 0.90 }
    ]) {
      const goal = goalFor(p, band.factor);
      const runs = [];
      for (let s = 0; s < 5; s++) runs.push(play('a', p, 1000 + s * 77, null, MAX_SECS_A, goal));
      const reached = mean(runs.map(r => r.reached));
      console.log(
        '  ' + (p.label + ' ' + band.label).padEnd(26) + '  ' +
        String(goal).padStart(4) +
        String(Math.round(mean(runs.map(r => r.wpm)))).padStart(7) +
        ('  ' + secsOf(runs, 'fadeAt')).padEnd(8) +
        secsOf(runs, 'holeAt').padEnd(8) +
        secsOf(runs, 'strikeAt').padEnd(8) +
        (reached.toFixed(1) + (reached ? ' @' + secsOf(runs, 'firstReachAt') : '')).padEnd(10) +
        String(mean(runs.map(r => r.secs)).toFixed(0) + 's').padStart(5) + '   ' +
        runs[0].reason.padEnd(9) +
        '  ' + Math.round(mean(runs.map(r => r.score))).toLocaleString().padStart(8));
    }
  }
  console.log('  (ends at ' + MAX_SECS_A + 's = survived; `reached` is levels cleared in a run)');
}

const which = process.argv[2];
if (!which || which === 'a') reportA();
