(function (root) {
  'use strict';

  const ROWS = { top: 'qwertyuiop', home: 'asdfghjkl', bottom: 'zxcvbnm' };

  // 0-3 left pinky..index, 5 thumb, 6-9 right index..pinky
  const FINGERS = {
    q: 0, a: 0, z: 0,
    w: 1, s: 1, x: 1,
    e: 2, d: 2, c: 2,
    r: 3, f: 3, v: 3, t: 3, g: 3, b: 3,
    y: 6, h: 6, n: 6, u: 6, j: 6, m: 6,
    i: 7, k: 7,
    o: 8, l: 8,
    p: 9
  };

  function keyInfo(ch) {
    if (ch === ' ') return { hand: 'T', row: 'space', finger: 5 };
    const finger = FINGERS[ch];
    if (finger === undefined) return null;
    let row = null;
    for (const name of Object.keys(ROWS)) {
      if (ROWS[name].indexOf(ch) !== -1) { row = name; break; }
    }
    return { hand: finger <= 3 ? 'L' : 'R', row: row, finger: finger };
  }

  function tagWord(word) {
    const infos = [];
    for (const ch of word) {
      const info = keyInfo(ch);
      if (!info) throw new Error('word "' + word + '" contains unmappable "' + ch + '"');
      infos.push(info);
    }

    const hands = infos.map(i => i.hand).join('');
    const rows = infos.map(i => i.row[0]).join('');
    const fingers = infos.map(i => i.finger);

    let home = 0, top = 0, alt = 0, run = 1, maxRun = 1, sameFinger = 0;
    for (let i = 0; i < infos.length; i++) {
      if (infos[i].row === 'home') home++;
      if (infos[i].row === 'top') top++;
      if (i > 0) {
        if (infos[i].hand !== infos[i - 1].hand) { alt++; run = 1; }
        else { run++; if (run > maxRun) maxRun = run; }
        if (infos[i].finger === infos[i - 1].finger && word[i] !== word[i - 1]) sameFinger++;
      }
    }

    const transitions = Math.max(1, infos.length - 1);
    const left = hands.split('').filter(h => h === 'L').length;
    const right = hands.length - left;

    return {
      word: word,
      len: word.length,
      hands: hands,
      rows: rows,
      fingers: fingers,
      homeFrac: home / word.length,
      topFrac: top / word.length,
      altFrac: infos.length > 1 ? alt / transitions : 0,
      maxSameHandRun: maxRun,
      sameFingerPairs: sameFinger,
      hand: right > left ? 'R' : 'L'
    };
  }

  const api = { keyInfo, tagWord, ROWS, FINGERS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
