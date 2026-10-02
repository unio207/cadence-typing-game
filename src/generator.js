(function (root) {
  'use strict';

  const req = (typeof require !== 'undefined' && typeof module !== 'undefined');
  const km = req ? require('./keymap.js') : root.cadence;
  const wd = req ? require('./words.js') : root.cadence;
  const tagWord = km.tagWord;
  const WORDS = wd.WORDS;
  const TOP200 = wd.TOP200;

  const ROLL_BIGRAMS = [
    'oi','io','er','re','we','ew','po','op','lk','kl','ui','iu',
    'ol','lo','ki','ik','sd','ds','df','fd','as','sa','ty','rt'
  ];

  function hasRoll(word) {
    for (let i = 0; i < word.length - 1; i++) {
      if (ROLL_BIGRAMS.indexOf(word.slice(i, i + 2)) !== -1) return true;
    }
    return false;
  }

  const CHAPTERS = [
    { key: 'open-field',    name: 'open field',    from: 40,  filter: t => t.altFrac >= 0.6 },
    { key: 'home-ground',   name: 'home ground',   from: 60,  filter: t => t.homeFrac >= 0.7 },
    { key: 'common-tongue', name: 'common tongue', from: 80,  filter: t => TOP200.has(t.word) },
    { key: 'short-work',    name: 'short work',    from: 100, filter: t => t.len <= 4 },
    { key: 'inward-roll',   name: 'inward roll',   from: 120, filter: t => hasRoll(t.word) },
    { key: 'long-form',     name: 'long form',     from: 140, filter: t => t.len >= 6 },
    { key: 'one-hand',      name: 'one hand',      from: 160, filter: t => t.maxSameHandRun >= 3 },
    { key: 'thin-air',      name: 'thin air',      from: 180, filter: t => t.topFrac >= 0.7 }
  ];

  function chapterAt(demand) {
    let idx = 0;
    for (let i = 0; i < CHAPTERS.length; i++) if (demand >= CHAPTERS[i].from) idx = i;
    return idx;
  }

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rejects(cand, recentTags, chapterIndex) {
    const recent = recentTags.slice(-12);
    for (const r of recent) if (r.word === cand.word) return 'repeat';

    const prev = recent[recent.length - 1];
    const prev2 = recent[recent.length - 2];

    if (prev && prev2 && prev.word[0] === cand.word[0] && prev2.word[0] === cand.word[0]) {
      return 'same-start';
    }

    if (prev) {
      const last = prev.word[prev.word.length - 1];
      const first = cand.word[0];
      const a = km.keyInfo(last), b = km.keyInfo(first);
      if (a && b && a.finger === b.finger && last !== first) return 'same-finger-boundary';
    }

    const isOneHand = CHAPTERS[chapterIndex].key === 'one-hand';
    if (!isOneHand && prev && prev2 && prev.hand === cand.hand && prev2.hand === cand.hand) {
      return 'same-hand-run';
    }

    return null;
  }

  function scoreCandidate(cand, prev, chapterIndex) {
    let s = 0;
    if (prev) {
      const last = km.keyInfo(prev.word[prev.word.length - 1]);
      const first = km.keyInfo(cand.word[0]);
      if (last && first && last.hand !== first.hand) s += 2;
    }
    if (CHAPTERS[chapterIndex].key === 'inward-roll' && hasRoll(cand.word)) s += 2;
    s -= cand.sameFingerPairs;
    return s;
  }

  const POOL_CACHE = {};
  function poolFor(chapterIndex) {
    if (!POOL_CACHE[chapterIndex]) {
      POOL_CACHE[chapterIndex] = WORDS.map(tagWord).filter(CHAPTERS[chapterIndex].filter);
    }
    return POOL_CACHE[chapterIndex];
  }

  // the greedy branch in draft C: denser, longer, worse transitions
  let GREEDY_CACHE = null;
  function greedyPool() {
    if (!GREEDY_CACHE) {
      GREEDY_CACHE = WORDS.map(tagWord)
        .filter(t => t.len >= 5 && (t.sameFingerPairs > 0 || t.maxSameHandRun >= 3 || t.len >= 7));
    }
    return GREEDY_CACHE;
  }

  function createGenerator(seed) {
    const rng = makeRng(seed);
    const recent = [];

    function pick(pool, chapterIndex) {
      let best = null, bestScore = -Infinity;
      for (let attempt = 0; attempt < 64 && (best === null || attempt < 8); attempt++) {
        const cand = pool[Math.floor(rng() * pool.length)];
        if (!cand) continue;
        if (rejects(cand, recent, chapterIndex) !== null) continue;
        const s = scoreCandidate(cand, recent[recent.length - 1], chapterIndex);
        if (s > bestScore) { bestScore = s; best = cand; }
      }
      if (best === null) {
        for (const cand of pool) {
          if (rejects(cand, recent, chapterIndex) === null) { best = cand; break; }
        }
      }
      if (best === null) throw new Error('no legal word for chapter ' + chapterIndex);
      recent.push(best);
      if (recent.length > 12) recent.shift();
      return best.word;
    }

    function words(chapterIndex, n) {
      const out = [];
      for (let i = 0; i < n; i++) out.push(pick(poolFor(chapterIndex), chapterIndex));
      return out;
    }

    // draft B: three-word bars
    function phrases(chapterIndex, n, perPhrase) {
      const size = perPhrase || 3;
      const out = [];
      for (let i = 0; i < n; i++) out.push(words(chapterIndex, size));
      return out;
    }

    // draft C: two valid lines that diverge on the first character and
    // reconverge afterwards. the greedy line is longer and denser.
    function branchPair(chapterIndex) {
      const safe = words(chapterIndex, 3);
      let greedy = null;
      for (let attempt = 0; attempt < 40; attempt++) {
        const cand = words(chapterIndex === 7 ? 7 : 5, 1)[0];
        const pool = greedyPool();
        const extra = pool[Math.floor(rng() * pool.length)];
        const first = cand[0];
        if (first !== safe[0][0]) {
          greedy = [cand, extra ? extra.word : cand, words(chapterIndex, 1)[0]];
          break;
        }
      }
      if (!greedy) {
        // guaranteed fallback: take any greedy word whose first letter differs
        const pool = greedyPool().filter(t => t.word[0] !== safe[0][0]);
        const a = pool[Math.floor(rng() * pool.length)];
        const b = pool[Math.floor(rng() * pool.length)];
        greedy = [a.word, b.word, words(chapterIndex, 1)[0]];
      }
      const safeLen = safe.join(' ').length;
      const greedyLen = greedy.join(' ').length;
      return {
        safe: safe,
        greedy: greedy,
        payout: 1.6,
        safeLen: safeLen,
        greedyLen: greedyLen
      };
    }

    return { recent: recent, words: words, phrases: phrases, branchPair: branchPair };
  }

  const api = {
    CHAPTERS, chapterAt, makeRng, createGenerator, rejects, hasRoll, poolFor, greedyPool
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
