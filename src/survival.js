(function (root) {
  'use strict';

  const req = (typeof require !== 'undefined' && typeof module !== 'undefined');
  const m = req ? require('./metrics.js') : root.cadence;
  const clamp = m.clamp;
  const median = m.median;

  const W = 40;
  const LEGIBLE = 0.18;
  const SAMPLE_EVERY_MS = 250;
  const SAMPLE_WINDOW = 80;
  // ---------------------------------------------------------------------------
  // The self-adjusting demand. DRAFT C ONLY.
  //
  // It paces itself off the player's own sustained speed: the target sits below
  // demonstrated speed so raising it never outruns you, and the value never falls,
  // so slowing down only ever costs. Two earlier formulations were wrong and are
  // recorded so they are not reintroduced: a pure clock term left a 100 wpm typist
  // with 68 seconds of no change and 2:13 of invulnerability; a hard
  // max(clock, 0.85 * sustained) fixed the opening but froze the demand at 85 for
  // the 89 seconds the clock needed to overtake it.
  //
  // Draft A used to share this and no longer does. The complaint was that the
  // squeeze arrived far too late - measured, the first unreadable hole landed at
  // 45-98s - and the cause was structural: the eased term converges to
  // 0.85 * sustained, while the ink only visibly dries at ratio 1.125 and the hole
  // only opens at ratio 0.94, both of which are ABOVE where it converges. So the
  // interesting part of the climb was covered by the 0.5 wpm/s floor alone, which
  // takes ~0.43 * v seconds - worse the faster you type. Draft A now paces against
  // a goal the player chose instead (see createPacer below, and
  // docs/superpowers/specs/2026-10-03-draft-a-pacing.md). Draft C keeps this,
  // unchanged and still tuned against it: its balance standard is that an adaptive
  // player out-scores both pure strategies, which tools/sweep-c.js measures, and
  // retuning the ratchet under draft C moved that margin from 23% to 14%.
  // ---------------------------------------------------------------------------

  const TARGET_FRACTION = 0.85;
  const EASE_PER_SECOND = 0.07;
  const MIN_RISE_PER_SECOND = 0.5;

  function createDemand() { return { value: 40, samples: [], lastSampleAt: -Infinity }; }

  function sampleSpeed(demand, v, nowMs) {
    if (nowMs - demand.lastSampleAt < SAMPLE_EVERY_MS) return;
    demand.lastSampleAt = nowMs;
    demand.samples.push(v);
    if (demand.samples.length > SAMPLE_WINDOW) demand.samples.shift();
  }

  function sustainedOf(demand) {
    if (demand.samples.length < 4) return 40;
    return median(demand.samples);
  }

  function stepDemand(demand, dtSeconds) {
    const target = TARGET_FRACTION * sustainedOf(demand);
    const eased = (target - demand.value) * EASE_PER_SECOND;
    demand.value += Math.max(MIN_RISE_PER_SECOND, eased) * dtSeconds;
    return demand.value;
  }

  // ---------------------------------------------------------------------------
  // The goal pacer. DRAFT A.
  //
  // The player picks a goal wpm off a ladder (or sets one). The demand ramps from
  // a gentle opening to that goal over RAMP_SECONDS and then HOLDS there forever -
  // it is a pacer, not a chaser. Everything downstream is untouched: at v == goal
  // the ink under the caret sits at baseInk(1.0) = 0.30, readable but visibly
  // drying, and the hole only opens below 0.94 * goal. So "slightly under and you
  // can barely keep up" falls straight out of the existing curve.
  //
  // Why a ramp rather than starting at the goal: rolling wpm means nothing for the
  // first ten keystrokes (see metrics.isWarm), and a cold page at the goal would
  // spend strikes before the player had read a word. Why smoothstep rather than
  // linear: it leaves the opening gentle and lands on the goal without a corner,
  // so there is no moment where the drying visibly changes rate.
  //
  // The value only ever rises - within a level the ramp is monotone, and a level
  // is only ever stepped UP, from wherever the value had got to.
  // ---------------------------------------------------------------------------

  const LEVELS = [40, 55, 70, 85, 100, 115, 130, 150, 170, 190];
  const LEVEL_STEP_ABOVE_LADDER = 20;   // past the ladder's top the goal keeps climbing
  const RAMP_SECONDS = 10;
  const OPENING_FRACTION = 0.5;         // the ramp starts here, as a fraction of the goal
  const HOLD_SECONDS = 10;              // time at or above the goal to have REACHED it
  const HOLD_RELEASE = 0.97;            // dipping inside this does not reset the hold

  function nextGoal(goal) {
    for (const l of LEVELS) if (l > goal) return l;
    return goal + LEVEL_STEP_ABOVE_LADDER;
  }

  function levelIndexOf(goal) {
    let i = 0;
    for (let k = 0; k < LEVELS.length; k++) if (goal >= LEVELS[k]) i = k;
    return i;
  }

  function smoothstep(k) { return k * k * (3 - 2 * k); }

  function createPacer(goal) {
    const g = goal || LEVELS[0];
    const from = OPENING_FRACTION * g;
    return {
      goal: g, startGoal: g, from: from, value: from,
      rampT: 0, atGoalMs: 0, reached: []
    };
  }

  // the demand at this instant, and the hold clock that decides "reached"
  function stepPacer(pacer, dtSeconds) {
    pacer.rampT += dtSeconds;
    const k = clamp(pacer.rampT / RAMP_SECONDS, 0, 1);
    pacer.value = pacer.from + (pacer.goal - pacer.from) * smoothstep(k);
    return pacer.value;
  }

  // Returns true on the keystroke-tick where the goal is reached. Dips shallower
  // than HOLD_RELEASE pause the hold rather than resetting it, because rolling wpm
  // over 3s wobbles by a few per cent even for a metronome, and a hold that any
  // wobble resets is a hold nobody can finish.
  function holdAtGoal(pacer, v, dtSeconds) {
    if (v >= pacer.goal) pacer.atGoalMs += dtSeconds * 1000;
    else if (v < pacer.goal * HOLD_RELEASE) pacer.atGoalMs = 0;
    return pacer.atGoalMs >= HOLD_SECONDS * 1000;
  }

  // Reaching a goal does not end the run: the ladder steps up and the ramp starts
  // again from wherever the demand had got to, so one run can clear several levels
  // and the mode stays endless.
  function stepUp(pacer) {
    pacer.from = pacer.value;
    pacer.goal = nextGoal(pacer.goal);
    pacer.rampT = 0;
    pacer.atGoalMs = 0;
    return pacer.goal;
  }

  function baseInk(ratio) { return clamp((ratio - 0.85) / 0.50, 0, 1); }

  function frontWidth(ratio) { return 0.85 * W * clamp((0.94 - ratio) / 0.40, 0, 1); }

  function opacityAt(d, ratio) {
    const base = baseInk(ratio);
    const f = frontWidth(ratio);
    const t = clamp((d - f) / (W - f), 0, 1);
    return base + (1 - base) * Math.pow(t, 0.8);
  }

  function isBlind(ratio) { return opacityAt(0, ratio) < LEGIBLE; }

  function unreadableWidth(ratio) {
    if (!isBlind(ratio)) return 0;
    const base = baseInk(ratio);
    const f = frontWidth(ratio);
    const t = Math.pow((LEGIBLE - base) / (1 - base), 1 / 0.8);
    return f + t * (W - f);
  }

  const api = {
    W, LEGIBLE, createDemand, sampleSpeed, sustainedOf, stepDemand,
    LEVELS, RAMP_SECONDS, OPENING_FRACTION, HOLD_SECONDS, HOLD_RELEASE,
    nextGoal, levelIndexOf, createPacer, stepPacer, holdAtGoal, stepUp,
    baseInk, frontWidth, opacityAt, isBlind, unreadableWidth
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
