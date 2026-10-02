const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  W, createDemand, sampleSpeed, sustainedOf, stepDemand,
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

test('a sustained 100 wpm reaches about 78 within thirty seconds', () => {
  const end = runDemand(() => 100, 30).pop().demand;
  assert.ok(end > 70 && end < 85, 'demand after 30s was ' + end);
});

test('a sustained 100 wpm crosses the blind threshold near 1:25', () => {
  const crossing = runDemand(() => 100, 150).find(p => 100 / p.demand < 0.94);
  assert.ok(crossing, 'never went blind');
  assert.ok(crossing.t > 70 && crossing.t < 100, 'went blind at t=' + crossing.t);
});

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
