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

  // ---------------------------------------------------------------------------
  // The result screen: minimal by default.
  //
  // What stays visible is what you want in the first half second after a run
  // ends - how long you lasted, what you scored, and whether that beat you. Every
  // other number is a thing you go and look at, so it lives behind one control in
  // the hint row, phrased like the other hints rather than built as a button.
  //
  // shell.js owns the markup written into #result-sheet and cannot be edited from
  // here, so this restructures what it finds instead of replacing it: the stats
  // row and the ink reprint are moved into a .more wrapper that CSS hides until
  // the sheet carries .is-open. Idempotent - re-running it on an already-enhanced
  // sheet is a no-op, which is what makes it safe to drive from a MutationObserver.
  // ---------------------------------------------------------------------------

  const DETAIL_PARTS = ['.stats', '#page-print'];

  function resultOpen(sheet) {
    return !!sheet && sheet.className.indexOf('is-open') >= 0;
  }

  function setResultOpen(sheet, open) {
    if (!sheet) return false;
    sheet.classList[open ? 'add' : 'remove']('is-open');
    const ctl = sheet.querySelector('.expand');
    // The label names what the control will do next, not what state you are in.
    if (ctl) ctl.innerHTML = '<b>' + (open ? '&#8593;' : '&#8595;') + '</b> ' +
      (open ? 'hide stats' : 'all stats');
    return !!open;
  }

  function enhanceResult(sheet) {
    if (!sheet || sheet.querySelector('.expand')) return null;
    const hint = sheet.querySelector('.hint');
    if (!hint) return null;

    const more = document.createElement('div');
    more.className = 'more';
    for (const sel of DETAIL_PARTS) {
      const el = sheet.querySelector(sel);
      if (el) more.appendChild(el);          // appendChild moves, it does not copy
    }
    sheet.insertBefore(more, hint);

    const ctl = document.createElement('span');
    ctl.className = 'expand';
    ctl.setAttribute('role', 'button');
    ctl.tabIndex = 0;
    hint.insertBefore(ctl, hint.firstChild);
    ctl.addEventListener('click', () => setResultOpen(sheet, !resultOpen(sheet)));

    setResultOpen(sheet, false);             // every run starts collapsed
    return ctl;
  }

  // ---------------------------------------------------------------------------
  // Theme. The palette is CSS custom properties on :root, so the whole of dark
  // mode is one attribute on <html>. resolveTheme is kept pure and separate so
  // the first-visit rule can be tested without a browser; the identical two lines
  // are also inlined in <head> so the choice lands before the first paint.
  // ---------------------------------------------------------------------------

  const THEME_KEY = 'cadence.theme';

  function resolveTheme(stored, prefersDark) {
    if (stored === 'light' || stored === 'dark') return stored;
    return prefersDark ? 'dark' : 'light';
  }

  function storedTheme() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const v = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', v);
    try { localStorage.setItem(THEME_KEY, v); } catch (e) { /* private mode */ }
    return v;
  }

  function toggleTheme() {
    return applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
  }

  const api = {
    KEY, DRAFT_IDS, loadRecords, saveRecords, recordRun, summarise,
    formatDuration, scoreLine, inkTrace, renderPage,
    enhanceResult, setResultOpen, resultOpen,
    THEME_KEY, resolveTheme, storedTheme, currentTheme, applyTheme, toggleTheme
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadenceScreens = Object.assign(root.cadenceScreens || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
