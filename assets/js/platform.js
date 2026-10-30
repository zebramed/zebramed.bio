/*
 * The platform as one scrolling story (test branch).
 * On wide screens without reduced motion, the figure stays pinned while the three texts
 * (Run, Translate, Reason) scroll past as chapters, and the scroll position drives the figure.
 * Anywhere else this script does nothing and the three panes show as before.
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
const nStep = group.querySelector('[data-pf-step]'), nText = group.querySelector('[data-pf-text]');
const wideQ = window.matchMedia('(min-width: 1024px) and (min-height: 620px)');
const reduceQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const MEDIA = stage.dataset.media || '/assets/media/platform/';

const CLIPS = { lateral: { src: MEDIA + 'imaged' }, behaviour: { src: MEDIA + 'tracked' } };
const NS = 'http://www.w3.org/2000/svg';
const COL = { line: '#9fb0d0', live: '#64ffda', context: '#c3a6ff', result: '#a8ff78', flag: '#f5b85c', target: '#ff6b7d',
              medium: '#ccd6f6', light: '#ffffff', plate: '#12173c', bg: '#0b1036' };

// ---------- the storyboard ----------
// Each input: appear, stay large while its content plays, dock, connect, pause. Models: the same, shorter.
const BACKBONE   = { build: 2600, rest: 1200 };
const INPUT_STEP = { appear: 400, dock: 650, link: 600, stagger: 120, pulse: 650, rest: 2200 };
const HOLD       = { imaged: 9000, tracked: 4000, sequenced: 5600 };
const PROPAGATE  = { wave: 2400, rest: 1400 };
const MODEL_STEP = { appear: 350, hold: 1700, dock: 500, branch: 500, pop: 300, attach: 450, stagger: 100, pulse: 550, rest: 1400 };
// Reason: XenoEx predicts, validates where it is unsure, then is asked for targets. Times within each part.
const PREDICT  = { card: 600, typeAt: 300, type: 1000, outAt: 1500, backAt: 2700, barsAt: 3600, rankAt: 4900, rank: 1200, end: 7600 };
const VALIDATE = { reqAt: 1000, req: 1500, runAt: 2500, run: 1900, backAt: 4400, updAt: 5400, upd: 900, rankAt: 6500, rank: 1100, end: 9000 };
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
                  kidney: [-30, 150], gut: [-150, 170], muscle: [-110, 170] };
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
const MODELS = [
  { id: 'cells',     kind: 'dish',     title: 'Cell cultures', caption: 'cell cultures',
    hub: [.58, .27], ctx: [[.47, .36, 'liver-0'], [.66, .44, 'liver-2'], [.62, .06, 'heart-0']] },
  { id: 'organoids', kind: 'organoid', title: 'Organoids',     caption: 'organoids',
    hub: [.03, .38], ctx: [[.38, .60, 'liver'], [.42, .22, 'brain']] },
  { id: 'chip',      kind: 'chip',     title: 'Organ-on-chip', caption: 'organ-on-chip',
    hub: [.55, .96], ctx: [[.44, .92, 'gut'], [.45, .66, 'liver']], couple: true },
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
const DISCOVER_QUERY = ['gut', 'liver', 'metabolism', 'kidney'];
const DISCOVER_WALK = [['gut', 'liver'], ['liver', 'metabolism'], ['metabolism', 'gut'], ['liver', 'kidney']];
const TARGETS = [
  { id: 'T1', x: .57, y: .64, links: ['liver', 'metabolism'], where: 'liver · metabolism', score: .86 },
  { id: 'T2', x: .29, y: .69, links: ['gut', 'liver'],        where: 'gut–liver axis',     score: .74 },
  { id: 'T3', x: .75, y: .50, links: ['liver-2', 'kidney'],   where: 'liver · kidney',     score: .61 },
];

(function timeline() {
  let t = BACKBONE.build + BACKBONE.rest;
  TL.inputs = INPUTS.map(inp => {
    const s = INPUT_STEP, T = t, st = { appear: s.appear, dockAt: s.appear + HOLD[inp.id], dock: s.dock };
    st.linkAt = st.dockAt + s.dock;
    st.pulseAt = st.linkAt + s.link * .75;
    st.end = st.linkAt + s.link + (inp.n - 1) * s.stagger + s.pulse;
    st.next = st.end + s.rest;
    inp.step = st; t += st.next;
    return T;
  });
  TL.prop = t; t += PROPAGATE.wave + PROPAGATE.rest;
  TL.models = MODELS.map(m => {
    const s = MODEL_STEP, T = t, st = { appear: s.appear, dockAt: s.appear + s.hold, dock: s.dock };
    st.branchAt = st.dockAt + s.dock;
    st.popAt = st.branchAt + s.branch;
    st.attachAt = st.popAt + s.pop;
    st.pulseAt = st.attachAt + s.attach * .7;
    st.end = st.attachAt + s.attach + (m.ctx.length - 1) * s.stagger + s.pulse;
    st.next = st.end + s.rest;
    m.step = st; t += st.next;
    return T;
  });
  TL.predict = t; t += PREDICT.end;
  TL.validate = t; t += VALIDATE.end;
  TL.discover = t; t += DISCOVER.end;
  TL.end = t;
})();

// chapters, in page order, and the steps inside each (scroll is shared out by step length)
const CHAPTERS = [
  { key: 'biofoundry',  bounds: [TL.inputs[0], TL.inputs[1], TL.inputs[2], TL.prop] },
  { key: 'interactome', bounds: [TL.prop, ...TL.models, TL.predict] },
  { key: 'xenoex',      bounds: [TL.predict, TL.validate, TL.discover, TL.end] },
];
// The story in steps: when each starts, where it comes to rest, its chapter, and what the page says.
// In step mode each step plays from the previous rest to its own, at its own pace.
const STEP_TEXT = {
  backbone:  ['Systemic backbone', 'A map of the body as one system: organs, and the functions and molecular signals that connect them.'],
  imaged:    ['Imaged', 'A living organism is imaged whole: organs, vessels and nerves seen together, in context.'],
  tracked:   ['Tracked', 'The same organism\u2019s behaviour is measured: how it moves, rests and responds.'],
  sequenced: ['Sequenced', 'Its gene activity is read out, clustered, and mapped onto the molecular signals of the backbone.'],
  spread:    ['Through the system', 'The backbone carries each observation on, from where it was measured to the organs and functions it connects to.'],
  cells:     ['Cell cultures', 'Other models are optional. Cell cultures plug in where they observe: at molecular signals.'],
  organoids: ['Organoids', 'Organoids add detail at single organs, here liver and brain.'],
  chip:      ['Organ-on-chip', 'An organ-on-chip couples two organs, gut and liver. The backbone works with or without them.'],
  predict:   ['Predict', 'XenoEx queries the backbone organ by organ and returns a human risk profile for each candidate, safest first.'],
  validate:  ['Validate', 'Where its confidence is under the agreed threshold, XenoEx designs a validation run for the biofoundry. The result updates the ranking.'],
  discover:  ['Discover', 'Asked about a disease instead, XenoEx follows its mechanisms through the backbone and proposes new targets.'],
};
const CHAPTER_LABEL = { biofoundry: 'Run', interactome: 'Translate', xenoex: 'Reason' };
const BEATS = [
  { id: 'backbone', ch: null, t: 0, rest: TL.inputs[0] - 300 },
  // inputs rest while the new links carry dots: the pause to take in the connection
  ...INPUTS.map((inp, i) => ({ id: inp.id, ch: 'biofoundry', t: TL.inputs[i], rest: TL.inputs[i] + inp.step.end + 900 })),
  { id: 'spread', ch: 'interactome', t: TL.prop, rest: TL.prop + PROPAGATE.wave + 200 },
  ...MODELS.map((m, i) => ({ id: m.id, ch: 'interactome', t: TL.models[i], rest: TL.models[i] + m.step.end + 300 })),
  { id: 'predict', ch: 'xenoex', t: TL.predict, rest: TL.validate - 300 },
  { id: 'validate', ch: 'xenoex', t: TL.validate, rest: TL.discover - 300 },
  { id: 'discover', ch: 'xenoex', t: TL.discover, rest: TL.end },
].map(b => {
  const [label, text] = STEP_TEXT[b.id];
  return Object.assign(b, { label, text, narr: b.ch ? `${CHAPTER_LABEL[b.ch]} \u00b7 ${label.toLowerCase()}` : label });
});
// common fields for the scroll to step through: when its line shows (start), where its playback
// begins (from) and where it comes to rest (to)
BEATS.forEach((b, i) => Object.assign(b, { start: b.t, from: i ? BEATS[i - 1].rest : 0, to: b.rest }));

// The story as states (state mode, the newsroom pattern): each a stable picture the reader can stay on.
// Reaching one plays a short intro (from -> to), then it rests there with the clips, link dots and
// heatmap still moving; moving on is a short transition. Each modality has two: shown large, then connected.
const STATE_TEXT = {
  sequenced:   ['Sequenced', 'Its gene activity is read out and clustered.'],
  imagedOn:    ['Imaged, connected', 'What is seen connects to the backbone, at the organs where it was seen.'],
  trackedOn:   ['Tracked, connected', 'Behaviour connects to the functions and organs it reflects.'],
  sequencedOn: ['Sequenced, connected', 'The clusters connect to the molecular signals of the backbone.'],
  validate:    ['Validate', 'Where its confidence is under the agreed threshold, XenoEx designs a validation run and sends it to the biofoundry.'],
  result:      ['Result', 'The run comes back above the threshold, and ZM-131 moves up the ranking.'],
};
// how long each modality's large card plays before it rests: the segmentation in, a swim bout, the clusters formed
const INTRO = { imaged: 8200, tracked: 3800, sequenced: 4600 };
const STATES = [
  { id: 'backbone', ch: null, from: 0, to: TL.inputs[0] - 300 },
  ...INPUTS.flatMap((inp, i) => {
    const T = TL.inputs[i], st = inp.step;
    return [{ id: inp.id, ch: 'biofoundry', from: T + st.appear, to: T + Math.min(INTRO[inp.id], st.dockAt - 200) },
            { id: inp.id + 'On', ch: 'biofoundry', from: T + st.dockAt, to: T + st.end + 900 }];
  }),
  { id: 'spread', ch: 'interactome', from: TL.prop, to: TL.prop + PROPAGATE.wave + 200 },
  ...MODELS.map((m, i) => ({ id: m.id, ch: 'interactome', from: TL.models[i] + m.step.appear, to: TL.models[i] + m.step.end + 300 })),
  { id: 'predict', ch: 'xenoex', from: TL.predict, to: TL.validate - 300 },
  { id: 'validate', ch: 'xenoex', from: TL.validate, to: TL.validate + VALIDATE.backAt },
  { id: 'result', ch: 'xenoex', from: TL.validate + VALIDATE.backAt, to: TL.discover - 300 },
  { id: 'discover', ch: 'xenoex', from: TL.discover, to: TL.end },
].map(s => {
  const [label, text] = STATE_TEXT[s.id] || STEP_TEXT[s.id];
  return Object.assign(s, { start: s.from, label, text, narr: s.ch ? `${CHAPTER_LABEL[s.ch]} \u00b7 ${label.toLowerCase()}` : label });
});

// The story as reading (reading mode): short paragraphs in the text column, each sized so that reading it
// takes about as long as its part of the animation (3 to 4 words a second). Each covers the timeline from
// the previous one's end to its own. Draft copy, from the site's existing wording.
const READ = [
  [null, TL.inputs[0] - 300, 'Everything here sits on one map, the systemic backbone: organs, the functions they carry out and the molecular signals between them, connected as they are in a living body.'],
  ['biofoundry', TL.inputs[0] + 4800, 'The biofoundry starts from transparent zebrafish larvae. They share 82% of human disease-associated genes and have a working liver, heart, nervous system and blood-brain barrier. ZebraChip microfluidics hold each larva in place to be imaged whole.'],
  ['biofoundry', TL.inputs[0] + INTRO.imaged, 'FishEye computer vision segments what the camera sees: the brain and spinal cord first, then each organ in view.'],
  ['biofoundry', TL.inputs[0] + INPUTS[0].step.end + 900, 'Each measurement is placed on the backbone at the organ where it was seen: here the brain, the gut and the heart.'],
  ['biofoundry', TL.inputs[1] + INTRO.tracked, 'The same larvae are filmed swimming, one per well. Tracking reads how each one moves, rests and responds, frame by frame.'],
  ['biofoundry', TL.inputs[1] + INPUTS[1].step.end + 900, 'Behaviour connects to the functions it reflects, such as activity, and to the organs behind them.'],
  ['biofoundry', TL.inputs[2] + INTRO.sequenced, 'Their gene activity is read out by sequencing. Samples group by dose, and genes group into programmes that rise, fall or switch on together.'],
  ['biofoundry', TL.inputs[2] + INPUTS[2].step.end + 900, 'Each programme is mapped to the molecular signals of the backbone it belongs to.'],
  ['interactome', TL.prop + PROPAGATE.wave + 200, 'The graph does not stop where a measurement lands. Orthology, shared ontologies and OECD adverse outcome pathways carry each observation on, step by mechanistic step, to its human counterpart and to the organs and functions it connects to.'],
  ['interactome', TL.models[0] + MODELS[0].step.end + 300, 'A client\u2019s own models can join the same graph. Cell cultures plug in at the molecular signals they observe.'],
  ['interactome', TL.models[1] + MODELS[1].step.end + 300, 'Organoids add detail at single organs, here the liver and the brain.'],
  ['interactome', TL.models[2] + MODELS[2].step.end + 300, 'An organ-on-chip couples two organs, the gut and the liver. These models add resolution; the backbone works without them.'],
  ['xenoex', TL.predict + PREDICT.barsAt, 'XenoEx reasons over the graph in steps a scientist can read, audit and redirect. Asked to rank four candidates, it queries the backbone organ by organ and collects what comes back.'],
  ['xenoex', TL.validate - 300, 'It returns a human risk profile for each, across liver, heart, brain and kidney, and ranks them safest first.'],
  ['xenoex', TL.validate + VALIDATE.reqAt, 'One prediction is uncertain: the heart risk of ZM-131 falls under the confidence threshold agreed with the client.'],
  ['xenoex', TL.validate + VALIDATE.backAt, 'So XenoEx designs the run that would settle it and sends it to the biofoundry, to be tested on whole organisms.'],
  ['xenoex', TL.discover - 300, 'The result comes back above the threshold. The heart risk is lower than feared, and ZM-131 moves up the ranking.'],
  ['xenoex', TL.discover + DISCOVER.popAt, 'XenoEx can also be asked the other way round: not which candidate is safest, but what to target in a disease. It follows the disease\u2019s mechanisms through the backbone.'],
  ['xenoex', TL.end, 'Where those mechanisms meet, it proposes new targets, each scored by the evidence behind it.'],
].map(([ch, to, text], i, all) => {
  const from = i ? all[i - 1][1] : 0;
  return { ch, from, to, start: from, text, label: ch ? CHAPTER_LABEL[ch] : 'Systemic backbone', narr: ch ? CHAPTER_LABEL[ch] : 'Systemic backbone' };
});

// ---------- layout (viewBox units) ----------
const L = {
  w: 1000, h: 540,
  bb: { x: 300, y: 92, w: 376, h: 376 }, bbTitle: { x: 488, y: 40 },
  heads: { whole: { x: 24, y: 46 }, models: { x: 24, y: 292 } },
  slots: {
    imaged: { x: 24, y: 66, w: 152, h: 38 }, tracked: { x: 24, y: 118, w: 42, h: 42 }, sequenced: { x: 24, y: 174, w: 58, h: 42 },
    cells: { x: 24, y: 308, w: 42, h: 42 }, organoids: { x: 24, y: 364, w: 42, h: 42 }, chip: { x: 24, y: 420, w: 42, h: 42 },
  },
  present: { cx: 410, cy: 252, maxW: 620, maxH: 330, maxS: 12 },
  out: { x: 714, y: 84, w: 266, h: 392 },
};

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
function txt(parent, x, y, s, cls, attrs = {}) { const n = el('text', Object.assign({ x, y, class: cls }, attrs), parent); n.textContent = s; return n; }
function bez(P, u) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return { x: a * P[0].x + b * P[1].x + c * P[2].x + d * P[3].x, y: a * P[0].y + b * P[1].y + c * P[2].y + d * P[3].y };
}
const pathD = C => `M${C[0].x} ${C[0].y} C${C[1].x} ${C[1].y} ${C[2].x} ${C[2].y} ${C[3].x} ${C[3].y}`;
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
  S = { nodes: [], edges: [], links: [], pulses: [], insets: [], fades: [], branches: [], waves: [], N: new Map() };
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
  const pickTargets = inp => {
    const keep = (inp.keep || []).map(N);
    const best = new Map();
    inp.pool.forEach(id => { const n = N(id), g = id.split('-')[0]; if (!best.has(g) || n.x < best.get(g).x) best.set(g, n); });
    return [...best.values()].sort((a, b) => a.x - b.x).slice(0, inp.n - keep.length).concat(keep);
  };
  INPUTS.forEach((inp, i) => {
    const T = TL.inputs[i];
    const ins = makeInset(inp, T, 'whole');
    const st = inp.step, s = INPUT_STEP;
    pickTargets(inp).forEach((node, j) => {
      S.links.push({ src: inp.id, T, from: ins.port, to: node, t0: T + st.linkAt + j * s.stagger, d: s.link, color: COL.live,
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

  // other models: optional, so drawn quieter than the whole-organism links
  MODELS.forEach((m, i) => {
    const T = TL.models[i];
    const ins = makeInset(m, T, 'model');
    const st = m.step, s = MODEL_STEP;
    const hub = add({ id: m.id + '-hub', kind: 'hub', x: m.hub[0], y: m.hub[1] });
    hub.t0 = T + st.branchAt + s.branch - 80; hub.d = 300;
    S.branches.push({ from: ins.port, hub, t0: T + st.branchAt, d: s.branch });
    const ctx = m.ctx.map((c, j) => {
      const n = add({ id: `${m.id}-c${j}`, kind: 'ctx', x: c[0], y: c[1] });
      n.t0 = T + st.popAt + j * 80; n.d = 300;
      S.edges.push({ a: hub, b: n, w: 1, alpha: .5, color: COL.context, layer: 'context', dash: true, t0: n.t0 - 40, d: 300 });
      S.edges.push({ a: n, b: N(c[2]), w: 1, alpha: .42, color: COL.context, layer: 'context', dash: true,
                     t0: T + st.attachAt + j * s.stagger, d: s.attach });
      S.pulses.push({ node: N(c[2]), t0: T + st.pulseAt + j * s.stagger, d: s.pulse, color: COL.context, alpha: .45 });
      return n;
    });
    if (m.couple) S.edges.push({ a: ctx[0], b: ctx[1], w: 1, alpha: .5, color: COL.context, layer: 'context', dash: true,
                                 t0: T + st.attachAt + 160, d: s.attach });
  });

  buildXeno();
  buildGraphSVG();
}

function buildChrome() {
  const g = layer.chrome;
  // backbone title, on a pill so links can pass under it
  const tg = el('g', {}, g);
  const tw = 196;
  el('rect', { x: L.bbTitle.x - tw / 2, y: L.bbTitle.y - 18, width: tw, height: 42, rx: 8, fill: COL.bg, 'fill-opacity': .82 }, tg);
  txt(tg, L.bbTitle.x, L.bbTitle.y, 'Systemic backbone', 't-head', { 'text-anchor': 'middle', style: 'fill:#fff;fill-opacity:1' });
  txt(tg, L.bbTitle.x, L.bbTitle.y + 18, 'how organs and systems interact', 't-note', { 'text-anchor': 'middle' });
  S.fades.push({ el: tg, t0: 0, d: 500 });

  const hw = txt(g, L.heads.whole.x, L.heads.whole.y, 'Whole organism', 't-head', { style: `fill:${COL.live}` });
  const hm = txt(g, L.heads.models.x, L.heads.models.y, 'Other models · optional', 't-head', { style: `fill:${COL.context};fill-opacity:.75` });
  S.fades.push({ el: hw, t0: TL.inputs[0], d: 300 }, { el: hm, t0: TL.models[0], d: 300 });

  S.backdrop = el('rect', { x: L.bb.x - 24, y: L.bb.y - 24, width: L.bb.w + 48, height: L.bb.h + 48, rx: 14, fill: COL.bg, opacity: 0 }, g);
  S.insetLayer = el('g', {}, g);
  // lights up when XenoEx sends a validation run to the biofoundry
  const sl = L.slots.imaged;
  S.runGlow = el('rect', { x: sl.x - 4, y: sl.y - 4, width: sl.w + 8, height: sl.h + 8, rx: 7, fill: 'none', stroke: COL.flag, 'stroke-width': 1.6, opacity: 0 }, g);
}

function makeInset(def, T, grp) {
  const sl = L.slots[def.id];
  const P = L.present;
  const s = Math.min(grp === 'model' ? 4 : P.maxS, P.maxW / sl.w, P.maxH / sl.h);
  const present = { x: P.cx - sl.w * s / 2, y: P.cy - sl.h * s / 2, s };
  const dock = { x: sl.x, y: sl.y, s: 1 };
  const capPos = { x: sl.x + sl.w + 10, y: sl.y + sl.h / 2 + 5 };
  const cap = txt(layer.chrome, capPos.x, capPos.y, def.caption, 't-label', { opacity: 0 });
  const port = { x: capPos.x + cap.getComputedTextLength() + 8, y: sl.y + sl.h / 2 };
  const g = el('g', { opacity: 0 }, S.insetLayer);
  const heat = drawInset(g, def.kind, sl.w, sl.h, grp);
  const pc = txt(g, sl.w / 2, sl.h + 20 / s, def.title, 't-label t-strong', { 'text-anchor': 'middle', style: `font-size:${15 / s}px` });
  const rec = { g, pc, cap, present, dock, T, port, group: grp, step: def.step, heat, video: g.querySelector('video'), shown: false };
  S.insets.push(rec);
  return rec;
}

function makeVideo(clip) {
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
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
function heatColour(v) {
  return v >= 0 ? mix('#161c4a', COL.live, Math.min(1, v) * .92) : mix('#161c4a', '#4466ee', Math.min(1, -v));
}
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
      r.g.setAttribute('transform', `translate(0,${(H.y0 + r.final * H.rh).toFixed(2)})`);
      r.rects.forEach((rect, c) => { rect.setAttribute('opacity', 1); rect.setAttribute('fill', heatColour(H.z[r.ri][H.cOrder[c]] / 2)); });
    });
    H.dendro.setAttribute('opacity', 1);
    H.state = 'final';
    return;
  }
  H.state = 'live';
  const sortU = prog(ms, 1700, 1700, E.inOut), breathe = prog(ms, 3600, 900), ts = (drive === 'scrub' ? ms : flowT) / 1000;
  H.rows.forEach(r => {
    r.g.setAttribute('transform', `translate(0,${(H.y0 + lerp(r.raw, r.final, sortU) * H.rh).toFixed(2)})`);
    r.rects.forEach((rect, c) => {
      rect.setAttribute('opacity', prog(ms, 350 + c * 80, 380).toFixed(3));
      if (breathe > 0) {
        const v = H.z[r.ri][H.cOrder[c]] + breathe * .28 * Math.sin(ts * 1.9 + r.ri * .9 + c * 1.7);
        rect.setAttribute('fill', heatColour(v / 2));
      }
    });
  });
  H.dendro.setAttribute('opacity', prog(ms, 3000, 700).toFixed(3));
}

function drawInset(g, kind, w, h, grp) {
  const tone = grp === 'model' ? COL.context : COL.line;
  el('rect', { x: 0, y: 0, width: w, height: h, rx: 4, fill: '#151b4a', stroke: tone, 'stroke-opacity': .55, 'stroke-width': 1 }, g);
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

// ---------- XenoEx: the panel, its exchanges with the backbone, the run it sends, the targets it finds ----------
function buildXeno() {
  const O = L.out, X = S.X = {};
  const P = TL.predict, V = TL.validate, D = TL.discover;
  X.port = { x: O.x - 2, y: O.y + 196 };

  const card = X.card = el('g', { opacity: 0 }, layer.output);
  el('rect', { x: O.x, y: O.y, width: O.w, height: O.h, rx: 12, fill: COL.plate, stroke: COL.live, 'stroke-opacity': .32 }, card);
  txt(card, O.x + 16, O.y + 30, 'XenoEx', 't-label t-strong', { style: 'font-size:15px' });
  // two ways to ask: rank candidates, or find targets for a disease
  X.tabs = ['candidates', 'targets'].map(s => txt(card, 0, O.y + 30, s, 't-note', { 'text-anchor': 'end' }));
  const wC = X.tabs[0].getComputedTextLength(), wT = X.tabs[1].getComputedTextLength();
  const xT = O.x + O.w - 16, xC = xT - wT - 14;
  X.tabs[0].setAttribute('x', xC); X.tabs[1].setAttribute('x', xT);
  X.tabPos = [{ x: xC - wC, w: wC }, { x: xT - wT, w: wT }];
  X.tabBar = el('rect', { x: xC - wC, y: O.y + 37, width: wC, height: 2, rx: 1, fill: COL.live }, card);
  X.tabOn = -1;

  el('rect', { x: O.x + 12, y: O.y + 46, width: O.w - 24, height: 28, rx: 6, fill: COL.bg, stroke: COL.line, 'stroke-opacity': .25 }, card);
  txt(card, O.x + 22, O.y + 65, '\u203a', 't-label', { style: `fill:${COL.live}` });
  X.query = txt(card, O.x + 34, O.y + 65, '', 't-label', { style: 'font-size:13px' });
  X.caret = el('rect', { x: O.x + 34, y: O.y + 53, width: 1.5, height: 15, fill: COL.live, opacity: 0 }, card);
  X.queries = [{ at: P + PREDICT.typeAt, d: PREDICT.type, s: 'rank 4 candidates · human risk' },
               { at: D + DISCOVER.typeAt, d: DISCOVER.type, s: `find targets · ${DISEASE}` }];
  X.status = txt(card, O.x + 16, O.y + 98, '', 't-note');
  X.statusIdx = -2;
  X.statuses = [
    [P + PREDICT.outAt, 'querying the backbone\u2026', COL.medium],
    [P + PREDICT.barsAt, '4 profiles scored, organ by organ', COL.medium],
    [P + PREDICT.rankAt, 'ranked, safest first', COL.medium],
    [V, 'ZM-131 · heart: low confidence', COL.flag],
    [V + VALIDATE.reqAt, 'validation run \u2192 biofoundry', COL.flag],
    [V + VALIDATE.backAt, 'result in: above threshold', COL.live],
    [V + VALIDATE.rankAt, 'ranking updated', COL.live],
    [D + DISCOVER.walkAt, 'following mechanisms\u2026', COL.medium],
    [D + DISCOVER.popAt, '3 new target hypotheses', COL.target],
  ];

  // candidates: human risk by organ, ranked
  const cand = X.cand = el('g', {}, card);
  const colX0 = O.x + 92, cw = (O.w - 92 - 12) / 4, bw = X.bw = cw - 10;
  OUT_ORGANS.forEach((o, j) => txt(cand, colX0 + cw * (j + .5), O.y + 126, o, 't-note', { 'text-anchor': 'middle' }));
  const rowTop = O.y + 136, pitch = 54;
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
  const ly = O.y + O.h - 16;
  [[16, COL.result, 'lower risk'], [100, COL.flag, 'higher risk']].forEach(([dx, c, s]) => {
    el('rect', { x: O.x + dx, y: ly - 8, width: 14, height: 6, rx: 3, fill: c }, cand);
    txt(cand, O.x + dx + 20, ly, s, 't-note');
  });
  el('rect', { x: O.x + 188, y: ly - 11, width: 14, height: 12, rx: 3, fill: 'none', stroke: COL.flag, 'stroke-width': 1.2, 'stroke-dasharray': '2 2' }, cand);
  txt(cand, O.x + 208, ly, 'unsure', 't-note');

  // targets: what it proposes when asked about a disease
  const targ = X.targ = el('g', { opacity: 0 }, card);
  txt(targ, O.x + 16, O.y + 126, `new targets · ${DISEASE}`, 't-note');
  X.trows = TARGETS.map((tg, i) => {
    const y = O.y + 160 + i * 56;
    const rg = el('g', { opacity: 0 }, targ);
    el('line', { x1: O.x + 12, y1: y - 22, x2: O.x + O.w - 12, y2: y - 22, stroke: COL.line, 'stroke-opacity': .14 }, rg);
    el('circle', { cx: O.x + 21, cy: y - 5, r: 4.5, fill: COL.target }, rg);
    txt(rg, O.x + 34, y, tg.id, 't-label t-strong');
    txt(rg, O.x + 62, y, tg.where, 't-label');
    const bx = O.x + 34, bwT = O.w - 34 - 52;
    el('rect', { x: bx, y: y + 10, width: bwT, height: 5, rx: 2.5, fill: COL.line, 'fill-opacity': .14 }, rg);
    const b = el('rect', { x: bx, y: y + 10, width: 0, height: 5, rx: 2.5, fill: COL.target }, rg);
    txt(rg, O.x + O.w - 16, y + 16, tg.score.toFixed(2), 't-note', { 'text-anchor': 'end' });
    return { g: rg, b, w: bwT * tg.score, t0: D + DISCOVER.listAt + i * DISCOVER.listStep };
  });
  txt(targ, O.x + 16, ly, 'scored by mechanistic support', 't-note');

  // exchanges: queries go out to nodes (white), evidence comes back (green)
  X.ex = [];
  const exchange = (ids, w) => ids.forEach((id, j) => {
    const n = S.N.get(id);
    const C = [n.p, { x: n.p.x + 150, y: n.p.y }, { x: X.port.x - 120, y: X.port.y }, X.port];
    const path = el('path', { d: pathD(C), fill: 'none', stroke: COL.line, 'stroke-width': 1.1, 'stroke-dasharray': '3 3', opacity: 0 }, layer.xeno);
    const dots = [0, 1].map(() => el('circle', { r: 2.4, opacity: 0 }, layer.xeno));
    const out = w.out == null ? null : w.out + j * 120;
    if (out != null) S.pulses.push({ node: n, t0: out + 700, d: 600, color: COL.light, alpha: .45 });
    X.ex.push({ C, path, dots, on: w.on, out, back: w.back + j * 120, off: w.off });
  });
  exchange(OUT_ORGANS, { on: P + PREDICT.outAt - 300, out: P + PREDICT.outAt, back: P + PREDICT.backAt, off: P + PREDICT.rankAt + 400 });
  exchange(['heart'], { on: V + VALIDATE.backAt - 200, out: null, back: V + VALIDATE.backAt, off: V + VALIDATE.updAt + 600 });
  exchange(DISCOVER_QUERY, { on: D + DISCOVER.walkAt - 300, out: D + DISCOVER.walkAt, back: D + DISCOVER.walkAt + 1300, off: D + DISCOVER.popAt + 800 });

  // validation run: from the flagged row, over the backbone, to the biofoundry (the imaged card)
  const flagged = X.rows.find(r => r.flagged), sl = L.slots.imaged;
  const a = { x: O.x - 2, y: flagged.y1 + pitch / 2 }, b = { x: sl.x + sl.w * .55, y: sl.y - 5 };
  X.req = { C: [a, { x: a.x - 200, y: -26 }, { x: b.x + 60, y: -34 }, b], t0: V + VALIDATE.reqAt, d: VALIDATE.req };
  X.req.path = el('path', { d: pathD(X.req.C), fill: 'none', stroke: COL.flag, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: 0 }, layer.xeno);
  X.req.dot = el('circle', { r: 4, fill: COL.flag, opacity: 0 }, layer.xeno);
  X.req.label = txt(layer.xeno, 0, 0, 'validation run · ZM-131', 't-note', { style: `fill:${COL.flag};fill-opacity:1`, opacity: 0 });
  // the run itself: the imaged card lights up and its heart link carries new data
  const runAt = V + VALIDATE.runAt;
  const hk = S.links.find(k => k.src === 'imaged' && k.to.id === 'heart');
  if (hk) {
    hk.boost = [runAt, runAt + VALIDATE.run];
    hk.flows.push([runAt + 200, runAt + VALIDATE.run - 100]);
    S.pulses.push({ node: hk.to, t0: runAt + 1100, d: 800, color: COL.live });
  }

  // discovery: a walk through the backbone, then new nodes where the mechanisms meet
  X.walk = DISCOVER_WALK.map(([p, q], i) => {
    const A = S.N.get(p), B = S.N.get(q);
    const line = el('line', { x1: A.p.x, y1: A.p.y, x2: A.p.x, y2: A.p.y, stroke: COL.target, 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0 }, layer.xeno);
    return { A, B, line, t0: D + DISCOVER.walkAt + i * DISCOVER.walkStep };
  });
  X.targets = TARGETS.map((tg, i) => {
    const p = S.U(tg.x, tg.y), t0 = D + DISCOVER.popAt + i * DISCOVER.popStep;
    const ends = tg.links.map(id => S.N.get(id).p);
    const edges = ends.map(() => el('line', { x1: p.x, y1: p.y, x2: p.x, y2: p.y, stroke: COL.target, 'stroke-width': 1.1, 'stroke-opacity': .6, opacity: 0 }, layer.xeno));
    const g = el('g', { opacity: 0 }, layer.xeno);
    el('circle', { r: 9, fill: 'none', stroke: COL.target, 'stroke-opacity': .45, 'stroke-width': 1 }, g);
    el('circle', { r: 4.6, fill: COL.target }, g);
    txt(g, 12, 4, tg.id, 't-note', { style: `fill:${COL.target};fill-opacity:1;font-weight:500` });
    S.pulses.push({ node: { p, kind: 'target' }, t0: t0 + 100, d: 800, color: COL.target });
    return { p, g, edges, ends, t0 };
  });
}

function linkCurve(a, b) {
  return [a, { x: lerp(a.x, b.x, .45), y: a.y }, { x: lerp(a.x, b.x, .55), y: b.y }, b];
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
    k.el = el('path', { d: pathD(linkCurve(k.from, k.to.p)), fill: 'none', stroke: k.color, 'stroke-width': k.w, 'stroke-linecap': 'round', opacity: 0 }, layer.links);
    k.len = k.el.getTotalLength();
    k.el.setAttribute('stroke-dasharray', k.len); k.el.setAttribute('stroke-dashoffset', k.len);
    k.dot = el('circle', { r: 2.6, fill: k.color, opacity: 0 }, layer.links);
  });
  S.branches.forEach(b => {
    const h = b.hub.p, f = b.from;
    b.el = el('path', { d: `M${f.x} ${f.y} C${f.x + 90} ${f.y} ${h.x - 80} ${h.y} ${h.x} ${h.y}`, fill: 'none', stroke: COL.context, 'stroke-width': 1.1, 'stroke-opacity': .55 }, layer.context);
    b.len = b.el.getTotalLength();
    b.el.setAttribute('stroke-dasharray', b.len); b.el.setAttribute('stroke-dashoffset', b.len);
  });
  S.pulses.forEach(p => {
    const k = p.node.kind;
    p.r0 = k === 'organ' ? 12 : k === 'func' ? 9 : k === 'target' ? 6 : 5;
    p.el = el('circle', { cx: p.node.p.x, cy: p.node.p.y, r: p.r0, fill: 'none', stroke: p.color, 'stroke-width': p.alpha ? 1.1 : 1.6, opacity: 0 },
              p.color === COL.context ? layer.context : layer.links);
  });
  S.nodes.forEach(n => {
    const parent = n.kind === 'hub' || n.kind === 'ctx' ? layer.context : layer.backbone;
    const g = el('g', { opacity: 0 }, parent);
    if (n.kind === 'organ') {
      el('circle', { r: 11, fill: COL.plate, stroke: COL.line, 'stroke-opacity': .9, 'stroke-width': 1.7 }, g);
      el('circle', { r: 3.2, fill: COL.line, 'fill-opacity': .8 }, g);
      txt(g, 0, 28, n.label, 't-label t-strong', { 'text-anchor': 'middle' });
    } else if (n.kind === 'signal') {
      el('circle', { r: 3.4, fill: COL.medium }, g);
    } else if (n.kind === 'func') {
      el('path', { d: 'M0 -8 L8 0 L0 8 L-8 0 Z', fill: COL.plate, stroke: COL.line, 'stroke-opacity': .9, 'stroke-width': 1.5 }, g);
      txt(g, 0, 25, n.label, 't-note', { 'text-anchor': 'middle' });
    } else if (n.kind === 'hub') {
      el('circle', { r: 4.5, fill: COL.plate, stroke: COL.context, 'stroke-opacity': .7, 'stroke-width': 1.2, 'stroke-dasharray': '2 2' }, g);
    } else {
      el('circle', { r: 3.4, fill: COL.plate, stroke: COL.context, 'stroke-opacity': .75, 'stroke-width': 1.2 }, g);
    }
    n.el = g;
  });
}

// ---------- frames ----------
let visible = false;
let flowT = 0;   // phase of the dots on links: story time when scrubbing, wall time otherwise (so they move at rest)
// motion stopped by the reader: Pause motion, or Pause in the player
const stillNow = () => paused || (drive === 'player' && userPaused);
function frameChrome(t) {
  S.fades.forEach(f => f.el.setAttribute('opacity', prog(t, f.t0, f.d)));
  let dim = 0;
  S.insets.forEach(r => {
    const st = r.step, ua = prog(t, r.T, st.appear), ud = prog(t, r.T + st.dockAt, st.dock, E.inOut);
    const x = lerp(r.present.x, r.dock.x, ud), y = lerp(r.present.y, r.dock.y, ud), s = lerp(r.present.s, r.dock.s, ud);
    r.g.setAttribute('opacity', ua * (r.group === 'model' ? lerp(1, .7, ud) : 1));
    r.g.setAttribute('transform', `translate(${x},${y}) scale(${s})`);
    r.pc.setAttribute('opacity', 1 - ud);
    r.cap.setAttribute('opacity', prog(t, r.T + st.dockAt + 250, 250) * (r.group === 'model' ? .75 : 1));
    dim = Math.max(dim, ua * (1 - ud));
    const live = ua > 0 && ud < 1;
    r.presenting = live;
    if (r.heat) animateHeat(r.heat, t - r.T, live);
    if (r.video) {
      if (live) {
        const ct = clamp((t - r.T) / 1000, 0, (r.video.duration || 10) - .05);
        const rate = drive === 'scrub' || stillNow() ? 0 : clipRate;
        if (rate !== 0) {
          // playing (rate > 0): the clip runs at the story's rate, drift corrected; resting (rate < 0): it just loops
          const pr = rate > 0 ? rate : 1;
          if (r.video.playbackRate !== pr) r.video.playbackRate = pr;
          if (r.video.paused) r.video.play().catch(() => {});
          if (rate > 0 && r.video.readyState >= 1 && Math.abs(r.video.currentTime - ct) > .3) r.video.currentTime = ct;
        } else {
          // scrubbing, rewinding, resting or paused: the clip follows the story time
          if (!r.video.paused) r.video.pause();
          if (r.video.readyState >= 1 && Math.abs(r.video.currentTime - ct) > .034) r.video.currentTime = ct;
        }
      } else if (ua > 0 && r.video.paused && visible && !stillNow()) {
        r.video.playbackRate = 1;
        r.video.play().catch(() => {});
      }
      r.shown = ua > 0;
    }
  });
  S.backdrop.setAttribute('opacity', (.78 * dim).toFixed(3));
  const g0 = TL.validate + VALIDATE.runAt;
  const gv = prog(t, g0 - 200, 300) * (1 - prog(t, g0 + VALIDATE.run, 500));
  S.runGlow.setAttribute('opacity', (gv * (.65 + .35 * Math.sin(t / 140))).toFixed(3));
}

function frameSVG(t) {
  S.nodes.forEach(n => {
    const u = prog(t, n.t0, n.d);
    n.el.setAttribute('opacity', u);
    n.el.setAttribute('transform', `translate(${n.p.x},${n.p.y}) scale(${(.55 + .45 * u).toFixed(3)})`);
  });
  S.edges.forEach(e => {
    const u = prog(t, e.t0, e.d);
    e.el.setAttribute('opacity', u > 0 ? 1 : 0);
    e.el.setAttribute('x2', lerp(e.a.p.x, e.b.p.x, u));
    e.el.setAttribute('y2', lerp(e.a.p.y, e.b.p.y, u));
  });
  S.waves.forEach(w => {
    const u = (t - w.t0) / w.d;
    if (u <= 0 || u >= 1) { w.el.setAttribute('opacity', 0); return; }
    const r = E.out(clamp(u * 2));
    w.el.setAttribute('x2', lerp(w.a.p.x, w.b.p.x, r)); w.el.setAttribute('y2', lerp(w.a.p.y, w.b.p.y, r));
    w.el.setAttribute('opacity', (.8 * (u < .5 ? 1 : (1 - u) * 2)).toFixed(3));
  });
  S.links.forEach(k => {
    const u = prog(t, k.t0, k.d);
    k.el.setAttribute('opacity', u > 0 ? linkAlpha(t, k) : 0);
    k.el.setAttribute('stroke-dashoffset', k.len * (1 - u));
    const f = linkFlow(t, k);
    if (f) {
      const p = k.el.getPointAtLength(f.u * k.len);
      k.dot.setAttribute('cx', p.x); k.dot.setAttribute('cy', p.y); k.dot.setAttribute('opacity', f.a.toFixed(3));
    } else k.dot.setAttribute('opacity', 0);
  });
  S.branches.forEach(b => b.el.setAttribute('stroke-dashoffset', b.len * (1 - prog(t, b.t0, b.d, E.inOut))));
  S.pulses.forEach(p => {
    const u = clamp((t - p.t0) / p.d);
    p.el.setAttribute('opacity', u > 0 && u < 1 ? (1 - u) * (p.alpha || .9) : 0);
    p.el.setAttribute('r', p.r0 + 16 * E.out(u));
  });
}

function frameXeno(t) {
  const X = S.X, P = TL.predict, V = TL.validate, D = TL.discover;
  X.card.setAttribute('opacity', prog(t, P, PREDICT.card));

  // which question: candidates, then targets
  const sw = prog(t, D, DISCOVER.switchD, E.inOut);
  X.cand.setAttribute('opacity', 1 - sw);
  X.targ.setAttribute('opacity', sw);
  X.tabBar.setAttribute('x', lerp(X.tabPos[0].x, X.tabPos[1].x, sw));
  X.tabBar.setAttribute('width', lerp(X.tabPos[0].w, X.tabPos[1].w, sw));
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
  X.caret.setAttribute('x', L.out.x + 34 + (X.qw || 0) + 1);
  X.caret.setAttribute('opacity', typing || (t >= D && t < X.queries[1].at) || (t >= P && t < X.queries[0].at) ? (Math.floor(t / 400) % 2 ? .2 : 1) : 0);

  let si = -1;
  X.statuses.forEach((s, k) => { if (t >= s[0]) si = k; });
  if (si !== X.statusIdx) {
    X.statusIdx = si;
    X.status.textContent = si < 0 ? '' : X.statuses[si][1];
    X.status.style.fill = si < 0 ? '' : X.statuses[si][2];
    X.status.style.fillOpacity = 1;
  }
  X.status.setAttribute('opacity', si < 0 ? 0 : prog(t, X.statuses[si][0], 300));

  // rows: bars grow, rank, then ZM-131 is flagged, validated and moves up
  const u1 = prog(t, P + PREDICT.rankAt, PREDICT.rank, E.inOut), u2 = prog(t, V + VALIDATE.rankAt, VALIDATE.rank, E.inOut);
  const upd = prog(t, V + VALIDATE.updAt, VALIDATE.upd, E.inOut);
  const flagOn = prog(t, V, 400) * (1 - prog(t, V + VALIDATE.updAt + VALIDATE.upd, 500));
  X.rows.forEach(r => {
    r.g.setAttribute('transform', `translate(0,${lerp(lerp(r.y0, r.y1, u1), r.y2, u2).toFixed(2)})`);
    const rk = String(u2 > .5 ? r.r2 : r.r1);
    if (r.rank.textContent !== rk) r.rank.textContent = rk;
    r.rank.setAttribute('opacity', prog(t, P + PREDICT.rankAt + PREDICT.rank - 200, 300));
    r.hl.setAttribute('opacity', r.flagged ? (.12 * flagOn).toFixed(3) : 0);
    r.bars.forEach((b, j) => {
      const grow = prog(t, P + PREDICT.barsAt + r.i * 90 + j * 50, 550);
      const v = b.unsure ? lerp(b.v, b.unsure.to, upd) : b.v;
      b.el.setAttribute('width', (X.bw * v * grow).toFixed(2));
      b.el.setAttribute('fill', v >= .5 ? COL.flag : COL.result);
      if (b.range) {
        const lo = lerp(b.unsure.lo, b.unsure.to, upd), hi = lerp(b.unsure.hi, b.unsure.to, upd);
        b.range.setAttribute('x', (b.x + X.bw * lo).toFixed(2));
        b.range.setAttribute('width', Math.max(0, X.bw * (hi - lo)).toFixed(2));
        b.range.setAttribute('opacity', (prog(t, V, 400) * (1 - prog(t, V + VALIDATE.updAt + VALIDATE.upd - 200, 300))).toFixed(3));
      }
    });
  });
  X.trows.forEach(r => { r.g.setAttribute('opacity', prog(t, r.t0, 400)); r.b.setAttribute('width', (r.w * prog(t, r.t0 + 150, 600)).toFixed(2)); });

  // exchanges with the backbone
  X.ex.forEach(x => {
    x.path.setAttribute('opacity', (.75 * prog(t, x.on, 300) * (1 - prog(t, x.off, 500))).toFixed(3));
    x.dots.forEach((d, k) => {
      let s = -1, out = false;
      if (x.out != null) { const so = (t - x.out - k * 260) / 700; if (so > 0 && so < 1) { s = so; out = true; } }
      const sb = (t - x.back - k * 260) / 700;
      if (sb > 0 && sb < 1) { s = sb; out = false; }
      if (s < 0) { d.setAttribute('opacity', 0); return; }
      const p = bez(x.C, out ? 1 - s : s);
      d.setAttribute('cx', p.x.toFixed(1)); d.setAttribute('cy', p.y.toFixed(1));
      d.setAttribute('fill', out ? COL.light : COL.result);
      d.setAttribute('opacity', (Math.sin(Math.PI * s) * .95).toFixed(3));
    });
  });

  // the validation run on its way to the biofoundry
  const R = X.req, us = clamp((t - R.t0) / R.d);
  R.path.setAttribute('opacity', (.7 * prog(t, R.t0, 300) * (1 - prog(t, V + VALIDATE.updAt, 600))).toFixed(3));
  if (us > 0 && us < 1) {
    const p = bez(R.C, E.inOut(us));
    R.dot.setAttribute('cx', p.x.toFixed(1)); R.dot.setAttribute('cy', p.y.toFixed(1)); R.dot.setAttribute('opacity', 1);
    R.label.setAttribute('x', (p.x + 9).toFixed(1)); R.label.setAttribute('y', (p.y + 16).toFixed(1));
    R.label.setAttribute('opacity', Math.min(1, Math.sin(Math.PI * us) * 2).toFixed(3));
  } else { R.dot.setAttribute('opacity', 0); R.label.setAttribute('opacity', 0); }

  // discovery
  X.walk.forEach(w => {
    const u = prog(t, w.t0, 450);
    w.line.setAttribute('x2', lerp(w.A.p.x, w.B.p.x, u).toFixed(1)); w.line.setAttribute('y2', lerp(w.A.p.y, w.B.p.y, u).toFixed(1));
    w.line.setAttribute('opacity', u > 0 ? lerp(.9, .3, prog(t, w.t0 + 900, 700)).toFixed(3) : 0);
  });
  X.targets.forEach(tg => {
    const u = prog(t, tg.t0, 500);
    tg.g.setAttribute('opacity', u.toFixed(3));
    tg.g.setAttribute('transform', `translate(${tg.p.x},${tg.p.y}) scale(${(.4 + .6 * u).toFixed(3)})`);
    const ue = prog(t, tg.t0 + 200, 500);
    tg.edges.forEach((e, k) => {
      e.setAttribute('x2', lerp(tg.p.x, tg.ends[k].x, ue).toFixed(1)); e.setAttribute('y2', lerp(tg.p.y, tg.ends[k].y, ue).toFixed(1));
      e.setAttribute('opacity', ue > 0 ? 1 : 0);
    });
  });
}

// a gentle zoom toward where the new thing happens, back to the whole picture between and at the end
function camRect(t) {
  const F = { x: 0, y: 0, w: L.w, h: L.h };
  const w = L.w * .82, h = L.h * .82;
  const IN = { x: 0, y: 22, w, h }, MOD = { x: 0, y: L.h - h - 8, w, h };
  const OUT = { x: L.w * .14, y: 16, w: L.w * .86, h: L.h * .86 };   // XenoEx: the panel and the backbone, title included
  const V = TL.validate, D = TL.discover;
  const keys = [[0, F], [TL.inputs[0] - 300, F], [TL.inputs[0] + 400, IN], [TL.prop - 300, IN], [TL.prop + 400, F],
                [TL.models[0] - 300, F], [TL.models[0] + 300, MOD], [TL.predict - 300, MOD], [TL.predict + 400, OUT],
                [V + VALIDATE.reqAt - 300, OUT], [V + VALIDATE.reqAt + 400, F], [D - 200, F], [D + 500, OUT],
                [TL.end - 2200, OUT], [TL.end - 800, F], [TL.end, F]];
  let i = 1;
  while (i < keys.length - 1 && t > keys[i][0]) i++;
  const [ta, A] = keys[i - 1], [tb, B] = keys[i], u = E.inOut(clamp((t - ta) / (tb - ta || 1)));
  return { x: lerp(A.x, B.x, u), y: lerp(A.y, B.y, u), w: lerp(A.w, B.w, u), h: lerp(A.h, B.h, u) };
}

// ---------- what drives the clock ----------
// 'read' (default): short paragraphs scroll in the text column; each plays its part when it reaches the
// reading line. 'player' (?drive=player): plays like a film when in view, with chapters and previous/next.
// 'states', 'steps' and 'scrub' are the earlier scroll-driven tests.
const DRIVE_PARAM = new URLSearchParams(window.location.search).get('drive');
const drive = ['player', 'states', 'steps', 'scrub'].includes(DRIVE_PARAM) ? DRIVE_PARAM : 'read';
const STOPS = drive === 'states' ? STATES : drive === 'read' ? READ : BEATS;   // what the story steps through
let clockSpeed = 0, clipRate = 0, paused = false, hold = false;

let narrIdx = -1;
// the step or state on screen at time t: the last one that has started
function stopAt(t) { let i = 0; STOPS.forEach((b, k) => { if (t >= b.start) i = k; }); return i; }
function narrate(t) {
  const i = stopAt(t);
  if (i === narrIdx) return;
  narrIdx = i;
  nStep.textContent = STOPS[i].narr;
  nText.textContent = STOPS[i].text;
  narr.classList.remove('is-fresh'); void narr.offsetWidth; narr.classList.add('is-fresh');
}

let lastVB = '';
function render(t) {
  flowT = drive === 'scrub' ? t : performance.now();
  const vb = camRect(t), vbs = `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`;
  if (vbs !== lastVB) { LAYERS.forEach(n => layer[n].setAttribute('viewBox', vbs)); lastVB = vbs; }
  frameChrome(t); frameSVG(t); frameXeno(t); narrate(t);
}

// ---------- chapters (both modes) ----------
let on = false, activeIdx = -1;
CHAPTERS.forEach(c => {
  c.el = group.querySelector(`[data-select-panel="${c.key}"]`);
  c.btn = group.querySelector(`[data-select="${c.key}"]`);
});
const docY = n => n.getBoundingClientRect().top + window.scrollY;
const pinTop = () => parseFloat(group.style.getPropertyValue('--pf-top')) || 0;
function setActiveChapter(active) {
  if (active === activeIdx) return;
  activeIdx = active;
  CHAPTERS.forEach((c, i) => {
    c.el.classList.toggle('is-active', i === active);
    if (c.btn) { c.btn.classList.toggle('is-active', i === active); c.btn.setAttribute('aria-pressed', String(i === active)); }
  });
}
function layoutScroll() {
  const header = document.getElementById('site-header');
  group.style.setProperty('--pf-top', `${(header ? header.offsetHeight : 72) + bar.offsetHeight}px`);
  if (drive === 'scrub') layoutScrub(); else if (drive === 'read') layoutRead(); else if (drive !== 'player') layoutSteps();
}

// ---------- scrub: the scroll position is the time ----------
// Each chapter is as tall as its steps need: scroll per step grows with its length, compressed.
const UNIT_VH = 24;
const weight = (a, b) => Math.pow((b - a) / 1000, .8);
let map = [], chapterY = [];
function layoutScrub() {
  const vh = window.innerHeight, top = pinTop();
  const unit = vh * UNIT_VH / 100;
  const ws = CHAPTERS.map(c => c.bounds.slice(1).map((b, k) => weight(c.bounds[k], b)));
  const spans = ws.map(w => w.reduce((a, b) => a + b, 0) * unit);
  // the last chapter also holds the final frame while its text scrolls away
  CHAPTERS.forEach((c, i) => c.el.style.setProperty('--h', `${Math.round(spans[i] + (i === CHAPTERS.length - 1 ? vh - top : 0))}px`));
  const s0 = docY(story);
  map = [[s0 - vh * .5, s0 - top, 0, TL.inputs[0]]];   // the backbone builds as the figure comes up
  chapterY = CHAPTERS.map((c, i) => {
    const y0 = docY(c.el) - top, W = ws[i].reduce((a, b) => a + b, 0);
    let y = y0;
    ws[i].forEach((w, k) => { const dy = spans[i] * w / W; map.push([y, y + dy, c.bounds[k], c.bounds[k + 1]]); y += dy; });
    return [y0, y];
  });
}
function timeAt(y) {
  if (y <= map[0][0]) return 0;
  for (const [y0, y1, t0, t1] of map) if (y <= y1) return y < y0 ? t0 : lerp(t0, t1, (y - y0) / (y1 - y0));
  return TL.end;
}
function yAt(t) {
  for (const [y0, y1, t0, t1] of map) if (t <= t1) return lerp(y0, y1, clamp((t - t0) / (t1 - t0)));
  return map[map.length - 1][1];
}
function chaptersScrub(y) {
  let active = 0;
  chapterY.forEach(([y0, y1], i) => {
    if (CHAPTERS[i].btn) CHAPTERS[i].btn.style.setProperty('--p', clamp((y - y0) / (y1 - y0)).toFixed(3));
    if (y >= y0 - 2) active = i;
  });
  setActiveChapter(active);
}
let tNow = 0, target = 0, following = false;
function follow() {
  const d = target - tNow;
  tNow = Math.abs(d) < 4 ? target : tNow + d * .16;
  render(tNow);
  if (tNow !== target) requestAnimationFrame(follow); else following = false;
}

// ---------- steps and states: the scroll picks where the story goes, the story plays in time ----------
// Each step or state is a stretch of scroll. What is shown (figure, step line, chapter text, bar) follows
// the playback, so it always agrees; the scroll only says where the story should go.
const stepIdx = c => STOPS.map((b, i) => [b, i]).filter(([b]) => b.ch === c.key || (c === CHAPTERS[0] && !b.ch)).map(([, i]) => i);
let stepY = [], beatIdx = -1, clockT = 0, raf = 0, lastNow = 0, walking = false;
function layoutSteps() {
  const vh = window.innerHeight, top = pinTop();
  // steps: about a screen each, more for longer ones; states: a little less, more for longer intros;
  // then a stretch holding the end
  const hs = STOPS.map(s => {
    const sec = (s.to - s.from) / 1000;
    return vh * (drive === 'states' ? clamp(.5 + .03 * sec, .5, .85) : Math.min(1.05, .55 + .035 * sec));
  });
  story.style.setProperty('--story-h', `${Math.round(hs.reduce((a, h) => a + h, 0) + vh * .8 + vh - top)}px`);
  let y = docY(story) - top - vh * .2;   // the backbone starts just before the figure is pinned
  stepY = hs.map(h => { const s = [y, y + h]; y += h; return s; });
  chapterY = CHAPTERS.map(c => { const ids = stepIdx(c); return [stepY[ids[0]][0], stepY[ids[ids.length - 1]][1]]; });
}
// chapter text and bar: the chapter that is playing is shown; the bar fills solid with what has played
// and faintly with where the reader has scrolled to
function chaptersSteps() {
  const y = window.scrollY;
  setActiveChapter(Math.max(0, CHAPTERS.findIndex(c => c.key === STOPS[stopAt(clockT)].ch)));
  CHAPTERS.forEach((c, i) => {
    if (!c.btn) return;
    const ids = stepIdx(c), t0 = STOPS[ids[0]].from, t1 = STOPS[ids[ids.length - 1]].to;
    c.btn.style.setProperty('--p', clamp((clockT - t0) / (t1 - t0)).toFixed(3));
    if (drive !== 'player') c.btn.style.setProperty('--s', clamp((y - chapterY[i][0]) / (chapterY[i][1] - chapterY[i][0])).toFixed(3));
  });
}
function beatAtScroll(y) {
  let b = -1;
  stepY.forEach(([s], i) => { if (y >= s) b = i; });
  return b;
}
// steps: the step that is playing is the first whose resting point is still ahead
function playingIdx(t) { let i = 0; while (i < BEATS.length - 1 && t > BEATS[i].rest) i++; return i; }
// where the page should be while the walkthrough plays time t
function yForClock(t) {
  const i = stopAt(t), next = i + 1 < STOPS.length ? STOPS[i + 1].start : TL.end;
  const u = clamp((t - STOPS[i].start) / Math.max(1, next - STOPS[i].start));
  return stepY[i][0] + 2 + u * (stepY[i][1] - stepY[i][0] - 4);
}
const restOf = b => (b < 0 ? 0 : STOPS[b].to);

// steps: play to the step's rest; steps scrolled past play faster (2x one behind, up to 4x); back rewinds
function stepsClock(dt) {
  const rest = restOf(beatIdx);
  if (clockT < rest) {
    const lag = beatIdx - playingIdx(clockT);
    clockSpeed = lag <= 0 ? 1 : Math.min(4, lag + 1);
    clockT = Math.min(rest, clockT + dt * clockSpeed);
  } else if (clockT > rest) {
    if (clockT - rest > 6000) clockT = rest + 1500;
    clockSpeed = -6;
    clockT = Math.max(rest, clockT + dt * clockSpeed);
  } else clockSpeed = 0;
  clipRate = clockSpeed > 0 ? clockSpeed : 0;
}

// states: 'intro' plays the state in time, 'rest' holds it (things keep looping), 'finish' completes an
// intro quickly when the reader has moved on, 'tween' is the short transition to the state they are at
let sMode = 'rest', ci = -1, tw = null;
function tweenTo(i, now) {
  const forward = i > ci;
  const to = i < 0 ? 0 : forward ? STOPS[i].from : STOPS[i].to;
  const gap = Math.abs(to - clockT);
  const D = gap <= 1500 ? gap : Math.min(2200, 1500 + Math.sqrt(gap - 1500) * 6);   // never much over 2 s
  tw = { i, from: clockT, to, start: now, D: Math.max(1, D), forward };
  sMode = 'tween';
}
function statesClock(now, dt) {
  const want = beatIdx;
  if (sMode === 'tween') { if (tw.i !== want) tweenTo(want, now); }
  else if (want !== ci) {
    if (want > ci && ci >= 0 && (sMode === 'intro' || sMode === 'finish')) sMode = 'finish';
    else tweenTo(want, now);
  } else if (sMode === 'finish') sMode = 'intro';
  if (sMode === 'finish') {
    clockT = Math.min(STOPS[ci].to, clockT + dt * 4); clockSpeed = clipRate = 4;
    if (clockT >= STOPS[ci].to) tweenTo(want, now);
  }
  if (sMode === 'tween') {
    const u = clamp((now - tw.start) / tw.D);
    clockT = lerp(tw.from, tw.to, E.inOut(u)); clockSpeed = 2; clipRate = 0;
    if (u >= 1) { ci = tw.i; sMode = tw.forward && ci >= 0 ? 'intro' : 'rest'; }
  } else if (sMode === 'intro') {
    clockT = Math.min(STOPS[ci].to, clockT + dt); clockSpeed = clipRate = 1;
    if (clockT >= STOPS[ci].to) sMode = 'rest';
  }
  if (sMode === 'rest') { clockSpeed = 0; clipRate = -1; }
}

// ---------- reading: the text scrolls; each paragraph plays its part when it reaches the reading line ----------
// Read at a normal pace, the text keeps up with the animation by itself. If the reader moves on while a part
// is still playing, the rest of it plays a little faster (1.5x); a jump further, or back, is a quick fade
// straight to where the reader is. Nothing is fast-forwarded.
const LINE = .55;
let readEls = [], readCur = -1, fade = null;
function makeReadSteps() {
  if (readEls.length) return;
  const rows = story.querySelector('.rows');
  readEls = READ.map(s => {
    const d = document.createElement('div');
    d.className = 'pf-read-step';
    const p = document.createElement('p'); p.textContent = s.text; d.appendChild(p);
    if (s.ch) CHAPTERS.find(c => c.key === s.ch).el.appendChild(d); else rows.insertBefore(d, rows.firstChild);
    return d;
  });
}
function layoutRead() {
  const line = window.innerHeight * LINE, tops = readEls.map(e => docY(e) - line);
  stepY = tops.map((y, i) => [y, i + 1 < tops.length ? tops[i + 1] : y + window.innerHeight * .5]);
  chapterY = CHAPTERS.map(c => { const ids = stepIdx(c); return [stepY[ids[0]][0], stepY[ids[ids.length - 1]][1]]; });
}
function markRead(i) {
  if (i === readCur) return;
  readCur = i;
  readEls.forEach((e, k) => e.classList.toggle('is-current', k === i));
}
// a quick fade through the background to another moment (jumps, previous/next, chapters)
function cutTo(t, i, now) { fade = { t, i, start: now, out: true }; }
function stepFade(now) {
  const u = clamp((now - fade.start) / 160);
  clockSpeed = clipRate = 0;
  if (fade.out) {
    stage.style.opacity = (1 - u).toFixed(3);
    if (u >= 1) { clockT = fade.t; ci = fade.i; fade.out = false; fade.start = now; }
  } else {
    stage.style.opacity = u.toFixed(3);
    if (u >= 1) { stage.style.opacity = ''; fade = null; }
  }
}
function readClock(now, dt) {
  const want = beatIdx;
  if (want < 0) { if (ci >= 0) cutTo(0, -1, now); clockSpeed = clipRate = 0; return; }   // above the story
  if (ci < 0) { if (want === 0) ci = 0; else { cutTo(STOPS[want].from, want, now); return; } }
  if (want === ci || (want === ci + 1 && clockT < STOPS[ci].to)) {
    // play this part at its pace; if the reader is already on the next one, a little faster
    const speed = want === ci ? 1 : 1.5;
    if (clockT < STOPS[ci].to) { clockT = Math.min(STOPS[ci].to, clockT + dt * speed); clockSpeed = clipRate = speed; }
    else { clockSpeed = 0; clipRate = -1; }
  } else if (want === ci + 1) ci = want;   // this part is done: the next one starts from here
  else cutTo(want < 0 ? 0 : want > ci ? STOPS[want].from : STOPS[want].to, want, now);
}

// ---------- player: plays like a film when in view; the page scrolls normally ----------
let userPaused = false, ended = false, inView = false;
const playBtn = group.querySelector('[data-pf-play]');
function updatePlay() { playBtn.textContent = ended ? 'Replay' : userPaused ? 'Play' : 'Pause'; }
function playerClock(dt) {
  if (inView && !userPaused && !ended) {
    clockT = Math.min(TL.end, clockT + dt); clockSpeed = clipRate = 1;
    if (clockT >= TL.end) { ended = true; updatePlay(); }
  } else { clockSpeed = 0; clipRate = 0; }
}
function playerJump(i) {
  ended = false; updatePlay();
  cutTo(STOPS[i].start, i, performance.now());
  startTick();
}
playBtn.addEventListener('click', () => {
  if (ended) { userPaused = false; playerJump(0); return; }
  userPaused = !userPaused; updatePlay(); startTick();
});
group.querySelector('[data-pf-prev]').addEventListener('click', () => {
  const i = stopAt(clockT);
  playerJump(clockT - STOPS[i].start > 1500 || i === 0 ? i : i - 1);   // to this step's start, or the one before
});
group.querySelector('[data-pf-next]').addEventListener('click', () => playerJump(Math.min(STOPS.length - 1, stopAt(clockT) + 1)));
// plays while most of the figure is on screen
new IntersectionObserver(entries => { inView = entries[0].intersectionRatio >= .6; startTick(); }, { threshold: [0, .6, 1] }).observe(stage);

function tick(now) {
  raf = 0;
  if (!on || drive === 'scrub' || !visible) return;
  const dt = Math.min(64, now - lastNow); lastNow = now;
  if (fade) stepFade(now);
  else if (hold) { /* held for review */ }
  else if (drive === 'player') playerClock(dt);
  else if (walking) {
    clockSpeed = clipRate = 1;
    clockT = Math.min(TL.end, clockT + dt);
    window.scrollTo({ top: yForClock(clockT), behavior: 'instant' });
    if (clockT >= TL.end) setWalking(false);
  } else if (paused) { clockT = restOf(beatIdx); clockSpeed = clipRate = 0; ci = beatIdx; sMode = 'rest'; }
  else if (drive === 'states') statesClock(now, dt);
  else if (drive === 'read') readClock(now, dt);
  else stepsClock(dt);
  render(clockT);
  chaptersSteps();
  // resting a while with more to come: remind the reader the story goes on
  const settled = drive === 'states' ? sMode === 'rest' && ci === beatIdx
    : drive === 'read' ? !fade && ci === beatIdx && clockT >= restOf(ci) : clockSpeed === 0;
  const resting = drive !== 'player' && settled && !walking && !paused && !hold && beatIdx >= 0 && beatIdx < STOPS.length - 1;
  if (!resting) atRestSince = 0; else if (!atRestSince) atRestSince = now;
  showHint(resting && now - Math.max(atRestSince, lastScrollAt) > HINT_AFTER);
  raf = requestAnimationFrame(tick);
}
function startTick() {
  if (raf || !on || drive === 'scrub' || !visible) return;
  lastNow = performance.now();
  raf = requestAnimationFrame(tick);
}

// the hint: shown after HINT_AFTER ms at rest without scrolling, gone as soon as the reader scrolls
const HINT_AFTER = 4000;
const hint = group.querySelector('[data-pf-hint]');
let lastScrollAt = 0, atRestSince = 0, hintOn = false;
function showHint(s) {
  if (s === hintOn) return;
  hintOn = s;
  hint.classList.toggle('is-shown', s);
}

// motion that plays by itself needs a way to stop it
const pauseBtn = group.querySelector('[data-pf-pause]');
function setPaused(p) {
  paused = p;
  if (p) setWalking(false);
  pauseBtn.setAttribute('aria-pressed', String(p));
  pauseBtn.textContent = p ? 'Resume motion' : 'Pause motion';
  if (p && S) S.insets.forEach(r => r.video && r.video.pause());
}
pauseBtn.addEventListener('click', () => setPaused(!paused));

// the walkthrough: the story plays at its own pace and the page follows; any scroll by the reader stops it.
// The button plays it from the start, the hint from where the reader is.
const walkBtn = group.querySelector('[data-pf-walk]');
function setWalking(w, fromStart = true) {
  if (w === walking) return;
  walking = w;
  walkBtn.setAttribute('aria-pressed', String(w));
  walkBtn.textContent = w ? 'Stop the walkthrough' : 'Play the walkthrough';
  if (w) {
    if (paused) setPaused(false);
    hold = false;
    if (fromStart || beatIdx < 0) clockT = 0;
    showHint(false);
    window.scrollTo({ top: yForClock(clockT), behavior: 'instant' });
    startTick();
  } else if (drive === 'states' || drive === 'read') {
    // carry on from where the walkthrough stopped
    ci = stopAt(clockT);
    sMode = clockT < STOPS[ci].to ? 'intro' : 'rest';
  }
}
walkBtn.addEventListener('click', () => setWalking(!walking));
group.querySelector('[data-pf-hint-play]').addEventListener('click', () => setWalking(true, false));
const SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];
['wheel', 'touchstart', 'keydown', 'mousedown'].forEach(type => window.addEventListener(type, e => {
  if (!walking || walkBtn.contains(e.target)) return;
  if (type === 'keydown' && !SCROLL_KEYS.includes(e.key)) return;
  setWalking(false);
}, { passive: true }));
group.querySelectorAll('[data-pf-drive] a').forEach(a => {
  if (a.dataset.drive === drive) a.setAttribute('aria-current', 'true');
});

// ---------- both ----------
function onScroll() {
  if (!on || drive === 'player') return;
  if (drive === 'scrub') {
    chaptersScrub(window.scrollY);
    target = timeAt(window.scrollY);
    if (!following) { following = true; requestAnimationFrame(follow); }
  } else {
    beatIdx = beatAtScroll(window.scrollY);
    if (drive === 'read') markRead(beatIdx);
    if (!walking) { lastScrollAt = performance.now(); showHint(false); }
    startTick();
  }
}
window.addEventListener('scroll', onScroll, { passive: true });
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (on) { layoutScroll(); onScroll(); } }, 150);
});

// the Run / Translate / Reason buttons jump to their chapter (in steps, the chapter then plays from its start)
CHAPTERS.forEach((c, i) => c.btn && c.btn.addEventListener('click', () => {
  if (!on) return;
  setWalking(false);
  if (drive === 'scrub') { window.scrollTo({ top: chapterY[i][0] + 2, behavior: 'smooth' }); return; }
  const first = stepIdx(c)[0];
  hold = false;
  if (drive === 'player') { playerJump(first); return; }
  if (drive === 'read') {
    window.scrollTo({ top: stepY[first][0] + 2, behavior: 'instant' });
    beatIdx = first; markRead(first);
    cutTo(STOPS[first].from, first, performance.now());
    startTick();
    return;
  }
  clockT = STOPS[first].from;
  ci = first; sMode = 'intro';
  window.scrollTo({ top: stepY[first][0] + 2, behavior: 'instant' });
  beatIdx = first;
  startTick();
}));

// clips play only while the story is on screen (browsers may also pause muted video; restart it)
new IntersectionObserver(entries => {
  visible = entries[0].isIntersecting;
  if (!visible && S) S.insets.forEach(r => r.video && r.video.pause());
  if (visible) startTick();
}).observe(story);
setInterval(() => {
  if (!on || !S || !visible || stillNow()) return;
  S.insets.forEach(r => { if (r.video && r.shown && r.video.paused && !r.presenting) r.video.play().catch(() => {}); });
}, 700);

function setOn(want) {
  if (want === on) return;
  on = want;
  group.classList.toggle('is-scrolly', on);
  group.classList.toggle('pf-steps', on && (drive === 'steps' || drive === 'states'));
  group.classList.toggle('pf-read', on && drive === 'read');
  group.classList.toggle('pf-player', on && drive === 'player');
  group.classList.toggle('pf-scrub', on && drive === 'scrub');
  sticky.hidden = !on;
  if (on) {
    if (!S) build();
    if (drive === 'read') makeReadSteps();
    activeIdx = -1;
    layoutScroll();
    if (drive === 'scrub') {
      tNow = target = timeAt(window.scrollY);
      chaptersScrub(window.scrollY);
      render(tNow);
    } else if (drive === 'player') {
      clockT = 0; ci = 0; ended = false; updatePlay();
      render(0);
      chaptersSteps();
      startTick();
    } else {
      // arriving mid-page (reload, link): show where that step rests, no catching up
      beatIdx = beatAtScroll(window.scrollY);
      clockT = restOf(beatIdx);
      ci = beatIdx; sMode = 'rest';
      if (drive === 'read') markRead(beatIdx);
      render(clockT);
      chaptersSteps();
      startTick();
    }
  } else {
    setWalking(false);
    stage.style.opacity = '';
    story.style.removeProperty('--story-h');
    CHAPTERS.forEach(c => { c.el.style.removeProperty('--h'); if (c.btn) { c.btn.style.removeProperty('--p'); c.btn.style.removeProperty('--s'); } });
    if (S) S.insets.forEach(r => r.video && r.video.pause());
  }
}
const evaluate = () => setOn(wideQ.matches && !reduceQ.matches);
wideQ.addEventListener('change', evaluate);
reduceQ.addEventListener('change', evaluate);
// content above the story (images, fonts) can move it: measure again when the page changes height
let lastDocH = 0;
new ResizeObserver(() => {
  const h = document.documentElement.scrollHeight;
  if (!on || h === lastDocH) return;
  lastDocH = h;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { layoutScroll(); onScroll(); }, 100);
}).observe(document.body);

// after main.js has set up the bar (its DOMContentLoaded listener runs first) and the fonts are in
const domReady = document.readyState === 'loading'
  ? new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true })) : Promise.resolve();
Promise.all([domReady, document.fonts.ready]).then(() => {
  evaluate();
  const params = new URLSearchParams(window.location.search);
  // ?pf-debug: where each step or state starts on the page, and what the clock is doing (for tests)
  if (params.has('pf-debug')) window.pfDebug = () => ({ starts: stepY.map(s => Math.round(s[0])), mode: sMode, ci, t: Math.round(clockT) });
  // ?walkthrough (e.g. in a link sent to someone) starts the walkthrough as soon as the page is ready
  if (on && drive !== 'scrub' && drive !== 'player' && params.has('walkthrough') && !params.has('pf-t')) { setWalking(true); return; }
  // ?pf-t=<ms> opens the page at that moment of the story and holds it there (for review)
  const at = params.get('pf-t');
  if (!on || at === null) return;
  const t = +at;
  if (drive === 'scrub') {
    window.scrollTo({ top: yAt(t), behavior: 'instant' });
    tNow = target = t;
    chaptersScrub(window.scrollY);
  } else if (drive === 'player') {
    window.scrollTo({ top: docY(story) - pinTop() - 16, behavior: 'instant' });
    hold = true; clockT = t; chaptersSteps();
  } else {
    const k = stopAt(t);
    window.scrollTo({ top: stepY[k][0] + 4, behavior: 'instant' });
    hold = true; clockT = t;
    beatIdx = ci = k; chaptersSteps();
    if (drive === 'read') markRead(k);
  }
  render(t);
});
})();
