(function (root) {
  'use strict';

  // 200 px/s. At 0.09 the ticks sat ~6px apart at 160 wpm and read as a texture
  // rather than a cadence; this shows roughly the last six seconds, legibly.
  const PX_PER_MS = 0.2;
  const CAPACITY = 500;
  const TICK_H = 13;

  function createRail(canvas) {
    const ctx = canvas.getContext('2d');
    const times = [];
    let w = 0, h = 0, ink = '#17171a', rule = '#e6e2d7';

    function readColours() {
      const st = getComputedStyle(document.documentElement);
      ink = (st.getPropertyValue('--ink') || '#17171a').trim();
      rule = (st.getPropertyValue('--rule') || '#e6e2d7').trim();
    }

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      readColours();
    }

    function mark(nowMs) {
      times.push(nowMs);
      if (times.length > CAPACITY) times.shift();
    }

    function draw(nowMs, rhythm) {
      // A canvas created while its section is display:none measures 0x0 and never
      // paints. Re-measure whenever the layout width has moved out from under us.
      if (!w || Math.abs(canvas.clientWidth - w) > 0.5) resize();
      if (!w) return;
      ctx.clearRect(0, 0, w, h);

      const mid = Math.round(h / 2);
      ctx.fillStyle = rule;
      ctx.fillRect(0, mid, w, 1);

      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.3 + 0.55 * (rhythm / 100);
      const top = Math.round((h - TICK_H) / 2);
      for (let i = times.length - 1; i >= 0; i--) {
        const x = w - (nowMs - times[i]) * PX_PER_MS;
        if (x < -2) break;
        if (x > w) continue;
        ctx.fillRect(Math.round(x), top, 1, TICK_H);
      }
      ctx.globalAlpha = 1;
    }

    function reset() { times.length = 0; }

    resize();
    return { resize: resize, mark: mark, draw: draw, reset: reset };
  }

  const api = { createRail };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cadence = Object.assign(root.cadence || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this);
