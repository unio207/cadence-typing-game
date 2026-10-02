const { test } = require('node:test');
const assert = require('node:assert/strict');
const { median, rhythmOf, createSpeed, pushKey, wpmAt, pointsFor } = require('../src/metrics.js');

const repeat = (v, n) => new Array(n).fill(v);

test('median handles odd and even lengths without mutating input', () => {
  const xs = [5, 1, 3];
  assert.equal(median(xs), 3);
  assert.deepEqual(xs, [5, 1, 3]);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('fewer than 8 intervals is neutral', () => {
  assert.equal(rhythmOf([]), 50);
  assert.equal(rhythmOf(repeat(100, 7)), 50);
});

test('perfectly even typing scores 100', () => {
  assert.equal(rhythmOf(repeat(100, 16)), 100);
});

test('one hiccup among fifteen even intervals is forgiven entirely', () => {
  // intended: a single slip costs nothing, so the metric never punishes the
  // involuntary. implemented by dropping the largest deviation outright.
  assert.equal(rhythmOf(repeat(100, 15).concat([420])), 100);
});

test('a minority cluster of hiccups is caught', () => {
  // the bug this metric replaced: median absolute deviation has a 50%
  // breakdown point, so ten even intervals among sixteen held MAD at exactly
  // zero and this lurching 10/6 split scored a perfect 100.
  const xs = repeat(100, 10).concat([300, 320, 290, 310, 305, 295]);
  assert.equal(rhythmOf(xs), 0);
});

test('alternating fast and slow keystrokes scores zero', () => {
  assert.equal(rhythmOf([60,140,60,140,60,140,60,140,60,140,60,140,60,140,60,140]), 0);
});

test('the cost of a slip is proportional to its size', () => {
  const gentle = repeat(100, 14).concat([180, 180]);
  const harsh = repeat(100, 14).concat([420, 400]);
  assert.equal(rhythmOf(gentle), 85);
  assert.equal(rhythmOf(harsh), 43);
});

test('the response curve lands where a player would expect', () => {
  const pct5 = [95,105,95,105,100,100,95,105,100,95,105,100,95,105,100,100];
  const pct15 = [85,115,85,115,100,100,85,115,100,85,115,100,85,115,100,100];
  assert.equal(rhythmOf(pct5), 91);    // tight typing reads high
  assert.equal(rhythmOf(pct15), 74);   // loose but controlled reads middling
  assert.equal(rhythmOf([90,90,90,90,100,100,100,100,110,110,110,110,100,100,100,100]), 87);
  assert.equal(rhythmOf([50,50,50,50,100,100,100,100,150,150,150,150,100,100,100,100]), 33);
});

test('intervals are clamped at 600ms so one long pause cannot dominate', () => {
  const huge = repeat(100, 14).concat([5000, 5000]);
  const clamped = repeat(100, 14).concat([600, 600]);
  assert.equal(rhythmOf(huge), rhythmOf(clamped));
  assert.equal(rhythmOf(huge), 5);
});

test('only the last 16 intervals count', () => {
  assert.equal(rhythmOf(repeat(999, 40).concat(repeat(100, 16))), 100);
});

test('rolling wpm counts only the last three seconds', () => {
  const s = createSpeed();
  for (let i = 0; i < 25; i++) pushKey(s, 10000 + i * 120);
  assert.ok(Math.abs(wpmAt(s, 13000) - 100) < 1, 'got ' + wpmAt(s, 13000));
});

test('rolling wpm decays to zero once the window empties', () => {
  const s = createSpeed();
  for (let i = 0; i < 25; i++) pushKey(s, 1000 + i * 120);
  assert.equal(wpmAt(s, 20000), 0);
  assert.equal(wpmAt(createSpeed(), 5000), 0);
});

test('points combine speed, rhythm and combo multiplicatively', () => {
  assert.ok(Math.abs(pointsFor(60, 100, 0) - 15) < 1e-9);
  assert.ok(Math.abs(pointsFor(120, 0, 300) - 24) < 1e-9);
});

test('multipliers are clamped at both ends', () => {
  assert.equal(pointsFor(0, 100, 0), pointsFor(30, 100, 0));
  assert.equal(pointsFor(180, 100, 0), pointsFor(400, 100, 0));
  assert.equal(pointsFor(60, 100, 300), pointsFor(60, 100, 9000));
});

test('faster typing is always worth more per character', () => {
  let prev = 0;
  for (const v of [40, 60, 90, 120, 150, 180]) {
    const p = pointsFor(v, 80, 50);
    assert.ok(p > prev, 'points did not increase at v=' + v);
    prev = p;
  }
});
