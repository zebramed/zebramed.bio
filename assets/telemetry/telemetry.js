/* telemetry.js: audience measurement for zebramed.bio, read from the outside.
 *
 * Loaded by _layouts/default.html only while site.telemetry.enabled is true
 * (see the telemetry block in _config.yml, which also says how to remove it).
 * The site's own scripts know nothing about this file: it watches the DOM
 * hooks listed under HOOKS and never changes the page, except to wire the
 * opt-out box on the privacy page, which also shows the visitor id.
 *
 * What leaves the browser: running totals per page view (seconds, counts,
 * enums), keyed by a random page-view id that lives only in this page's
 * memory, and a random visitor id kept in localStorage for 13 months from its
 * creation, never extended. No cookie, no referrer URL, no text. The visitor
 * id and the opt-out choice are the only things ever stored on the device;
 * opting out (or a GPC/DNT signal) deletes the id. The receiver (tally) drops
 * anything outside its allowlist and never stores the IP address. The team
 * lists its own browsers' ids on tally's admin page, so the dashboard can
 * leave them out.
 *
 * Kept outside assets/js/ on purpose: Tailwind scans that folder.
 */
(() => {
  'use strict';

  const script = document.currentScript;
  const SRC = 'zebramed.bio';
  const OPTOUT_KEY = 'zm-measure-optout';
  const ID_KEY = 'zm-measure-id';
  const ID_DAYS = 393;        // the shortest 13 months (365 + 28 days), so the id never outlives what the policy says
  const TICK_MS = 1000;
  const IDLE_MS = 15000;      // no input for this long and the visitor is no longer reading
  const PERIODIC_MS = 60000;  // while reading, send at most this often
  const MAX_SEQ = 300;        // requests per page view
  const MAX_ITEMS = 40;       // events per request
  const MAX_S = 43200;

  const safe = fn => function () { try { return fn.apply(this, arguments); } catch (e) { /* never disturb the page */ } };

  /* ---------- opt-out: works on every host, before any other check ---------- */
  const stored = {
    get() { try { return localStorage.getItem(OPTOUT_KEY) === '1'; } catch (e) { return false; } },
    set(off) { try { if (off) localStorage.setItem(OPTOUT_KEY, '1'); else localStorage.removeItem(OPTOUT_KEY); } catch (e) { /* storage blocked */ } },
  };
  const signalled = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  // "<uuid> <created, ms>". A visit never renews it: once expired, a new one replaces it.
  const visitor = {
    get() {
      try {
        const [id, since] = (localStorage.getItem(ID_KEY) || '').split(' ');
        const age = Date.now() - Number(since);
        return /^[0-9a-f-]{36}$/.test(id) && age >= 0 && age < ID_DAYS * 864e5 ? id : '';
      } catch (e) { return ''; }
    },
    ensure(make) {
      const id = visitor.get();
      if (id) return id;
      try {
        const fresh = make();
        localStorage.setItem(ID_KEY, fresh + ' ' + Date.now());
        return visitor.get();
      } catch (e) { return ''; }
    },
    forget() { try { localStorage.removeItem(ID_KEY); } catch (e) { /* storage blocked */ } },
  };
  if (signalled || stored.get()) visitor.forget();

  let stop = () => {};
  const boxes = [...document.querySelectorAll('[data-telemetry-optout]')]
    .filter(box => box.querySelector('button') && box.querySelector('[role="status"]'));
  const renderBoxes = () => boxes.forEach(box => {
    const btn = box.querySelector('button'), status = box.querySelector('[role="status"]');
    const off = stored.get();
    btn.style.display = signalled ? 'none' : '';
    btn.textContent = off ? box.dataset.onLabel : box.dataset.offLabel;
    status.textContent = signalled ? box.dataset.statusSignal : off ? box.dataset.statusOff : box.dataset.statusOn;
    const shown = box.querySelector('[data-telemetry-id]'), code = shown && shown.querySelector('code');
    if (!code) return;
    const id = signalled || off ? '' : visitor.get();
    code.textContent = id;
    shown.hidden = !id;   // none yet on previews, or before this page's first measurement
  });
  boxes.forEach(safe(box => {
    const btn = box.querySelector('button');
    btn.addEventListener('click', safe(() => {
      stored.set(!stored.get());
      if (stored.get()) { stop(); visitor.forget(); }   // turning it back on takes effect on the next page
      renderBoxes();
    }));
    const code = box.querySelector('[data-telemetry-id] code');
    if (code) code.style.userSelect = code.style.webkitUserSelect = 'all';   // one tap selects the whole id
    box.hidden = false;
  }));
  safe(renderBoxes)();

  /* ---------- gates ---------- */
  const endpoint = script && script.dataset.endpoint;
  const params = new URLSearchParams(location.search);
  if (!endpoint || !script.dataset.host || location.hostname !== script.dataset.host) return;  // previews, jekyll serve, CI
  if (signalled || stored.get() || navigator.webdriver) return;
  if (params.has('pf-t')) return;   // review links that set the film's clock

  /* ---------- HOOKS: the DOM this file reads (and what a missing one costs) ---------- */
  // main section[id|class]          per-section time (bit 1)
  // [data-figure="loop"|"wall"]     time in view of the ring and the wall chart (bits 2, 4)
  // [data-pf-stage]                 time in view of the platform film (bit 8)
  // [data-platform] [data-select]   inline --p, the film's progress per chapter (bit 16)
  // [data-pf-*], [data-play], [data-hold], [data-replay], #mobile-menu-btn   control.use
  // article.person, article.member (img alt or h3/h4)   whose card a link.click came from
  // .board                          place "board" instead of the section
  const FIGURES = [['loop', '[data-figure="loop"]', 0.3, 2], ['wall', '[data-figure="wall"]', 0.3, 4], ['film', '[data-pf-stage]', 0.6, 8]];
  const CHAPTERS = '[data-platform] [data-select]';
  const label = el => (el.textContent || '').trim();
  const CONTROLS = [
    ['[data-pf-play]', b => ({ Pause: 'film.pause', Replay: 'film.replay' })[label(b)] || 'film.play'],
    ['[data-pf-prev]', () => 'film.prev'],
    ['[data-pf-next]', () => 'film.next'],
    [CHAPTERS, () => 'film.chapter'],
    ['[data-play]', b => label(b) === 'Pause' ? 'loop.pause' : 'loop.play'],
    ['[data-hold]', () => 'loop.hold'],
    ['[data-replay]', () => 'wall.replay'],
    ['#mobile-menu-btn', () => 'menu'],
  ];

  /* ---------- page-level facts, classified here so raw values never leave ---------- */
  const cleanPath = p => (p.replace(/\.html$/, '').replace(/\/index$/, '').replace(/\/+$/, '')) || '/';
  const uuid = () => {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };
  const from = () => {
    const r = document.referrer;
    if (!r) return 'direct';
    if (/^android-app:\/\/com\.linkedin\.android/.test(r)) return 'linkedin';
    let h;
    try { h = new URL(r).hostname.toLowerCase(); } catch (e) { return 'other'; }
    const is = re => re.test(h);
    if (h === location.hostname) return 'internal';
    if (is(/(^|\.)zebramed\.bio$/)) return 'zebramed';
    if (is(/(^|\.)(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com)$/)) return 'ai';
    if (is(/^(mail\.google\.com|outlook\.(live|office|office365)\.com|mail\.yahoo\.com|mail\.proton\.me)$|^(web)?mail\./)) return 'webmail';
    if (is(/(^|\.)(linkedin\.com|lnkd\.in)$/)) return 'linkedin';
    if (is(/(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|qwant\.com|ecosia\.org|search\.yahoo\.com|yandex\.[a-z]+|baidu\.com|startpage\.com|search\.brave\.com|kagi\.com)$/)) return 'search';
    if (is(/(^|\.)(x\.com|twitter\.com|t\.co|facebook\.com|instagram\.com|threads\.net|bsky\.app|reddit\.com|youtube\.com)$|^mastodon\./)) return 'social';
    return 'other';
  };
  const ref = () => { const v = (params.get('ref') || '').toLowerCase(); return /^[a-z0-9-]{1,32}$/.test(v) ? v : ''; };
  const sectionName = s => s.id || s.classList[s.classList.length - 1] || 'section';
  const place = el => {
    if (el.closest('header')) return 'header';
    if (el.closest('footer')) return 'footer';
    if (el.closest('.board')) return 'board';
    const s = el.closest('main section');
    return s ? sectionName(s) : 'other';
  };
  // The team or board member whose card holds the link: their name (the
  // photo's alt text, else the heading before any ", PhD"), as a slug.
  const person = el => {
    const card = el.closest('article.person, article.member');
    if (!card) return '';
    const img = card.querySelector('img[alt]'), h = card.querySelector('h3, h4');
    const name = img && img.alt ? img.alt : h ? label(h).split(',')[0] : '';
    return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  };
  const linkKind = a => {
    if (/^mailto:/i.test(a.getAttribute('href') || '')) return 'email';
    let u;
    try { u = new URL(a.href, location.href); } catch (e) { return 'other'; }
    if (/(^|\.)linkedin\.com$/.test(u.hostname)) return 'linkedin';
    if (u.origin !== location.origin) return 'external';
    const p = cleanPath(u.pathname);
    if (p === cleanPath(location.pathname) && u.hash) return 'anchor';
    if (p === '/') return 'home';
    if (/^\/(privacy|legal-notice|terms)$/.test(p)) return 'legal';
    return 'page';
  };

  /* ---------- state of one page view ---------- */
  let vid = '', pv, seq, t, sent, startedAt, last, prevState, lastInput, lastSend, engagedAtSend, timer = null, stopped = false;
  let current = null, depthDirty = true, lastP = {}, lastFilmControl = -Infinity, hooks = 0;
  const inView = new Set();

  const reset = () => {
    pv = uuid(); seq = 0; sent = new Map();
    startedAt = last = lastInput = performance.now(); lastSend = 0; engagedAtSend = -1; prevState = null; lastP = {};
    t = { visible: 0, focused: 0, engaged: 0, depth: 0, sections: {}, figures: {}, chapters: {}, played: 0, done: false, controls: {}, links: {} };
  };
  const bump = (o, k, by) => { o[k] = (o[k] || 0) + by; };

  /* ---------- reading the film from outside ---------- */
  // --p only moves while the stage is at least 60% on screen and the film plays,
  // so a rise on a tick with no recent control use is the visitor watching.
  const readFilm = now => {
    if (!inView.has('film')) { lastP = {}; return false; }
    let moved = false;
    document.querySelectorAll(CHAPTERS).forEach(b => {
      const raw = b.style.getPropertyValue('--p');
      if (raw === '') return;   // film not on yet: no reading, not zero
      const p = Math.min(1, Math.max(0, parseFloat(raw)));
      if (isNaN(p)) return;
      hooks |= 16;
      const name = b.dataset.select;
      const c = t.chapters[name] || (t.chapters[name] = { watched: 0, reached: 0 });
      const before = lastP[name];
      if (before !== undefined && p > before && now - lastFilmControl > 1500) {
        c.watched = Math.min(1, c.watched + p - before);
        moved = true;
      }
      if (p > c.reached) c.reached = p;
      lastP[name] = p;
    });
    if (t.chapters.xenoex && t.chapters.xenoex.reached >= 0.999) t.done = true;
    return moved;
  };

  /* ---------- clock ---------- */
  const sample = now => {
    const focused = document.hasFocus();
    const filmMoved = readFilm(now);
    return { focused, filmMoved, engaged: focused && (now - lastInput < IDLE_MS || filmMoved), section: current, figures: [...inView] };
  };
  const credit = (dt, st) => {
    t.visible += dt;
    if (st.focused) t.focused += dt;
    if (st.filmMoved) t.played += dt;
    if (!st.engaged) return;
    t.engaged += dt;
    if (st.section) bump(t.sections, st.section, dt);
    st.figures.forEach(f => bump(t.figures, f, dt));
  };
  const measureDepth = () => {
    const doc = document.documentElement;
    const d = Math.min(100, Math.floor(((window.scrollY + window.innerHeight) / Math.max(1, doc.scrollHeight)) * 10) * 10);
    if (d > t.depth) t.depth = d;
    depthDirty = false;
  };
  const tick = safe(() => {
    if (document.visibilityState !== 'visible' || stopped) return;
    const now = performance.now();
    const dt = Math.min(now - last, 2000);   // a sleeping laptop adds nothing
    last = now;
    if (depthDirty) measureDepth();
    const st = sample(now);
    credit(dt, st);
    prevState = st;
    if (now - lastSend >= PERIODIC_MS && t.engaged !== engagedAtSend) flush();
  });
  const finalTick = () => {   // the stretch between the last tick and the tab hiding
    if (!prevState) return;
    const now = performance.now();
    credit(Math.min(now - last, 2000), prevState);
    last = now;
  };
  const run = () => { if (timer === null && !stopped) { last = performance.now(); timer = setInterval(tick, TICK_MS); } };
  const pause = () => { if (timer !== null) { clearInterval(timer); timer = null; } };

  /* ---------- sending ---------- */
  const s = ms => Math.min(MAX_S, Math.round(ms / 1000));
  const pct = x => Math.round(x * 100);
  const items = () => {
    const out = [['page.engaged', 'page.engaged', {
      open: s(performance.now() - startedAt), visible: s(t.visible), focused: s(t.focused), engaged: s(t.engaged), depth: t.depth, hooks,
    }]];
    Object.entries(t.sections).forEach(([k, v]) => out.push(['section:' + k, 'section.engaged', { section: k, s: s(v) }]));
    Object.entries(t.figures).forEach(([k, v]) => out.push(['figure:' + k, 'figure.view', { figure: k, s: s(v) }]));
    Object.entries(t.chapters).forEach(([k, c]) => out.push(['chapter:' + k, 'film.chapter', { chapter: k, watched: pct(c.watched), reached: pct(c.reached) }]));
    if (t.played || t.done) out.push(['film', 'film.state', { played_s: s(t.played), done: t.done }]);
    Object.entries(t.controls).forEach(([k, n]) => out.push(['control:' + k, 'control.use', { control: k, n }]));
    Object.entries(t.links).forEach(([k, n]) => {
      const [kind, where, who] = k.split('|');
      const a = { kind, place: where, n };
      if (who) a.person = who;
      out.push(['link:' + k, 'link.click', a]);
    });
    return out;
  };
  const post = ev => {
    if (seq >= MAX_SEQ) return;
    seq += 1;
    const body = JSON.stringify(vid ? { v: 1, src: SRC, vid, pv, seq, ev } : { v: 1, src: SRC, pv, seq, ev });
    // Not sendBeacon: it always sends cookies, and the team's sign-in cookie is
    // scoped to zebramed.bio. A string body goes as text/plain: no preflight.
    fetch(endpoint, { method: 'POST', body, keepalive: true, credentials: 'omit', mode: 'no-cors' }).catch(() => {});
  };
  const flush = safe(extra => {
    if (stopped) return;
    const ev = extra ? [extra] : [];
    items().forEach(([key, n, a]) => {
      const j = JSON.stringify(a);
      if (sent.get(key) === j) return;
      sent.set(key, j);
      ev.push({ n, a });
    });
    for (let i = 0; i < ev.length; i += MAX_ITEMS) post(ev.slice(i, i + MAX_ITEMS));
    lastSend = performance.now();
    engagedAtSend = t.engaged;
  });

  /* ---------- listeners ---------- */
  const onInput = () => { lastInput = performance.now(); };
  ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'].forEach(e => addEventListener(e, onInput, { passive: true, capture: true }));
  addEventListener('scroll', () => { lastInput = performance.now(); depthDirty = true; }, { passive: true });

  const filmControl = name => { if (name.startsWith('film.')) { lastFilmControl = performance.now(); lastP = {}; } };
  const countControl = name => { bump(t.controls, name, 1); filmControl(name); };
  document.addEventListener('click', safe(e => {
    if (!(e.target instanceof Element) || stopped) return;
    for (const [sel, name] of CONTROLS) {
      const b = e.target.closest(sel);
      if (b) { countControl(name(b)); return; }
    }
    const a = e.target.closest('a[href]');
    if (a) bump(t.links, linkKind(a) + '|' + place(a) + '|' + person(a), 1);
  }), { capture: true, passive: true });
  // main.js cancels Enter/Space on the chapter buttons, so no click follows.
  document.addEventListener('keydown', safe(e => {
    if (stopped || (e.key !== 'Enter' && e.key !== ' ') || !(e.target instanceof Element) || !e.target.closest(CHAPTERS)) return;
    setTimeout(safe(() => { if (e.defaultPrevented) countControl('film.chapter'); }), 0);
  }), { capture: true });

  const observe = () => {
    const sections = document.querySelectorAll('main section');
    if (sections.length) hooks |= 1;
    const reading = new IntersectionObserver(safe(entries => entries.forEach(e => {
      const name = sectionName(e.target);
      if (e.isIntersecting) current = name;
      else if (current === name) current = null;
    })), { rootMargin: '-40% 0px -59% 0px' });
    sections.forEach(sec => reading.observe(sec));
    FIGURES.forEach(([name, sel, threshold, bit]) => {
      const el = document.querySelector(sel);
      if (!el) return;
      hooks |= bit;
      // isIntersecting stays true below the threshold, so compare the ratio
      new IntersectionObserver(safe(entries => entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio >= threshold - 0.01) inView.add(name); else inView.delete(name);
      })), { threshold }).observe(el);
    });
  };

  const pageView = () => {
    const a = { path: cleanPath(location.pathname), from: from(), vw: innerWidth < 720 ? 's' : innerWidth < 1240 ? 'm' : 'l',
      motion: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full' };
    const r = ref();
    if (r) a.ref = r;
    return { n: 'page.view', a };
  };
  const begin = () => {
    vid = visitor.ensure(uuid);   // '' when storage is blocked: measured without one
    reset();
    measureDepth();
    flush(pageView());
    run();
    safe(renderBoxes)();
  };

  stop = () => { stopped = true; pause(); };
  document.addEventListener('visibilitychange', safe(() => {
    if (stopped || !pv) return;   // !pv: not seen yet, the first-visible handler starts it
    if (document.visibilityState === 'hidden') { finalTick(); pause(); flush(); }
    else run();
  }));
  addEventListener('pagehide', safe(() => { if (!stopped && pv) { finalTick(); pause(); flush(); } }));
  addEventListener('pageshow', safe(e => { if (e.persisted && !stopped) begin(); }));   // back from bfcache: a new page view

  const start = safe(() => {
    observe();
    if (document.visibilityState === 'visible') { begin(); return; }
    const first = safe(() => {   // opened in a background tab: start when first seen
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', first);
      begin();
    });
    document.addEventListener('visibilitychange', first);
  });
  if (document.prerendering) document.addEventListener('prerenderingchange', start, { once: true });
  else start();
})();
