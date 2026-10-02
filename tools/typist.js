// A synthetic typist whose keystroke intervals depend on what it is typing.
//
// Needed because a fixed-interval simulator cannot see typing difficulty at all,
// which hid a balance bug in draft C: in character coordinates a longer branch
// costs nothing, so the "greedy" line was strictly better. Awkward text is only
// a cost if awkward text is slower, so the simulator has to model that.
'use strict';

const { keyInfo } = require('../src/keymap.js');

const ROW_INDEX = { top: 0, home: 1, bottom: 2, space: 1 };

// multiplier on the base interval for the transition prev -> ch
function transitionCost(prev, ch) {
  if (prev === null || prev === undefined) return 1;
  const a = keyInfo(prev), b = keyInfo(ch);
  if (!a || !b) return 1;

  if (a.hand === 'T' || b.hand === 'T') return 0.85;        // the thumb is cheap

  let cost;
  if (a.hand !== b.hand) {
    cost = 0.92;                                            // hand-off is fastest
  } else if (a.finger === b.finger) {
    cost = prev === ch ? 1.0 : 2.1;                         // same finger, new key: worst
  } else {
    const inward = a.hand === 'L' ? (b.finger > a.finger) : (b.finger < a.finger);
    cost = inward ? 0.95 : 1.25;                            // inward rolls beat outward
  }

  cost += 0.12 * Math.abs(ROW_INDEX[a.row] - ROW_INDEX[b.row]);
  return cost;
}

// How often this typist gets a character wrong, given how legible that character
// currently is. This is the other half of what a fixed-interval simulator cannot
// see: with oracle knowledge of the text a synthetic typist reads invisible ink
// perfectly, so draft A's whole mechanic becomes unmeasurable and nobody ever
// dies. A real player guessing in the dark is wrong roughly a third of the time.
function errorRate(opacity, jitter) {
  const base = 0.008 + 0.03 * jitter;
  const dark = Math.pow(1 - Math.min(1, Math.max(0, opacity / 0.5)), 3);
  return base + 0.30 * dark;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

function wrongKey(correct, random) {
  let k = correct;
  while (k === correct) k = ALPHABET[Math.floor(random() * ALPHABET.length)];
  return k;
}

// baseWpm: the typist's speed on easy alternating text
// jitter: 0 = metronome, 0.5 = ragged
function createTypist(baseWpm, jitter, rng) {
  const random = rng || Math.random;
  const baseMs = 60000 / (baseWpm * 5);
  let prev = null;
  return {
    jitter: jitter,
    random: random,
    // true if this typist fumbles a character of the given legibility
    errs(opacity) { return random() < errorRate(opacity, jitter); },
    wrongKey(correct) { return wrongKey(correct, random); },
    // ms this typist needs before striking `ch`
    intervalFor(ch) {
      const cost = transitionCost(prev, ch);
      prev = ch;
      const noise = 1 + (random() * 2 - 1) * jitter;
      return Math.max(12, baseMs * cost * noise);
    },
    reset() { prev = null; }
  };
}

// Measured effective WPM of a typist on a given string - the number a real
// speed test would report, as opposed to the typist's nominal baseWpm.
function effectiveWpm(text, baseWpm) {
  const t = createTypist(baseWpm, 0, () => 0.5);
  let total = 0;
  for (const ch of text) total += t.intervalFor(ch);
  return (text.length / 5) / (total / 60000);
}

module.exports = { createTypist, transitionCost, effectiveWpm, errorRate };
