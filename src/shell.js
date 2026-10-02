(function (root) {
  'use strict';

  const c = root.cadence;
  const S = root.cadenceScreens;

  const DRAFTS = { a: c.draftA, b: c.draftB, c: c.draftC };
  const ORDER = ['a', 'b', 'c'];
  const CHAPTER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
  const STRIKE_LABEL = { a: 'strikes', b: 'dropped', c: 'touches' };
  // Draft C's pressure comes from behind, so its caret sits further right to leave
  // room for the edge. A and B show the page ahead, so theirs sits left.
  const CARET_X = { a: 0.34, b: 0.34, c: 0.62 };

  const els = {};
  const app = { draftId: 'a', run: null, renderer: null, rail: null, screen: 'title', last: 0 };

  function grab() {
    const ids = ['screen-title', 'screen-run', 'screen-result', 'draft-list',
      'hud-score', 'hud-wpm', 'hud-demand', 'hud-rhythm', 'hud-chapter', 'hud-chapter-label',
      'strikes', 'strike-label', 'stage', 'track', 'line', 'caret', 'caret-line',
      'deadline', 'edge', 'branch-safe', 'branch-greedy', 'rail',
      'bar-fill', 'bar-notch', 'result-sheet'];
    for (const id of ids) els[id] = document.getElementById(id);
  }

  function show(name) {
    app.screen = name;
    for (const n of ['title', 'run', 'result']) {
      els['screen-' + n].className = 'screen' + (n === name ? ' is-active' : '');
    }
  }

  // ---------------- title ----------------

  function renderTitle() {
    const recs = S.loadRecords();
    els['draft-list'].innerHTML = ORDER.map((id, i) => {
      const D = DRAFTS[id];
      const r = recs[id];
      const best = r.highest
        ? r.highest.score.toLocaleString('en-US') + ' <em>&middot; ' + S.formatDuration(r.longest.ms) + '</em>'
        : '<em>—</em>';
      return '<div class="draft-row' + (id === app.draftId ? ' sel' : '') + '" data-id="' + id + '">' +
        '<span class="k">' + (i + 1) + '</span>' +
        '<span class="n">' + D.META.name + '</span>' +
        '<span class="d">' + D.META.blurb + '</span>' +
        '<span class="b">' + best + '</span></div>';
    }).join('');
    for (const row of els['draft-list'].children) {
      row.addEventListener('click', () => { app.draftId = row.dataset.id; renderTitle(); startRun(); });
    }
  }

  // ---------------- run ----------------

  function startRun() {
    app.run = DRAFTS[app.draftId].createRun((Math.random() * 0x7fffffff) | 0);
    app.renderer.reset();
    app.rail.reset();
    app.last = performance.now();
    applyCaretX(app.draftId);
    els['strike-label'].textContent = STRIKE_LABEL[app.draftId];
    els['deadline'].style.display = app.draftId === 'b' ? 'block' : 'none';
    els['edge'].style.display = app.draftId === 'c' ? 'block' : 'none';
    const showBranch = app.draftId === 'c' ? 'block' : 'none';
    els['branch-safe'].style.display = showBranch;
    els['branch-greedy'].style.display = showBranch;
    show('run');
    app.rail.resize();            // the canvas is only measurable once visible
    app.renderer.measure();
  }

  function finishRun() {
    const run = app.run;
    run.ms = c.elapsedMs(run);
    run.wpm = run.ms ? (run.correct / 5) / (run.ms / 60000) : 0;
    showResult(run);
    show('result');
  }

  function caretScreenX() {
    return els['stage'].getBoundingClientRect().width * CARET_X[app.draftId];
  }

  function applyCaretX(draftId) {
    document.documentElement.style.setProperty('--caret-x', (CARET_X[draftId] * 100) + '%');
  }

  function drawOverlays(run, info, now) {
    const cw = info.charWidth;
    const baseX = caretScreenX() + info.caretOffset;

    if (run.draft === 'b') {
      const bar = run.bars[run.barIndex];
      if (bar) {
        const left = baseX + (bar.start - run.cursor) * cw;
        const width = (bar.end - bar.start) * cw;
        const remain = DRAFTS.b.barRemaining(run, now);
        els['deadline'].style.left = left.toFixed(1) + 'px';
        els['deadline'].style.width = Math.max(0, width).toFixed(1) + 'px';
        els['deadline'].firstElementChild.style.width = (remain * 100).toFixed(1) + '%';
      }
    }

    if (run.draft === 'c') {
      const edgeX = baseX + (run.edge - run.cursor) * cw;
      els['edge'].style.left = Math.max(-40, edgeX).toFixed(1) + 'px';

      const b = run.branch;
      if (b && b.committed === null) {
        els['branch-safe'].style.left = baseX.toFixed(1) + 'px';
        els['branch-greedy'].style.left = baseX.toFixed(1) + 'px';
        els['branch-safe'].innerHTML = b.safeText + '<span class="tag">  &times;1</span>';
        els['branch-greedy'].innerHTML = b.greedyText +
          '<span class="tag">  &times;' + DRAFTS.c.TUNING.greedyPayout + '  edge faster</span>';
        els['branch-safe'].style.opacity = '1';
        els['branch-greedy'].style.opacity = '1';
      } else {
        els['branch-safe'].style.opacity = '0';
        els['branch-greedy'].style.opacity = '0';
      }
    }
  }

  function updateHud(run) {
    const D = DRAFTS[app.draftId];
    els['hud-score'].textContent = Math.round(run.score).toLocaleString('en-US');
    els['hud-wpm'].textContent = Math.round(run.v);
    els['hud-demand'].textContent = Math.round(run.demand.value);
    els['hud-rhythm'].textContent = Math.round(run.rhythm);

    const ch = c.CHAPTERS[run.chapterIndex];
    els['hud-chapter'].textContent = ch.name;
    els['hud-chapter-label'].textContent = 'chapter ' + CHAPTER_WORDS[run.chapterIndex];

    const spent = D.strikesOf(run);
    const marks = els['strikes'].children;
    for (let i = 0; i < marks.length; i++) {
      const cls = i < spent ? 'spent' : '';
      if (marks[i].className !== cls) marks[i].className = cls;
    }

    const scale = 220;
    els['bar-fill'].style.width = Math.min(100, (run.v / scale) * 100).toFixed(1) + '%';
    els['bar-notch'].style.left = Math.min(100, (run.demand.value / scale) * 100).toFixed(1) + '%';
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - app.last) / 1000);
    app.last = now;
    if (app.screen !== 'run' || !app.run) return;

    const D = DRAFTS[app.draftId];
    D.tick(app.run, now, dt);
    const info = app.renderer.draw(app.run, D, dt);
    drawOverlays(app.run, info, now);
    app.rail.draw(now, app.run.rhythm);
    updateHud(app.run);

    if (app.run.ended) finishRun();
  }

  // ---------------- result ----------------

  function showResult(run) {
    const D = DRAFTS[app.draftId];
    const s = S.summarise(run);
    const fell = S.recordRun(app.draftId, run);
    const chapter = c.CHAPTERS[s.chapterIndex];

    const extra = run.draft === 'b'
      ? stat('locked', run.locked) + stat('loose', run.loose)
      : run.draft === 'c'
        ? stat('safe', run.safeTaken) + stat('greedy', run.greedyTaken)
        : stat('best combo', run.maxCombo);

    els['result-sheet'].innerHTML =
      '<div class="wordmark">' + D.META.name + '<s> &middot; ' + D.endLabel(run) + '</s></div>' +
      '<div class="big">' + S.formatDuration(s.ms) + '</div>' +
      '<div class="sub">' + s.score.toLocaleString('en-US') + '</div>' +
      (fell.longest || fell.highest ? '<div class="flag">new record</div>' : '') +
      '<div class="stats">' +
        stat('wpm', s.wpm) + stat('peak', s.peak) +
        stat('rhythm', s.rhythm, '%') + stat('accuracy', s.accuracy.toFixed(1), '%') +
        extra + stat('reached', chapter.name) +
      '</div>' +
      '<div id="page-print">' + S.renderPage(run, 260) + '</div>' +
      '<div class="hint"><span><b>tab</b> again</span><span><b>c</b> copy</span>' +
      '<span><b>esc</b> drafts</span></div>';

    function stat(k, v, unit) {
      return '<div><i class="label">' + k + '</i><div class="v">' + v +
        (unit ? '<s>' + unit + '</s>' : '') + '</div></div>';
    }
  }

  // ---------------- input ----------------

  function isTypingKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    return e.key === ' ' || /^[a-z]$/.test(e.key);
  }

  function onKeyDown(e) {
    const now = performance.now();              // timestamp before any other work

    if (e.key === 'Tab') { e.preventDefault(); startRun(); return; }
    if (e.key === 'Escape') { renderTitle(); show('title'); return; }

    if (app.screen !== 'run' && /^[123]$/.test(e.key)) {
      app.draftId = ORDER[Number(e.key) - 1];
      renderTitle();
      if (app.screen === 'result') show('title');
      return;
    }

    if (app.screen === 'result' && (e.key === 'c' || e.key === 'C')) {
      const line = S.scoreLine(app.draftId, DRAFTS[app.draftId].META.name, app.run);
      if (navigator.clipboard) navigator.clipboard.writeText(line).catch(() => {});
      return;
    }

    if (e.key === ' ') e.preventDefault();
    if (!isTypingKey(e)) return;

    if (app.screen !== 'run') { startRun(); app.last = now; }

    const res = DRAFTS[app.draftId].onKey(app.run, e.key, now);
    app.rail.mark(now);
    if (res.ended) finishRun();
  }

  function boot() {
    grab();
    app.renderer = c.createRenderer({
      line: els['line'], caret: els['caret'], caretLine: els['caret-line'], track: els['track']
    });
    app.rail = c.createRail(els['rail']);

    const remeasure = () => { app.renderer.measure(); app.rail.resize(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(remeasure);
    window.addEventListener('resize', remeasure);
    window.addEventListener('keydown', onKeyDown);

    renderTitle();
    show('title');
    requestAnimationFrame(frame);
  }

  // Replays a scripted run with synthetic timestamps and renders a single frame.
  // Deterministic: it never waits on rAF or setTimeout, both of which a browser
  // throttles hard in a background tab. Used to preview a draft at a chosen point
  // in its difficulty curve, and to verify rendering without racing the clock.
  function replay(draftId, opts) {
    const o = Object.assign({ keys: 120, msPerKey: 70, jitter: 0, errorEvery: 0, seed: 1 }, opts || {});
    const D = DRAFTS[draftId];
    app.draftId = draftId;
    app.screen = 'replay';                     // keeps frame() from clobbering us
    app.run = D.createRun(o.seed);
    app.renderer.reset();
    app.rail.reset();

    applyCaretX(draftId);
    els['strike-label'].textContent = STRIKE_LABEL[draftId];
    els['deadline'].style.display = draftId === 'b' ? 'block' : 'none';
    els['edge'].style.display = draftId === 'c' ? 'block' : 'none';
    const vis = draftId === 'c' ? 'block' : 'none';
    els['branch-safe'].style.display = vis;
    els['branch-greedy'].style.display = vis;
    show('run');                  // before any drawing: a hidden canvas measures 0
    app.rail.resize();
    app.renderer.measure();

    let now = 1000;
    let seed = o.seed;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    for (let i = 0; i < o.keys && !app.run.ended; i++) {
      const run = app.run;
      let ch;
      if (draftId === 'c' && run.branch && run.branch.committed === null) {
        ch = (o.greedy ? run.branch.greedyText : run.branch.safeText)[0];
      } else {
        ch = run.text[run.cursor];
      }
      if (ch === undefined) ch = ' ';
      const wrong = o.errorEvery && i > 0 && i % o.errorEvery === 0;
      D.onKey(run, wrong ? (ch === 'q' ? 'z' : 'q') : ch, now);
      app.rail.mark(now);
      const step = o.msPerKey * (1 + (rnd() * 2 - 1) * o.jitter);
      // advance the world in frame-sized slices so springs and demand settle
      for (let acc = 0; acc < step; acc += 16) {
        const slice = Math.min(16, step - acc) / 1000;
        D.tick(run, now + acc, slice);
        app.renderer.draw(run, D, slice);
      }
      now += step;
    }

    const run = app.run;
    const info = app.renderer.draw(run, D, 1 / 60);
    drawOverlays(run, info, now);
    app.rail.draw(now, run.rhythm);
    updateHud(run);
    app.screen = 'replay';

    return {
      draft: draftId, cursor: run.cursor, score: Math.round(run.score),
      wpm: Math.round(run.v), demand: +run.demand.value.toFixed(1),
      ratio: +run.ratio.toFixed(2), rhythm: run.rhythm,
      strikes: D.strikesOf(run), ended: run.ended, reason: run.endReason,
      chapter: c.CHAPTERS[run.chapterIndex].name,
      caretOffsetPx: +info.caretOffset.toFixed(1), charWidth: +info.charWidth.toFixed(2)
    };
  }

  root.cadenceApp = { app: app, els: els, startRun: startRun, finishRun: finishRun,
    boot: boot, DRAFTS: DRAFTS, replay: replay, show: show, renderTitle: renderTitle };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
