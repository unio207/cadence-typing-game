(function (root) {
  'use strict';

  const WINDOW_BEHIND = 70;
  const WINDOW_AHEAD = 110;
  const WINDOW = WINDOW_BEHIND + WINDOW_AHEAD;   // the span pool, 180 wide
  const SCROLL_K = 14;      // spring constants: scroll tracks tightly,
  const CARET_K = 9;        // the caret lags a little, deliberately
  const REPAIR_PER_FRAME = 4;  // stale slots recycled per frame after a text cut

  // prefers-reduced-motion, read once. The CSS media query only stops CSS
  // transitions; the motion here is JS, so it has to be switched off here too:
  // springs snap to their target and the typing pulse lends nothing.
  const REDUCED = typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------------------------------------------------------------------------
  // Why the spans are a ring buffer at absolute positions.
  //
  // Two earlier arrangements both made the run go choppy, and both are recorded
  // here so neither comes back.
  //
  // 1. `first = cursor - WINDOW_BEHIND`, span `i` holding character `first + i`.
  //    The scroll target `-(cursor - first) * cw` is then a CONSTANT, so past
  //    character 70 the springs settled to zero error and the text stopped
  //    sliding altogether - it advanced by swapping glyph contents, one whole
  //    character per keystroke. Character-quantised scrolling is literally what
  //    choppiness is, and it began about four seconds in at 200 wpm. It also
  //    rewrote all 180 spans and all 180 caret twins on every frame the cursor
  //    moved: 360 text-node writes a frame.
  //
  // 2. Quantising `first` to a multiple of 24. That restored the sliding and cut
  //    the MEAN write rate by 24x, but it moved the cost into a burst: every 24
  //    characters the whole window was rewritten at once. Measured, that is a
  //    433-write frame against a 45-write mean - a 10x spike roughly every two
  //    seconds at 120 wpm, which is a periodic hitch rather than a smooth run.
  //
  // So: a span's slot is `idx % WINDOW` and its `left` is `idx * charWidth`,
  // both fixed for the life of that character. A character entering the window
  // writes one span and nothing else touches the DOM. There is no rebase, so
  // there is no burst, and the write rate is flat at about one per keystroke for
  // the whole run however long it goes.
  //
  // Positions grow without bound (a 10-minute run at 200 wpm reaches ~177,000px)
  // which is comfortably inside float precision, so no origin shifting is needed.
  // ---------------------------------------------------------------------------

  // The caret twin. Each keystroke lights the characters just ahead of the caret
  // and the glow decays, so sustained typing keeps the page lit and stopping lets
  // it go out. This is deliberately PRESENTATION ONLY: it is added on top of the
  // opacity the survival model computed and never feeds back into `isBlind`, so
  // it cannot change who lives or dies. PULSE_MAX is kept under the 0.18
  // legibility threshold so a genuinely dark character can never be lit into a
  // readable one - the race it creates is real, not cosmetic relief from it.
  const PULSE_GAIN = 0.5;    // added to the pulse per character typed
  const PULSE_TAU = 0.26;    // seconds to decay by 1/e
  const PULSE_MAX = REDUCED ? 0 : 0.12;    // most opacity a keystroke can lend
  const PULSE_REACH = 12;    // characters ahead that it reaches

  const TWIN_BEHIND = 4;     // characters of twin kept left of the caret
  const TWIN_SPAN = 14;      // total characters in the twin string

  function createRenderer(els) {
    const st = {
      charWidth: 0,
      x: 0, caretX: 0,         // continuous floats, never character indices
      spans: [],
      pulse: 0,
      lastCursor: -1,
      twinFirst: -1,
      twinText: null,
      textEdits: 0,            // run.textEdits last seen: text past run.textCut was replaced
      staleAt: -1              // next slot index that may still hold a discarded glyph
    };

    function measure() {
      const probe = document.createElement('span');
      probe.textContent = 'mmmmmmmmmm';
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;line-height:1';
      const cs = getComputedStyle(els.line);
      probe.style.font = cs.font;
      probe.style.fontSize = cs.fontSize;
      probe.style.fontFamily = cs.fontFamily;
      probe.style.letterSpacing = cs.letterSpacing;
      document.body.appendChild(probe);
      st.charWidth = probe.getBoundingClientRect().width / 10;
      probe.remove();

      // Absolutely positioned children give the line no height of its own, which
      // would break the `translateY(-50%)` that centres it. Pin it to one line.
      els.line.style.height = cs.fontSize;

      // every span's left is charWidth-derived, so they all have to be re-placed
      for (const sp of st.spans) sp.__idx = -1;
      return st.charWidth;
    }

    function build() {
      while (st.spans.length < WINDOW) {
        const sp = document.createElement('span');
        sp.style.position = 'absolute';
        sp.style.top = '0';
        sp.__idx = -1;
        sp.__cls = null;
        sp.__op = null;
        els.line.appendChild(sp);
        st.spans.push(sp);
      }
    }

    function draw(run, draft, dt) {
      if (!st.charWidth) measure();
      build();
      const cw = st.charWidth;
      const cursor = run.cursor;

      // --- the typing pulse ---------------------------------------------------
      if (st.lastCursor >= 0 && cursor > st.lastCursor) {
        st.pulse = Math.min(1, st.pulse + PULSE_GAIN * (cursor - st.lastCursor));
      }
      st.lastCursor = cursor;
      if (st.pulse > 0) {
        st.pulse *= Math.exp(-dt / PULSE_TAU);
        if (st.pulse < 0.002) st.pulse = 0;
      }

      const first = Math.max(0, cursor - WINDOW_BEHIND);
      const last = Math.min(run.text.length, first + WINDOW);

      // The run cut its text back and regenerated past `textCut` (a chapter change).
      // The slots already holding those characters would otherwise keep the old
      // glyphs, so recycle them - a few a frame, nearest the caret first, because
      // recycling all ~50 at once is the 47-write burst the perf test forbids. The
      // cut sits >= 17 characters past the visible edge, about a second even at
      // 200 wpm, and this clears ~50 slots in ~13 frames.
      if (run.textEdits && run.textEdits !== st.textEdits) {
        st.textEdits = run.textEdits;
        st.staleAt = run.textCut + 1;
      }
      for (let n = 0; st.staleAt >= 0 && n < REPAIR_PER_FRAME;) {
        if (st.staleAt >= first + WINDOW) { st.staleAt = -1; break; }
        const sp = st.spans[st.staleAt % WINDOW];
        if (sp.__idx === st.staleAt) { sp.__idx = -1; n++; }
        st.staleAt++;
      }

      for (let idx = first; idx < first + WINDOW; idx++) {
        const span = st.spans[idx % WINDOW];

        // This slot is being recycled for a new character: the only moment it
        // needs its text and its position written.
        if (span.__idx !== idx) {
          span.__idx = idx;
          span.textContent = idx < last ? run.text[idx] : '';
          span.style.left = (idx * cw).toFixed(1) + 'px';
          span.__cls = null;
          span.__op = null;
        } else if (idx < last && span.textContent === '') {
          // the text caught up to a slot we blanked earlier (draft C commits its
          // branch text only once you choose a line)
          span.textContent = run.text[idx];
        }

        if (idx >= last) {
          if (span.__cls !== '') { span.className = ''; span.__cls = ''; }
          if (span.__op !== '') { span.style.opacity = ''; span.__op = ''; }
          continue;
        }

        let cls = '';
        let op = 1;

        if (idx < cursor) {
          const mark = run.marks[idx];
          cls = mark === 'err' ? (run.struck[idx] ? 'strike' : 'err')
            : mark === 'miss' ? 'miss' : 'done';
        } else {
          const d = idx - cursor;
          op = draft.inkAhead(run, d);
          if (st.pulse > 0 && d < PULSE_REACH) {
            op = Math.min(1, op + PULSE_MAX * st.pulse * (1 - d / PULSE_REACH));
          }
        }


        if (span.__cls !== cls) { span.className = cls; span.__cls = cls; }
        const o = op >= 1 ? '' : op.toFixed(3);
        if (span.__op !== o) { span.style.opacity = o; span.__op = o; }
      }

      // --- springs: continuous float positions ---------------------------------
      const target = -cursor * cw;
      if (REDUCED) { st.x = target; st.caretX = target; } else {
        st.x += (target - st.x) * (1 - Math.exp(-SCROLL_K * dt));
        st.caretX += (target - st.caretX) * (1 - Math.exp(-CARET_K * dt));
      }

      els.line.style.transform = 'translate(' + st.x.toFixed(2) + 'px, -50%)';
      els.caret.style.transform = 'translateX(' + (st.caretX - target).toFixed(2) + 'px)';

      // --- the caret twin ------------------------------------------------------
      // Only one character is ever visible through the caret's 1ch window, so the
      // twin is a short substring rather than a second 180-span line. That alone
      // removed half of the old per-frame write load. It stays registered with the
      // MAIN line, not with the caret, so the block reads as a window onto the
      // text rather than a box carrying a glyph around.
      const twinFirst = Math.max(0, cursor - TWIN_BEHIND);
      if (twinFirst !== st.twinFirst || st.twinText === null) {
        st.twinFirst = twinFirst;
        st.twinText = run.text.substr(twinFirst, TWIN_SPAN);
        els.caretLine.textContent = st.twinText;
      }
      const twinShift = (twinFirst - cursor) * cw + (st.x - st.caretX);
      els.caretLine.style.transform = 'translate(' + twinShift.toFixed(2) + 'px, -50%)';

      return { charWidth: cw, first: first, scrollX: st.x, caretOffset: st.caretX - target };
    }

    function reset() {
      st.x = 0; st.caretX = 0;
      st.pulse = 0; st.lastCursor = -1;
      st.twinFirst = -1; st.twinText = null; st.textEdits = 0; st.staleAt = -1;
      for (const sp of st.spans) {
        sp.__idx = -1; sp.__cls = null; sp.__op = null;
        sp.textContent = ''; sp.className = ''; sp.style.opacity = '';
      }
      els.caretLine.textContent = '';
    }

    // adds a class to one character's span, if it is in the window. draw() would
    // overwrite it, so this is for a frozen line only (the death beat); reset()
    // clears it.
    function mark(idx, cls) {
      const sp = st.spans[idx % WINDOW];
      if (!sp || sp.__idx !== idx) return false;
      sp.className = sp.className ? sp.className + ' ' + cls : cls;
      sp.__cls = null;
      return true;
    }

    return {
      measure: measure, draw: draw, reset: reset, mark: mark,
      get charWidth() { return st.charWidth; }
    };
  }

  const api = { createRenderer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
