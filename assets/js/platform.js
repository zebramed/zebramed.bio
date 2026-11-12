/*
 * The platform as one story, played like a film while it is in view: the figure, a line for each step,
 * and the chapters (Run, Translate, Reason) with previous/next. Without this script the three panes show as before.
 * 2D renderer ported from docs/preview/graph-backbone.html. Illustrative, fictional values.
 */
(() => {
'use strict';

const group = document.querySelector('[data-platform]');
const stage = group && group.querySelector('[data-pf-stage]');
if (!stage) return;
const sticky = group.querySelector('[data-pf-sticky]');
const story = group.querySelector('[data-pf-story]');
const bar = group.querySelector('[data-select-bar]');
const narr = group.querySelector('[data-pf-narration]');
const chapterText = group.querySelector('.rows');
const nStep = group.querySelector('[data-pf-step]'), nText = group.querySelector('[data-pf-text]');
// Three arrangements: the chapter text beside the figure (wide and tall enough for the figure to stay legible);
// on short wide screens, the step line and controls beside the figure and the chapter text under it; otherwise
// one column. The wide figure from 900px, or from 720px in landscape; below, and on portrait tablets, the portrait one.
const wideQ = window.matchMedia('(min-width: 1240px) and (min-height: 740px)');
const shortQ = window.matchMedia('(min-width: 1024px) and (max-height: 739.98px)');
const layoutQ = window.matchMedia('(min-width: 900px), (min-width: 720px) and (orientation: landscape)');
const reduceQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const MEDIA = stage.dataset.media || '/assets/media/platform/';

const CLIPS = { lateral: { src: MEDIA + 'imaged' }, behaviour: { src: MEDIA + 'tracked' } };
const NS = 'http://www.w3.org/2000/svg';
const COL = { line: '#9fb0d0', live: '#64ffda', context: '#c3a6ff', result: '#a8ff78', flag: '#f5b85c', target: '#ff6b7d',
              human: '#6cb6ff', medium: '#ccd6f6', light: '#ffffff', plate: '#12173c', bg: '#0b1036' };

// ---------- the storyboard ----------
// Each input: appear, stay large while its content plays, dock, connect, pause. Models: the same, shorter.
// Every step lasts at least as long as its line takes to read (about 250 ms a word, plus a second), and so does each
// status line in XenoEx.
const BACKBONE   = { build: 2600, rest: 4000 };
const INPUT_STEP = { appear: 400, dock: 650, link: 600, stagger: 120, pulse: 650, rest: 2200 };
const HOLD       = { imaged: 9000, tracked: 5200, sequenced: 5600, human: 5600 };
// While each whole-organism (and the human) card is shown large: what is at work, what it does, and a
// checklist that ticks as the card shows each read-out (ms after the card starts).
const PRESENT = {
  imaged:    { head: 'FishEye in action', sub: 'Our computer vision, extracting phenomics from the perturbed larva',
               checks: [['vessels', 3000], ['organs', 5600], ['morphology', 8000]] },
  tracked:   { head: 'FishEye in action', sub: 'Our computer vision, tracking behaviour under perturbation',
               checks: [['keypoints', 1000], ['swim path', 3600], ['speed', 4800]] },
  sequenced: { head: 'Whole-organism transcriptomics', sub: 'The gene programmes the perturbation changes',
               checks: [['reads', 1000], ['genes', 2600], ['programmes', 4000]] },
  human:     { head: 'Human pathobiology', sub: 'Human evidence on molecules of the same families', color: COL.human,
               checks: [['clinical trials', 1200], ['concordance studies', 2800], ['existing datasets', 4400]] },
};
const PROPAGATE  = { wave: 2400, rest: 4200 };
// other models: no zoom; they appear together, one after another, then all connect
const MODEL_STEP = { appear: 350, stagger: 200, hold: 1900, link: 600, linkStagger: 150, pulse: 550, rest: 4000 };
// Reason: XenoEx predicts, validates where it is unsure, then is asked for targets. Times within each part.
const PREDICT  = { card: 600, typeAt: 300, type: 1000, outAt: 1500, backAt: 2700, barsAt: 3600, rankAt: 6100, rank: 1200, end: 8800 };
const VALIDATE = { reqAt: 2400, req: 1500, runAt: 3900, run: 2800, backAt: 6700, moaAt: 8300, moaStep: 380, updAt: 9600, upd: 900, rankAt: 11000, rank: 1100, end: 13000 };
const DISCOVER = { switchD: 600, typeAt: 400, type: 900, walkAt: 1500, walkStep: 380, popAt: 3700, popStep: 450, listAt: 4300, listStep: 300, end: 8800 };
const TL = {};

// ---------- the graph (unit square) ----------
const ORGANS = [
  { id: 'liver',  label: 'liver',  x: .50, y: .50 },
  { id: 'brain',  label: 'brain',  x: .27, y: .17 },
  { id: 'heart',  label: 'heart',  x: .74, y: .19 },
  { id: 'kidney', label: 'kidney', x: .86, y: .63 },
  { id: 'gut',    label: 'gut',    x: .33, y: .85 },
  { id: 'muscle', label: 'muscle', x: .11, y: .55 },
];
// molecular signals around each organ, by angle (deg, y down); the label sits below, so no 60–120
const SIGNALS = { liver: [-140, -60, 15], brain: [-150, -40], heart: [-130, -20],
                  kidney: [-30, 160], gut: [-150, 170], muscle: [-110, 170] };
const FUNCS = [
  { id: 'activity',   label: 'activity',   x: .10, y: .25, links: ['brain', 'muscle'] },
  { id: 'rate',       label: 'heart rate', x: .93, y: .34, links: ['heart'] },
  { id: 'flow',       label: 'blood flow', x: .90, y: .48, links: ['heart', 'kidney'] },
  { id: 'metabolism', label: 'metabolism', x: .64, y: .74, links: ['liver', 'gut'] },
];
const ORGAN_EDGES = [['liver', 'heart'], ['liver', 'brain'], ['liver', 'gut'], ['liver', 'kidney'], ['gut', 'brain'], ['brain', 'muscle']];
// each input links to the n nodes of its pool nearest to it (one per organ); 'keep' nodes link regardless
const INPUTS = [
  { id: 'imaged',    kind: 'lateral',   title: 'Whole organism · imaged',    caption: 'imaged',    pool: ['liver', 'gut', 'brain', 'flow'], keep: ['heart'], n: 3 },
  { id: 'tracked',   kind: 'behaviour', title: 'Whole organism · tracked',   caption: 'tracked',   pool: ['activity', 'muscle', 'rate'], n: 2 },
  { id: 'sequenced', kind: 'heatmap',   title: 'Whole organism · sequenced', caption: 'sequenced',
    pool: ['liver', 'brain', 'heart', 'gut', 'kidney'].flatMap(o => SIGNALS[o].map((_, i) => `${o}-${i}`)), n: 3 },
];
// human pathobiology: prior human data, joined at the organs where human toxicity shows
const HUMAN = { id: 'human', kind: 'human', title: 'Human pathobiology', caption: 'human data', pool: ['liver', 'heart', 'kidney'], n: 3 };
// other models attach to nodes already in the graph, adding none of their own
const MODELS = [
  { id: 'cells',     kind: 'dish',     title: 'Cell cultures', caption: 'cell cultures', to: ['liver-0', 'heart-0'] },
  { id: 'organoids', kind: 'organoid', title: 'Organoids',     caption: 'organoids',     to: ['liver', 'brain'] },
  { id: 'chip',      kind: 'chip',     title: 'Organ-on-chip', caption: 'organ-on-chip', to: ['gut', 'liver'], couple: ['gut', 'liver'] },
];
const OUT_ORGANS = ['liver', 'heart', 'brain', 'kidney'];
// ZM-131's heart risk is uncertain until the validation run comes back
const CANDIDATES = [
  { name: 'ZM-104', risk: [.18, .10, .14, .08] },
  { name: 'ZM-087', risk: [.78, .22, .12, .34] },
  { name: 'ZM-131', risk: [.30, .66, .20, .16], unsure: { j: 1, lo: .38, hi: .92, to: .34 } },
  { name: 'ZM-062', risk: [.16, .14, .62, .22] },
];
const DISEASE = 'MASH';
// what the validation run shows about ZM-131: the mechanism, from a liver signal through the liver to the heart
const MOA_PATH = ['liver-2', 'liver', 'heart', 'rate'];
const DISCOVER_QUERY = ['gut', 'liver', 'metabolism', 'kidney'];
const DISCOVER_WALK = [['gut', 'liver'], ['liver', 'metabolism'], ['metabolism', 'gut'], ['liver', 'kidney']];
// new targets sit on the mechanism lines XenoEx walks, part way (u) from one node to the other
const TARGETS = [
  { id: 'T1', on: ['liver', 'metabolism'], u: .55, where: 'liver · metabolism', score: .86 },
  { id: 'T2', on: ['gut', 'liver'],        u: .5,  where: 'gut–liver axis',     score: .74 },
  { id: 'T3', on: ['liver', 'kidney'],     u: .62, where: 'liver · kidney',     score: .61 },
];

(function timeline() {
  let t = BACKBONE.build + BACKBONE.rest;
  const inputStep = inp => {
    const s = INPUT_STEP, st = { appear: s.appear, dockAt: s.appear + HOLD[inp.id], dock: s.dock };
    st.linkAt = st.dockAt + s.dock;
    st.pulseAt = st.linkAt + s.link * .75;
    st.end = st.linkAt + s.link + (inp.n - 1) * s.stagger + s.pulse;
    st.next = st.end + s.rest;
    inp.step = st;
    return st.next;
  };
  TL.inputs = INPUTS.map(inp => { const T = t; t += inputStep(inp); return T; });
  TL.prop = t; t += PROPAGATE.wave + PROPAGATE.rest;
  TL.human = t; t += inputStep(HUMAN);
  // other models appear together, one after another, then all their links draw, one after another
  {
    const s = MODEL_STEP, T0 = t;
    TL.models = MODELS.map((m, i) => { m.step = { appear: s.appear, dockAt: 0, dock: 1 }; return T0 + i * s.stagger; });
    let k = 0, linkAt = T0 + (MODELS.length - 1) * s.stagger + s.appear + s.hold;
    MODELS.forEach(m => { m.links = m.to.map(() => linkAt + (k++) * s.linkStagger); });
    TL.modelsEnd = linkAt + (k - 1) * s.linkStagger + s.link + s.pulse;
    t = TL.modelsEnd + s.rest;
  }
  TL.predict = t; t += PREDICT.end;
  TL.validate = t; t += VALIDATE.end;
  TL.discover = t; t += DISCOVER.end;
  TL.end = t;
})();

// chapters, in page order
const CHAPTERS = [{ key: 'biofoundry' }, { key: 'interactome' }, { key: 'xenoex' }];
// The story in steps: when each starts (t), where it comes to rest, its chapter, and what the page says.
const STEP_TEXT = {
  backbone:  ['Systemic atlas', 'A multi-species knowledge graph of the body as one system: organs, and the functions and molecular signals that connect them.'],
  imaged:    ['Imaged', 'A living organism, perturbed by a compound, is imaged whole. FishEye segments it and extracts its phenomics: vessels, organs, morphology.'],
  tracked:   ['Tracked', 'The same perturbed organism is filmed swimming. FishEye tracks it keypoint by keypoint: how it moves, rests and responds.'],
  sequenced: ['Sequenced', 'Whole-organism transcriptomics reads out its gene activity. Genes cluster into the programmes the perturbation changes, mapped onto the molecular signals of the atlas.'],
  spread:    ['Through the system', 'The atlas carries each observation on, from where it was measured to the organs and functions it connects to.'],
  human:     ['Human pathobiology', 'Human data joins on the human side: clinical trials of molecules from the same families, concordance studies and existing datasets, at the organs where human toxicity shows.'],
  models:    ['Other models', 'Other models are optional. Cell cultures, organoids and an organ-on-chip attach where they observe: molecular signals, single organs, the gut\u2013liver axis. The atlas works with or without them.'],
  predict:   ['Predict', 'XenoEx queries the atlas organ by organ and returns a human risk profile for each candidate, safest first.'],
  validate:  ['Validate', 'Where its confidence is under the agreed threshold, XenoEx sends a validation run to the biofoundry. The result traces the mechanism through the atlas and updates the ranking.'],
  discover:  ['Discover', 'Asked about a disease instead, XenoEx follows its mechanisms through the atlas and proposes new targets on them.'],
};
const CHAPTER_LABEL = { biofoundry: 'Run', interactome: 'Translate', xenoex: 'Reason' };
const BEATS = [
  { id: 'backbone', ch: null, t: 0, rest: TL.inputs[0] - 300 },
  // inputs rest while the new links carry dots: the pause to take in the connection
  ...INPUTS.map((inp, i) => ({ id: inp.id, ch: 'biofoundry', t: TL.inputs[i], rest: TL.inputs[i] + inp.step.end + 900 })),
  { id: 'spread', ch: 'interactome', t: TL.prop, rest: TL.prop + PROPAGATE.wave + 200 },
  { id: 'human', ch: 'interactome', t: TL.human, rest: TL.human + HUMAN.step.end + 900 },
  { id: 'models', ch: 'interactome', t: TL.models[0], rest: TL.modelsEnd + 300 },
  { id: 'predict', ch: 'xenoex', t: TL.predict, rest: TL.validate - 300 },
  { id: 'validate', ch: 'xenoex', t: TL.validate, rest: TL.discover - 300 },
  { id: 'discover', ch: 'xenoex', t: TL.discover, rest: TL.end },
].map(b => {
  const [label, text] = STEP_TEXT[b.id];
  return Object.assign(b, { label, text, narr: b.ch ? `${CHAPTER_LABEL[b.ch]} \u00b7 ${label.toLowerCase()}` : label });
});
// every step line in one grid cell, all but the current one hidden: the step line keeps the height of the
// longest at any width, so nothing under it moves when it changes
function stack(host, lines) {
  const now = document.createElement('span');
  host.replaceChildren(now, ...lines.map(s => {
    const g = document.createElement('span');
    g.className = 'pf-ghost'; g.setAttribute('aria-hidden', 'true'); g.textContent = s;
    return g;
  }));
  return now;
}
const nStepNow = stack(nStep, BEATS.map(b => b.narr)), nTextNow = stack(nText, BEATS.map(b => b.text));

// ---------- layouts (viewBox units) ----------
// wide: inputs, human data and models down the left, XenoEx on the right. compact (phones, narrow windows):
// inputs in a row on top, human data and models in a row below, and the XenoEx panel rising over the bottom
// of the figure in Reason. xp: where things sit inside the XenoEx panel.
const LAYOUTS = {
  wide: {
    kind: 'wide', w: 1000, h: 540,
    bb: { x: 300, y: 92, w: 376, h: 376 }, bbTitle: { x: 488, y: 40 },
    heads: { whole: { x: 24, y: 44 }, human: { x: 24, y: 236 }, models: { x: 714, y: 186 } },
    slots: {
      imaged: { x: 24, y: 58, w: 152, h: 38 }, tracked: { x: 24, y: 106, w: 40, h: 40 }, sequenced: { x: 24, y: 156, w: 55, h: 40 },
      human: { x: 24, y: 248, w: 40, h: 40 },
      // other models on the right of the graph (the XenoEx panel later covers them; their links stay)
      cells: { x: 714, y: 200, w: 36, h: 36 }, organoids: { x: 714, y: 246, w: 36, h: 36 }, chip: { x: 714, y: 292, w: 36, h: 36 },
    },
    present: { cx: 410, cy: 232, maxW: 620, maxH: 290, maxS: 12 },
    out: { x: 714, y: 84, w: 266, h: 392 },
    xp: { title: 30, tabBar: 37, qY: 46, qH: 28, caretY: 53, qText: 65, status: 98, head: 126, rowTop: 136, pitch: 54, legend: true, tRow0: 160, tPitch: 56 },
  },
  compact: {
    kind: 'compact', w: 400, h: 600,
    bb: { x: 36, y: 132, w: 328, h: 328 }, bbTitle: { x: 200, y: 24 },
    heads: { whole: { x: 12, y: 64 }, human: { x: 12, y: 500 }, models: { x: 110, y: 500 } },
    slots: {
      imaged: { x: 12, y: 74, w: 120, h: 30 }, tracked: { x: 176, y: 72, w: 34, h: 34 }, sequenced: { x: 280, y: 72, w: 46, h: 34 },
      human: { x: 12, y: 510, w: 34, h: 34 },
      cells: { x: 110, y: 510, w: 34, h: 34 }, organoids: { x: 205, y: 510, w: 34, h: 34 }, chip: { x: 290, y: 510, w: 34, h: 34 },
    },
    present: { cx: 200, cy: 270, maxW: 376, maxH: 260, maxS: 12 },
    tlab: { T3: [0, 22, 'middle'] },   // target labels placed apart from the default (beside, above right)
    moaTag: [-60, 6],                  // the mechanism tag left of the liver-heart line, clear of 'heart rate'
    out: { x: 8, y: 384, w: 384, h: 208 },
    xp: { title: 22, tabBar: 28, qY: 34, qH: 24, caretY: 40, qText: 51, status: 74, head: 92, rowTop: 98, pitch: 26, legend: false, tRow0: 116, tPitch: 30 },
  },
};
let L = LAYOUTS.wide;
const vertical = () => L.kind !== 'wide';   // compact: inputs above the backbone, models below

// ---------- helpers ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const E = { out: u => 1 - Math.pow(1 - u, 3), inOut: u => (u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2) };
const prog = (t, s, d, e = E.out) => e(clamp((t - s) / d));
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }
function el(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
// in the frame loop: write an attribute only when its value changes (most of the figure is still in any frame)
function set(n, k, v) {
  const c = n.pfAttrs || (n.pfAttrs = {});
  if (c[k] !== v) { c[k] = v; n.setAttribute(k, v); }
}
function txt(parent, x, y, s, cls, attrs = {}) { const n = el('text', Object.assign({ x, y, class: cls }, attrs), parent); n.textContent = s; return n; }
function bez(P, u) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return { x: a * P[0].x + b * P[1].x + c * P[2].x + d * P[3].x, y: a * P[0].y + b * P[1].y + c * P[2].y + d * P[3].y };
}
const pathD = C => `M${C[0].x} ${C[0].y} C${C[1].x} ${C[1].y} ${C[2].x} ${C[2].y} ${C[3].x} ${C[3].y}`;
// the first part of a cubic, up to u (de Casteljau)
function bezPart(P, u) {
  const at = (a, b) => ({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) });
  const p01 = at(P[0], P[1]), p12 = at(P[1], P[2]), p23 = at(P[2], P[3]), p012 = at(p01, p12);
  return [P[0], p01, p012, at(p012, at(p12, p23))];
}
function mix(h1, h2, u) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const a = p(h1), b = p(h2);
  return '#' + a.map((v, i) => Math.round(lerp(v, b[i], u)).toString(16).padStart(2, '0')).join('');
}

const LAYERS = ['backbone', 'links', 'context', 'xeno', 'chrome', 'output'];
const layer = {};
LAYERS.forEach(n => { layer[n] = stage.querySelector(`svg[data-layer="${n}"]`); });
let S = null;

// ---------- build ----------
function build() {
  LAYERS.forEach(n => { layer[n].innerHTML = ''; layer[n].setAttribute('viewBox', `0 0 ${L.w} ${L.h}`); });
  S = { nodes: [], edges: [], links: [], pulses: [], insets: [], fades: [], waves: [], rings: [], N: new Map() };
  const U = (x, y) => ({ x: L.bb.x + x * L.bb.w, y: L.bb.y + y * L.bb.h });
  S.U = U;

  const add = n => { n.p = U(n.x, n.y); S.N.set(n.id, n); S.nodes.push(n); return n; };
  ORGANS.forEach(o => add(Object.assign({ kind: 'organ' }, o)));
  ORGANS.forEach(o => {
    const r = o.id === 'liver' ? .095 : .085;
    SIGNALS[o.id].forEach((deg, i) => {
      const a = deg * Math.PI / 180;
      add({ id: `${o.id}-${i}`, kind: 'signal', x: o.x + Math.cos(a) * r, y: o.y + Math.sin(a) * r });
    });
  });
  FUNCS.forEach(f => add(Object.assign({ kind: 'func' }, f)));
  S.nodes.forEach(n => {
    const d = Math.hypot(n.x - .5, n.y - .5);
    n.t0 = n.kind === 'organ' ? 100 + d * 2000 : n.kind === 'signal' ? 450 + d * 2000 : 1500;
    n.d = 420;
  });

  const N = id => S.N.get(id);
  const edge = (a, b, w, alpha, color = COL.line) => S.edges.push({ a: N(a), b: N(b), w, alpha, color, layer: 'backbone' });
  ORGAN_EDGES.forEach(([a, b]) => edge(a, b, 1.7, .5));
  ORGANS.forEach(o => SIGNALS[o.id].forEach((_, i) => edge(o.id, `${o.id}-${i}`, 1.1, .42)));
  FUNCS.forEach(f => f.links.forEach(l => edge(f.id, l, 1.1, .42)));
  S.edges.forEach(e => { e.t0 = Math.max(e.a.t0, e.b.t0) + 60; e.d = 560; });

  buildChrome();

  // whole-organism inputs: links end on the side of the backbone facing them
  const reach = n => (vertical() ? n.y : n.x);   // how far into the backbone, seen from the inputs
  const pickTargets = inp => {
    const keep = (inp.keep || []).map(N);
    const best = new Map();
    inp.pool.forEach(id => { const n = N(id), g = id.split('-')[0]; if (!best.has(g) || reach(n) < reach(best.get(g))) best.set(g, n); });
    return [...best.values()].sort((a, b) => reach(a) - reach(b)).slice(0, inp.n - keep.length).concat(keep);
  };
  INPUTS.forEach((inp, i) => {
    const T = TL.inputs[i];
    const ins = makeInset(inp, T, 'whole');
    const st = inp.step, s = INPUT_STEP;
    pickTargets(inp).forEach((node, j) => {
      S.links.push({ src: inp.id, cat: 'whole', T, from: ins.port, to: node, t0: T + st.linkAt + j * s.stagger, d: s.link, color: COL.live,
                     alpha: .85, rest: .28, dimAt: T + st.next, flows: [[T + st.end, T + st.next]], j, w: 1.4 });
      S.pulses.push({ node, t0: T + st.pulseAt + j * s.stagger, d: s.pulse, color: COL.live });
    });
  });

  // Translate: from the nodes the data landed on, a wave runs out through the backbone
  const adj = new Map();
  S.edges.forEach(e => [[e.a, e.b], [e.b, e.a]].forEach(([p, q]) => { if (!adj.has(p)) adj.set(p, []); adj.get(p).push(q); }));
  const depth = new Map(), queue = [];
  S.links.forEach(k => { if (!depth.has(k.to)) { depth.set(k.to, 0); queue.push(k.to); } });
  while (queue.length) {
    const n = queue.shift();
    (adj.get(n) || []).forEach(m => { if (!depth.has(m)) { depth.set(m, depth.get(n) + 1); queue.push(m); } });
  }
  const hop = (PROPAGATE.wave - 900) / Math.max(1, ...depth.values());
  S.edges.forEach(e => {
    const da = depth.get(e.a), db = depth.get(e.b);
    if (da === undefined || db === undefined) return;
    const [a, b] = da <= db ? [e.a, e.b] : [e.b, e.a];
    S.waves.push({ a, b, t0: TL.prop + Math.min(da, db) * hop, d: 900 });
  });
  depth.forEach((d, n) => { if (n.kind !== 'signal' && d > 0) S.pulses.push({ node: n, t0: TL.prop + d * hop + 250, d: 700, color: COL.live, alpha: .5 }); });

  // human pathobiology: joins on the human side, at the organs where human toxicity shows
  {
    const T = TL.human, ins = makeInset(HUMAN, T, 'human'), st = HUMAN.step, s = INPUT_STEP;
    pickTargets(HUMAN).forEach((node, j) => {
      S.links.push({ src: 'human', cat: 'human', T, from: ins.port, to: node, t0: T + st.linkAt + j * s.stagger, d: s.link, color: COL.human,
                     alpha: .85, rest: .3, dimAt: T + st.next, flows: [[T + st.end, T + st.next]], j, w: 1.4 });
      S.pulses.push({ node, t0: T + st.pulseAt + j * s.stagger, d: s.pulse, color: COL.human });
    });
  }

  // other models: optional, so drawn quieter (dashed) and attached to nodes the graph already has
  MODELS.forEach((m, i) => {
    const T = TL.models[i], ins = makeInset(m, T, 'model'), s = MODEL_STEP;
    m.to.forEach((id, j) => {
      const node = N(id), t0 = m.links[j];
      S.links.push({ src: m.id, cat: 'model', T, from: ins.port, to: node, t0, d: s.link, color: COL.context,
                     alpha: .75, rest: .32, dimAt: TL.modelsEnd + s.rest, flows: [], j, w: 1.2, dashed: true });
      S.pulses.push({ node, t0: t0 + s.link * .75, d: s.pulse, color: COL.context, alpha: .55 });
    });
    if (m.couple) S.edges.push({ a: N(m.couple[0]), b: N(m.couple[1]), w: 1.8, alpha: .75, color: COL.context, layer: 'context', dash: true,
                                 t0: m.links[m.links.length - 1] + 250, d: s.link });
  });

  // evidence rings: each kind of data adds a ring, in its colour, around the organs it reaches
  const organsOf = n => (n.kind === 'organ' ? [n.id] : n.kind === 'signal' ? [n.id.split('-')[0]] : n.kind === 'func' ? n.links : []);
  const first = new Map();
  S.links.forEach(k => organsOf(k.to).forEach(o => {
    if (!first.has(o)) first.set(o, new Map());
    const at = k.t0 + k.d, m = first.get(o);
    if (!m.has(k.cat) || at < m.get(k.cat)) m.set(k.cat, at);
  }));
  const RING = { whole: COL.live, human: COL.human, model: COL.context };
  first.forEach((m, o) => [...m.entries()].sort((a, b) => a[1] - b[1]).forEach(([cat, at], k) => {
    S.rings.push({ node: N(o), r: 16 + 4.5 * k, color: RING[cat], t0: at });
  }));

  buildXeno();
  buildGraphSVG();
}

function buildChrome() {
  const g = layer.chrome;
  // the names of organs and functions, over the links and the XenoEx traces, on a halo (frameSVG moves them with their nodes)
  S.labelLayer = el('g', {}, g);
  // backbone title, on a pill so links can pass under it; the pill fits the longer line
  const tg = el('g', {}, g);
  const pill = el('rect', { y: L.bbTitle.y - 16, height: 44, rx: 8, fill: COL.bg, 'fill-opacity': .82 }, tg);
  const lines = [txt(tg, L.bbTitle.x, L.bbTitle.y, 'Systemic atlas', 't-head', { 'text-anchor': 'middle', style: 'fill:#fff;fill-opacity:1' }),
                 txt(tg, L.bbTitle.x, L.bbTitle.y + 18, 'a multi-species knowledge graph', 't-note', { 'text-anchor': 'middle' })];
  const tw = Math.max(...lines.map(n => n.getComputedTextLength())) + 28;
  pill.setAttribute('x', L.bbTitle.x - tw / 2); pill.setAttribute('width', tw);
  S.fades.push({ el: tg, t0: 0, d: 500 });

  const hw = txt(g, L.heads.whole.x, L.heads.whole.y, 'Whole organism', 't-head t-halo', { style: `fill:${COL.live}` });
  const hh = txt(g, L.heads.human.x, L.heads.human.y, vertical() ? 'Human' : 'Human pathobiology', 't-head t-halo', { style: `fill:${COL.human}` });
  const hm = txt(g, L.heads.models.x, L.heads.models.y, 'Other models · optional', 't-head t-halo', { style: `fill:${COL.context};fill-opacity:.75` });
  // the human heading arrives with its card as it docks (in the portrait figure it sits under the large card's caption)
  S.fades.push({ el: hw, t0: TL.inputs[0], d: 300, left: true }, { el: hh, t0: TL.human + HUMAN.step.dockAt, d: 300, left: true },
               { el: hm, t0: TL.models[0], d: 300 });

  S.backdrop = el('rect', { x: L.bb.x - 24, y: L.bb.y - 24, width: L.bb.w + 48, height: L.bb.h + 48, rx: 14, fill: COL.bg, opacity: 0 }, g);
  S.insetLayer = el('g', {}, g);
  // lights up when XenoEx sends a validation run to the biofoundry
  const sl = L.slots.imaged;
  S.runGlow = el('rect', { x: sl.x - 4, y: sl.y - 4, width: sl.w + 8, height: sl.h + 8, rx: 7, fill: 'none', stroke: COL.flag, 'stroke-width': 1.6, opacity: 0 }, g);
}

function makeInset(def, T, grp) {
  const sl = L.slots[def.id];
  const P = L.present;
  const s = Math.min(P.maxS, P.maxW / sl.w, P.maxH / sl.h);
  const dock = { x: sl.x, y: sl.y, s: 1 };
  // other models are not shown large: they appear in place
  const present = grp === 'model' ? dock : { x: P.cx - sl.w * s / 2, y: P.cy - sl.h * s / 2, s };
  // caption beside the docked card (wide) or under it (compact); links leave from just past it, or, for
  // cards on the right of the graph, from their left side
  const capPos = vertical() ? { x: sl.x, y: sl.y + sl.h + 14 } : { x: sl.x + sl.w + 10, y: sl.y + sl.h / 2 + 5 };
  const cap = txt(layer.chrome, capPos.x, capPos.y, def.caption, 't-label', { opacity: 0 });
  const onRight = !vertical() && sl.x > L.bb.x + L.bb.w;
  const port = onRight ? { x: sl.x - 6, y: sl.y + sl.h / 2 }
    : !vertical() ? { x: capPos.x + cap.getComputedTextLength() + 8, y: sl.y + sl.h / 2 }
    : grp === 'whole' ? { x: sl.x + sl.w / 2, y: sl.y + sl.h + 22 } : { x: sl.x + sl.w / 2, y: sl.y - 4 };
  const g = el('g', { opacity: 0 }, S.insetLayer);
  const art = drawInset(g, def.kind, sl.w, sl.h, grp);
  const heat = art && art.rows ? art : null;
  const rec = { g, cap, present, dock, T, port, group: grp, step: def.step, heat, video: g.querySelector('video'), shown: false };
  if (def.kind === 'behaviour') rec.track = makeTrack(g, sl.w, s);
  rec.pc = PRESENT[def.id] ? makePresentCaption(rec, PRESENT[def.id], sl, s)
    : grp === 'model' ? el('g', {}, g)
    : txt(g, sl.w / 2, sl.h + 20 / s, def.title, 't-label t-strong', { 'text-anchor': 'middle', style: `font-size:${15 / s}px` });
  S.insets.push(rec);
  return rec;
}

// Under the large card, at the presented scale: a pulsing dot and what is at work, what it does, and a
// checklist of read-outs that tick as the clip shows them.
function makePresentCaption(rec, info, sl, s) {
  const pg = el('g', { transform: `translate(${sl.w / 2},${sl.h}) scale(${1 / s})` }, rec.g);
  const col = rec.checkColor = info.color || COL.live;
  const back = el('rect', { y: 6, height: 74, rx: 10, fill: COL.bg, 'fill-opacity': .9 }, pg);
  const head = txt(pg, 0, 24, info.head.toUpperCase(), 't-head', { 'text-anchor': 'middle', style: `fill:${col};fill-opacity:1` });
  const hw = head.getComputedTextLength();
  rec.liveDot = el('circle', { cx: -hw / 2 - 11, cy: 19.5, r: 3.5, fill: col }, pg);
  const sub = txt(pg, 0, 45, info.sub, 't-label t-strong', { 'text-anchor': 'middle' });
  // wider than the figure leaves room for (the portrait one): two balanced lines
  let subW = sub.getComputedTextLength(), dy = 0;
  if (subW > L.w - 64) {
    const words = info.sub.split(' '), width = s => { sub.textContent = s; return sub.getComputedTextLength(); };
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const w = Math.max(width(words.slice(0, k).join(' ')), width(words.slice(k).join(' ')));
      if (!best || w < best.w) best = { k, w };
    }
    sub.textContent = words.slice(0, best.k).join(' ');
    txt(pg, 0, 45 + 18, words.slice(best.k).join(' '), 't-label t-strong', { 'text-anchor': 'middle' });
    subW = best.w; dy = 18;
  }
  // the read-outs in a row, centred; on more rows when the figure is too narrow for one
  const items = info.checks.map(([label, at]) => {
    const g = el('g', {}, pg);
    const box = el('rect', { y: 59, width: 11, height: 11, rx: 2.5, fill: 'none', stroke: col, 'stroke-width': 1.2 }, g);
    const tick = el('path', { d: 'M2.6 64.6l2.4 2.4l4.2 -4.6', fill: 'none', stroke: COL.bg, 'stroke-width': 1.8,
                              'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, g);
    const t = txt(g, 17, 69, label, 't-note');
    return { g, box, tick, at, w: 17 + t.getComputedTextLength() };
  });
  const rows = [];
  items.forEach(it => {
    const r = rows[rows.length - 1];
    if (r && r.w + 22 + it.w <= L.w - 56) { r.items.push(it); r.w += 22 + it.w; } else rows.push({ items: [it], w: it.w });
  });
  rows.forEach((r, k) => {
    let x = -r.w / 2;
    r.items.forEach(it => { it.g.setAttribute('transform', `translate(${x},${dy + 18 * k})`); x += it.w + 22; });
  });
  rec.checks = items.map(({ box, tick, at }) => ({ box, tick, at }));
  const bw = Math.max(hw + 30, subW, ...rows.map(r => r.w)) + 40;
  back.setAttribute('x', -bw / 2); back.setAttribute('width', bw);
  back.setAttribute('height', 74 + dy + 18 * (rows.length - 1));
  return pg;
}
function frameChecks(r, ms) {
  set(r.liveDot, 'opacity', (.45 + .55 * Math.abs(Math.sin(flowT / 380))).toFixed(3));
  let current = true;
  r.checks.forEach(c => {
    const on = ms >= c.at;
    set(c.box, 'fill', on ? r.checkColor : 'none');
    set(c.tick, 'opacity', on ? 1 : 0);
    // the read-out under way pulses until it ticks
    set(c.box, 'stroke-opacity', on ? 1 : current ? (.35 + .65 * Math.abs(Math.sin(flowT / 300))).toFixed(3) : .35);
    if (!on) current = false;
  });
}

// FishEye-style tracking over the tracked clip: keypoints along the body and the path of the head, from
// tracking the clip itself (docs/preview/media/track.py). Drawn while the card is large.
function makeTrack(g, w, s) {
  const k = 1 / s, tg = el('g', { opacity: 0 }, g);
  const rec = { g: tg, trail: el('polyline', { fill: 'none', stroke: COL.live, 'stroke-width': 1.6 * k, 'stroke-opacity': .7,
                                                'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, tg),
                body: el('polyline', { fill: 'none', stroke: COL.live, 'stroke-width': 1.2 * k }, tg),
                dots: [0, 1, 2, 3, 4].map(i => el('circle', { r: (i ? 2.2 : 3.2) * k, fill: i ? COL.live : COL.light,
                                                              stroke: COL.live, 'stroke-width': .8 * k }, tg)),
                data: null, scale: 1, frame: -1 };
  fetch(MEDIA + 'tracked.json').then(res => (res.ok ? res.json() : null)).then(d => {
    if (d) { rec.data = d; rec.scale = w / d.w; }
  }).catch(() => {});
  return rec;
}
function frameTrack(r, ms, show) {
  const tr = r.track, d = tr.data;
  set(tr.g, 'opacity', d ? (show * prog(ms, PRESENT.tracked.checks[0][1] - 300, 300)).toFixed(3) : 0);
  if (!d || show <= 0) return;
  const v = r.video, sec = v && v.readyState >= 2 ? v.currentTime : ms / 1000;
  const f = Math.max(0, Math.min(d.kp.length - 1, Math.floor(sec * d.fps)));
  if (f === tr.frame) return;
  tr.frame = f;
  const q = tr.scale, kp = d.kp[f];
  const from = Math.floor((PRESENT.tracked.checks[0][1] / 1000) * d.fps);   // the path is drawn from when tracking starts
  const pts = [];
  for (let i = Math.min(from, f); i <= f; i++) if (d.kp[i]) pts.push(`${(d.kp[i][0] * q).toFixed(2)},${(d.kp[i][1] * q).toFixed(2)}`);
  set(tr.trail, 'points', pts.join(' '));
  if (!kp) return;
  const P = [0, 1, 2, 3, 4].map(i => [kp[2 * i] * q, kp[2 * i + 1] * q]);
  set(tr.body, 'points', P.map(p => p.map(c => c.toFixed(2)).join(',')).join(' '));
  tr.dots.forEach((c, i) => { set(c, 'cx', P[i][0].toFixed(2)); set(c, 'cy', P[i][1].toFixed(2)); });
}

function makeVideo(clip) {
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = near ? 'auto' : 'none';   // see loadClips
  v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
  v.poster = clip.src + '.jpg';
  v.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;border-radius:4px';
  ['webm', 'mp4'].forEach(ext => {
    const s = document.createElement('source');
    s.src = `${clip.src}.${ext}`; s.type = `video/${ext}`; v.appendChild(s);
  });
  return v;
}

// A clustered heatmap computed from simulated dose-response data (illustrative, not a result):
// 12 samples x 36 genes in four programmes, z-scored per gene, ordered by average-linkage clustering.
function hclust(vecs) {
  const D = vecs.map(a => vecs.map(b => Math.hypot(...a.map((v, k) => v - b[k]))));
  let nodes = vecs.map((_, i) => ({ leaves: [i], h: 0 }));
  while (nodes.length > 1) {
    let best = null;
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      let s = 0;
      nodes[a].leaves.forEach(i => nodes[b].leaves.forEach(j => { s += D[i][j]; }));
      const d = s / (nodes[a].leaves.length * nodes[b].leaves.length);
      if (!best || d < best.d) best = { a, b, d };
    }
    const A = nodes[best.a], B = nodes[best.b];
    nodes = nodes.filter((_, k) => k !== best.a && k !== best.b);
    nodes.push({ leaves: A.leaves.concat(B.leaves), h: best.d, l: A, r: B });
  }
  return nodes[0];
}
const HEAT = (() => {
  const R = rng(20261029), gauss = () => { let u = 0; for (let i = 0; i < 6; i++) u += R(); return (u - 3) * 1.41; };
  const dose = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3];
  const programmes = [
    { n: 12, f: d => d * .9 }, { n: 10, f: d => -d * .8 }, { n: 6, f: d => (d === 3 ? 2.4 : 0) }, { n: 8, f: () => 0 },
  ];
  const raw = [];
  programmes.forEach(p => { for (let i = 0; i < p.n; i++) { const gain = .6 + R() * .8; raw.push(dose.map(d => p.f(d) * gain + gauss() * .35)); } });
  const z = raw.map(r => {
    const m = r.reduce((a, b) => a + b) / r.length;
    const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / r.length) || 1;
    return r.map(v => (v - m) / sd);
  });
  return { z, dose, rowTree: hclust(z), colTree: hclust(dose.map((_, j) => z.map(r => r[j]))) };
})();
// the heatmap's colours in 65 steps from -1 to 1, so the breathing values reuse a few strings
const HEAT_COLOURS = Array.from({ length: 65 }, (_, i) => {
  const v = i / 32 - 1;
  return v >= 0 ? mix('#161c4a', COL.live, v * .92) : mix('#161c4a', '#4466ee', -v);
});
function heatColour(v) { return HEAT_COLOURS[Math.round((clamp(v, -1, 1) + 1) * 32)]; }
function dendro(node, leafPos, hPos, vertical, out) {
  if (!node.l) return { p: leafPos(node.leaves[0]), q: hPos(0) };
  const a = dendro(node.l, leafPos, hPos, vertical, out), b = dendro(node.r, leafPos, hPos, vertical, out), q = hPos(node.h);
  const f = x => x.toFixed(2);
  out.push(vertical ? `M${f(a.p)} ${f(a.q)}V${f(q)}H${f(b.p)}V${f(b.q)}` : `M${f(a.q)} ${f(a.p)}H${f(q)}V${f(b.p)}H${f(b.q)}`);
  return { p: (a.p + b.p) / 2, q };
}
function drawHeatmap(g, w, h) {
  const { z, dose, rowTree, colTree } = HEAT;
  const rOrder = rowTree.leaves, cOrder = colTree.leaves;
  const left = w * .18, top = h * .2, bar = h * .06, gap = h * .025;
  const x0 = left, y0 = top + bar + gap, gw = w - 2 - x0, gh = h - 2 - y0;
  const cw = gw / cOrder.length, rh = gh / rOrder.length;
  el('rect', { x: 0, y: 0, width: w, height: h, rx: 4, fill: '#10153f' }, g);
  const R = rng(4242), measured = rOrder.slice();
  for (let i = measured.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [measured[i], measured[j]] = [measured[j], measured[i]]; }
  const cells = el('g', { 'shape-rendering': 'crispEdges' }, g);
  const rows = rOrder.map((ri, r) => {
    const rg = el('g', { transform: `translate(0,${(y0 + r * rh).toFixed(2)})` }, cells);
    const rects = cOrder.map((ci, c) => el('rect', {
      x: (x0 + c * cw).toFixed(2), y: 0, width: (cw + .12).toFixed(2), height: (rh + .12).toFixed(2), fill: heatColour(z[ri][ci] / 2) }, rg));
    return { g: rg, ri, final: r, raw: measured.indexOf(ri), rects };
  });
  cOrder.forEach((ci, c) => el('rect', { x: x0 + c * cw + cw * .08, y: top, width: cw * .84, height: bar,
    fill: dose[ci] ? COL.live : COL.line, 'fill-opacity': [.45, .35, .65, 1][dose[ci]] }, g));
  const sw = Math.max(.3, w / 240);
  const dg = el('g', { fill: 'none', stroke: COL.line, 'stroke-opacity': .8, 'stroke-width': sw }, g);
  const cp = [], rp = [];
  dendro(colTree, i => x0 + (cOrder.indexOf(i) + .5) * cw, hh => top - gap - (hh / colTree.h) * (top - gap - h * .04), true, cp);
  dendro(rowTree, i => y0 + (rOrder.indexOf(i) + .5) * rh, hh => left - gap - (hh / rowTree.h) * (left - gap - w * .025), false, rp);
  el('path', { d: cp.join('') + rp.join('') }, dg);
  return { rows, y0, rh, cOrder, z, dendro: dg, state: 'final' };
}
// While the card is large: columns fill in, rows sort into their clusters, the trees appear,
// then the values breathe a little. Docked, it rests in its final state.
function animateHeat(H, ms, live) {
  if (!live) {
    if (H.state === 'final') return;
    H.rows.forEach(r => {
      set(r.g, 'transform', `translate(0,${(H.y0 + r.final * H.rh).toFixed(2)})`);
      r.rects.forEach((rect, c) => { set(rect, 'opacity', 1); set(rect, 'fill', heatColour(H.z[r.ri][H.cOrder[c]] / 2)); });
    });
    set(H.dendro, 'opacity', 1);
    H.state = 'final';
    return;
  }
  H.state = 'live';
  const sortU = prog(ms, 1700, 1700, E.inOut), breathe = prog(ms, 3600, 900), ts = flowT / 1000;
  const refill = breathe > 0 && !(flowT - H.filled < 50);   // the breathing redraws 20 times a second
  if (refill) H.filled = flowT;
  H.rows.forEach(r => {
    set(r.g, 'transform', `translate(0,${(H.y0 + lerp(r.raw, r.final, sortU) * H.rh).toFixed(2)})`);
    r.rects.forEach((rect, c) => {
      set(rect, 'opacity', prog(ms, 350 + c * 80, 380).toFixed(3));
      if (refill) {
        const v = H.z[r.ri][H.cOrder[c]] + breathe * .28 * Math.sin(ts * 1.9 + r.ri * .9 + c * 1.7);
        set(rect, 'fill', heatColour(v / 2));
      }
    });
  });
  set(H.dendro, 'opacity', prog(ms, 3000, 700).toFixed(3));
}

function drawInset(g, kind, w, h, grp) {
  const tone = grp === 'model' ? COL.context : grp === 'human' ? COL.human : COL.line;
  el('rect', { x: 0, y: 0, width: w, height: h, rx: 4, fill: '#151b4a', stroke: tone, 'stroke-opacity': .55, 'stroke-width': 1 }, g);
  if (kind === 'human') return drawHuman(g, w, h);
  const clip = CLIPS[kind];
  if (clip) {
    el('image', { href: clip.src + '.jpg', x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'xMidYMid slice' }, g);
    const fo = el('foreignObject', { x: 0, y: 0, width: w, height: h }, g);
    fo.appendChild(makeVideo(clip));
    el('rect', { x: .25, y: .25, width: w - .5, height: h - .5, rx: 4, fill: 'none', stroke: tone, 'stroke-opacity': .55, 'stroke-width': .5 }, g);
    return null;
  }
  const R = rng(kind.length * 977);
  if (kind === 'heatmap') return drawHeatmap(g, w, h);
  if (kind === 'dish') {
    const cx = w / 2, cy = h / 2, r = w * .38;
    el('circle', { cx, cy, r, fill: 'none', stroke: COL.context, 'stroke-opacity': .85, 'stroke-width': 1 }, g);
    el('circle', { cx, cy, r: r * .88, fill: 'none', stroke: COL.context, 'stroke-opacity': .35, 'stroke-width': .6 }, g);
    for (let i = 0; i < 18; i++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * .78;
      el('ellipse', { cx: cx + Math.cos(a) * d, cy: cy + Math.sin(a) * d, rx: w * .035, ry: w * .025, fill: COL.context, 'fill-opacity': .7,
                      transform: `rotate(${(R() * 180).toFixed(0)} ${cx + Math.cos(a) * d} ${cy + Math.sin(a) * d})` }, g);
    }
  } else if (kind === 'organoid') {
    const cx = w / 2, cy = h / 2, r0 = w * .32;
    let d = '';
    for (let i = 0; i <= 64; i++) {
      const a = i / 64 * Math.PI * 2, r = r0 * (1 + .09 * Math.sin(a * 6) + .05 * Math.sin(a * 11 + 1));
      d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(2) + ' ' + (cy + Math.sin(a) * r).toFixed(2);
    }
    el('path', { d: d + 'Z', fill: COL.context, 'fill-opacity': .14, stroke: COL.context, 'stroke-width': 1 }, g);
    el('ellipse', { cx: cx + w * .03, cy: cy - h * .02, rx: r0 * .42, ry: r0 * .3, fill: 'none', stroke: COL.context, 'stroke-opacity': .7, 'stroke-width': .7 }, g);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      el('circle', { cx: cx + Math.cos(a) * r0 * .78, cy: cy + Math.sin(a) * r0 * .78, r: w * .025, fill: COL.context, 'fill-opacity': .65 }, g);
    }
  } else if (kind === 'chip') {
    const x0 = w * .1, y0 = h * .26, cw = w * .8, ch = h * .48;
    el('rect', { x: x0, y: y0, width: cw, height: ch, rx: h * .08, fill: 'none', stroke: COL.context, 'stroke-width': 1 }, g);
    [.3, .7].forEach(v => el('line', { x1: x0 + cw * .12, y1: y0 + ch * v, x2: x0 + cw * .88, y2: y0 + ch * v, stroke: COL.context, 'stroke-width': 1.6, 'stroke-opacity': .7 }, g));
    el('line', { x1: x0 + cw * .12, y1: y0 + ch * .5, x2: x0 + cw * .88, y2: y0 + ch * .5, stroke: COL.context, 'stroke-width': .6, 'stroke-dasharray': '1.5 1.5' }, g);
    [[.12, .3], [.88, .3], [.12, .7], [.88, .7]].forEach(([u, v]) =>
      el('circle', { cx: x0 + cw * u, cy: y0 + ch * v, r: h * .05, fill: COL.plate, stroke: COL.context, 'stroke-width': .8 }, g));
  }
  return null;
}

// The human card: a plain front-view human outline, as on a body chart, drawn solid so it reads when
// shown large. Drawn in a 36-unit design space, centred on 0.
const HUMAN_OUTLINE = `M0 -15.6C0.4 -15.6 0.9 -15.5 1.2 -15.2C1.5 -15 1.5 -14.6 1.6 -14.2C1.7 -13.8 1.6 -13.3 1.5 -12.9C1.4 -12.6
1.3 -12.2 1.1 -11.9C1 -11.7 0.8 -11.6 0.8 -11.4C0.7 -11.3 0.7 -11 0.8 -10.8C0.9 -10.6 1.4 -10.4 1.7 -10.3C2.1
-10.1 2.6 -10.1 3 -9.9C3.3 -9.8 3.6 -9.7 3.8 -9.5C4 -9.3 4.1 -9 4.2 -8.6C4.3 -8.1 4.3 -7.5 4.4 -6.9C4.4 -6.3
4.5 -5.7 4.5 -5.2C4.6 -4.8 4.7 -4.4 4.8 -4C4.8 -3.5 4.9 -2.9 5 -2.3C5.1 -1.7 5.1 -1 5.2 -0.5C5.2 -0.2 5.2 0.1
5.2 0.3C5.3 0.6 5.4 0.9 5.5 1.2C5.5 1.6 5.6 2 5.5 2.3C5.4 2.6 5.3 2.9 5.2 3C5.1 3 4.9 3 4.8 2.9C4.6 2.7 4.6
2.1 4.6 1.7C4.6 1.3 4.6 1 4.5 0.6C4.5 0 4.4 -0.6 4.3 -1.2C4.2 -1.8 4.1 -2.5 4 -3C3.9 -3.4 3.8 -3.8 3.8
-4.2C3.6 -4.7 3.6 -5.4 3.5 -6C3.3 -6.5 3.2 -7.6 3.1 -7.5C3 -7.5 3 -7 2.9 -6.6C2.8 -6.1 2.8 -5.4 2.7 -4.8C2.6
-4.2 2.5 -3.7 2.5 -3.1C2.4 -2.5 2.6 -1.8 2.7 -1.2C2.8 -0.6 3 0 3 0.6C3 1.2 3 1.7 3 2.3C2.9 2.9 2.8 3.6 2.7
4.3C2.7 5 2.5 5.8 2.4 6.4C2.3 6.9 2.2 7.3 2.2 7.8C2.2 8.3 2.3 8.8 2.3 9.4C2.3 10.1 2.2 10.8 2.1 11.5C2 12.2
1.7 13 1.7 13.6C1.7 14 1.9 14.3 1.9 14.6C2 14.8 2.2 15.1 2.2 15.2C2.2 15.4 2 15.5 1.9 15.6C1.6 15.7 1.2 15.7
1 15.6C0.8 15.5 0.8 15.2 0.7 14.9C0.7 14.6 0.8 14.1 0.8 13.6C0.8 13 0.7 12.1 0.7 11.4C0.7 10.8 0.8 10.2 0.8
9.6C0.7 9 0.6 8.4 0.6 7.8C0.5 7.1 0.5 6.3 0.4 5.6C0.4 4.9 0.4 4 0.3 3.4C0.2 3 0.1 2.2 0 2.2C-0.1 2.2 -0.2 3
-0.3 3.4C-0.4 4 -0.4 4.9 -0.4 5.6C-0.5 6.3 -0.5 7.1 -0.6 7.8C-0.6 8.4 -0.7 9 -0.8 9.6C-0.8 10.2 -0.7 10.8
-0.7 11.4C-0.7 12.1 -0.8 13 -0.8 13.6C-0.8 14.1 -0.7 14.6 -0.7 14.9C-0.8 15.2 -0.8 15.5 -1 15.6C-1.2 15.7
-1.6 15.7 -1.9 15.6C-2 15.5 -2.2 15.4 -2.2 15.2C-2.2 15.1 -2 14.8 -1.9 14.6C-1.9 14.3 -1.7 14 -1.7 13.6C-1.7
13 -2 12.2 -2.1 11.5C-2.2 10.8 -2.3 10.1 -2.3 9.4C-2.3 8.8 -2.2 8.3 -2.2 7.8C-2.2 7.3 -2.3 6.9 -2.4 6.4C-2.5
5.8 -2.7 5 -2.7 4.3C-2.8 3.6 -2.9 2.9 -3 2.3C-3 1.7 -3 1.2 -3 0.6C-3 0 -2.8 -0.6 -2.7 -1.2C-2.6 -1.8 -2.4
-2.5 -2.5 -3.1C-2.5 -3.7 -2.6 -4.2 -2.7 -4.8C-2.8 -5.4 -2.8 -6.1 -2.9 -6.6C-3 -7 -3 -7.5 -3.1 -7.5C-3.2 -7.6
-3.3 -6.5 -3.5 -6C-3.6 -5.4 -3.6 -4.7 -3.8 -4.2C-3.8 -3.8 -3.9 -3.4 -4 -3C-4.1 -2.5 -4.2 -1.8 -4.3 -1.2C-4.4
-0.6 -4.5 0 -4.5 0.6C-4.6 1 -4.6 1.3 -4.6 1.7C-4.6 2.1 -4.6 2.7 -4.8 2.9C-4.9 3 -5.1 3 -5.2 3C-5.3 2.9 -5.4
2.6 -5.5 2.3C-5.6 2 -5.5 1.6 -5.5 1.2C-5.4 0.9 -5.3 0.6 -5.2 0.3C-5.2 0.1 -5.2 -0.2 -5.2 -0.5C-5.1 -1 -5.1
-1.7 -5 -2.3C-4.9 -2.9 -4.8 -3.5 -4.8 -4C-4.7 -4.4 -4.6 -4.8 -4.5 -5.2C-4.5 -5.7 -4.4 -6.3 -4.4 -6.9C-4.3
-7.5 -4.3 -8.1 -4.2 -8.6C-4.1 -9 -4 -9.3 -3.8 -9.5C-3.6 -9.7 -3.3 -9.8 -3 -9.9C-2.6 -10.1 -2.1 -10.1 -1.7
-10.3C-1.4 -10.4 -0.9 -10.6 -0.8 -10.8C-0.7 -11 -0.7 -11.3 -0.8 -11.4C-0.8 -11.6 -1 -11.7 -1.1 -11.9C-1.3
-12.2 -1.4 -12.6 -1.5 -12.9C-1.6 -13.3 -1.7 -13.8 -1.6 -14.2C-1.5 -14.6 -1.5 -15 -1.2 -15.2C-0.9 -15.5 -0.4
-15.6 0 -15.6Z`;
function drawHuman(g, w, h) {
  const z = Math.min(w, h) / 36, c = COL.human;
  const fg = el('g', { transform: `translate(${w / 2},${h / 2}) scale(${z})` }, g);
  el('path', { d: HUMAN_OUTLINE, fill: c, 'fill-opacity': .22, stroke: c, 'stroke-width': .5, 'stroke-linejoin': 'round' }, fg);
}

// ---------- XenoEx: the panel, its exchanges with the backbone, the run it sends, the targets it finds ----------
function buildXeno() {
  const O = L.out, Q = L.xp, X = S.X = {};
  const P = TL.predict, V = TL.validate, D = TL.discover;
  X.port = vertical() ? { x: O.x + O.w / 2, y: O.y - 2 } : { x: O.x - 2, y: O.y + 196 };

  const card = X.card = el('g', { opacity: 0 }, layer.output);
  el('rect', { x: O.x, y: O.y, width: O.w, height: O.h, rx: 12, fill: COL.plate, stroke: COL.live, 'stroke-opacity': .32 }, card);
  txt(card, O.x + 16, O.y + Q.title, 'XenoEx', 't-label t-strong', { style: 'font-size:15px' });
  // two ways to ask: rank candidates, or find targets for a disease
  X.tabs = ['candidates', 'targets'].map(s => txt(card, 0, O.y + Q.title, s, 't-note', { 'text-anchor': 'end' }));
  const wC = X.tabs[0].getComputedTextLength(), wT = X.tabs[1].getComputedTextLength();
  const xT = O.x + O.w - 16, xC = xT - wT - 14;
  X.tabs[0].setAttribute('x', xC); X.tabs[1].setAttribute('x', xT);
  X.tabPos = [{ x: xC - wC, w: wC }, { x: xT - wT, w: wT }];
  X.tabBar = el('rect', { x: xC - wC, y: O.y + Q.tabBar, width: wC, height: 2, rx: 1, fill: COL.live }, card);
  X.tabOn = -1;

  el('rect', { x: O.x + 12, y: O.y + Q.qY, width: O.w - 24, height: Q.qH, rx: 6, fill: COL.bg, stroke: COL.line, 'stroke-opacity': .25 }, card);
  txt(card, O.x + 22, O.y + Q.qText, '\u203a', 't-label', { style: `fill:${COL.live}` });
  X.query = txt(card, O.x + 34, O.y + Q.qText, '', 't-label', { style: 'font-size:13px' });
  X.caret = el('rect', { x: O.x + 34, y: O.y + Q.caretY, width: 1.5, height: 15, fill: COL.live, opacity: 0 }, card);
  X.queries = [{ at: P + PREDICT.typeAt, d: PREDICT.type, s: 'rank 4 candidates · human risk' },
               { at: D + DISCOVER.typeAt, d: DISCOVER.type, s: `find targets · ${DISEASE}` }];
  X.status = txt(card, O.x + 16, O.y + Q.status, '', 't-note');
  X.statusIdx = -2;
  X.statuses = [
    [P + PREDICT.outAt, 'querying the atlas\u2026', COL.medium],
    [P + PREDICT.barsAt, '4 profiles scored, organ by organ', COL.medium],
    [P + PREDICT.rankAt, 'ranked, safest first', COL.medium],
    [V, 'ZM-131 · heart: low confidence', COL.flag],
    [V + VALIDATE.reqAt, 'validation run \u2192 biofoundry', COL.flag],
    [V + VALIDATE.backAt, 'result in: above threshold', COL.live],
    [V + VALIDATE.moaAt + 400, 'mechanism traced: liver \u2192 heart', COL.result],
    [V + VALIDATE.rankAt, 'ranking updated', COL.live],
    [D + DISCOVER.walkAt, 'following mechanisms\u2026', COL.medium],
    [D + DISCOVER.popAt, '3 new target hypotheses', COL.target],
  ];

  // candidates: human risk by organ, ranked
  const cand = X.cand = el('g', {}, card);
  const colX0 = O.x + 92, cw = (O.w - 92 - 12) / 4, bw = X.bw = cw - 10;
  OUT_ORGANS.forEach((o, j) => txt(cand, colX0 + cw * (j + .5), O.y + Q.head, o, 't-note', { 'text-anchor': 'middle' }));
  const rowTop = O.y + Q.rowTop, pitch = Q.pitch;
  const riskAfter = c => c.risk.map((v, j) => (c.unsure && c.unsure.j === j ? c.unsure.to : v));
  const order = f => CANDIDATES.map((c, i) => i).sort((a, b) => Math.max(...f(CANDIDATES[a])) - Math.max(...f(CANDIDATES[b])));
  const o1 = order(c => c.risk), o2 = order(riskAfter);
  X.rows = CANDIDATES.map((c, i) => {
    const rg = el('g', {}, cand);
    const hl = el('rect', { x: O.x + 6, y: 2, width: O.w - 12, height: pitch - 4, rx: 6, fill: COL.flag, opacity: 0 }, rg);
    el('line', { x1: O.x + 12, y1: 0, x2: O.x + O.w - 12, y2: 0, stroke: COL.line, 'stroke-opacity': .14 }, rg);
    const rank = txt(rg, O.x + 16, pitch / 2 + 5, '', 't-note', { opacity: 0, style: 'fill:#fff;fill-opacity:1;font-weight:500' });
    txt(rg, O.x + 32, pitch / 2 + 5, c.name, 't-label t-strong');
    const bars = c.risk.map((v, j) => {
      const x = colX0 + cw * j + 5;
      el('rect', { x, y: pitch / 2 - 3, width: bw, height: 6, rx: 3, fill: COL.line, 'fill-opacity': .14 }, rg);
      const unsure = c.unsure && c.unsure.j === j ? c.unsure : null;
      const range = unsure && el('rect', { x, y: pitch / 2 - 7, width: 0, height: 14, rx: 3, fill: 'none', stroke: COL.flag,
                                          'stroke-width': 1.2, 'stroke-dasharray': '2 2', opacity: 0 }, rg);
      return { el: el('rect', { x, y: pitch / 2 - 3, width: 0, height: 6, rx: 3 }, rg), x, v, unsure, range };
    });
    return { g: rg, hl, rank, bars, i, flagged: !!c.unsure, y0: rowTop + pitch * i,
             y1: rowTop + pitch * o1.indexOf(i), y2: rowTop + pitch * o2.indexOf(i), r1: o1.indexOf(i) + 1, r2: o2.indexOf(i) + 1 };
  });
  // re-ranking: the rows that rise are drawn on top, and the rows they pass dim while they move
  X.rerank = [['y0', 'y1'], ['y1', 'y2']].map(([a, b]) => {
    const up = X.rows.filter(r => r[b] < r[a]), span = r => [Math.min(r[a], r[b]), Math.max(r[a], r[b])];
    return { up, dim: X.rows.filter(r => !up.includes(r) && up.some(q => span(r)[0] <= span(q)[1] && span(r)[1] >= span(q)[0])) };
  });
  X.rerankOn = -1;
  const ly = O.y + O.h - 16;
  if (Q.legend) {
    [[16, COL.result, 'lower risk'], [100, COL.flag, 'higher risk']].forEach(([dx, c, s]) => {
      el('rect', { x: O.x + dx, y: ly - 8, width: 14, height: 6, rx: 3, fill: c }, cand);
      txt(cand, O.x + dx + 20, ly, s, 't-note');
    });
    el('rect', { x: O.x + 188, y: ly - 11, width: 14, height: 12, rx: 3, fill: 'none', stroke: COL.flag, 'stroke-width': 1.2, 'stroke-dasharray': '2 2' }, cand);
    txt(cand, O.x + 208, ly, 'unsure', 't-note');
  }

  // targets: what it proposes when asked about a disease
  const targ = X.targ = el('g', { opacity: 0 }, card);
  txt(targ, O.x + 16, O.y + Q.head, `new targets · ${DISEASE}`, 't-note');
  X.trows = TARGETS.map((tg, i) => {
    const y = O.y + Q.tRow0 + i * Q.tPitch;
    const rg = el('g', { opacity: 0 }, targ);
    el('line', { x1: O.x + 12, y1: y - Q.tPitch * .4, x2: O.x + O.w - 12, y2: y - Q.tPitch * .4, stroke: COL.line, 'stroke-opacity': .14 }, rg);
    el('circle', { cx: O.x + 21, cy: y - 5, r: 4.5, fill: COL.target }, rg);
    txt(rg, O.x + 34, y, tg.id, 't-label t-strong');
    txt(rg, O.x + 62, y, tg.where, 't-label');
    const bx = O.x + 34, bwT = O.w - 34 - 52;
    el('rect', { x: bx, y: y + 10, width: bwT, height: 5, rx: 2.5, fill: COL.line, 'fill-opacity': .14 }, rg);
    const b = el('rect', { x: bx, y: y + 10, width: 0, height: 5, rx: 2.5, fill: COL.target }, rg);
    txt(rg, O.x + O.w - 16, y + 16, tg.score.toFixed(2), 't-note', { 'text-anchor': 'end' });
    return { g: rg, b, w: bwT * tg.score, t0: D + DISCOVER.listAt + i * DISCOVER.listStep };
  });
  if (Q.legend) txt(targ, O.x + 16, ly, 'scored by mechanistic support', 't-note');

  // exchanges: queries go out to nodes (white), evidence comes back (green)
  X.ex = [];
  const exchange = (ids, w) => ids.forEach((id, j) => {
    const n = S.N.get(id), pt = X.port;
    const C = vertical() ? [n.p, { x: n.p.x, y: n.p.y + 70 }, { x: pt.x, y: pt.y - 90 }, pt]
      : [n.p, { x: n.p.x + 150, y: n.p.y }, { x: pt.x - 120, y: pt.y }, pt];
    const path = el('path', { d: pathD(C), fill: 'none', stroke: COL.line, 'stroke-width': 1.1, 'stroke-dasharray': '3 3', opacity: 0 }, layer.xeno);
    const dots = [0, 1].map(() => el('circle', { r: 2.4, opacity: 0 }, layer.xeno));
    const out = w.out == null ? null : w.out + j * 120;
    if (out != null) S.pulses.push({ node: n, t0: out + 700, d: 600, color: COL.light, alpha: .45 });
    X.ex.push({ C, path, dots, on: w.on, out, back: w.back + j * 120, off: w.off });
  });
  exchange(OUT_ORGANS, { on: P + PREDICT.outAt - 300, out: P + PREDICT.outAt, back: P + PREDICT.backAt, off: P + PREDICT.rankAt + 400 });
  exchange(['heart'], { on: V + VALIDATE.backAt - 200, out: null, back: V + VALIDATE.backAt, off: V + VALIDATE.updAt + 600 });
  exchange(DISCOVER_QUERY, { on: D + DISCOVER.walkAt - 300, out: D + DISCOVER.walkAt, back: D + DISCOVER.walkAt + 1300, off: D + DISCOVER.popAt + 800 });

  // validation run: from the flagged row (wide) or the panel's top (compact), over the backbone, to the
  // biofoundry (the imaged card)
  const flagged = X.rows.find(r => r.flagged), sl = L.slots.imaged;
  if (vertical()) {
    const a = { x: O.x + 40, y: O.y - 2 }, b = { x: sl.x + sl.w * .5, y: sl.y + sl.h + 22 };
    X.req = { C: [a, { x: a.x - 30, y: a.y - 140 }, { x: b.x + 10, y: b.y + 160 }, b] };
  } else {
    const a = { x: O.x - 2, y: flagged.y1 + pitch / 2 }, b = { x: sl.x + sl.w * .55, y: sl.y - 5 };
    X.req = { C: [a, { x: a.x - 200, y: -26 }, { x: b.x + 60, y: -34 }, b] };
  }
  Object.assign(X.req, { t0: V + VALIDATE.reqAt, d: VALIDATE.req });
  X.req.path = el('path', { d: pathD(X.req.C), fill: 'none', stroke: COL.flag, 'stroke-width': 2, 'stroke-dasharray': '5 4', opacity: 0 }, layer.xeno);
  X.req.dot = el('circle', { r: 5, fill: COL.flag, opacity: 0 }, layer.xeno);
  X.req.label = el('g', { opacity: 0 }, layer.xeno);
  const rl = txt(X.req.label, 12, 5, 'validation run · ZM-131', 't-label t-strong', { style: `fill:${COL.flag}` });
  const rb = rl.getBBox();   // the pill fits the text, 10 to the sides and 4 above and below
  X.req.label.insertBefore(el('rect', { x: 2, y: rb.y - 4, width: rb.width + 20, height: rb.height + 8, rx: rb.height / 2 + 4,
                                        fill: COL.bg, 'fill-opacity': .92, stroke: COL.flag, 'stroke-opacity': .55 }), rl);
  // the run under way: a callout at the biofoundry, from when the run starts until the ranking is updated
  {
    const cw = 300, ch = 62, cx = sl.x, cy = vertical() ? sl.y + sl.h + 24 : sl.y + sl.h + 10;
    // on the top layer: it sits over the cards below the biofoundry while the run is under way
    const C = X.call = { g: el('g', { opacity: 0 }, layer.output), bw: cw - 28 };
    el('rect', { x: cx, y: cy, width: cw, height: ch, rx: 8, fill: COL.bg, 'fill-opacity': .95, stroke: COL.flag, 'stroke-opacity': .6 }, C.g);
    C.dot = el('circle', { cx: cx + 17, cy: cy + 18.5, r: 3.5, fill: COL.flag }, C.g);
    C.head = txt(C.g, cx + 28, cy + 23, '', 't-head', { style: `fill:${COL.flag};fill-opacity:1` });
    txt(C.g, cx + 14, cy + 42, 'ZM-131 · heart · whole organism', 't-label t-strong');
    el('rect', { x: cx + 14, y: cy + 50, width: C.bw, height: 4, rx: 2, fill: COL.line, 'fill-opacity': .18 }, C.g);
    C.bar = el('rect', { x: cx + 14, y: cy + 50, width: 0, height: 4, rx: 2, fill: COL.flag }, C.g);
  }
  // the run itself: the imaged card lights up and its heart link carries new data
  const runAt = V + VALIDATE.runAt;
  const hk = S.links.find(k => k.src === 'imaged' && k.to.id === 'heart');
  if (hk) {
    hk.boost = [runAt, runAt + VALIDATE.run];
    hk.flows.push([runAt + 200, runAt + VALIDATE.run - 100]);
    S.pulses.push({ node: hk.to, t0: runAt + 1100, d: 800, color: COL.live });
  }

  // the mechanism of action, traced along the graph once the result is back
  X.moa = MOA_PATH.slice(1).map((id, i) => {
    const A = S.N.get(MOA_PATH[i]).p, B = S.N.get(id).p, t0 = V + VALIDATE.moaAt + i * VALIDATE.moaStep;
    const at = { x1: A.x, y1: A.y, x2: A.x, y2: A.y, stroke: COL.result, 'stroke-linecap': 'round', opacity: 0 };
    const glow = el('line', Object.assign({ 'stroke-width': 8, 'stroke-opacity': .18 }, at), layer.xeno);
    const line = el('line', Object.assign({ 'stroke-width': 2.6 }, at), layer.xeno);
    S.pulses.push({ node: S.N.get(id), t0: t0 + 380, d: 700, color: COL.result });
    return { A, B, glow, line, t0 };
  });
  {
    const a = S.N.get('liver').p, b = S.N.get('heart').p;
    const [dx, dy] = L.moaTag || [36, 12];
    X.moaTag = el('g', { opacity: 0, transform: `translate(${(a.x + b.x) / 2 + dx},${(a.y + b.y) / 2 + dy})` }, layer.xeno);
    const tt = txt(X.moaTag, 0, 4.5, 'MoA · ZM-131', 't-note', { 'text-anchor': 'middle', style: `fill:${COL.result};fill-opacity:1;font-weight:500` });
    const tb = tt.getBBox(), tw = tb.width + 18;
    X.moaTag.insertBefore(el('rect', { x: -tw / 2, y: tb.y - 4, width: tw, height: tb.height + 8, rx: tb.height / 2 + 4, fill: COL.bg,
                                       'fill-opacity': .92, stroke: COL.result, 'stroke-opacity': .5 }), tt);
  }

  // discovery: XenoEx walks the disease's mechanisms through the backbone; new targets appear on those lines
  X.walk = DISCOVER_WALK.map(([p, q], i) => {
    const A = S.N.get(p), B = S.N.get(q);
    const line = el('line', { x1: A.p.x, y1: A.p.y, x2: A.p.x, y2: A.p.y, stroke: COL.target, 'stroke-width': 2.2, 'stroke-linecap': 'round', opacity: 0 }, layer.xeno);
    return { A, B, line, t0: D + DISCOVER.walkAt + i * DISCOVER.walkStep };
  });
  X.targets = TARGETS.map((tg, i) => {
    const A = S.N.get(tg.on[0]).p, B = S.N.get(tg.on[1]).p, t0 = D + DISCOVER.popAt + i * DISCOVER.popStep;
    const p = { x: lerp(A.x, B.x, tg.u), y: lerp(A.y, B.y, tg.u) };
    const g = el('g', { opacity: 0 }, layer.xeno);
    el('circle', { r: 10, fill: COL.bg, 'fill-opacity': .7, stroke: COL.target, 'stroke-opacity': .5, 'stroke-width': 1 }, g);
    el('circle', { r: 5, fill: COL.target }, g);
    const [lx, ly, anchor] = (L.tlab && L.tlab[tg.id]) || [13, -7, 'start'];
    txt(g, lx, ly, tg.id, 't-note t-halo', { 'text-anchor': anchor, style: `fill:${COL.target};fill-opacity:1;font-weight:600` });
    S.pulses.push({ node: { p, kind: 'target' }, t0: t0 + 100, d: 800, color: COL.target });
    return { p, g, t0 };
  });
}

function linkCurve(a, b) {
  return vertical()
    ? [a, { x: a.x, y: lerp(a.y, b.y, .45) }, { x: b.x, y: lerp(a.y, b.y, .55) }, b]
    : [a, { x: lerp(a.x, b.x, .45), y: a.y }, { x: lerp(a.x, b.x, .55), y: b.y }, b];
}
function linkAlpha(t, k) {
  const base = lerp(k.alpha, k.rest, prog(t, k.dimAt, 800));
  if (!k.boost) return base;
  return lerp(base, .95, prog(t, k.boost[0], 300) * (1 - prog(t, k.boost[1] - 400, 400)));
}
// dots travel along a link while one of its flow windows is open
function linkFlow(t, k) {
  for (const [from, to] of k.flows) {
    if (t <= from || t >= to) continue;
    const win = prog(t, from, 400) * (1 - prog(t, to - 500, 500));
    const u = ((flowT / 1700) + k.j * .17) % 1;
    return { u, a: Math.sin(Math.PI * u) * .9 * win };
  }
  return null;
}

function buildGraphSVG() {
  const lay = { backbone: layer.backbone, context: layer.context };
  S.edges.forEach(e => {
    e.el = el('line', { x1: e.a.p.x, y1: e.a.p.y, x2: e.a.p.x, y2: e.a.p.y, stroke: e.color, 'stroke-width': e.w,
                        'stroke-opacity': e.alpha, opacity: 0, 'stroke-dasharray': e.dash ? '3 3' : 'none' }, lay[e.layer]);
  });
  S.waves.forEach(w => {
    w.el = el('line', { x1: w.a.p.x, y1: w.a.p.y, x2: w.a.p.x, y2: w.a.p.y, stroke: COL.live, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0 }, layer.links);
  });
  S.links.forEach(k => {
    k.C = linkCurve(k.from, k.to.p);
    k.el = el('path', { d: pathD(k.C), fill: 'none', stroke: k.color, 'stroke-width': k.w, 'stroke-linecap': 'round', opacity: 0 }, layer.links);
    k.len = k.el.getTotalLength();
    // dashed links (other models) draw on by growing the curve; solid ones by their dash offset
    if (k.dashed) k.el.setAttribute('stroke-dasharray', '3 3');
    else { k.el.setAttribute('stroke-dasharray', k.len); k.el.setAttribute('stroke-dashoffset', k.len); }
    k.dot = el('circle', { r: 2.6, fill: k.color, opacity: 0 }, layer.links);
  });
  // evidence rings: open at the bottom, where the organ's name sits
  S.rings.forEach(g => {
    const a0 = 125 * Math.PI / 180, a1 = 55 * Math.PI / 180, r = g.r;
    g.el = el('g', { opacity: 0 }, layer.backbone);
    el('path', { d: `M${(r * Math.cos(a0)).toFixed(2)} ${(r * Math.sin(a0)).toFixed(2)}A${r} ${r} 0 1 1 ${(r * Math.cos(a1)).toFixed(2)} ${(r * Math.sin(a1)).toFixed(2)}`,
                 fill: 'none', stroke: g.color, 'stroke-width': 1.6, 'stroke-opacity': .85, 'stroke-linecap': 'round' }, g.el);
  });
  S.pulses.forEach(p => {
    const k = p.node.kind;
    p.r0 = k === 'organ' ? 12 : k === 'func' ? 9 : k === 'target' ? 6 : 5;
    p.el = el('circle', { cx: p.node.p.x, cy: p.node.p.y, r: p.r0, fill: 'none', stroke: p.color, 'stroke-width': p.alpha ? 1.1 : 1.6, opacity: 0 },
              p.color === COL.context ? layer.context : layer.links);
  });
  S.nodes.forEach(n => {
    const g = el('g', { opacity: 0 }, layer.backbone);
    if (n.kind === 'organ') {
      el('circle', { r: 11, fill: COL.plate, stroke: COL.line, 'stroke-opacity': .9, 'stroke-width': 1.7 }, g);
      el('circle', { r: 3.2, fill: COL.line, 'fill-opacity': .8 }, g);
    } else if (n.kind === 'signal') {
      el('circle', { r: 3.4, fill: COL.medium }, g);
    } else {
      el('path', { d: 'M0 -8 L8 0 L0 8 L-8 0 Z', fill: COL.plate, stroke: COL.line, 'stroke-opacity': .9, 'stroke-width': 1.5 }, g);
    }
    if (n.label) {
      n.lab = el('g', { opacity: 0 }, S.labelLayer);
      txt(n.lab, 0, n.kind === 'organ' ? 28 : 25, n.label, n.kind === 'organ' ? 't-label t-strong t-halo' : 't-note t-halo', { 'text-anchor': 'middle' });
    }
    n.el = g;
  });
}

// ---------- frames ----------
let visible = false;
// phase of the dots on links, the pulsing dots and the heatmap's breathing: it runs while the film plays, so they
// move at rest, and stops with it (paused, ended, out of view, reduced motion)
let flowT = 0;
function frameChrome(t) {
  // the left column (whole-organism and human data) fades as the camera pans past it, rather than being cut mid-word
  const leftA = 1 - clamp(cam.x / 30);
  S.fades.forEach(f => set(f.el, 'opacity', prog(t, f.t0, f.d) * (f.left ? leftA : 1)));
  let dim = 0;
  S.insets.forEach(r => {
    const st = r.step, ua = prog(t, r.T, st.appear), ud = prog(t, r.T + st.dockAt, st.dock, E.inOut);
    const x = lerp(r.present.x, r.dock.x, ud), y = lerp(r.present.y, r.dock.y, ud), s = lerp(r.present.s, r.dock.s, ud);
    const la = r.group === 'model' ? 1 : leftA;
    set(r.g, 'opacity', ua * la * (r.group === 'model' ? lerp(1, .7, ud) : 1));
    set(r.g, 'transform', `translate(${x},${y}) scale(${s})`);
    // in once the backdrop has darkened the graph; out in the first third of the dock, before it shrinks over the graph
    set(r.pc, 'opacity', (1 - prog(t, r.T + st.dockAt, st.dock * .35)) * prog(t, r.T + 200, 300));
    set(r.cap, 'opacity', prog(t, r.T + st.dockAt + 250, 250) * la * (r.group === 'model' ? .75 : 1));
    if (r.group !== 'model') dim = Math.max(dim, ua * (1 - ud));
    const live = ua > 0 && ud < 1;
    r.presenting = live;
    if (r.heat) animateHeat(r.heat, t - r.T, live);
    if (r.checks && live) frameChecks(r, t - r.T);
    if (r.track) frameTrack(r, t - r.T, live ? 1 - ud : 0);
    if (r.video) {
      if (live) {
        const ct = clamp((t - r.T) / 1000, 0, (r.video.duration || 10) - .05);
        if (playing) {
          // the clip runs with the story, drift corrected
          if (r.video.paused) r.video.play().catch(() => {});
          if (r.video.readyState >= 1 && Math.abs(r.video.currentTime - ct) > .3) r.video.currentTime = ct;
        } else {
          // paused, out of view or jumping: the clip follows the story time
          if (!r.video.paused) r.video.pause();
          if (r.video.readyState >= 1 && Math.abs(r.video.currentTime - ct) > .034) r.video.currentTime = ct;
        }
      } else if (ua > 0 && playing) {
        // docked: the clip loops while the film plays
        if (r.video.paused) r.video.play().catch(() => {});
      } else if (!r.video.paused) r.video.pause();   // hidden, or the film paused, ended or out of view
      r.shown = ua > 0;
    }
  });
  set(S.backdrop, 'opacity', (.78 * dim).toFixed(3));
  const g0 = TL.validate + VALIDATE.runAt;
  const gv = prog(t, g0 - 200, 300) * (1 - prog(t, g0 + VALIDATE.run, 500));
  set(S.runGlow, 'opacity', (gv * (.65 + .35 * Math.sin(t / 140))).toFixed(3));
}

function frameSVG(t) {
  S.nodes.forEach(n => {
    const u = prog(t, n.t0, n.d);
    const tr = `translate(${n.p.x},${n.p.y}) scale(${(.55 + .45 * u).toFixed(3)})`;
    set(n.el, 'opacity', u);
    set(n.el, 'transform', tr);
    if (n.lab) { set(n.lab, 'opacity', u); set(n.lab, 'transform', tr); }
  });
  S.edges.forEach(e => {
    const u = prog(t, e.t0, e.d);
    set(e.el, 'opacity', u > 0 ? 1 : 0);
    set(e.el, 'x2', lerp(e.a.p.x, e.b.p.x, u));
    set(e.el, 'y2', lerp(e.a.p.y, e.b.p.y, u));
  });
  S.waves.forEach(w => {
    const u = (t - w.t0) / w.d;
    if (u <= 0 || u >= 1) { set(w.el, 'opacity', 0); return; }
    const r = E.out(clamp(u * 2));
    set(w.el, 'x2', lerp(w.a.p.x, w.b.p.x, r)); set(w.el, 'y2', lerp(w.a.p.y, w.b.p.y, r));
    set(w.el, 'opacity', (.8 * (u < .5 ? 1 : (1 - u) * 2)).toFixed(3));
  });
  S.links.forEach(k => {
    const u = prog(t, k.t0, k.d);
    set(k.el, 'opacity', u > 0 ? linkAlpha(t, k) : 0);
    if (!k.dashed) set(k.el, 'stroke-dashoffset', k.len * (1 - u));
    else if (u !== k.u) { k.u = u; set(k.el, 'd', pathD(u >= 1 ? k.C : bezPart(k.C, Math.max(u, .001)))); }
    const f = linkFlow(t, k);
    if (f) {
      const p = k.el.getPointAtLength(f.u * k.len);
      set(k.dot, 'cx', p.x); set(k.dot, 'cy', p.y); set(k.dot, 'opacity', f.a.toFixed(3));
    } else set(k.dot, 'opacity', 0);
  });
  S.rings.forEach(g => {
    const u = prog(t, g.t0, 600);
    set(g.el, 'opacity', u.toFixed(3));
    set(g.el, 'transform', `translate(${g.node.p.x},${g.node.p.y}) scale(${(.7 + .3 * u).toFixed(3)})`);
  });
  S.pulses.forEach(p => {
    const u = clamp((t - p.t0) / p.d);
    set(p.el, 'opacity', u > 0 && u < 1 ? (1 - u) * (p.alpha || .9) : 0);
    set(p.el, 'r', p.r0 + 16 * E.out(u));
  });
}

function frameXeno(t) {
  const X = S.X, P = TL.predict, V = TL.validate, D = TL.discover;
  set(X.card, 'opacity', prog(t, P, PREDICT.card));

  // which question: candidates, then targets
  const sw = prog(t, D, DISCOVER.switchD, E.inOut);
  set(X.cand, 'opacity', 1 - sw);
  set(X.targ, 'opacity', sw);
  set(X.tabBar, 'x', lerp(X.tabPos[0].x, X.tabPos[1].x, sw));
  set(X.tabBar, 'width', lerp(X.tabPos[0].w, X.tabPos[1].w, sw));
  const tab = sw < .5 ? 0 : 1;
  if (tab !== X.tabOn) { X.tabOn = tab; X.tabs.forEach((n, i) => { n.style.fill = i === tab ? COL.light : ''; n.style.fillOpacity = i === tab ? 1 : ''; }); }

  // the query, typed
  let q = '', typing = false;
  X.queries.forEach(Q => {
    if (t < Q.at) return;
    const n = Math.round(Q.s.length * clamp((t - Q.at) / Q.d));
    q = Q.s.slice(0, n); typing = n < Q.s.length;
  });
  if (t >= D && t < X.queries[1].at) q = '';
  if (X.query.textContent !== q) { X.query.textContent = q; X.qw = q ? X.query.getComputedTextLength() : 0; }
  set(X.caret, 'x', L.out.x + 34 + (X.qw || 0) + 1);
  set(X.caret, 'opacity', typing || (t >= D && t < X.queries[1].at) || (t >= P && t < X.queries[0].at) ? (Math.floor(t / 400) % 2 ? .2 : 1) : 0);

  let si = -1;
  X.statuses.forEach((s, k) => { if (t >= s[0]) si = k; });
  if (si !== X.statusIdx) {
    X.statusIdx = si;
    X.status.textContent = si < 0 ? '' : X.statuses[si][1];
    X.status.style.fill = si < 0 ? '' : X.statuses[si][2];
    X.status.style.fillOpacity = 1;
  }
  set(X.status, 'opacity', si < 0 ? 0 : prog(t, X.statuses[si][0], 300));

  // rows: bars grow, rank, then ZM-131 is flagged, validated and moves up
  const u1 = prog(t, P + PREDICT.rankAt, PREDICT.rank, E.inOut), u2 = prog(t, V + VALIDATE.rankAt, VALIDATE.rank, E.inOut);
  const upd = prog(t, V + VALIDATE.updAt, VALIDATE.upd, E.inOut);
  const flagOn = prog(t, V, 400) * (1 - prog(t, V + VALIDATE.updAt + VALIDATE.upd, 500));
  const k = u2 > 0 ? 1 : 0;
  if (k !== X.rerankOn) { X.rerankOn = k; X.rerank[k].up.forEach(r => X.cand.appendChild(r.g)); }
  X.rows.forEach(r => {
    set(r.g, 'transform', `translate(0,${lerp(lerp(r.y0, r.y1, u1), r.y2, u2).toFixed(2)})`);
    const pass = Math.max(X.rerank[0].dim.includes(r) ? Math.sin(Math.PI * u1) : 0, X.rerank[1].dim.includes(r) ? Math.sin(Math.PI * u2) : 0);
    set(r.g, 'opacity', (1 - .7 * pass).toFixed(3));
    const rk = String(u2 > .5 ? r.r2 : r.r1);
    if (r.rank.textContent !== rk) r.rank.textContent = rk;
    set(r.rank, 'opacity', prog(t, P + PREDICT.rankAt + PREDICT.rank - 200, 300));
    set(r.hl, 'opacity', r.flagged ? (.12 * flagOn).toFixed(3) : 0);
    r.bars.forEach((b, j) => {
      const grow = prog(t, P + PREDICT.barsAt + r.i * 90 + j * 50, 550);
      const v = b.unsure ? lerp(b.v, b.unsure.to, upd) : b.v;
      set(b.el, 'width', (X.bw * v * grow).toFixed(2));
      set(b.el, 'fill', v >= .5 ? COL.flag : COL.result);
      if (b.range) {
        const lo = lerp(b.unsure.lo, b.unsure.to, upd), hi = lerp(b.unsure.hi, b.unsure.to, upd);
        set(b.range, 'x', (b.x + X.bw * lo).toFixed(2));
        set(b.range, 'width', Math.max(0, X.bw * (hi - lo)).toFixed(2));
        set(b.range, 'opacity', (prog(t, V, 400) * (1 - prog(t, V + VALIDATE.updAt + VALIDATE.upd - 200, 300))).toFixed(3));
      }
    });
  });
  X.trows.forEach(r => { set(r.g, 'opacity', prog(t, r.t0, 400)); set(r.b, 'width', (r.w * prog(t, r.t0 + 150, 600)).toFixed(2)); });

  // exchanges with the backbone
  X.ex.forEach(x => {
    set(x.path, 'opacity', (.75 * prog(t, x.on, 300) * (1 - prog(t, x.off, 500))).toFixed(3));
    x.dots.forEach((d, k) => {
      let s = -1, out = false;
      if (x.out != null) { const so = (t - x.out - k * 260) / 700; if (so > 0 && so < 1) { s = so; out = true; } }
      const sb = (t - x.back - k * 260) / 700;
      if (sb > 0 && sb < 1) { s = sb; out = false; }
      if (s < 0) { set(d, 'opacity', 0); return; }
      const p = bez(x.C, out ? 1 - s : s);
      set(d, 'cx', p.x.toFixed(1)); set(d, 'cy', p.y.toFixed(1));
      set(d, 'fill', out ? COL.light : COL.result);
      set(d, 'opacity', (Math.sin(Math.PI * s) * .95).toFixed(3));
    });
  });

  // the validation run on its way to the biofoundry
  const R = X.req, us = clamp((t - R.t0) / R.d);
  set(R.path, 'opacity', (.9 * prog(t, R.t0, 300) * (1 - prog(t, V + VALIDATE.updAt, 600))).toFixed(3));
  if (us > 0 && us < 1) {
    const p = bez(R.C, E.inOut(us));
    set(R.dot, 'cx', p.x.toFixed(1)); set(R.dot, 'cy', p.y.toFixed(1)); set(R.dot, 'opacity', 1);
    set(R.label, 'transform', `translate(${p.x.toFixed(1)},${(p.y + 20).toFixed(1)})`);
    // in quickly, and gone before the run lands on the biofoundry's caption
    set(R.label, 'opacity', (clamp(us / .12) * (1 - clamp((us - .55) / .2))).toFixed(3));
  } else { set(R.dot, 'opacity', 0); set(R.label, 'opacity', 0); }

  // the run under way, then its result
  const C = X.call, c0 = V + VALIDATE.runAt, done = t >= V + VALIDATE.backAt;
  set(C.g, 'opacity', (prog(t, c0 - 300, 300) * (1 - prog(t, V + VALIDATE.updAt + 400, 400))).toFixed(3));
  const hs = done ? 'RESULT IN \u00b7 ABOVE THRESHOLD' : 'PERFORMING A VALIDATION RUN';
  if (C.head.textContent !== hs) {
    C.head.textContent = hs;
    C.head.style.fill = done ? COL.live : COL.flag;
    set(C.dot, 'fill', done ? COL.live : COL.flag); set(C.bar, 'fill', done ? COL.live : COL.flag);
  }
  set(C.bar, 'width', (C.bw * clamp((t - c0) / (V + VALIDATE.backAt - c0))).toFixed(1));
  set(C.dot, 'opacity', done ? 1 : (.4 + .6 * Math.abs(Math.sin(flowT / 300))).toFixed(3));

  // the mechanism of action: bright while the result is read, then a trace once the question changes
  const moaOn = 1 - .7 * prog(t, D, 700);
  X.moa.forEach(m => {
    const u = prog(t, m.t0, 420), x2 = lerp(m.A.x, m.B.x, u).toFixed(1), y2 = lerp(m.A.y, m.B.y, u).toFixed(1);
    [m.glow, m.line].forEach(l => { set(l, 'x2', x2); set(l, 'y2', y2); set(l, 'opacity', u > 0 ? moaOn.toFixed(3) : 0); });
  });
  set(X.moaTag, 'opacity', (prog(t, V + VALIDATE.moaAt + 2 * VALIDATE.moaStep, 400) * (1 - prog(t, D, 500))).toFixed(3));

  // discovery: the mechanism lines stay, and the targets appear on them
  X.walk.forEach(w => {
    const u = prog(t, w.t0, 450);
    set(w.line, 'x2', lerp(w.A.p.x, w.B.p.x, u).toFixed(1)); set(w.line, 'y2', lerp(w.A.p.y, w.B.p.y, u).toFixed(1));
    set(w.line, 'opacity', u > 0 ? lerp(.9, .6, prog(t, w.t0 + 900, 700)).toFixed(3) : 0);
  });
  X.targets.forEach(tg => {
    const u = prog(t, tg.t0, 500);
    set(tg.g, 'opacity', u.toFixed(3));
    set(tg.g, 'transform', `translate(${tg.p.x},${tg.p.y}) scale(${(.4 + .6 * u).toFixed(3)})`);
  });
}

// a gentle zoom toward where the new thing happens, back to the whole picture between and at the end
function camRect(t) {
  const F = { x: 0, y: 0, w: L.w, h: L.h };
  if (vertical() || reduced) return F;
  const w = L.w * .82, h = L.h * .82;
  const IN = { x: 0, y: 22, w, h }, HUM = IN;
  const MOD = { x: L.w * .12, y: 20, w: L.w * .88, h: L.h * .88 };   // other models, on the right: the graph's title and labels stay in
  const OUT = { x: L.w * .14, y: 16, w: L.w * .86, h: L.h * .86 };   // XenoEx: the panel and the backbone, title included
  const V = TL.validate, D = TL.discover;
  const keys = [[0, F], [TL.inputs[0] - 300, F], [TL.inputs[0] + 400, IN], [TL.prop - 300, IN], [TL.prop + 400, F],
                [TL.human - 300, F], [TL.human + 400, HUM], [TL.models[0] - 300, HUM], [TL.models[0] + 300, MOD],
                [TL.predict - 300, MOD], [TL.predict + 400, OUT],
                [V + VALIDATE.reqAt - 300, OUT], [V + VALIDATE.reqAt + 400, F], [D - 200, F], [D + 500, OUT],
                [TL.end - 2200, OUT], [TL.end - 800, F], [TL.end, F]];
  let i = 1;
  while (i < keys.length - 1 && t > keys[i][0]) i++;
  const [ta, A] = keys[i - 1], [tb, B] = keys[i], u = E.inOut(clamp((t - ta) / (tb - ta || 1)));
  return { x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), w: lerp(A.w, B.w, u), h: lerp(A.h, B.h, u) };
}

// ---------- the clock ----------
// Plays like a film while most of the figure is on screen, with chapters and previous/next; the page scrolls normally.
let reduced = reduceQ.matches;
let playing = false, hold = false;   // hold: a moment kept on screen for review (?pf-t)
let clockT = 0, raf = 0, lastNow = 0, fade = null;

let narrIdx = -1;
// the step on screen at time t: the last one that has started
function stepAt(t) { let i = 0; BEATS.forEach((b, k) => { if (t >= b.t) i = k; }); return i; }
function narrate(t) {
  const i = stepAt(t);
  if (i === narrIdx) return;
  narrIdx = i;
  nStepNow.textContent = BEATS[i].narr;
  nTextNow.textContent = BEATS[i].text;
  narr.classList.remove('is-fresh'); void narr.offsetWidth; narr.classList.add('is-fresh');
}

let lastVB = '', cam = { x: 0 };
function render(t) {
  if (!S) return;   // not built yet
  const vb = cam = camRect(t), vbs = `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`;
  if (vbs !== lastVB) { LAYERS.forEach(n => layer[n].setAttribute('viewBox', vbs)); lastVB = vbs; }
  frameChrome(t); frameSVG(t); frameXeno(t); narrate(t);
}

// ---------- chapters ----------
let on = false, activeIdx = -1;
CHAPTERS.forEach(c => {
  c.el = group.querySelector(`[data-select-panel="${c.key}"]`);
  c.btn = group.querySelector(`[data-select="${c.key}"]`);
});
const docY = n => n.getBoundingClientRect().top + window.scrollY;
function setActiveChapter(active) {
  if (active === activeIdx) return;
  activeIdx = active;
  CHAPTERS.forEach((c, i) => {
    c.el.classList.toggle('is-active', i === active);
    if (c.btn) { c.btn.classList.toggle('is-active', i === active); c.btn.setAttribute('aria-pressed', String(i === active)); }
  });
}
const stepIdx = c => BEATS.map((b, i) => [b, i]).filter(([b]) => b.ch === c.key || (c === CHAPTERS[0] && !b.ch)).map(([, i]) => i);
// chapter text and bar: the chapter that is playing is shown, and its bar fills with what has played
function markChapters() {
  setActiveChapter(Math.max(0, CHAPTERS.findIndex(c => c.key === BEATS[stepAt(clockT)].ch)));
  CHAPTERS.forEach(c => {
    if (!c.btn) return;
    const ids = stepIdx(c), t0 = ids[0] ? BEATS[ids[0] - 1].rest : 0, t1 = BEATS[ids[ids.length - 1]].rest;
    c.btn.style.setProperty('--p', clamp((clockT - t0) / (t1 - t0)).toFixed(3));
  });
}

// a quick fade through the background to another moment (previous/next, chapters); a cut with reduced motion
function cutTo(t, i, now) {
  if (reduced) { clockT = t; return; }
  fade = { t, i, start: now, out: true };
}
function stepFade(now) {
  const u = clamp((now - fade.start) / 160);
  playing = false;
  if (fade.out) {
    stage.style.opacity = (1 - u).toFixed(3);
    if (u >= 1) { clockT = fade.t; fade.out = false; fade.start = now; }
  } else {
    stage.style.opacity = u.toFixed(3);
    if (u >= 1) { stage.style.opacity = ''; fade = null; }
  }
}

// ---------- player ----------
let userPaused = false, ended = false, inView = false;
const playBtn = group.querySelector('[data-pf-play]');
function updatePlay() { playBtn.textContent = ended ? 'Replay' : userPaused ? 'Play' : 'Pause'; }
function playerClock(dt) {
  playing = inView && !userPaused && !ended;
  if (!playing) return;
  clockT = Math.min(TL.end, clockT + dt);
  if (clockT >= TL.end) { ended = true; updatePlay(); }
}
function playerJump(i) {
  ended = false; updatePlay();
  // paused (as reduced motion starts): show the step finished; otherwise play it from its start
  cutTo(userPaused ? BEATS[i].rest : BEATS[i].t, i, performance.now());
  startTick();
}
playBtn.addEventListener('click', () => {
  if (ended) { userPaused = false; playerJump(0); return; }
  userPaused = !userPaused; updatePlay(); startTick();
});
// the step on screen, or the one a fade is already heading to (so quick repeated clicks keep stepping)
const stepNow = () => (fade ? fade.i : stepAt(clockT));
group.querySelector('[data-pf-prev]').addEventListener('click', () => {
  const i = stepNow(), still = userPaused;
  playerJump(!still && !fade && (clockT - BEATS[i].t > 1500 || i === 0) ? i : Math.max(0, i - 1));   // to this step's start, or the one before
});
group.querySelector('[data-pf-next]').addEventListener('click', () => playerJump(Math.min(BEATS.length - 1, stepNow() + 1)));
// plays while most of the figure is on screen
new IntersectionObserver(entries => { inView = entries[0].intersectionRatio >= .6; startTick(); }, { threshold: [0, .6, 1] }).observe(stage);

function tick(now) {
  raf = 0;
  if (!on || !visible || !S) return;
  const dt = Math.min(64, now - lastNow); lastNow = now;
  const fading = !!fade;
  if (fade) stepFade(now);
  else if (hold) playing = false;
  else playerClock(dt);
  if (playing) flowT += dt;
  render(clockT);
  markChapters();
  // frames while the film plays or fades (and one after, to pick up playing); otherwise the last frame stands
  // until something changes (startTick)
  if (playing || fading) raf = requestAnimationFrame(tick);
}
function startTick() {
  if (raf || !on || !visible) return;
  lastNow = performance.now();
  raf = requestAnimationFrame(tick);
}

// the Run / Translate / Reason buttons play their chapter from its start
CHAPTERS.forEach(c => c.btn && c.btn.addEventListener('click', () => {
  if (!on) return;
  hold = false;
  playerJump(stepIdx(c)[0]);
}));

// clips play only while the story is on screen (browsers may also pause muted video; restart it)
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (!visible && S) S.insets.forEach(r => r.video && r.video.pause());
  if (visible) startTick();
}).observe(story);
// Not with the page: the figure is built once the browser is idle after load, or when the story comes within a
// screen of view if that is sooner; its clips load only from then on.
let near = false;
function ensureBuilt() { if (on && !S) { build(); render(clockT); markChapters(); startTick(); } }
function loadClips() {
  if (S) S.insets.forEach(r => { if (r.video && r.video.preload !== 'auto') { r.video.preload = 'auto'; r.video.load(); } });
}
new IntersectionObserver(entries => {
  near = entries[0].isIntersecting;
  if (near) { ensureBuilt(); loadClips(); }
}, { rootMargin: '100% 0px' }).observe(story);
setInterval(() => {
  if (!on || !S || !visible || !playing) return;
  S.insets.forEach(r => { if (r.video && r.shown && r.video.paused && !r.presenting) r.video.play().catch(() => {}); });
}, 700);

function setOn(want) {
  if (want === on) return;
  on = want;
  group.classList.toggle('is-scrolly', on);
  group.classList.toggle('pf-short', on && arrangement() === 'short');
  group.classList.toggle('pf-narrow', on && arrangement() === 'stacked');
  group.classList.toggle('pf-compact', on && vertical());
  sticky.hidden = !on;
  // the chapter text changes by itself while the film plays: not announced, as it is when a reader picks a part
  chapterText.setAttribute('aria-live', on ? 'off' : 'polite');
  if (on) {
    if (!S && near) build();
    activeIdx = -1;
    // with reduced motion it waits for Play, showing the first step finished
    userPaused = reduced; ended = false;
    clockT = reduced ? BEATS[0].rest : 0;
    updatePlay();
    render(clockT);
    markChapters();
    startTick();
  } else {
    stage.style.opacity = '';
    CHAPTERS.forEach(c => c.btn && c.btn.style.removeProperty('--p'));
    if (S) S.insets.forEach(r => r.video && r.video.pause());
  }
}
const arrangement = () => (!layoutQ.matches ? 'stacked' : wideQ.matches ? 'beside' : shortQ.matches ? 'short' : 'stacked');
let arranged = '';
// The figure's layout follows the window; a change keeps the place in the story.
function evaluate() {
  const kind = layoutQ.matches ? 'wide' : 'compact';
  if (on && kind === L.kind && reduced === reduceQ.matches && arranged === arrangement()) return;
  arranged = arrangement();
  // the place in the story, and whether it was paused or over, unless the motion preference itself changed
  const keep = on ? { t: clockT, paused: userPaused, ended, reduced } : null;
  setOn(false);
  reduced = reduceQ.matches;
  if (kind !== L.kind) { L = LAYOUTS[kind]; S = null; }
  setOn(true);
  if (keep) {
    clockT = keep.t;
    if (keep.reduced === reduced) { userPaused = keep.paused; ended = keep.ended; updatePlay(); }
    render(clockT); markChapters();
  }
}
[wideQ, shortQ, layoutQ, reduceQ].forEach(q => q.addEventListener('change', evaluate));

// after main.js has set up the bar (its DOMContentLoaded listener runs first) and the fonts are in
const domReady = document.readyState === 'loading'
  ? new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true })) : Promise.resolve();
Promise.all([domReady, document.fonts.ready]).then(() => {
  evaluate();
  (window.requestIdleCallback || (f => setTimeout(f, 1500)))(ensureBuilt, { timeout: 4000 });
  // ?pf-t=<ms> opens the page at that moment of the story and holds it there (for review)
  const at = new URLSearchParams(window.location.search).get('pf-t');
  if (at === null) return;
  const header = document.getElementById('site-header');
  window.scrollTo({ top: docY(story) - (header ? header.offsetHeight : 72) - bar.offsetHeight - 16, behavior: 'instant' });
  hold = true; clockT = +at;
  if (!S) build();
  render(clockT); markChapters();
});
})();
