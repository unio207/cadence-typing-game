const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WORDS, TOP200 } = require('../src/words.js');
const { tagWord } = require('../src/keymap.js');

test('pool is lowercase letters only, 2-9 characters, no duplicates', () => {
  assert.ok(WORDS.length >= 280, 'pool too small: ' + WORDS.length);
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

test('every chapter filter has at least 40 eligible words', () => {
  const tags = WORDS.map(tagWord);
  const counts = {
    'open field': tags.filter(t => t.altFrac >= 0.6).length,
    'home ground': tags.filter(t => t.homeFrac >= 0.7).length,
    'common tongue': tags.filter(t => TOP200.has(t.word)).length,
    'short work': tags.filter(t => t.len <= 4).length,
    'long form': tags.filter(t => t.len >= 6).length,
    'one hand': tags.filter(t => t.maxSameHandRun >= 3).length,
    'thin air': tags.filter(t => t.topFrac >= 0.7).length
  };
  for (const [chapter, n] of Object.entries(counts)) {
    assert.ok(n >= 40, chapter + ' has only ' + n + ' eligible words — add words to src/words.js');
  }
});
