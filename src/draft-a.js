// DRAFT A - "drying ink"
// Pressure is legibility. The ink dries ahead of your caret at a rate the demand
// sets; fall below 94% of it and a hole opens in the page. You can only be killed
// by being wrong about something you could not see.
//
// The demand is a GOAL the player chose, not a chaser. It ramps from a gentle
// opening to that goal over ten seconds and then holds, so the ink is a pacer: at
// exactly the goal the page is readable but visibly drying, a little under and you
// are reading from memory. Hold at or above the goal for ten seconds and you have
// REACHED it - the ladder steps up and the ramp runs again, so one run can clear
// several levels and the mode stays endless.
//
// It used to pace itself off the player's own sustained speed, and the squeeze
// arrived far too late: measured, the first unreadable hole landed at 45-98s, worse
// the faster you typed. See docs/superpowers/specs/2026-10-03-draft-a-pacing.md
// for the autopsy and for the alternatives that were rejected.
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

  // How fast the ink is allowed to DRY, as a time constant on the ratio.
  //
  // Measured problem this fixes: rolling wpm over 3s wobbles by 4-8% even for a
  // metronome, because the text's hand and finger transitions are not uniform. The
  // hole opens below 94% of the goal, so a player typing exactly AT their goal was
  // flickering in and out of blindness several times a minute, and a blind
  // character is wrong about a third of the time - three strikes arrived in 16-44s.
  // Typing at your goal has to be sustainable, so the estimator's wobble must not
  // reach the page.
  //
  // Asymmetric on purpose: catching up is instant, because pushing hard has to be
  // rewarded immediately and a player who speeds up should see the page clear under
  // their fingers. Falling behind takes DRY_TAU to register, so a 300ms stumble
  // barely moves the ink while a real slowdown dries it out within a couple of
  // seconds. It is also the literal reading of the premise: ink takes a moment to
  // dry. Measured at 1.6s; see docs/.../2026-10-03-draft-a-pacing.md.
  const DRY_TAU = 1.6;

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

  // Characters ahead of the caret that are kept when the chapter changes. Measured
  // in Chrome at the widest stage (1180px, 30px Plex Mono, 17.7px a glyph): 43
  // characters are visible right of the caret, and the stage never gets wider. The
  // rest is slack, so the cut always lands off screen.
  const KEEP_AHEAD = 60;

  // On a chapter change, drop the buffered old-chapter text past the visible edge
  // and regenerate it in the new chapter. Without this the hands keep typing the
  // old texture for 200-330 characters (measured 18-28s, and at 10s a level a
  // chapter could be skipped outright). The cut lands on a space, so the kept text
  // ends on a whole word and nothing at or behind the caret changes.
  function rechapter(run) {
    const cut = run.text.indexOf(' ', run.cursor + KEEP_AHEAD);
    if (cut === -1) return;
    run.text = run.text.slice(0, cut);
    run.gen.rewind(run.text.split(' '));
    run.textCut = cut;           // the renderer redraws every slot past this
    run.textEdits++;
    topUp(run);
  }

  // opts.goal: the wpm the player is pacing against. Defaults to the bottom of the
  // ladder, which is also what every caller that does not care about the goal gets.
  function createRun(seed, opts) {
    const goal = (opts && opts.goal) || s.LEVELS[0];
    // opts.stepUp: false pins the ladder. Reaching the goal normally promotes you
    // to the next rung, which means "is this goal a line you can sit on?" is not
    // otherwise answerable - a player who holds their goal is always killed by the
    // NEXT one, so the two questions have to be separable to be measured.
    const stepUp = !opts || opts.stepUp !== false;
    const run = {
      draft: 'a', seed: seed, gen: g.createGenerator(seed),
      text: '', cursor: 0, marks: [], rhythmAt: [], struck: [], textCut: 0, textEdits: 0,
      combo: 0, maxCombo: 0, score: 0, strikes: 0, correct: 0, total: 0,
      v: 0, peakV: 0, ratio: 1, rhythm: 50, chapterIndex: 0,
      startedAt: null, lastKeyAt: null, nowMs: 0, intervals: [], blindSince: null,
      ended: false, endReason: null,
      demand: s.createPacer(goal), speed: m.createSpeed(), stepUp: stepUp
    };
    run.chapterIndex = g.chapterAt(run.demand.goal);
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
        run.struck[run.cursor - 1] = true;   // presentation only: the renderer blots it
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

    s.stepPacer(run.demand, dtSeconds);

    // Until the speed tracker is warm, rolling wpm is meaningless - it reads near
    // zero however fast you are going, so it would blank the page on keystroke two.
    // Pin the ratio somewhere comfortable until it means something.
    if (!m.isWarm(run.speed)) {
      run.ratio = WARMUP_RATIO;
    } else {
      const target = run.demand.value > 0 ? run.v / run.demand.value : 0;
      run.ratio = target >= run.ratio
        ? target
        : run.ratio + (target - run.ratio) * (1 - Math.exp(-dtSeconds / DRY_TAU));
      if (s.holdAtGoal(run.demand, run.v, dtSeconds)) {
        run.demand.reached.push({ goal: run.demand.goal, ms: nowMs - run.startedAt });
        if (run.stepUp) s.stepUp(run.demand);
      }
    }

    // Chapters key off the GOAL, not the demand, so the texture ladder and the
    // level ladder line up: clearing a level is also what changes what your hands
    // are doing. Keying them off the ramping demand instead would walk a player
    // through three textures in the first ten seconds of every run.
    const next = g.chapterAt(run.demand.goal);
    if (next > run.chapterIndex) { run.chapterIndex = next; rechapter(run); }

    if (s.isBlind(run.ratio)) {
      if (run.blindSince === null) run.blindSince = nowMs;
      else if (nowMs - run.blindSince >= STALL_MS) endRun(run, 'dried');
    } else {
      run.blindSince = null;
    }

  }

  // how the renderer should ink the character `d` ahead of the caret
  function inkAhead(run, d) { return d >= s.W ? 1 : s.opacityAt(d, run.ratio); }

  function endLabel(run) {
    return run.endReason === 'strikes' ? 'three blind guesses' : 'the page dried out';
  }

  function goalOf(run) { return run.demand.goal; }
  function reachedOf(run) { return run.demand.reached; }

  const api = {
    draftA: {
      META, createRun, onKey, tick, inkAhead, endLabel, goalOf, reachedOf,
      LEVELS: s.LEVELS, MAX_STRIKES, STALL_MS,
      strikesOf: run => run.strikes, maxStrikes: () => MAX_STRIKES
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api.draftA;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
