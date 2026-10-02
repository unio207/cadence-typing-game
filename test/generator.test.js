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
  assert.ok(sampleOf('home-ground').every(t => t.homeFrac >= 0.7));
  assert.ok(sampleOf('one-hand').every(t => t.maxSameHandRun >= 3));
});

test('same seed gives the same text, different seeds do not', () => {
  assert.deepEqual(createGenerator(5).words(0, 50), createGenerator(5).words(0, 50));
  assert.notDeepEqual(createGenerator(5).words(0, 50), createGenerator(6).words(0, 50));
});

test('phrases come in fixed-size bars of real words', () => {
  const bars = createGenerator(11).phrases(2, 30, 3);
  assert.equal(bars.length, 30);
  for (const bar of bars) {
    assert.equal(bar.length, 3);
    for (const w of bar) assert.match(w, /^[a-z]{2,9}$/);
  }
});

test('branch pairs diverge on the very first character', () => {
  for (let ci = 0; ci < CHAPTERS.length; ci++) {
    const gen = createGenerator(23 + ci);
    for (let i = 0; i < 40; i++) {
      const p = gen.branchPair(ci);
      assert.equal(p.safe.length, 3);
      assert.equal(p.greedy.length, 3);
      assert.notEqual(p.safe[0][0], p.greedy[0][0],
        'chapter ' + ci + ' branch ' + i + ' shares a first letter: ' + p.safe[0] + ' / ' + p.greedy[0]);
    }
  }
});

test('the greedy branch is the denser one on average', () => {
  const gen = createGenerator(31);
  let safe = 0, greedy = 0;
  for (let i = 0; i < 80; i++) {
    const p = gen.branchPair(2);
    safe += p.safeLen; greedy += p.greedyLen;
  }
  assert.ok(greedy > safe, 'greedy ' + greedy + ' vs safe ' + safe);
});
