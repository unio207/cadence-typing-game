(function (root) {
  'use strict';

  const c = root.cadence;
  const S = root.cadenceScreens;

  const D = c.draftA;
  const CHAPTER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
  const CARET_X = 0.34;   // where the caret sits across the stage

  // ---------------------------------------------------------------------------
  // The goal ladder - draft A.
  //
  // Draft A paces the drying ink against a goal wpm the player picked, so the goal
  // has to be chosen before the run and remembered between them. Cleared rungs live
  // under their own localStorage key rather than in cadenceScreens' records: that
  // module owns per-draft bests and its schema is not mine to change, and this is a
  // different kind of thing anyway - progression rather than a record.
  // ---------------------------------------------------------------------------

  const LEVELS = c.LEVELS;
  const GOAL_KEY = 'cadence.goal.v1';
  const CUSTOM_STEP = 5;              // shift+arrow sets a goal off the ladder

  function loadGoalState() {
    const blank = { goal: LEVELS[0], cleared: [], best: null };
    let raw = null;
    try { raw = localStorage.getItem(GOAL_KEY); } catch (e) { return blank; }
    if (!raw) return blank;
    let p;
    try { p = JSON.parse(raw); } catch (e) { return blank; }
    if (!p || typeof p !== 'object') return blank;
    return {
      goal: typeof p.goal === 'number' && p.goal > 0 ? Math.round(p.goal) : blank.goal,
      cleared: Array.isArray(p.cleared) ? p.cleared.filter(n => typeof n === 'number') : [],
      best: p.best && typeof p.best.goal === 'number' ? p.best : null
    };
  }

  function saveGoalState() {
    try { localStorage.setItem(GOAL_KEY, JSON.stringify(app.goals)); } catch (e) { /* ignore */ }
  }

  // every goal the run held for ten seconds counts as cleared, ladder rung or not
  function bankGoals(run) {
    const reached = c.draftA.reachedOf(run);
    if (!reached.length) return false;
    let changed = false;
    for (const r of reached) {
      if (app.goals.cleared.indexOf(r.goal) < 0) { app.goals.cleared.push(r.goal); changed = true; }
    }
    const top = reached[reached.length - 1];
    if (!app.goals.best || top.goal > app.goals.best.goal) {
      app.goals.best = { goal: top.goal, ms: top.ms };
      changed = true;
    }
    if (changed) { app.goals.cleared.sort((a, b) => a - b); saveGoalState(); }
    return changed;
  }

  function setGoal(goal) {
    app.goals.goal = Math.max(20, Math.min(400, Math.round(goal)));
    saveGoalState();
    renderLevels();
  }

  function stepGoal(dir, fine) {
    const g = app.goals.goal;
    if (fine) return setGoal(g + dir * CUSTOM_STEP);
    if (dir > 0) return setGoal(c.nextGoal(g));
    let prev = LEVELS[0];
    for (const l of LEVELS) if (l < g) prev = l;
    setGoal(prev);
  }

  function renderLevels() {
    const g = app.goals.goal;
    const rungs = LEVELS.slice();
    if (rungs.indexOf(g) < 0) rungs.push(g);          // a custom goal shows as a rung
    rungs.sort((a, b) => a - b);
    els['level-list'].innerHTML = rungs.map(l =>
      '<span class="rung' + (l === g ? ' sel' : '') +
      (app.goals.cleared.indexOf(l) >= 0 ? ' cleared' : '') +
      '" data-goal="' + l + '">' + l + '</span>').join(' ');
    for (const r of els['level-list'].children) {
      r.addEventListener('click', () => setGoal(Number(r.dataset.goal)));
    }
    const best = app.goals.best;
    els['goal-note'].innerHTML = best
      ? 'best reached <b>' + best.goal + '</b> in ' + (best.ms / 1000).toFixed(0) + 's'
      : 'hold the goal for ten seconds to reach it';
    // the ladder is draft A's pacer; draft C paces itself off your own speed
    els['goal-row'].style.display = 'flex';
  }

  const els = {};
  const app = { run: null, renderer: null, rail: null, screen: 'title', last: 0,
    goals: null };

  function grab() {
    const ids = ['screen-title', 'screen-run', 'screen-result', 'title-best',
      'goal-row', 'level-list', 'goal-note', 'hud-goal', 'hud-goal-label', 'hud-goal-wrap',
      'hud-score', 'hud-wpm', 'hud-demand', 'hud-rhythm', 'hud-chapter', 'hud-chapter-label',
      'strikes', 'strike-label', 'stage', 'track', 'line', 'caret', 'caret-line',
      'rail',
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
    const r = recs.a;
    els['title-best'].innerHTML = r.highest
      ? r.highest.score.toLocaleString('en-US') + ' <em>&middot; ' +
        S.formatDuration(r.longest.ms) + '</em>'
      : '<em>no runs yet</em>';
    renderLevels();
  }

  // ---------------- run ----------------

  function startRun() {
    app.run = D.createRun((Math.random() * 0x7fffffff) | 0,
      { goal: app.goals.goal });
    app.renderer.reset();
    app.rail.reset();
    resetHud(app.run);
    app.last = performance.now();
    els['strike-label'].textContent = 'strikes';
    els['caret'].className = '';

    show('run');
    app.rail.resize();            // the canvas is only measurable once visible
    app.renderer.measure();
  }

  function finishRun() {
    const run = app.run;
    if (run.draft === 'a') bankGoals(run);
    run.ms = c.elapsedMs(run);
    run.wpm = run.ms ? (run.correct / 5) / (run.ms / 60000) : 0;
    showResult(run);
    // Split the sheet into its minimal and expanded halves straight away. This
    // used to be driven by a MutationObserver because the file was owned
    // elsewhere; a direct call is synchronous with the render instead of a
    // microtask behind it, so the sheet is never briefly shown fully expanded.
    if (root.cadenceScreens.enhanceResult) root.cadenceScreens.enhanceResult(els['result-sheet']);

    // The death beat. Frame 0: draw the killing keystroke once with dt 0, so no
    // spring or pulse moves, then stop drawing - frame() skips the run while the
    // screen is 'dying', so the ink stays exactly as it was when you lost. Mark
    // what killed you, hold, then hand over to the result. Tab skips it.
    const now = performance.now();
    app.renderer.draw(run, D, 0);
    app.rail.draw(now, run.rhythm);
    updateHud(run, now);
    if (run.endReason === 'strikes') app.renderer.mark(run.cursor - 1, 'death');
    else els['caret'].className = 'death';
    app.screen = 'dying';
    app.diedAt = now;
  }

  const REDUCED_MOTION = !!(root.matchMedia &&
    root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const DEATH_HOLD_MS = 400;                        // nothing moves; read the line
  const DEATH_FADE_MS = REDUCED_MOTION ? 0 : 200;   // run fades out (ease-in, css)

  function deathBeat(now) {
    const t = now - app.diedAt;
    if (t >= DEATH_HOLD_MS + DEATH_FADE_MS) {
      show('result');
      els['screen-result'].className += ' is-entering';   // 300ms --ease, css
    } else if (t >= DEATH_HOLD_MS && els['screen-run'].className.indexOf('is-leaving') < 0) {
      els['screen-run'].className += ' is-leaving';
    }
  }

  // Reading the stage's geometry every frame forces a synchronous layout, and it
  // lands right after the renderer has dirtied its span window. The width only
  // changes on resize and on a font load, both of which already call remeasure().
  let stageWidth = 0;
  function invalidateStageWidth() { stageWidth = 0; }
  function caretScreenX() {
    if (!stageWidth) stageWidth = els['stage'].getBoundingClientRect().width;
    return stageWidth * CARET_X;
  }


  // The step-up, the run's only progression moment. Read off reached.length rather
  // than a flag in the draft, so the simulation stays free of presentation state.
  // Timings: the hold line stays full STEP_HOLD_MS then fades over STEP_FADE_MS,
  // the goal counts up over STEP_COUNT_MS, the chapter crossfades over
  // STEP_CHAPTER_MS. Under reduced motion all of it is skipped and the HUD just
  // changes; the rail tick stays, since it scrolls with the marks like any other.
  const STEP_HOLD_MS = 150, STEP_FADE_MS = 300, STEP_COUNT_MS = 300, STEP_CHAPTER_MS = 250;
  const hud = { cleared: 0, stepAt: -Infinity, fromGoal: 0, chapter: 0, chFade: false,
    hold: '', holdInk: '' };

  function resetHud(run) {
    hud.cleared = run.demand.reached.length;
    hud.stepAt = -Infinity;
    hud.chapter = run.chapterIndex;
    hud.chFade = false;
  }

  function updateHud(run, now) {
    els['hud-score'].textContent = Math.round(run.score).toLocaleString('en-US');
    els['hud-wpm'].textContent = Math.round(run.v);
    els['hud-demand'].textContent = Math.round(run.demand.value);
    els['hud-rhythm'].textContent = Math.round(run.rhythm);

    let t = Infinity;                      // ms since the last step-up
    if (run.draft === 'a') {
      const reached = run.demand.reached;
      const cleared = reached.length;
      if (cleared > hud.cleared) {
        app.rail.step(now);
        if (!REDUCED_MOTION) {
          hud.stepAt = now;
          hud.fromGoal = reached[cleared - 1].goal;
          hud.chFade = run.chapterIndex !== hud.chapter;
        }
      }
      hud.cleared = cleared;
      t = now - hud.stepAt;

      // the goal, and the ten-second hold as a hairline that fills under it. The
      // hold clock already pauses on dips inside HOLD_RELEASE and resets below it,
      // so the line does exactly what the clock does.
      let goal = run.demand.goal;
      if (t < STEP_COUNT_MS) {
        const e = 1 - Math.pow(1 - t / STEP_COUNT_MS, 3);
        goal = hud.fromGoal + (goal - hud.fromGoal) * e;
      }
      const goalText = String(Math.round(goal));
      if (els['hud-goal'].textContent !== goalText) els['hud-goal'].textContent = goalText;
      const label = cleared ? cleared + ' cleared' : 'goal';
      if (els['hud-goal-label'].textContent !== label) els['hud-goal-label'].textContent = label;

      let fill, ink = 1;
      if (t < STEP_HOLD_MS + STEP_FADE_MS) {
        fill = 1;
        ink = t < STEP_HOLD_MS ? 1 : 1 - (t - STEP_HOLD_MS) / STEP_FADE_MS;
      } else {
        fill = Math.min(1, run.demand.atGoalMs / 1000 / c.HOLD_SECONDS);
      }
      // drawn as #hud-goal::after so it is exactly as wide as the number
      const hold = fill.toFixed(3);
      if (hud.hold !== hold) { hud.hold = hold; els['hud-goal'].style.setProperty('--hold', hold); }
      const holdInk = ink.toFixed(2);
      if (hud.holdInk !== holdInk) { hud.holdInk = holdInk; els['hud-goal'].style.setProperty('--hold-ink', holdInk); }
    }

    // a chapter change at a step-up swaps the text at the midpoint of a dip
    let chIndex = run.chapterIndex, chInk = 1;
    if (hud.chFade && t < STEP_CHAPTER_MS) {
      if (t < STEP_CHAPTER_MS / 2) chIndex = hud.chapter;
      chInk = Math.abs(t - STEP_CHAPTER_MS / 2) / (STEP_CHAPTER_MS / 2);
    }
    hud.chapter = chIndex;
    const ch = c.CHAPTERS[chIndex];
    els['hud-chapter'].textContent = ch.name;
    els['hud-chapter-label'].textContent = 'chapter ' + CHAPTER_WORDS[chIndex];
    const chOp = chInk === 1 ? '' : chInk.toFixed(2);
    if (els['hud-chapter'].style.opacity !== chOp) {
      els['hud-chapter'].style.opacity = chOp;
      els['hud-chapter-label'].style.opacity = chOp;
    }

    const spent = D.strikesOf(run);
    const marks = els['strikes'].children;
    for (let i = 0; i < marks.length; i++) {
      const cls = i < spent ? 'spent land' : '';
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
    if (app.screen === 'dying') { deathBeat(now); return; }
    if (app.screen !== 'run' || !app.run) return;

    D.tick(app.run, now, dt);
    const info = app.renderer.draw(app.run, D, dt);
    app.rail.draw(now, app.run.rhythm);
    updateHud(app.run, now);

    if (app.run.ended) finishRun();
  }

  // ---------------- result ----------------

  function showResult(run) {
    const s = S.summarise(run);
    const fell = S.recordRun('a', run);
    const chapter = c.CHAPTERS[s.chapterIndex];

    const reached = run.draft === 'a' ? c.draftA.reachedOf(run) : [];
    const extra = run.draft === 'c'
      ? stat('safe', run.safeTaken) + stat('greedy', run.greedyTaken)
      : stat('goal', reached.length ? reached[reached.length - 1].goal : run.demand.startGoal,
          reached.length ? ' reached' : ' missed') +
        stat('best combo', run.maxCombo);

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
      '<span><b>esc</b> title</span></div>';

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

    // The goal ladder: left and right, on the title screen only. Deliberately not
    // up and down, and deliberately not on the result screen - index.html binds the
    // vertical arrows there to the stats panel, and two handlers fighting over one
    // key is how a screen ends up doing two things at once.
    if (app.screen === 'title' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      stepGoal(e.key === 'ArrowRight' ? 1 : -1, e.shiftKey);
      return;
    }


    if (app.screen === 'result' && (e.key === 'c' || e.key === 'C')) {
      const line = S.scoreLine('a', D.META.name, app.run);
      if (navigator.clipboard) navigator.clipboard.writeText(line).catch(() => {});
      return;
    }

    if (e.key === ' ') e.preventDefault();
    if (app.screen === 'result' && e.key === 'Enter') { startRun(); return; }
    if (!isTypingKey(e)) return;

    // The key that starts a run only starts it: the text was not on screen yet.
    // The death beat and the result screen ignore typing altogether, or a player
    // still mid-word when the run ends skips straight past them into a new run.
    if (app.screen === 'title') { startRun(); app.last = now; return; }
    if (app.screen !== 'run') return;

    const res = D.onKey(app.run, e.key, now);
    app.rail.mark(now);
    if (res.ended) finishRun();
  }

  function boot() {
    grab();
    app.goals = loadGoalState();
    app.renderer = c.createRenderer({
      line: els['line'], caret: els['caret'], caretLine: els['caret-line'], track: els['track']
    });
    app.rail = c.createRail(els['rail']);

    const remeasure = () => { invalidateStageWidth(); app.renderer.measure(); app.rail.resize(); };
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
  function replay(opts) {
    const o = Object.assign({ keys: 120, msPerKey: 70, jitter: 0, errorEvery: 0, seed: 1,
      goal: 100 }, opts || {});
    if (!app.goals) app.goals = loadGoalState();
    app.screen = 'replay';                     // keeps frame() from clobbering us
    app.run = D.createRun(o.seed, { goal: o.goal });
    app.renderer.reset();
    app.rail.reset();
    resetHud(app.run);

    els['strike-label'].textContent = 'strikes';
    show('run');                  // before any drawing: a hidden canvas measures 0
    app.rail.resize();
    app.renderer.measure();

    let now = 1000;
    let seed = o.seed;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    for (let i = 0; i < o.keys && !app.run.ended; i++) {
      const run = app.run;
      let ch = run.text[run.cursor];
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
    app.rail.draw(now, run.rhythm);
    hud.cleared = run.demand.reached.length;      // a single frame: no step-up event
    hud.chapter = run.chapterIndex;
    updateHud(run, now);
    app.screen = 'replay';

    return {
      cursor: run.cursor, score: Math.round(run.score),
      wpm: Math.round(run.v), demand: +run.demand.value.toFixed(1),
      ratio: +run.ratio.toFixed(2), rhythm: run.rhythm,
      goal: run.demand.goal, reached: run.draft === 'a' ? run.demand.reached.length : 0,
      strikes: D.strikesOf(run), ended: run.ended, reason: run.endReason,
      chapter: c.CHAPTERS[run.chapterIndex].name,
      caretOffsetPx: +info.caretOffset.toFixed(1), charWidth: +info.charWidth.toFixed(2)
    };
  }

  root.cadenceApp = { app: app, els: els, startRun: startRun, finishRun: finishRun,
    boot: boot, draft: D, replay: replay, show: show, renderTitle: renderTitle };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof globalThis !== 'undefined' ? globalThis : this);
