(function (root) {
  'use strict';

  const WINDOW_BEHIND = 70;
  const WINDOW_AHEAD = 110;
  const SCROLL_K = 14;      // spring constants: scroll tracks tightly,
  const CARET_K = 9;        // the caret lags a little, deliberately

  function createRenderer(els) {
    const st = {
      charWidth: 0,
      x: 0, caretX: 0,       // continuous floats, never character indices
      spans: [], twins: [],
      first: -1
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
      return st.charWidth;
    }

    function ensure(host, bank, count) {
      while (bank.length < count) {
        const sp = document.createElement('span');
        host.appendChild(sp);
        bank.push(sp);
      }
      for (let i = count; i < bank.length; i++) {
        if (bank[i].textContent !== '') bank[i].textContent = '';
      }
    }

    function draw(run, draft, dt) {
      if (!st.charWidth) measure();
      const cw = st.charWidth;

      const first = Math.max(0, run.cursor - WINDOW_BEHIND);
      const last = Math.min(run.text.length, run.cursor + WINDOW_AHEAD);
      const count = last - first;

      ensure(els.line, st.spans, count);
      ensure(els.caretLine, st.twins, count);

      const isC = run.draft === 'c';

      for (let i = 0; i < count; i++) {
        const idx = first + i;
        const ch = run.text[idx];
        const span = st.spans[i];
        const twin = st.twins[i];

        if (span.textContent !== ch) { span.textContent = ch; twin.textContent = ch; }

        let cls = '';
        let op = 1;

        if (idx < run.cursor) {
          const mark = run.marks[idx];
          cls = mark === 'err' ? 'err' : mark === 'miss' ? 'miss' : 'done';
        } else {
          op = draft.inkAhead(run, idx - run.cursor);
        }

        // draft C: the edge has consumed everything behind it
        if (isC && idx < run.edge) { op = 0; cls = 'miss'; }

        if (span.className !== cls) span.className = cls;
        const o = op >= 1 ? '' : op.toFixed(3);
        if (span.style.opacity !== o) span.style.opacity = o;
      }

      // springs - continuous float positions
      const target = -(run.cursor - first) * cw;
      st.x += (target - st.x) * (1 - Math.exp(-SCROLL_K * dt));
      st.caretX += (target - st.caretX) * (1 - Math.exp(-CARET_K * dt));

      els.line.style.transform = 'translate(' + st.x.toFixed(2) + 'px, -50%)';
      els.caretLine.style.transform = 'translate(' + st.caretX.toFixed(2) + 'px, -50%)';
      els.caret.style.transform = 'translateX(' + (st.caretX - target).toFixed(2) + 'px)';

      st.first = first;
      return { charWidth: cw, first: first, scrollX: st.x, caretOffset: st.caretX - target };
    }

    function reset() {
      st.x = 0; st.caretX = 0; st.first = -1;
      for (const sp of st.spans) { sp.textContent = ''; sp.className = ''; sp.style.opacity = ''; }
      for (const sp of st.twins) sp.textContent = '';
    }

    return {
      measure: measure, draw: draw, reset: reset,
      get charWidth() { return st.charWidth; }
    };
  }

  const api = { createRenderer };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
