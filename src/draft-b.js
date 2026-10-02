// DRAFT B - "the lock"
// Pressure is temporal. Text comes in three-word bars, each with a deadline set by
// the demand. Finish a bar clean and in rhythm and it LOCKS - banked at double and
// untakeable. Miss the deadline and the bar is skipped like a missed note, and
// three missed bars end the run. Full legibility throughout: nothing fades.
(function (root) {
  'use strict';

  const req = (typeof require !== 'undefined' && typeof module !== 'undefined');
  const m = req ? require('./metrics.js') : root.cadence;
  const s = req ? require('./survival.js') : root.cadence;
  const g = req ? require('./generator.js') : root.cadence;

  const MAX_DROPS = 3;
  const WORDS_PER_BAR = 3;
  const SLACK = 1.15;          // grace on each bar's deadline
  const LOCK_RHYTHM = 70;      // rhythm needed at bar end to lock it
  const LOCK_BONUS = 2.0;
  const BARS_AHEAD = 12;
  const IDLE_DROP_MS = 1500;   // hands off the keys drops the bar at once

  const WARMUP_RATIO = 1.2;   // comfortably legible while the speed tracker fills

  const META = {
    id: 'b',
    name: 'the lock',
    blurb: 'three-word bars on a deadline. hold the rhythm and they lock.',
    pressure: 'deadlines'
  };

  function barCharsPerSecond(demandWpm) { return (demandWpm * 5) / 60; }

  function topUp(run) {
    while (run.bars.length < run.barIndex + BARS_AHEAD) {
      const words = run.gen.phrases(run.chapterIndex, 1, WORDS_PER_BAR)[0];
      const text = words.join(' ') + ' ';
      const start = run.text.length;
      run.bars.push({
        words: words, text: text, start: start, end: start + text.length,
        state: 'pending', deadlineAt: null, allowedMs: 0, errors: 0, pot: 0
      });
      run.text += text;
    }
  }

  function activate(run, nowMs) {
    const bar = run.bars[run.barIndex];
    if (!bar || bar.state !== 'pending') return;
    const cps = barCharsPerSecond(run.demand.value);
    bar.allowedMs = (bar.text.length / cps) * 1000 * SLACK;
    bar.deadlineAt = nowMs + bar.allowedMs;
    bar.state = 'active';
  }

  function createRun(seed) {
    const run = {
      draft: 'b', seed: seed, gen: g.createGenerator(seed),
      text: '', cursor: 0, marks: [], rhythmAt: [],
      bars: [], barIndex: 0,
      locked: 0, loose: 0, dropped: 0, idleDrops: 0,
      combo: 0, maxCombo: 0, score: 0, correct: 0, total: 0,
      v: 0, peakV: 0, ratio: 1, rhythm: 50, chapterIndex: 0,
      startedAt: null, lastKeyAt: null, nowMs: 0, intervals: [],
      ended: false, endReason: null,
      demand: s.createDemand(), speed: m.createSpeed(), wpmTrace: []
    };
    topUp(run);
    return run;
  }

  function endRun(run, reason) { run.ended = true; run.endReason = reason; }

  function closeBar(run, state) {
    const bar = run.bars[run.barIndex];
    bar.state = state;
    if (state === 'locked') { run.score += bar.pot * LOCK_BONUS; run.locked++; }
    else if (state === 'loose') { run.score += bar.pot; run.loose++; }
    else { run.dropped++; run.combo = 0; }
    run.barIndex++;
    if (run.dropped >= MAX_DROPS) endRun(run, 'dropped');
    topUp(run);
  }

  function dropBar(run, nowMs) {
    const bar = run.bars[run.barIndex];
    for (let i = run.cursor; i < bar.end; i++) run.marks[i] = 'miss';
    run.cursor = bar.end;
    closeBar(run, 'dropped');
    if (!run.ended) activate(run, nowMs);
  }

  function onKey(run, key, nowMs) {
    if (run.ended) return { correct: false, ended: true, closed: null };
    if (run.startedAt === null) { run.startedAt = nowMs; activate(run, nowMs); }
    run.nowMs = nowMs;

    const bar = run.bars[run.barIndex];
    const correct = key === run.text[run.cursor];

    if (run.lastKeyAt !== null) {
      run.intervals.push(nowMs - run.lastKeyAt);
      if (run.intervals.length > 64) run.intervals.shift();
    }
    run.lastKeyAt = nowMs;
    run.idleDrops = 0;

    m.pushKey(run.speed, nowMs);
    run.v = m.wpmAt(run.speed, nowMs);
    if (run.v > run.peakV) run.peakV = run.v;
    run.rhythm = m.rhythmOf(run.intervals);

    run.total++;
    run.marks[run.cursor] = correct ? 'ok' : 'err';
    run.rhythmAt[run.cursor] = run.rhythm;
    run.cursor++;

    if (correct) {
      run.correct++;
      run.combo++;
      if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      bar.pot += m.pointsFor(run.v, run.rhythm, run.combo);
    } else {
      run.combo = 0;
      bar.errors++;
    }

    let closed = null;
    if (run.cursor >= bar.end) {
      const clean = bar.errors === 0;
      const inRhythm = run.rhythm >= LOCK_RHYTHM;
      closed = (clean && inRhythm) ? 'locked' : 'loose';
      closeBar(run, closed);
      if (!run.ended) activate(run, nowMs);
    }

    return { correct: correct, ended: run.ended, closed: closed };
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

    // An idle gap costs one bar per IDLE_DROP_MS of continued idleness. Waiting
    // out each bar's own deadline instead would make a full stop take a tedious
    // 15s; dropping all three at once would end it in 1.6s. One per interval
    // puts a hands-off run at 4.5s, in line with draft A's two seconds.
    if (run.lastKeyAt !== null) {
      const owed = Math.floor((nowMs - run.lastKeyAt) / IDLE_DROP_MS);
      while (!run.ended && run.idleDrops < owed) { run.idleDrops++; dropBar(run, nowMs); }
    }

    let guard = 0;
    while (!run.ended && guard++ < 8) {
      const bar = run.bars[run.barIndex];
      if (!bar) break;
      if (bar.state === 'pending') activate(run, nowMs);
      if (bar.deadlineAt !== null && nowMs >= bar.deadlineAt) dropBar(run, nowMs);
      else break;
    }

    run.wpmTrace.push({ t: nowMs - run.startedAt, v: run.v, demand: run.demand.value });
    if (run.wpmTrace.length > 4000) run.wpmTrace.shift();
  }

  // fraction of the active bar's deadline still remaining, 0-1
  function barRemaining(run, nowMs) {
    const bar = run.bars[run.barIndex];
    if (!bar || bar.deadlineAt === null) return 1;
    return Math.max(0, Math.min(1, (bar.deadlineAt - nowMs) / bar.allowedMs));
  }

  function inkAhead() { return 1; }   // draft B never fades the page

  function endLabel() { return 'three bars dropped'; }

  const api = {
    draftB: {
      META, createRun, onKey, tick, inkAhead, endLabel, barRemaining,
      MAX_DROPS, LOCK_RHYTHM, WORDS_PER_BAR, IDLE_DROP_MS,
      strikesOf: run => run.dropped, maxStrikes: () => MAX_DROPS
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api.draftB;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
