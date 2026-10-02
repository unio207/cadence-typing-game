// DRAFT A - "drying ink"
// Pressure is legibility. The ink dries ahead of your caret at a rate the demand
// sets; fall below 94% of it and a hole opens in the page. You can only be killed
// by being wrong about something you could not see.
(function (root) {
  'use strict';

  const req = (typeof require !== 'undefined' && typeof module !== 'undefined');
  const m = req ? require('./metrics.js') : root.cadence;
  const s = req ? require('./survival.js') : root.cadence;
  const g = req ? require('./generator.js') : root.cadence;

  const MAX_STRIKES = 3;
  const STALL_MS = 2000;
  const LOOKAHEAD = 200;
  const CHUNK_WORDS = 40;

  const WARMUP_RATIO = 1.2;   // comfortably legible while the speed tracker fills

  const META = {
    id: 'a',
    name: 'drying ink',
    blurb: 'the ink dries ahead of your caret. keep up or type from memory.',
    pressure: 'legibility'
  };

  function topUp(run) {
    while (run.text.length < run.cursor + LOOKAHEAD) {
      const words = run.gen.words(run.chapterIndex, CHUNK_WORDS);
      run.text += (run.text.length ? ' ' : '') + words.join(' ');
    }
  }

  function createRun(seed) {
    const run = {
      draft: 'a', seed: seed, gen: g.createGenerator(seed),
      text: '', cursor: 0, marks: [], rhythmAt: [],
      combo: 0, maxCombo: 0, score: 0, strikes: 0, correct: 0, total: 0,
      v: 0, peakV: 0, ratio: 1, rhythm: 50, chapterIndex: 0,
      startedAt: null, lastKeyAt: null, nowMs: 0, intervals: [], blindSince: null,
      ended: false, endReason: null,
      demand: s.createDemand(), speed: m.createSpeed(), wpmTrace: []
    };
    topUp(run);
    return run;
  }

  function endRun(run, reason) { run.ended = true; run.endReason = reason; }

  function onKey(run, key, nowMs) {
    if (run.ended) return { correct: false, wasBlind: false, strike: false, ended: true };
    if (run.startedAt === null) run.startedAt = nowMs;
    run.nowMs = nowMs;

    const wasBlind = s.isBlind(run.ratio);
    const correct = key === run.text[run.cursor];

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
    run.cursor++;

    let strike = false;
    if (correct) {
      run.correct++;
      run.combo++;
      if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      run.score += m.pointsFor(run.v, run.rhythm, run.combo);
      run.blindSince = wasBlind ? nowMs : null;
    } else {
      run.combo = 0;
      if (wasBlind) {
        strike = true;
        run.strikes++;
        if (run.strikes >= MAX_STRIKES) endRun(run, 'strikes');
      }
    }

    topUp(run);
    return { correct: correct, wasBlind: wasBlind, strike: strike, ended: run.ended };
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

    if (s.isBlind(run.ratio)) {
      if (run.blindSince === null) run.blindSince = nowMs;
      else if (nowMs - run.blindSince >= STALL_MS) endRun(run, 'dried');
    } else {
      run.blindSince = null;
    }

    run.wpmTrace.push({ t: nowMs - run.startedAt, v: run.v, demand: run.demand.value });
    if (run.wpmTrace.length > 4000) run.wpmTrace.shift();
  }

  // how the renderer should ink the character `d` ahead of the caret
  function inkAhead(run, d) { return d >= s.W ? 1 : s.opacityAt(d, run.ratio); }

  function endLabel(run) {
    return run.endReason === 'strikes' ? 'three blind guesses' : 'the page dried out';
  }

  const api = {
    draftA: {
      META, createRun, onKey, tick, inkAhead, endLabel,
      MAX_STRIKES, STALL_MS, strikesOf: run => run.strikes, maxStrikes: () => MAX_STRIKES
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api.draftA;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
