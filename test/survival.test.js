const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  W, createDemand, sampleSpeed, sustainedOf, stepDemand,
  LEVELS, RAMP_SECONDS, HOLD_SECONDS, nextGoal, levelIndexOf,
  createPacer, stepPacer, holdAtGoal, stepUp,
  baseInk, frontWidth, opacityAt, isBlind, unreadableWidth
} = require('../src/survival.js');

test('the newest character is always fully legible, at every ratio', () => {
  for (const ratio of [0, 0.1, 0.4, 0.54, 0.74, 0.9, 0.94, 1, 1.35, 3]) {
    assert.ok(Math.abs(opacityAt(W, ratio) - 1) < 1e-9,
      'opacity at the window edge was ' + opacityAt(W, ratio) + ' at ratio ' + ratio);
  }
});

test('the blank front never reaches the window edge', () => {
  for (const ratio of [0, 0.2, 0.5, 0.54]) assert.ok(frontWidth(ratio) <= 0.85 * W + 1e-9);
});

test('blindness begins just below 94% of the demand', () => {
  assert.equal(isBlind(0.93), true);
  assert.equal(isBlind(0.95), false);
});

test('ink is crisp when well ahead and pale at the caret when matching', () => {
  assert.equal(baseInk(1.35), 1);
  assert.ok(Math.abs(baseInk(1.0) - 0.30) < 1e-9);
  assert.equal(baseInk(0.5), 0);
});

test('the unreadable region grows from nothing to most of the window', () => {
  assert.equal(unreadableWidth(1.2), 0);
  assert.ok(Math.abs(unreadableWidth(0.90) - 5.2) < 0.4, 'was ' + unreadableWidth(0.90));
  assert.ok(Math.abs(unreadableWidth(0.74) - 19.7) < 0.6, 'was ' + unreadableWidth(0.74));
  assert.ok(unreadableWidth(0.5) > 30, 'was ' + unreadableWidth(0.5));
});

test('opacity rises monotonically with distance', () => {
  for (const ratio of [0.5, 0.74, 0.9, 1.0, 1.2]) {
    let prev = -1;
    for (let d = 0; d <= W; d++) {
      const o = opacityAt(d, ratio);
      assert.ok(o >= prev - 1e-12, 'opacity dipped at d=' + d + ' ratio=' + ratio);
      prev = o;
    }
  }
});

function runDemand(speedFn, seconds) {
  const d = createDemand();
  const dt = 1 / 60;
  const trace = [];
  for (let step = 0; step * dt < seconds; step++) {
    const t = step * dt;
    sampleSpeed(d, speedFn(t), t * 1000);
    stepDemand(d, dt);
    trace.push({ t: t, demand: d.value });
  }
  return trace;
}

test('demand starts at 40', () => { assert.equal(createDemand().value, 40); });

test('demand never decreases, whatever the player does', () => {
  const erratic = t => (t < 10 ? 150 : (t < 20 ? 0 : (t < 30 ? 90 : 20)));
  const trace = runDemand(erratic, 60);
  for (let i = 1; i < trace.length; i++) {
    assert.ok(trace[i].demand >= trace[i - 1].demand - 1e-12, 'demand fell at t=' + trace[i].t);
  }
});

test('demand never plateaus - no five second span without increase', () => {
  const trace = runDemand(() => 100, 120);
  const perSecond = 60;
  for (let i = 0; i + 5 * perSecond < trace.length; i += perSecond) {
    const rise = trace[i + 5 * perSecond].demand - trace[i].demand;
    assert.ok(rise >= 2.4, 'demand rose only ' + rise.toFixed(2) + ' over 5s at t=' + trace[i].t);
  }
});

test('demand climbs at least 0.5 wpm per second when the target is below it', () => {
  const trace = runDemand(() => 10, 20);
  const rise = trace[trace.length - 1].demand - trace[0].demand;
  assert.ok(rise >= 0.5 * 19, 'rose only ' + rise);
});

// The old "reaches 78 in 30s / blind near 1:25" pair lived here and described
// draft A. Draft A no longer uses this demand at all - it paces against a goal the
// player chose (see the goal pacer below). What remains here is draft C's ratchet,
// whose contract is the three assertions above: never falls, never plateaus, never
// slower than 0.5 wpm/s.

test('a one second burst does not permanently raise the demand', () => {
  const steady = runDemand(() => 100, 60).pop().demand;
  const bursty = runDemand(t => (t > 20 && t < 21 ? 180 : 100), 60).pop().demand;
  assert.ok(Math.abs(bursty - steady) < 1.0, 'a burst moved the demand by ' + (bursty - steady));
});

test('sustained uses the median and ignores early sparse samples', () => {
  const d = createDemand();
  assert.equal(sustainedOf(d), 40);
  for (let i = 0; i < 3; i++) sampleSpeed(d, 120, i * 300);
  assert.equal(sustainedOf(d), 40, 'fewer than four samples should stay neutral');
  sampleSpeed(d, 120, 1200);
  assert.equal(sustainedOf(d), 120);
});

test('sampleSpeed throttles to one sample per 250ms', () => {
  const d = createDemand();
  for (let i = 0; i < 100; i++) sampleSpeed(d, 100, i * 10);
  assert.ok(d.samples.length <= 5, 'took ' + d.samples.length + ' samples in 1s');
});

// ---------------------------------------------------------------------------
// The goal pacer - draft A.
//
// The ink is a pacer against a wpm the player chose: the demand ramps from a
// gentle opening to the goal over ten seconds and then holds there. These tests
// pin the two properties the whole model rests on - that the squeeze arrives at
// the same moment whatever your speed, and that it then stops rising.
// ---------------------------------------------------------------------------

function runPacer(goal, seconds, v) {
  const p = createPacer(goal);
  const dt = 1 / 60;
  const trace = [];
  for (let step = 0; step * dt < seconds; step++) {
    stepPacer(p, dt);
    if (v !== undefined && holdAtGoal(p, v, dt)) stepUp(p);
    trace.push({ t: (step + 1) * dt, demand: p.value, goal: p.goal, reached: p.atGoalMs });
  }
  return { pacer: p, trace: trace };
}

test('the pacer opens gently and holds exactly at the goal', () => {
  for (const goal of [40, 70, 100, 150, 190]) {
    const r = runPacer(goal, 30);
    assert.ok(r.trace[0].demand < goal * 0.55, 'opened at ' + r.trace[0].demand);
    const landed = r.trace.find(p => p.t >= RAMP_SECONDS);
    assert.ok(Math.abs(landed.demand - goal) < 0.01, 'at the ramp end it was ' + landed.demand);
    const end = r.trace[r.trace.length - 1];
    assert.equal(end.demand, goal, 'it kept moving after the ramp: ' + end.demand);
  }
});

test('the pacer never decreases', () => {
  const r = runPacer(150, 40);
  for (let i = 1; i < r.trace.length; i++) {
    assert.ok(r.trace[i].demand >= r.trace[i - 1].demand - 1e-12,
      'the demand fell at t=' + r.trace[i].t);
  }
});

test('the ink is drying within eight seconds, at EVERY goal', () => {
  // This is the whole point of the model and the player's actual complaint. ratio
  // 1.125 is baseInk 0.55: more than half the ink under the caret is gone. The
  // ramp is a fraction of the goal, so this time is identical at every speed -
  // which the old self-pacing demand could not manage: it took 28-53s, and it got
  // WORSE the faster you typed.
  for (const goal of [40, 60, 90, 120, 160, 200]) {
    const drying = runPacer(goal, 20).trace.find(p => goal / p.demand <= 1.125);
    assert.ok(drying, 'the page never dried at goal ' + goal);
    assert.ok(drying.t < 8, 'at goal ' + goal + ' the ink dried at t=' + drying.t.toFixed(1));
  }
});

test('typing at the goal is readable; ten per cent under it is not', () => {
  // the band the player asked for: on the goal you can barely keep up, under it
  // you are reading from memory
  assert.equal(isBlind(1.0), false);
  assert.ok(baseInk(1.0) < 0.35, 'ink at the goal was ' + baseInk(1.0) + ' - not drying');
  assert.equal(isBlind(0.90), true);
});

test('holding at or above the goal for ten seconds reaches it', () => {
  const dt = 1 / 60;
  const p = createPacer(100);
  let reachedAt = null;
  for (let step = 0; step * dt < 30 && reachedAt === null; step++) {
    stepPacer(p, dt);
    if (holdAtGoal(p, 101, dt)) reachedAt = (step + 1) * dt;
  }
  assert.ok(reachedAt !== null, 'never reached the goal while typing above it');
  assert.ok(Math.abs(reachedAt - HOLD_SECONDS) < 0.2, 'reached it at t=' + reachedAt);
});

test('a dip below the goal pauses the hold, a real drop resets it', () => {
  const dt = 1 / 60;
  const p = createPacer(100);
  for (let i = 0; i < 300; i++) holdAtGoal(p, 101, dt);     // 5s banked
  const banked = p.atGoalMs;
  for (let i = 0; i < 60; i++) holdAtGoal(p, 98.5, dt);     // inside HOLD_RELEASE
  assert.equal(p.atGoalMs, banked, 'a 1.5% dip threw the hold away');
  holdAtGoal(p, 80, dt);                                    // a real drop
  assert.equal(p.atGoalMs, 0, 'a 20% drop did not reset the hold');
});

test('reaching a goal steps the ladder up and ramps again, it does not end the run', () => {
  const p = createPacer(100);
  const dt = 1 / 60;
  let steps = 0;
  for (let step = 0; step * dt < 60; step++) {
    stepPacer(p, dt);
    if (holdAtGoal(p, 400, dt)) { stepUp(p); steps++; }
  }
  assert.ok(steps >= 4, 'cleared only ' + steps + ' levels in 60s at four times the goal');
  assert.equal(p.goal, 190, 'the ladder did not walk up to 190: ' + p.goal);
  // the ramp restarts a breather below the old goal and has climbed back by now
  assert.ok(p.value >= 100, 'the demand fell back to ' + p.value + ' after a step up');
});

test('the ladder walks the levels in order and keeps climbing past the top', () => {
  assert.deepEqual(LEVELS, [40, 55, 70, 85, 100, 115, 130, 150, 170, 190]);
  for (let i = 0; i < LEVELS.length - 1; i++) assert.equal(nextGoal(LEVELS[i]), LEVELS[i + 1]);
  assert.ok(nextGoal(190) > 190, 'the ladder stopped at the top');
  assert.equal(levelIndexOf(40), 0);
  assert.equal(levelIndexOf(123), 5);
  assert.equal(levelIndexOf(500), LEVELS.length - 1);
  // a custom goal between rungs still steps to the next rung above it
  assert.equal(nextGoal(123), 130);
});
