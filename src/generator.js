(function (root) {
  'use strict';

  const req = (typeof require !== 'undefined' && typeof module !== 'undefined');
  const km = req ? require('./keymap.js') : root.cadence;
  const wd = req ? require('./words.js') : root.cadence;
  const tagWord = km.tagWord;
  const WORDS = wd.WORDS;
  const TOP200 = wd.TOP200;

  // How many words back a repeat is forbidden. Adjacent repetition is far more
  // noticeable than overall frequency, so this is the lever that matters once the
  // pool is deliberately small and common.
  const NO_REPEAT_WINDOW = 16;

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
    { key: 'home-ground',   name: 'home ground',   from: 60,  filter: t => t.homeFrac >= 0.6 },
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
    const recent = recentTags.slice(-NO_REPEAT_WINDOW);
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

  // How effortless a word is to type, from the same hand and finger facts the
  // typist model in tools/typist.js prices transitions with: a same finger moving
  // to a different key is the expensive thing, a hand-off is the cheap one. 1 is
  // effortless. This is a PREFERENCE, not a filter - every word in the pool is
  // common enough to be fair game, ease only decides which of several candidates
  // wins.
  function easeOf(t) {
    let e = 1;
    e -= 0.30 * t.sameFingerPairs;        // 'my', 'gym': no travel, pure stutter
    e -= 0.20 * (1 - t.altFrac);          // alternating hands plays itself
    e -= 0.05 * Math.max(0, t.len - 6);   // long words cost rhythm to hold
    return e;
  }

  function scoreCandidate(cand, prev, chapterIndex, rank, poolSize) {
    let s = 0;
    if (prev) {
      const last = km.keyInfo(prev.word[prev.word.length - 1]);
      const first = km.keyInfo(cand.word[0]);
      if (last && first && last.hand !== first.hand) s += 2;
    }
    if (CHAPTERS[chapterIndex].key === 'inward-roll' && hasRoll(cand.word)) s += 2;

    s += 3.0 * easeOf(cand);                        // heavily favour easy words
    s += 1.2 * (1 - rank / Math.max(1, poolSize));  // and common ones
    return s;
  }

  // Pools keep WORDS' frequency order, so a word's index IS its rank.
  const POOL_CACHE = {};
  function poolFor(chapterIndex) {
    if (!POOL_CACHE[chapterIndex]) {
      POOL_CACHE[chapterIndex] = WORDS.map(tagWord).filter(CHAPTERS[chapterIndex].filter);
    }
    return POOL_CACHE[chapterIndex];
  }

  // Sampling leans towards the front of the pool rather than being uniform.
  //
  // Only mildly, though, and the measurement is why. Once the pool itself is all
  // common words a heavy lean stops buying commonness and only buys repetition:
  // measured over 300 generated words, an exponent of 1.9 dropped distinct words
  // to 72-137 and let one word recur up to 21 times, against 89-176 and 5-11 at
  // uniform. 1.25 keeps the very common head slightly ahead without that cost.
  // Typability is handled by easeOf, not by this.
  const RANK_EXP = 1.25;
  function sampleIndex(rng, size) {
    return Math.min(size - 1, Math.floor(size * Math.pow(rng(), RANK_EXP)));
  }


  function createGenerator(seed) {
    const rng = makeRng(seed);
    const recent = [];

    function pick(pool, chapterIndex) {
      let best = null, bestScore = -Infinity;
      for (let attempt = 0; attempt < 64 && (best === null || attempt < 10); attempt++) {
        const at = sampleIndex(rng, pool.length);
        const cand = pool[at];
        if (!cand) continue;
        if (rejects(cand, recent, chapterIndex) !== null) continue;
        const s = scoreCandidate(cand, recent[recent.length - 1], chapterIndex, at, pool.length);
        if (s > bestScore) { bestScore = s; best = cand; }
      }
      if (best === null) {
        for (const cand of pool) {
          if (rejects(cand, recent, chapterIndex) === null) { best = cand; break; }
        }
      }
      if (best === null) throw new Error('no legal word for chapter ' + chapterIndex);
      recent.push(best);
      if (recent.length > NO_REPEAT_WINDOW) recent.shift();
      return best.word;
    }

    function words(chapterIndex, n) {
      const out = [];
      for (let i = 0; i < n; i++) out.push(pick(poolFor(chapterIndex), chapterIndex));
      return out;
    }



    return { recent: recent, words: words };
  }

  const api = {
    CHAPTERS, chapterAt, makeRng, createGenerator, rejects, hasRoll, poolFor,
    easeOf, sampleIndex, RANK_EXP, NO_REPEAT_WINDOW
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
