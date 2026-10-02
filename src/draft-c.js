// DRAFT C - "branches"
// Pressure is spatial: an edge advances from the left at the demand's pace, eating
// the page. Stay ahead of it. At every junction two lines are valid - the greedy
// one pays 1.6x but is longer, so taking it costs ground against the chaser. Your
// fingers choose: the first character you type commits you, because the generator
// guarantees the two lines diverge on their very first letter.
//
// The junction is materialised a WHOLE SEGMENT before the cursor reaches it, and
// the safe line is provisionally appended to the page as it is. Both of those are
// load-bearing; see newBranch() and resolve() for why.
(function (root) {
  'use strict';

  const req = (typeof require !== 'undefined' && typeof module !== 'undefined');
  const m = req ? require('./metrics.js') : root.cadence;
  const s = req ? require('./survival.js') : root.cadence;
  const g = req ? require('./generator.js') : root.cadence;

  const MAX_TOUCHES = 3;
  const START_LEAD = 26;      // characters of head start
  // The edge must stay on screen to be a threat. Outpacing the demand let the gap
  // grow without bound - it reached 116 characters in testing, pushing the edge
  // off the left of the stage entirely, so the pressure simply vanished for any
  // competent player. Capping it also keeps the junction a real decision: a greedy
  // segment costs ~7 characters of ground, so the cap is about six of them.
  // 40 also fits on screen behind draft C's caret, which sits at 62% for this reason.
  const MAX_GAP = 40;
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

  // The least run-up a junction may have, in characters. The run-up IS the segment
  // you are typing when the junction opens, and in the short-word chapters a
  // three-word segment is only 11 characters - under a second at 150 wpm, which is
  // not enough time to read two lines and choose. Short segments are padded with
  // plain words (no payout, no fork) until the run-up is at least this long.
  const MIN_RUNUP = 18;

  function appendSegment(run, text, mult) {
    for (let i = 0; i < text.length; i++) run.payoutAt.push(mult);
    run.text += text;
  }

  // Opens the NEXT junction, a whole segment ahead of the cursor.
  //
  // This is the fix for the flaw the player reported: "it ruins the rhythm since
  // you have to stop and look at each sentence since they show up only after you
  // complete the previous one." newBranch() used to be called from onKey the
  // instant the cursor reached segmentEnd, so the two candidate lines appeared
  // under your fingers with zero lead - you had to stop, read both, and choose.
  // The choice is meant to be one you have ALREADY made by the time your fingers
  // arrive, which means the lines have to be on screen while you finish the
  // current segment. So: the junction is opened as soon as the previous one is
  // resolved, which gives a lead of one full segment (18-22 characters, 1.4-2.4s
  // at 110-200 wpm) and leaves both lines on screen continuously.
  //
  // The safe line is also appended to the page immediately, as a PROVISIONAL
  // continuation. Without that the page simply ends at the junction while you are
  // still typing toward it - a hole in the line and a dead stop for the eye, which
  // is the stall this change exists to remove. Reaching for the greedy line
  // rewrites the page from the junction onward (see resolve), and since nothing
  // past the junction has been typed yet, nothing typed is ever rewritten.
  function newBranch(run) {
    const pair = run.gen.branchPair(run.chapterIndex);
    const safeText = pair.safe.join(' ') + ' ';
    run.branch = {
      safeText: safeText,
      greedyText: pair.greedy.join(' ') + ' ',
      payout: TUNING.greedyPayout,
      at: run.text.length,          // where the junction sits in the page
      committed: null
    };
    appendSegment(run, safeText, 1);
  }

  // The cursor has arrived at the junction and one key has decided it.
  function resolve(run, which) {
    const b = run.branch;
    b.committed = which;
    if (which === 'greedy') {
      // swap the provisional safe line out for the greedy one. the cursor is
      // exactly at b.at, so this never touches a character already struck.
      run.text = run.text.slice(0, b.at);
      run.payoutAt.length = b.at;
      appendSegment(run, b.greedyText, TUNING.greedyPayout);
      run.greedyTaken++;
    } else {
      run.safeTaken++;
    }
    run.segmentGreedy = which === 'greedy';
    run.segmentStart = b.at;
    while (run.text.length - b.at < MIN_RUNUP) {
      appendSegment(run, run.gen.words(run.chapterIndex, 1)[0] + ' ', 1);
    }
    run.segmentEnd = run.text.length;
    newBranch(run);                 // open the next one immediately: read-ahead
  }

  // true when the next keystroke is the one that commits. Callers that choose a
  // line (the shell's replay, tools/balance.js, tools/sweep-c.js) ask this rather
  // than inspecting the branch, because "the junction is open" and "the cursor is
  // standing on it" are now two different things - which is the whole point.
  function atJunction(run) {
    return run.branch !== null && run.branch.committed === null && run.cursor === run.branch.at;
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
      startedAt: null, lastKeyAt: null, nowMs: 0, intervals: [],
      ended: false, endReason: null,
      demand: s.createDemand(), speed: m.createSpeed()
    };
    // open on a plain committed segment so the FIRST junction has read-ahead too,
    // rather than greeting the player with a choice on keystroke one.
    const opening = run.gen.words(0, 3).join(' ') + ' ';
    appendSegment(run, opening, 1);
    run.segmentEnd = run.text.length;
    newBranch(run);
    return run;
  }

  function endRun(run, reason) { run.ended = true; run.endReason = reason; }

  function onKey(run, key, nowMs) {
    if (run.ended) return { correct: false, ended: true, chose: null };
    if (run.startedAt === null) run.startedAt = nowMs;
    run.nowMs = nowMs;

    let chose = null;
    let correct;

    if (atJunction(run)) {
      // one keystroke decides which line you are on. a wrong key here is an
      // ordinary error on the line you were already on, not a third outcome.
      if (key === run.branch.greedyText[0]) { resolve(run, 'greedy'); chose = 'greedy'; correct = true; }
      else { correct = key === run.text[run.cursor]; resolve(run, 'safe'); chose = 'safe'; }
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

    return { correct: correct, ended: run.ended, chose: chose };
  }

  function tick(run, nowMs, dtSeconds) {
    if (run.ended || run.startedAt === null) return;
    run.nowMs = nowMs;

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

    if (run.cursor - run.edge > MAX_GAP) run.edge = run.cursor - MAX_GAP;

    const gap = run.cursor - run.edge;
    if (gap < run.closestGap) run.closestGap = gap;
    if (gap <= 0) {
      run.touches++;
      run.edge = run.cursor - REPRIEVE;
      if (run.touches >= MAX_TOUCHES) endRun(run, 'caught');
    }

  }

  function gapOf(run) { return run.cursor - run.edge; }
  function inkAhead() { return 1; }
  function endLabel() { return 'the edge caught you'; }

  const api = {
    draftC: {
      META, createRun, onKey, tick, inkAhead, endLabel, gapOf, atJunction,
      MAX_TOUCHES, START_LEAD, MAX_GAP, TUNING, EDGE_IDLE_MULT,
      strikesOf: run => run.touches, maxStrikes: () => MAX_TOUCHES
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api.draftC;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
