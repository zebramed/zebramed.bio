/* motion.js — the site's motion layer.
 *
 * One rule: motion means something or it doesn't run. Figures play only
 * while in view, every figure has a complete static end-state, and
 * prefers-reduced-motion renders that end-state with manual stepping.
 *
 * html[data-motion] is "reduced" or "playing"; CSS keys off it.
 */
(() => {
  const html = document.documentElement;
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => mq.matches;
  const setMotion = () => { html.dataset.motion = reduced() ? 'reduced' : 'playing'; };
  setMotion();
  mq.addEventListener('change', () => { setMotion(); figures.forEach(f => f.onMotionChange && f.onMotionChange()); });

  const figures = [];

  /* ---------- in-view gate shared by all figures ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const f = figures.find(x => x.el === e.target);
      if (!f) return;
      e.isIntersecting ? f.enter() : f.leave();
    });
  }, { threshold: 0.3 });

  /* ---------- Figure 1: the lab-in-the-loop ring ---------- */
  document.querySelectorAll('[data-figure="loop"]').forEach(root => {
    const svg = root.querySelector('svg');
    const stations = [...root.querySelectorAll('.station')];
    const turnN = root.querySelector('.turn-n');
    const playBtn = root.querySelector('[data-play]');
    const holdBtns = [...root.querySelectorAll('[data-hold]')];
    const STEP_MS = 2400;
    let step = -1, lap = 0, timer = null, held = null, inView = false;

    const show = i => stations.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      if (k === i || lap > 1 || k < i) s.classList.add('is-done');
    });
    const tick = () => {
      step = (step + 1) % stations.length;
      if (step === 0) {
        lap += 1;
        svg.dataset.turn = String(Math.min(lap, 3));
        if (turnN) turnN.textContent = String(lap).padStart(2, '0');
      }
      show(step);
    };
    const endState = () => {
      clearInterval(timer); timer = null;
      svg.classList.remove('is-playing');
      stations.forEach(s => { s.classList.add('is-done'); s.classList.remove('is-active'); });
      svg.dataset.turn = '3'; if (turnN) turnN.textContent = '03';
    };
    const start = () => {
      if (reduced()) { endState(); return; }
      if (!timer) {
        tick(); timer = setInterval(tick, STEP_MS);
        // The pulse takes one step per station: start it where the ring is now.
        svg.style.setProperty('--orbit-delay', `${-step * STEP_MS}ms`);
      }
      svg.classList.add('is-playing');
      if (playBtn) playBtn.textContent = playBtn.dataset.pauseLabel || 'Pause';
    };
    const stop = () => {
      clearInterval(timer); timer = null;
      svg.classList.remove('is-playing');
      if (playBtn) playBtn.textContent = playBtn.dataset.playLabel || 'Play';
    };
    const playing = () => timer !== null;

    if (playBtn) playBtn.addEventListener('click', () => {
      held = null; holdBtns.forEach(b => b.setAttribute('aria-pressed', 'false'));
      playing() ? stop() : start();
    });
    holdBtns.forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.hold;
      if (held === i) { held = null; b.setAttribute('aria-pressed', 'false'); start(); return; }
      held = i; holdBtns.forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      stop();
      stations.forEach(s => s.classList.add('is-done'));
      stations.forEach((s, k) => s.classList.toggle('is-active', k === i));
    }));

    figures.push({
      el: root,
      enter() { inView = true; if (held === null) start(); },
      leave() { inView = false; if (held === null) stop(); },
      onMotionChange() { if (reduced()) endState(); else if (inView && held === null) start(); }
    });
    io.observe(root);
    if (reduced()) endState();
  });

  /* ---------- Figure 2: the wall chart draws once ---------- */
  // The series carry pathLength="1000", so CSS draws them from .is-drawn alone;
  // nothing is measured (one of the two chart variants is always display:none).
  document.querySelectorAll('[data-figure="wall"]').forEach(root => {
    let drawn = false;
    const draw = () => {
      if (drawn) return; drawn = true;
      root.classList.add('is-drawn');
    };
    const replay = root.querySelector('[data-replay]');
    if (replay) replay.addEventListener('click', () => {
      drawn = false;
      root.classList.add('no-anim'); root.classList.remove('is-drawn');
      requestAnimationFrame(() => requestAnimationFrame(() => { root.classList.remove('no-anim'); draw(); }));
    });
    figures.push({ el: root, enter() { draw(); }, leave() {}, onMotionChange() { if (reduced()) draw(); } });
    io.observe(root);
    if (reduced()) draw();
  });

  /* ---------- count-up for numeric measures only ---------- */
  document.querySelectorAll('[data-count]').forEach(el => {
    const raw = el.dataset.count;
    const target = parseFloat(raw);
    if (!isFinite(target)) return;               // placeholders stay as written
    const suffix = el.dataset.suffix || '';
    const decimals = (raw.split('.')[1] || '').length;
    const render = v => { el.textContent = v.toFixed(decimals) + suffix; };
    if (reduced()) { render(target); return; }
    render(0);
    let done = false;
    figures.push({
      el, leave() {},
      enter() {
        if (done) return; done = true;
        const t0 = performance.now(), dur = 900;
        const frame = t => { const k = Math.min(1, (t - t0) / dur); render(target * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(frame); };
        requestAnimationFrame(frame);
      }
    });
    io.observe(el);
  });
})();
