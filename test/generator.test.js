const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CHAPTERS, makeRng, chapterAt, createGenerator, rejects } = require('../src/generator.js');
const { tagWord } = require('../src/keymap.js');

test('mulberry32 is deterministic and in range', () => {
  const a = makeRng(12345), b = makeRng(12345);
  for (let i = 0; i < 100; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
  assert.notEqual(makeRng(1)(), makeRng(2)());
});

test('chapters are ordered and selected by demand', () => {
  assert.equal(CHAPTERS.length, 8);
  for (let i = 1; i < CHAPTERS.length; i++) assert.ok(CHAPTERS[i].from > CHAPTERS[i - 1].from);
  assert.equal(chapterAt(0), 0);
  assert.equal(chapterAt(40), 0);
  assert.equal(chapterAt(59), 0);
  assert.equal(chapterAt(60), 1);
  assert.equal(chapterAt(105), 3);
  assert.equal(chapterAt(400), 7);
});

test('rejects catches a repeat inside the 12-word window', () => {
  const recent = ['one','two','three','four','five','six','seven','eight','nine','ten','long','form'].map(tagWord);
  assert.equal(rejects(tagWord('form'), recent, 0), 'repeat');
  assert.equal(rejects(tagWord('glass'), recent, 0), null);
});

test('rejects catches three same-start words in a row', () => {
  const recent = [tagWord('trade'), tagWord('train')];
  assert.equal(rejects(tagWord('treat'), recent, 0), 'same-start');
});

test('rejects catches a same-finger boundary with no travel', () => {
  assert.equal(rejects(tagWord('year'), [tagWord('them')], 0), 'same-finger-boundary');
  assert.equal(rejects(tagWord('glass'), [tagWord('them')], 0), null);
});

test('rejects catches a third consecutive same-hand word, except in one hand', () => {
  const recent = [tagWord('water'), tagWord('sweat')];
  const oneHand = CHAPTERS.findIndex(c => c.key === 'one-hand');
  assert.equal(rejects(tagWord('trade'), recent, 0), 'same-hand-run');
  assert.equal(rejects(tagWord('trade'), recent, oneHand), null);
});

test('generated text obeys every rejection rule in every chapter', () => {
  for (let ci = 0; ci < CHAPTERS.length; ci++) {
    const gen = createGenerator(99);
    const words = gen.words(ci, 200);
    assert.equal(words.length, 200);
    for (let i = 0; i < words.length; i++) {
      const recent = words.slice(Math.max(0, i - 12), i).map(tagWord);
      const why = rejects(tagWord(words[i]), recent, ci);
      assert.equal(why, null, CHAPTERS[ci].key + ' word ' + i + ' "' + words[i] + '" violates ' + why);
    }
  }
});

test('generated text matches the chapter texture', () => {
  const byKey = {};
  CHAPTERS.forEach((c, i) => { byKey[c.key] = i; });
  const sampleOf = key => createGenerator(7).words(byKey[key], 120).map(tagWord);
  assert.ok(sampleOf('short-work').every(t => t.len <= 4));
  assert.ok(sampleOf('long-form').every(t => t.len >= 6));
  assert.ok(sampleOf('thin-air').every(t => t.topFrac >= 0.7));
  assert.ok(sampleOf('home-ground').every(t => t.homeFrac >= 0.6));
  assert.ok(sampleOf('one-hand').every(t => t.maxSameHandRun >= 3));
});

test('same seed gives the same text, different seeds do not', () => {
  assert.deepEqual(createGenerator(5).words(0, 50), createGenerator(5).words(0, 50));
  assert.notDeepEqual(createGenerator(5).words(0, 50), createGenerator(6).words(0, 50));
});

