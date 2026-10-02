(function (root) {
  'use strict';

  const req = (typeof require !== 'undefined' && typeof module !== 'undefined');
  const g = req ? require('./generator.js') : root.cadence;

  const KEY = 'cadence.v2';
  const DRAFT_IDS = ['a', 'c'];

  function blank() {
    const r = { v: 2 };
    for (const id of DRAFT_IDS) r[id] = { longest: null, highest: null };
    return r;
  }

  function validRecord(r) {
    return r && typeof r === 'object' && typeof r.ms === 'number' && typeof r.score === 'number';
  }

  function loadRecords() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return blank(); }
    if (!raw) return blank();
    let parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return blank(); }
    const out = blank();
    for (const id of DRAFT_IDS) {
      const d = parsed && parsed[id];
      if (d && validRecord(d.longest)) out[id].longest = d.longest;
      if (d && validRecord(d.highest)) out[id].highest = d.highest;
    }
    return out;
  }

  function saveRecords(recs) {
    try { localStorage.setItem(KEY, JSON.stringify(recs)); } catch (e) { /* ignore */ }
  }

  function summarise(run) {
    return {
      ms: typeof run.ms === 'number' ? run.ms : 0,
      score: Math.round(run.score || 0),
      wpm: Math.round(run.wpm || 0),
      peak: Math.round(run.peakV || 0),
      rhythm: Math.round(run.rhythm || 0),
      chapterIndex: run.chapterIndex || 0,
      accuracy: run.total ? (100 * run.correct / run.total) : 0
    };
  }

  function recordRun(draftId, run) {
    const s = summarise(run);
    const recs = loadRecords();
    const slot = recs[draftId];
    const fell = {
      longest: !slot.longest || s.ms > slot.longest.ms,
      highest: !slot.highest || s.score > slot.highest.score
    };
    if (fell.longest) slot.longest = s;
    if (fell.highest) slot.highest = s;
    if (fell.longest || fell.highest) saveRecords(recs);
    return fell;
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(total / 60) + ':' + String(total % 60).padStart(2, '0');
  }

  function scoreLine(draftId, draftName, run) {
    const s = summarise(run);
    return 'cadence ' + draftId + ' (' + draftName + ') · ' + formatDuration(s.ms) +
      ' · ' + s.score.toLocaleString('en-US') + ' · ' + s.wpm + 'wpm · r' + s.rhythm +
      ' · chapter ' + (s.chapterIndex + 1);
  }

  // rhythm as ink weight: the page remembers how you typed it, not just what
  function inkTrace(run, count) {
    const end = run.cursor;
    const start = Math.max(0, end - count);
    const out = [];
    for (let i = start; i < end; i++) {
      const r = run.rhythmAt[i] === undefined ? 50 : run.rhythmAt[i];
      out.push({
        ch: run.text[i],
        opacity: 0.18 + 0.82 * Math.pow(r / 100, 1.9),
        weight: r > 72 ? 500 : 400,
        err: run.marks[i] === 'err',
        miss: run.marks[i] === 'miss'
      });
    }
    return out;
  }

  function renderPage(run, count) {
    let html = '';
    for (const c of inkTrace(run, count)) {
      const colour = (c.err || c.miss) ? 'var(--red)' : 'var(--ink)';
      const op = c.miss ? 0.2 : c.opacity;
      html += '<span style="opacity:' + op.toFixed(3) + ';font-weight:' + c.weight +
        ';color:' + colour + '">' + c.ch + '</span>';
    }
    return html;
  }

  const api = {
    KEY, DRAFT_IDS, loadRecords, saveRecords, recordRun, summarise,
    formatDuration, scoreLine, inkTrace, renderPage
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadenceScreens = Object.assign(root.cadenceScreens || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
