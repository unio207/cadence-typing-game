const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WORDS, TOP200 } = require('../src/words.js');
const { tagWord } = require('../src/keymap.js');

test('pool is lowercase letters only, 2-9 characters, no duplicates', () => {
  assert.ok(WORDS.length >= 700, 'pool too small: ' + WORDS.length);
  const seen = new Set(), dupes = [];
  for (const w of WORDS) { if (seen.has(w)) dupes.push(w); seen.add(w); }
  assert.deepEqual(dupes, [], 'duplicates: ' + dupes.join(', '));
  for (const w of WORDS) assert.match(w, /^[a-z]{2,9}$/, 'bad word: ' + w);
});

test('every word can be tagged', () => {
  for (const w of WORDS) assert.doesNotThrow(() => tagWord(w), w);
});

test('TOP200 is a subset of the pool', () => {
  const missing = [...TOP200].filter(w => !WORDS.includes(w));
  assert.deepEqual(missing, [], 'TOP200 words not in pool: ' + missing.join(', '));
});

test('every chapter filter has a workable number of eligible words', () => {
  const tags = WORDS.map(tagWord);
  const counts = {
    'open field': tags.filter(t => t.altFrac >= 0.6).length,
    'home ground': tags.filter(t => t.homeFrac >= 0.6).length,
    'common tongue': tags.filter(t => TOP200.has(t.word)).length,
    'short work': tags.filter(t => t.len <= 4).length,
    'long form': tags.filter(t => t.len >= 6).length,
    'one hand': tags.filter(t => t.maxSameHandRun >= 3).length,
    'thin air': tags.filter(t => t.topFrac >= 0.7).length
  };
  // If this fails, the fix is a chapter filter that admits more COMMON words -
  // not more words. The pool is deliberately capped at everyday vocabulary, and
  // reaching further down the frequency list to feed a filter is what produced
  // wield, keel, phantom and situate the last time.
  for (const [chapter, n] of Object.entries(counts)) {
    assert.ok(n >= 100, chapter + ' has only ' + n + ' eligible words — add words to src/words.js');
  }
});

test('generated text does not visibly repeat itself', () => {
  // The 12-word rejection window stops adjacent repeats but says nothing about
  // how often a word comes back over a whole run, which is what a player notices.
  const { CHAPTERS, createGenerator } = require('../src/generator.js');
  for (let ci = 0; ci < CHAPTERS.length; ci++) {
    const words = createGenerator(5).words(ci, 300);
    const freq = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    const worst = Math.max(...Object.values(freq));
    const distinct = new Set(words).size;
    // Some repetition is the deliberate price of never showing an unfamiliar
    // word: you cannot hold a rhythm through a word you are still reading, and
    // the pool is small on purpose. These bounds are where that trade sits.
    assert.ok(worst <= 14,
      CHAPTERS[ci].name + ' repeats a word ' + worst + ' times in 300');
    assert.ok(distinct >= 80,
      CHAPTERS[ci].name + ' used only ' + distinct + ' distinct words in 300');
  }
});

test('the pool is everyday vocabulary, not a vocabulary test', () => {
  // A blunt proxy for "a fast typist never has to think about it": common English
  // is short. The 3142-word pool this replaced averaged well over five letters
  // and contained words like 'situate' and 'phantom'.
  const mean = WORDS.reduce((a, w) => a + w.length, 0) / WORDS.length;
  assert.ok(mean < 5.2, 'mean word length is ' + mean.toFixed(2) + ' - the pool has drifted long');
  assert.ok(WORDS.slice(0, 20).every(w => w.length <= 5),
    'the most common words should be the shortest: ' + WORDS.slice(0, 20).join(' '));
});

test('generated text favours words that are easy to type', () => {
  // The player asked for easily typable words to be heavily favoured, so assert
  // the weighting actually bites rather than trusting that it does: generated
  // text must be easier than drawing from the same pool uniformly would be.
  const { createGenerator, CHAPTERS, poolFor, easeOf } = require('../src/generator.js');
  const { tagWord } = require('../src/keymap.js');
  for (let ci = 0; ci < CHAPTERS.length; ci++) {
    const pool = poolFor(ci);
    const poolEase = pool.reduce((a, t) => a + easeOf(t), 0) / pool.length;
    const got = createGenerator(21).words(ci, 300).map(tagWord);
    const gotEase = got.reduce((a, t) => a + easeOf(t), 0) / got.length;
    assert.ok(gotEase > poolEase,
      CHAPTERS[ci].name + ': generated ease ' + gotEase.toFixed(3) +
      ' is no better than the pool average ' + poolEase.toFixed(3));
  }
});
