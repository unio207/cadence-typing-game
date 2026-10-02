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
    baseInk, frontWidth, opacityAt, isBlind, unreadableWidth
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
