// Injected by docs/preview/compare/server.py into every page it serves; never
// part of the site. Tells the compare page where the reader is (which section,
// and how far into it) and follows the other pane. Sections are matched by id,
// so two designs of different lengths still line up section by section.
(() => {
  if (window.parent === window) return;
  const post = msg => window.parent.postMessage(Object.assign({ zm: true }, msg), '*');

  const anchors = () => {
    const max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const list = [{ id: '#top', top: 0 }];
    document.querySelectorAll('main section[id], footer').forEach(el => {
      const top = Math.min(max, el.getBoundingClientRect().top + scrollY);
      list.push({ id: el.id ? '#' + el.id : 'footer', top });
    });
    list.push({ id: '#end', top: max });
    return list.sort((a, b) => a.top - b.top);
  };

  const where = () => {
    const y = scrollY, a = anchors();
    let i = 0;
    while (i < a.length - 2 && a[i + 1].top <= y) i++;
    const span = a[i + 1].top - a[i].top;
    return { id: a[i].id, frac: span > 0 ? Math.min(1, (y - a[i].top) / span) : 0 };
  };

  const scrollToPos = (id, frac) => {
    const a = anchors();
    const i = a.findIndex(x => x.id === id);
    let y;
    if (i === -1 || i === a.length - 1) {
      y = i === -1 ? 0 : a[i].top;            // section missing on this side: stay put at top
    } else {
      y = a[i].top + frac * (a[i + 1].top - a[i].top);
    }
    window.scrollTo({ top: y, behavior: 'instant' });
  };

  let following = false, raf = 0;
  addEventListener('scroll', () => {
    if (following) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => post(Object.assign({ type: 'pos' }, where())));
  }, { passive: true });

  addEventListener('message', e => {
    const d = e.data;
    if (!d || !d.zm) return;
    if (d.type === 'follow') {
      following = true;
      scrollToPos(d.id, d.frac);
      setTimeout(() => { following = false; }, 120);
    } else if (d.type === 'jump') {
      // like the site's own nav links: lands below the sticky header (scroll-margin-top)
      const el = d.id.startsWith('#') && d.id.length > 1 && document.getElementById(d.id.slice(1));
      if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' });
      else scrollToPos(d.id, 0);              // reported either way, so the other pane follows
    } else if (d.type === 'reload') {
      location.reload();
    }
  });

  post({ type: 'nav', path: location.pathname });
})();
