// DRAFT C - "branches"
// Pressure is spatial: an edge advances from the left at the demand's pace, eating
// the page. Stay ahead of it. At every junction two lines are valid - the greedy
// one pays 1.6x but is longer, so taking it costs ground against the chaser. Your
// fingers choose: the first character you type commits you, because the generator
// guarantees the two lines diverge on their very first letter.
(function (root) {
  'use strict';

  const req = (typeof require !== 'undefined' && typeof module !== 'undefined');
  const m = req ? require('./metrics.js') : root.cadence;
  const s = req ? require('./survival.js') : root.cadence;
  const g = req ? require('./generator.js') : root.cadence;

  const MAX_TOUCHES = 3;
  const START_LEAD = 26;      // characters of head start
  const REPRIEVE = 16;        // characters the edge is pushed back when it catches you
  // Tunable so tools/balance.js can sweep them. The target these were chosen
  // against: an adaptive player (take the hard line only when the gap is big)
  // must out-score BOTH pure strategies. If always-safe or always-greedy wins,
  // the junction is not a decision and the mechanic is decoration.
  // Measured with tools/sweep-c.js across three typist profiles, 6 seeds each:
  //   always-safe    64,642
  //   always-greedy  66,654
  //   adaptive       70,600 - 72,300  (any gap threshold from 14 to 50)
  // Adaptive beats both pure strategies by 8-12%, so the junction is a real
  // decision. It is a SHALLOW one: the adaptive curve is nearly flat across
  // thresholds, so no particular policy is much better than another. A human has
  // information this sweep does not - it judges only the gap, never how awkward
  // the two lines actually look - so the ceiling is probably higher in practice.
  const TUNING = { greedyPayout: 2.0, edgeGreedyMult: 1.25 };

  // Taking your hands off the keys has to cost something promptly. At the demand's
  // ordinary pace the edge needs ~8s to cross a full lead and ~5s per reprieve, so
  // a full stop took 24s to end a run. The edge surges while you are idle instead:
  // the page catching up fast when you are not moving is the obvious reading.
  const IDLE_SURGE_AFTER_MS = 1200;
  const EDGE_IDLE_MULT = 4;

  // Why the edge quickens rather than the hard words simply being slower: in
  // character coordinates a longer branch costs nothing, because the edge has to
  // traverse those extra characters too - the gap closes at (yourCps - edgeCps)
  // regardless of path length. And measured against the typist model in
  // tools/typist.js, the denser greedy text is only ~5% slower to type, which a
  // 1.6x payout dwarfs. Without an explicit cost the greedy line is strictly
  // better and the choice is fake.

  const WARMUP_RATIO = 1.2;   // comfortably legible while the speed tracker fills

  const META = {
    id: 'c',
    name: 'branches',
    blurb: 'two valid lines. the hard one pays double. stay ahead of the edge.',
    pressure: 'a chaser'
  };

  function cps(demandWpm) { return (demandWpm * 5) / 60; }

  function newBranch(run) {
    const pair = run.gen.branchPair(run.chapterIndex);
    run.branch = {
      safeText: pair.safe.join(' ') + ' ',
      greedyText: pair.greedy.join(' ') + ' ',
      payout: TUNING.greedyPayout,
      committed: null
    };
  }

  function commit(run, which) {
    const b = run.branch;
    const chosen = which === 'greedy' ? b.greedyText : b.safeText;
    const mult = which === 'greedy' ? TUNING.greedyPayout : 1;
    b.committed = which;
    run.segmentGreedy = which === 'greedy';
    run.segmentStart = run.text.length;
    run.segmentEnd = run.text.length + chosen.length;
    for (let i = 0; i < chosen.length; i++) run.payoutAt.push(mult);
    run.text += chosen;
    if (which === 'greedy') run.greedyTaken++; else run.safeTaken++;
  }

  function createRun(seed) {
    const run = {
      draft: 'c', seed: seed, gen: g.createGenerator(seed),
      text: '', cursor: 0, marks: [], rhythmAt: [], payoutAt: [],
      branch: null, segmentStart: 0, segmentEnd: 0, segmentGreedy: false,
      safeTaken: 0, greedyTaken: 0,
      edge: -START_LEAD, touches: 0, closestGap: Infinity,
      combo: 0, maxCombo: 0, score: 0, correct: 0, total: 0,
      v: 0, peakV: 0, ratio: 1, rhythm: 50, chapterIndex: 0,
      startedAt: null, lastKeyAt: null, intervals: [],
      ended: false, endReason: null,
      demand: s.createDemand(), speed: m.createSpeed(), wpmTrace: []
    };
    newBranch(run);
    return run;
  }

  function endRun(run, reason) { run.ended = true; run.endReason = reason; }

  function onKey(run, key, nowMs) {
    if (run.ended) return { correct: false, ended: true, chose: null };
    if (run.startedAt === null) run.startedAt = nowMs;

    let chose = null;
    let correct;

    if (run.branch && run.branch.committed === null) {
      // the junction: one keystroke decides which line you are on
      if (key === run.branch.safeText[0]) { commit(run, 'safe'); chose = 'safe'; correct = true; }
      else if (key === run.branch.greedyText[0]) { commit(run, 'greedy'); chose = 'greedy'; correct = true; }
      else { commit(run, 'safe'); chose = 'safe'; correct = false; }
    } else {
      correct = key === run.text[run.cursor];
    }

    if (run.lastKeyAt !== null) {
      run.intervals.push(nowMs - run.lastKeyAt);
      if (run.intervals.length > 64) run.intervals.shift();
    }
    run.lastKeyAt = nowMs;

    m.pushKey(run.speed, nowMs);
    run.v = m.wpmAt(run.speed, nowMs);
    if (run.v > run.peakV) run.peakV = run.v;
    run.rhythm = m.rhythmOf(run.intervals);

    run.total++;
    run.marks[run.cursor] = correct ? 'ok' : 'err';
    run.rhythmAt[run.cursor] = run.rhythm;
    const payout = run.payoutAt[run.cursor] || 1;
    run.cursor++;

    if (correct) {
      run.correct++;
      run.combo++;
      if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      run.score += m.pointsFor(run.v, run.rhythm, run.combo) * payout;
    } else {
      run.combo = 0;
    }

    if (run.cursor >= run.segmentEnd) newBranch(run);

    return { correct: correct, ended: run.ended, chose: chose };
  }

  function tick(run, nowMs, dtSeconds) {
    if (run.ended || run.startedAt === null) return;

    run.v = m.wpmAt(run.speed, nowMs);

    // Until the speed tracker is warm, rolling wpm is meaningless - it reads near
    // zero however fast you are going. Pin the ratio somewhere comfortable and
    // keep the cold-start zeros out of the demand ratchet.
    if (!m.isWarm(run.speed)) {
      run.ratio = WARMUP_RATIO;
      s.stepDemand(run.demand, dtSeconds);
    } else {
      s.sampleSpeed(run.demand, run.v, nowMs);
      s.stepDemand(run.demand, dtSeconds);
      run.ratio = run.demand.value > 0 ? run.v / run.demand.value : 0;
    }

    const next = g.chapterAt(run.demand.value);
    if (next > run.chapterIndex) run.chapterIndex = next;

    const idle = run.lastKeyAt !== null && (nowMs - run.lastKeyAt) > IDLE_SURGE_AFTER_MS;
    let edgeRate = cps(run.demand.value) * (run.segmentGreedy ? TUNING.edgeGreedyMult : 1);
    if (idle) edgeRate *= EDGE_IDLE_MULT;
    run.edge += edgeRate * dtSeconds;

    const gap = run.cursor - run.edge;
    if (gap < run.closestGap) run.closestGap = gap;
    if (gap <= 0) {
      run.touches++;
      run.edge = run.cursor - REPRIEVE;
      if (run.touches >= MAX_TOUCHES) endRun(run, 'caught');
    }

    run.wpmTrace.push({ t: nowMs - run.startedAt, v: run.v, demand: run.demand.value });
    if (run.wpmTrace.length > 4000) run.wpmTrace.shift();
  }

  function gapOf(run) { return run.cursor - run.edge; }
  function inkAhead() { return 1; }
  function endLabel() { return 'the edge caught you'; }

  const api = {
    draftC: {
      META, createRun, onKey, tick, inkAhead, endLabel, gapOf,
      MAX_TOUCHES, START_LEAD, TUNING, EDGE_IDLE_MULT,
      strikesOf: run => run.touches, maxStrikes: () => MAX_TOUCHES
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api.draftC;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
