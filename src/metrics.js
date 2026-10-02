(function (root) {
  'use strict';

  const RHYTHM_WINDOW = 16;
  const RHYTHM_MIN_SAMPLES = 8;
  const INTERVAL_CLAMP_MS = 600;
  const CV_AT_ZERO = 0.35;   // dispersion at which rhythm reads 0
  const SPEED_WINDOW_MS = 3000;

  function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

  function median(nums) {
    const xs = nums.slice().sort((a, b) => a - b);
    if (xs.length === 0) return 0;
    const mid = xs.length >> 1;
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  }

  // Dispersion of keystroke intervals, as a 0-100 score.
  //
  // Deliberately NOT median absolute deviation: MAD has a 50% breakdown point,
  // so ten even intervals among sixteen hold the median deviation at exactly
  // zero and a badly lurching 10/6 split scores a perfect 100. Instead we drop
  // the single largest deviation - which is what buys forgiveness for one
  // hiccup, explicitly rather than as an accident of the estimator - and take
  // the mean of the rest.
  function rhythmOf(intervals) {
    const xs = intervals.slice(-RHYTHM_WINDOW).map(d => Math.min(d, INTERVAL_CLAMP_MS));
    if (xs.length < RHYTHM_MIN_SAMPLES) return 50;

    const m = median(xs);
    if (m === 0) return 0;

    const devs = xs.map(d => Math.abs(d - m)).sort((a, b) => a - b);
    devs.pop();                                     // forgive the worst single slip
    const mean = devs.reduce((a, b) => a + b, 0) / devs.length;

    const cv = clamp(mean / m, 0, 1);
    return Math.round(100 * (1 - clamp(cv / CV_AT_ZERO, 0, 1)));
  }

  const WARM_KEYS = 10;        // keystrokes before rolling wpm means anything

  function createSpeed() { return { times: [] }; }

  function isWarm(speed) { return speed.times.length >= WARM_KEYS; }

  function pushKey(speed, nowMs) {
    speed.times.push(nowMs);
    if (speed.times.length > 512) speed.times.splice(0, speed.times.length - 512);
  }

  // Divides by the window that has actually elapsed, not the nominal 3s. A fixed
  // 3s denominator reads ~4 wpm at the second keystroke of a run however fast you
  // are typing - it is counting characters you have not had time to type yet -
  // which made the opening second of every run unwinnable in draft A.
  function wpmAt(speed, nowMs) {
    const times = speed.times;
    if (times.length === 0) return 0;
    const cutoff = nowMs - SPEED_WINDOW_MS;
    let n = 0, oldest = times[times.length - 1];
    for (let i = times.length - 1; i >= 0; i--) {
      if (times[i] < cutoff) break;
      n++;
      oldest = times[i];
    }
    if (n === 0) return 0;
    const windowMs = Math.max(600, Math.min(SPEED_WINDOW_MS, nowMs - oldest));
    return (n / 5) * (60000 / windowMs);
  }

  function pointsFor(v, rhythm, combo) {
    const speedMult = clamp(v / 60, 0.5, 3.0);
    const rhythmMult = 0.6 + 0.9 * (rhythm / 100);
    const comboMult = 1 + Math.min(combo, 300) / 300;
    return 10 * speedMult * rhythmMult * comboMult;
  }

  const api = {
    clamp, median, rhythmOf, createSpeed, pushKey, wpmAt, pointsFor, isWarm, WARM_KEYS,
    RHYTHM_WINDOW, INTERVAL_CLAMP_MS, SPEED_WINDOW_MS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
