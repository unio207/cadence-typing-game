'use strict';
// Sweeps draft C's two balance constants looking for a setting where an adaptive
// player beats both always-safe and always-greedy.
const C = require('../src/draft-c.js');
const { createTypist } = require('./typist.js');
const { makeRng } = require('../src/generator.js');

function play(profile, seed, strategy, threshold) {
  const rng = makeRng(seed);
  const typist = createTypist(profile.wpm, profile.jitter, rng);
  const run = C.createRun(seed);
  let now = 1000, next = now;
  const dt = 1 / 120;
  while (!run.ended && (now - 1000) < 400000) {
    if (now >= next) {
      let key;
      if (C.atJunction(run)) {
        const greedy = strategy === 'greedy' ? true
          : strategy === 'safe' ? false
          : C.gapOf(run) > threshold;
        key = greedy ? run.branch.greedyText[0] : run.branch.safeText[0];
      } else key = run.text[run.cursor];
      C.onKey(run, key === undefined ? ' ' : key, now);
      next = now + typist.intervalFor(key);
    }
    C.tick(run, now, dt);
    now += dt * 1000;
  }
  return run.score;
}

const PROFILES = [
  { label: 'tight 150', wpm: 150, jitter: 0.10 },
  { label: 'normal 110', wpm: 110, jitter: 0.22 },
  { label: 'slow 70', wpm: 70, jitter: 0.25 }
];

function avg(strategy, threshold) {
  let total = 0, n = 0;
  for (const p of PROFILES) {
    for (let s = 0; s < 4; s++) { total += play(p, 2000 + s * 131, strategy, threshold); n++; }
  }
  return total / n;
}

console.log('payout  edgeMult  safe      greedy    adaptive  verdict');
const rows = [];
for (const payout of [1.6, 1.8, 2.0, 2.3]) {
  for (const mult of [1.08, 1.12, 1.16, 1.20, 1.25]) {
    C.TUNING.greedyPayout = payout;
    C.TUNING.edgeGreedyMult = mult;
    const safe = avg('safe');
    const greedy = avg('greedy');
    let best = -Infinity, bestT = null;
    for (const t of [10, 14, 18, 22, 26]) {
      const v = avg('adaptive', t);
      if (v > best) { best = v; bestT = t; }
    }
    const wins = best > safe * 1.04 && best > greedy * 1.04;
    rows.push({ payout, mult, safe, greedy, best, bestT, wins });
    console.log(
      String(payout).padEnd(8) + String(mult).padEnd(10) +
      Math.round(safe).toLocaleString().padStart(8) + '  ' +
      Math.round(greedy).toLocaleString().padStart(8) + '  ' +
      Math.round(best).toLocaleString().padStart(8) + '  ' +
      (wins ? 'ADAPTIVE WINS (gap>' + bestT + ')' : '')
    );
  }
}
const winners = rows.filter(r => r.wins).sort((a, b) =>
  (b.best / Math.max(b.safe, b.greedy)) - (a.best / Math.max(a.safe, a.greedy)));
console.log('\nbest setting:', winners[0] ? JSON.stringify(winners[0]) : 'none found');
