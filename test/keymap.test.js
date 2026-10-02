const { test } = require('node:test');
const assert = require('node:assert/strict');
const { keyInfo, tagWord } = require('../src/keymap.js');

test('keyInfo maps letters to hand, row and finger', () => {
  assert.deepEqual(keyInfo('a'), { hand: 'L', row: 'home', finger: 0 });
  assert.deepEqual(keyInfo('f'), { hand: 'L', row: 'home', finger: 3 });
  assert.deepEqual(keyInfo('j'), { hand: 'R', row: 'home', finger: 6 });
  assert.deepEqual(keyInfo('p'), { hand: 'R', row: 'top', finger: 9 });
  assert.deepEqual(keyInfo('z'), { hand: 'L', row: 'bottom', finger: 0 });
  assert.deepEqual(keyInfo(' '), { hand: 'T', row: 'space', finger: 5 });
});

test('keyInfo rejects anything outside the lowercase layout', () => {
  assert.equal(keyInfo('A'), null);
  assert.equal(keyInfo('1'), null);
  assert.equal(keyInfo('.'), null);
});

test('tagWord describes hand alternation', () => {
  const the = tagWord('the');
  assert.equal(the.hands, 'LRL');
  assert.equal(the.altFrac, 1);
  assert.equal(the.maxSameHandRun, 1);
});

test('tagWord measures rows as fractions', () => {
  const the = tagWord('the');
  assert.ok(Math.abs(the.topFrac - 2 / 3) < 1e-9);
  assert.ok(Math.abs(the.homeFrac - 1 / 3) < 1e-9);
  assert.equal(tagWord('glass').homeFrac, 1);
  assert.equal(tagWord('power').topFrac, 1);
});

test('tagWord finds single-hand runs', () => {
  const water = tagWord('water');
  assert.equal(water.maxSameHandRun, 5);
  assert.equal(water.altFrac, 0);
  assert.equal(water.hand, 'L');
  assert.equal(tagWord('pull').maxSameHandRun, 4);
  assert.equal(tagWord('pull').hand, 'R');
});

test('tagWord counts same-finger pairs that need no travel', () => {
  assert.equal(tagWord('my').sameFingerPairs, 1);
  assert.equal(tagWord('the').sameFingerPairs, 0);
});
