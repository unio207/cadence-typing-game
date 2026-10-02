// Runs every draft against a range of typist profiles and reports how long each
// run lasts and what it scores. This is how the drafts get compared - by
// measurement, not by feel.
'use strict';

const { createTypist } = require('./typist.js');
const { makeRng } = require('../src/generator.js');

const DRAFTS = {
  a: require('../src/draft-a.js'),
  c: require('../src/draft-c.js')
};

const PROFILES = [
  { label: 'metronome 200', wpm: 200, jitter: 0.00 },
  { label: 'tight 150',     wpm: 150, jitter: 0.10 },
  { label: 'normal 110',    wpm: 110, jitter: 0.22 },
  { label: 'ragged 110',    wpm: 110, jitter: 0.55 },
  { label: 'slow 70',       wpm: 70,  jitter: 0.25 }
];

// strategy: for draft C only - 'safe' | 'greedy' | 'adaptive'
function play(draft, profile, seed, strategy, maxSecs) {
  const D = DRAFTS[draft];
  const rng = makeRng(seed);
  const typist = createTypist(profile.wpm, profile.jitter, rng);
  const run = D.createRun(seed);

  let now = 1000;
  let next = now;
  const dt = 1 / 120;

  while (!run.ended && (now - 1000) < maxSecs * 1000) {
    if (now >= next) {
      let key;
      if (draft === 'c' && run.branch && run.branch.committed === null) {
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
    now += dt * 1000;
  }

  return {
    secs: (now - 1000) / 1000,
    score: Math.round(run.score),
    reason: run.endReason || 'survived',
    extra: draft === 'c'
      ? 'safe ' + run.safeTaken + ' greedy ' + run.greedyTaken + ' touches ' + run.touches
      : 'strikes ' + run.strikes + ' combo ' + run.maxCombo
  };
}

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }

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

const which = process.argv[2];
if (!which || which === 'a') report('a');
if (!which || which === 'c') { report('c', 'safe'); report('c', 'greedy'); report('c', 'adaptive'); }
