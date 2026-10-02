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

test('every chapter filter has a workable number of eligible words', () => {
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
  // 100, not 40. 'home ground' once had 52 eligible words, which with a 12-word
  // no-repeat window meant the chapter audibly repeated itself. If this fails the
  // fix is to add words to src/words.js, never to loosen a chapter filter.
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
    assert.ok(worst <= 14,
      CHAPTERS[ci].name + ' repeats a word ' + worst + ' times in 300');
    assert.ok(distinct >= 90,
      CHAPTERS[ci].name + ' used only ' + distinct + ' distinct words in 300');
  }
});
