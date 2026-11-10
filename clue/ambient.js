// Clue Quest: the living sky over the painted map. Everything is drawn straight onto the world canvas in whole canvas
// pixels with no smoothing, so it keeps the map's pixel-art grain.
//
// A wind blows all the time and gusts now and then: clouds, snow, rain, leaves, chimney smoke, balloons and birds all
// lean with it, wind streaks whoosh past and snow puffs fall off the big pines. Showers come and go (rain clouds gather,
// rain slants in the wind, the snow thickens in the forest, a rainbow after), flocks of geese and little birds flap
// across, an eagle circles the peaks, the low sun throws rays, light shafts fall under the cloud sea, lanterns flicker,
// the lake glints, snow blows off the summits, mist rolls over the cloud sea, the aurora shimmers, stars twinkle and
// shoot, a sleigh and a plane pass by.
//
// Positions are world units (320 wide, see world.js). Sizes are canvas pixels: there are 1 or 2 of them per world unit
// and always about 2 CSS px on screen, so a bird or a raindrop looks the same size on a phone and on the class board.

const W = 320;
const R = Math.random;
const rnd = (a, b) => a + R() * (b - a);
const pick = (a) => a[(R() * a.length) | 0];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
const step = (a, n = 4) => Math.round(a * n) / n;   // stepped alpha: the pixel-art way to fade
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }

// ---------- painted-map landmarks (world units) ----------
const SUN = { x: 82, y: 2177 };                       // the low sun glowing through the clouds over the far mountains
const HORIZON = 2186;                                 // the far mountain ridge
const CHIMNEY = { x: 134.5, y: 2287 };                // the little cabin by the lake
const LANTERNS = [[67, 2306, 1.2], [186, 2302, .7], [268, 2312, 1]];
const WINDOW = { x: 140, y: 2297 };
const TREE_STAR = { x: 230.5, y: 2273.5 };
const LAKE = { x0: 80, x1: 266, y0: 2318, y1: 2338 };
const PINES = [[2, 34, 2232, 2330], [254, 318, 2240, 2330]];   // the two big snowy pines framing the clearing: x0, x1, y0, y1
const SUMMITS = [[231, 1660], [63, 1678], [140, 1700], [291, 1716], [15, 1720], [250, 1727], [166, 1750]];
const MOON = { x: 270, y: 98, r: 28 };
const SLEIGH_Y = 655, PLANE_Y = 1012;
const RAINBOW = { x: 300, y: 2192, r: 128 };

// ---------- palettes ----------
const CLOUD_PAL = {   // rim, lit, body, shade, deep: sampled from the painted clouds at each height
  sunset: ['#fde6f0', '#efb3d6', '#d6a5ea', '#bba2f1', '#a69aef'],
  day: ['#f6e6f4', '#dcc0ec', '#b9a2f2', '#9c94ee', '#8b85ec'],
  sea: ['#f8e8f3', '#e2c3ea', '#b8a0f2', '#8e88ee', '#7174dd'],
  night: ['#9aa2ee', '#7680e0', '#5f6ad6', '#4e5cca', '#4252c0'],
  storm: ['#bdb6dc', '#9890c4', '#7a73ac', '#625d94', '#4f4b7e'],
};
const LEAF_COLS = [['#f39a3e', '#c8602a'], ['#ec5a4c', '#a83a3c'], ['#f6cd4c', '#c8962a'], ['#c47a3e', '#86502c']];
const BAL_COLS = [['#ff5a6a', '#ffd24a'], ['#4a8aff', '#ffffff'], ['#3ac85a', '#ffe27a'], ['#a86aff', '#ff8ad8'], ['#ff9a3a', '#ffffff']];
const INK = '#2a2350';

// ---------- small pixel helpers ----------
const diskCache = new Map();
function disk(r, col) {   // a crisp pixel circle of radius r (canvas px)
  r = Math.max(1, Math.round(r)); const key = r + col; if (diskCache.has(key)) return diskCache.get(key);
  const d = r * 2 + 1, c = canvas(d, d), g = c.getContext('2d'); g.fillStyle = col;
  for (let y = -r; y <= r; y++) { const hw = Math.floor(Math.sqrt(r * r - y * y + r * .8)); g.fillRect(r - hw, y + r, hw * 2 + 1, 1); }
  diskCache.set(key, c); return c;
}
function line(g, x0, y0, x1, y1) {   // Bresenham, 1 px
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
  for (;;) { g.fillRect(x0, y0, 1, 1); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
}
function flipX(c) { const f = canvas(c.width, c.height), g = f.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(c, 0, 0); return f; }
function fromRows(rows, pal) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length)), c = canvas(w, h), g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}

// ---------- clouds: a row of round puffs (small ones low in front), each lit from the upper left, flat underneath ----------
function cloudSprite(seed, wpx, pal, kind) {
  const r = rng(seed), flat = kind === 'wisp';
  const h = Math.max(5, Math.round(wpx * (flat ? .22 : kind === 'storm' ? .5 : .46))), base = h - 1, circ = [];
  const n = flat ? 3 + ((r() * 3) | 0) : 4 + ((r() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const f = (i + .5) / n, big = Math.sin(f * Math.PI);
    const rad = wpx * (flat ? .07 + .05 * r() : .085 + .15 * big * (.7 + .6 * r()));
    circ.push({ cx: wpx * (.11 + .78 * f) + (r() - .5) * wpx * .07, cy: base - rad * (flat ? .35 : .5) - (flat ? 0 : big * wpx * .05 * r()), rad });
  }
  if (!flat) for (let k = 0; k < 2; k++) { const rad = wpx * (.06 + .05 * r()); circ.push({ cx: wpx * (.18 + .64 * r()), cy: base - rad * .25, rad }); }
  const Lx = -.5, Ly = -.86;
  const c = canvas(wpx, h), g = c.getContext('2d');
  for (let y = 0; y <= base; y++) for (let x = 0; x < wpx; x++) {
    let own = null;
    for (const q of circ) { const dx = x + .5 - q.cx, dy = y + .5 - q.cy; if (dx * dx + dy * dy <= q.rad * q.rad) own = q; }   // the front-most puff
    if (!own) continue;
    const nx = (x + .5 - own.cx) / own.rad, ny = (y + .5 - own.cy) / own.rad, lit = nx * Lx + ny * Ly;
    let tone = lit > .62 ? 0 : lit > .2 ? 1 : lit > -.3 ? 2 : 3;
    if (y >= base - (flat ? 0 : 1)) tone = Math.max(tone, y === base ? 4 : 3);
    g.fillStyle = pal[tone]; g.fillRect(x, y, 1, 1);
  }
  return c;
}

// thin streak clouds (like the painted ones high up): a few long strokes, lighter on top, ends breaking up
function wispSprite(seed, wpx, pal) {
  // flat lens-shaped clouds: a few squashed puffs side by side, lit on top, a dark seam underneath
  const r = rng(seed), h = Math.max(5, Math.round(wpx * .11)), base = h - 1, puffs = [];
  const n = 3 + ((r() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const f = (i + .5) / n, big = .55 + .45 * Math.sin(f * Math.PI);
    const rx = wpx * (.1 + .12 * r()) * big + 2, ry = h * (.32 + .3 * r()) * big + 1;
    puffs.push({ cx: wpx * (.08 + .84 * f) + (r() - .5) * wpx * .06, cy: base - ry * .8 - (1 - big) * h * .2, rx, ry });
  }
  const c = canvas(wpx, h), g = c.getContext('2d'), Lx = -.35, Ly = -.94;
  for (let y = 0; y <= base; y++) for (let x = 0; x < wpx; x++) {
    let own = null;
    for (const q of puffs) { const dx = (x + .5 - q.cx) / q.rx, dy = (y + .5 - q.cy) / q.ry; if (dx * dx + dy * dy <= 1) own = q; }
    if (!own) continue;
    const nx = (x + .5 - own.cx) / own.rx, ny = (y + .5 - own.cy) / own.ry, lit = nx * Lx + ny * Ly;
    let tone = lit > .7 ? 0 : lit > .25 ? 1 : lit > -.25 ? 2 : 3;
    if (y === base) tone = 4;
    g.fillStyle = pal[tone]; g.fillRect(x, y, 1, 1);
  }
  return c;
}

// ---------- birds: little pixel silhouettes seen from below, wings beating up and down ----------
const BIRDS = {
  goose: { col: { k: '#3d345f', b: '#2c254a' }, frames: [
    ['k.........k', '.k.......k.', '..kk...kk..', '....kbk....', '.....b.....'],
    ['...........', 'kk.......kk', '..kk...kk..', '....kbk....', '.....b.....'],
    ['...........', '...........', 'kkkkkbkkkkk', '....kbk....', '.....b.....'],
    ['...........', '....kbk....', '..kk.b.kk..', '.k.......k.', 'k.........k'],
  ], cycle: [0, 1, 2, 3, 2, 1] },
  small: { col: { k: '#4a3d6e' }, frames: [
    ['k...k', '.k.k.', '..k..'], ['.....', 'kk.kk', '..k..'], ['..k..', '.k.k.', 'k...k'], ['.....', '.kk..', '.....'],
  ], cycle: [0, 1, 2, 1], tucked: 3 },
  gull: { col: { w: '#fbfaff', d: '#4a4470', s: '#c9c6e6' }, frames: [
    ['d.........d', '.w.......w.', '..ww...ww..', '....wsw....', '.....s.....'],
    ['...........', '.ww.....ww.', 'd..ww.ww..d', '.....s.....', '...........'],
    ['....wsw....', '..ww.s.ww..', '.w.......w.', 'd.........d', '...........'],
  ], cycle: [0, 1, 2, 1], glide: 1 },
  eagle: { col: { k: '#4a3646', d: '#2e2230', h: '#f4f0ff' }, frames: [
    ['d.............d', '.k...........k.', '..kk...h...kk..', '....kkkkkkk....', '......kkk......', '.......d.......'],
    ['...............', 'dd...........dd', '.kkk...h...kkk.', '...kkkkkkkkk...', '......kkk......', '.......d.......'],
    ['...............', '.......h.......', 'ddkkkkkkkkkkkdd', '.....kkkkk.....', '......kkk......', '.......d.......'],
    ['.......h.......', '....kkkkkkk....', '..kk..kkk..kk..', '.k.....d.....k.', 'd.............d', '...............'],
  ], cycle: [0, 1, 2, 3, 2, 1], glide: 1 },
};
const birdCache = new Map();
function birdFrames(kind) {
  if (birdCache.has(kind)) return birdCache.get(kind);
  const b = BIRDS[kind], fr = b.frames.map((rows) => fromRows(rows, b.col));
  const out = { f: fr, cycle: b.cycle, tucked: b.tucked, glide: b.glide, w: fr[0].width, h: fr[0].height };
  birdCache.set(kind, out); return out;
}

// ---------- the hot-air balloon, the plane, the sleigh, a leaf: pixel sprites ----------
function balloonSprite(a, b) {
  const rows = [
    '...aabbaa...',
    '..aabbbbaa..',
    '.aaabbbbaaa.',
    'haaabbbbaaas',
    'haaabbbbaaas',
    'haaabbbbaaas',
    '.haabbbbaas.',
    '.haabbbbaas.',
    '..haabbaas..',
    '...aabbaa...',
    '....k..k....',
    '....k..k....',
    '....wwww....',
    '....wwww....',
  ];
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(clamp(v * f, 0, 255)).toString(16).padStart(2, '0')).join(''); };
  return fromRows(rows, { a, b, h: shade(a, 1.18), s: shade(a, .7), k: '#3a2a3c', w: '#9a6a3a' });
}
const PLANE = ['......kk....', '.....kww....', 'kk..kwwwwwwk', 'kwwwwwwwwwwwk', '.kkkkwwkkkk.', '.....kk.....'];
function planeSprite(light) { return fromRows(PLANE.map((r, i) => (i === 2 ? r.slice(0, -1) + (light ? 'r' : 'k') : r)), { k: '#5a5c88', w: '#eef0ff', r: '#ff5a6a' }); }
function sleighSprite(f) {
  // two reindeer pulling Santa's red sleigh, facing right; f = gallop frame
  const c = canvas(34, 12), g = c.getContext('2d'), P = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const deer = (x, y, nose) => {
    P('#8a5a3a', x, y + 3, 7, 2); P('#8a5a3a', x + 6, y + 1, 2, 2); P('#8a5a3a', x + 7, y, 3, 2); P('#6a4030', x, y + 4, 7, 1);
    P('#f0d8a8', x + 7, y - 1); P('#f0d8a8', x + 6, y - 2); P('#f0d8a8', x + 8, y - 2); P('#f0d8a8', x + 9, y - 1);
    P(nose ? '#ff4a4a' : '#3a2430', x + 10, y + 1); P('#1d1430', x + 8, y);
    P('#f6e8d0', x - 1, y + 3);
    const legs = f ? [[x, 5, 2], [x + 1, 6, 1], [x + 5, 5, 2], [x + 7, 5, 1]] : [[x - 1, 5, 1], [x + 1, 5, 2], [x + 6, 5, 2], [x + 8, 4, 1]];
    for (const [lx, ly, lh] of legs) P('#5a3a2a', lx, y + ly, 1, lh);
  };
  deer(23, 2, true); deer(13, 3, false);
  P('#ffd24a', 10, 7, 4, 1); P('#ffd24a', 14, 6, 9, 1);   // reins
  P('#e04050', 1, 5, 9, 3); P('#e04050', 0, 3, 2, 2); P('#b02838', 1, 7, 9, 1); P('#e04050', 9, 4, 2, 2);
  P('#e04050', 3, 2, 3, 3); P('#ffffff', 3, 4, 3, 1); P('#f6d0b0', 4, 1, 2, 1); P('#e04050', 4, 0, 2, 1); P('#ffffff', 6, 0, 1, 1);
  P('#7a3ad0', 6, 3, 3, 2); P('#ffd24a', 7, 3);   // the sack of presents
  P('#ffd24a', 0, 9, 12, 1); P('#ffd24a', 12, 8); P('#ffd24a', 12, 7); P('#ffd24a', 2, 8); P('#ffd24a', 8, 8);
  return c;
}
const LEAF = [['...1.', '..112', '.1122', '1122.', '.2...'], ['.....', '..11.', '.1122', '.22..', '.....'], ['.....', '.....', '11222', '.....', '.....'], ['.2...', '1221.', '.1221', '..121', '...1.']];
const leafCache = new Map();
function leafFrames(ci) {
  if (leafCache.has(ci)) return leafCache.get(ci);
  const [a, b] = LEAF_COLS[ci], f = LEAF.map((rows) => fromRows(rows, { 1: a, 2: b })); leafCache.set(ci, f); return f;
}
const SPARK = [['.....', '.....', '..w..', '.....', '.....'], ['.....', '..y..', '.ywy.', '..y..', '.....'], ['..y..', '..y..', 'yywyy', '..y..', '..y..']];
let sparkFrames = null;
const sparks = () => sparkFrames || (sparkFrames = SPARK.map((r) => fromRows(r, { w: '#ffffff', y: '#fff2c0' })));

// ======================================================================================================================
export function createAmbient() {
  let s = 0, last = 0, lastCam = null, built = false;
  const v = { t: 0, dt: 0, camY: 0, vh: 180, vw: W, x0: 0, cw: 320, ch: 180 };
  const X = (x) => Math.round((x - v.x0) * s), Y = (y) => Math.round((y - v.camY) * s);
  const seen = (y0, y1) => y1 > v.camY - 8 && y0 < v.camY + v.vh + 8;   // does the view show any of y0…y1?
  const onView = (x, y, m = 20) => y > v.camY - m && y < v.camY + v.vh + m && x > v.x0 - m && x < v.x0 + v.vw + m;

  // ---------- wind: a breeze that swells, and gusts every 9–23 s ----------
  const wind = { v: 6, k: 0, gust: null, next: 5000, css: -1 };
  function updWind() {
    const t = v.t;
    if (!wind.gust && t > wind.next) { wind.gust = { t0: t, len: rnd(3200, 6200), peak: rnd(.5, 1) }; puffPines(); }
    let k = 0;
    if (wind.gust) {
      const f = (t - wind.gust.t0) / wind.gust.len;
      if (f >= 1) { wind.gust = null; wind.next = t + rnd(9000, 23000); }
      else k = wind.gust.peak * Math.pow(Math.sin(Math.PI * f), 2) * (1 + .12 * Math.sin(t / 170));
    }
    wind.k = k; wind.v = 5 + 2.5 * Math.sin(t / 6100) + 34 * k;
    const css = Math.round(clamp((wind.v - 5) / 30, 0, 1.2) * 20) / 20;
    if (css !== wind.css) { wind.css = css; document.documentElement.style.setProperty('--wind', css); }
  }

  // ---------- weather: a shower every 45–80 s (the first one soon), then a rainbow ----------
  const wx = { next: 14000 + R() * 8000, t0: -1e9, len: 0, rain: 0, bow: 0, bowT: -1e9 };
  function updWeather() {
    const t = v.t;
    if (t > wx.next) { wx.t0 = t; wx.len = rnd(15000, 22000); wx.next = t + wx.len + rnd(45000, 80000); wx.bowT = t + wx.len - 1500; gatherStorms(); }
    const f = t - wx.t0;
    wx.rain = f < 0 || f > wx.len ? 0 : smooth(0, 2500, f) * (1 - smooth(wx.len - 3000, wx.len, f));
    const b = t - wx.bowT;
    wx.bow = b < 0 || b > 17000 ? 0 : smooth(0, 3000, b) * (1 - smooth(13000, 17000, b));
  }

  // ---------- clouds ----------
  let clouds = [];
  function buildClouds() {
    const r = rng(77), list = [];
    const add = (n, y0, y1, w0, w1, pal, kind, a = 1) => { for (let i = 0; i < n; i++) list.push({ x: r() * (W + 120) - 60, y: y0 + r() * (y1 - y0), w: w0 + r() * (w1 - w0), pal, kind, a, depth: .5 + r() * .8, seed: (r() * 1e9) | 0 }); };
    add(14, 1830, 2165, 14, 40, 'sunset', 'puff');            // the pink evening clouds over the forest
    add(7, 1610, 1700, 16, 38, 'sunset', 'puff');             // round the peaks, still pink
    add(12, 1360, 1600, 16, 46, 'day', 'puff');               // the blue sky under the cloud sea
    add(10, 1130, 1350, 50, 110, 'sea', 'wisp', .55);         // mist drifting over the cloud sea
    add(10, 860, 1110, 50, 120, 'night', 'wisp', .8);         // thin moonlit streaks up high
    add(5, 480, 860, 60, 130, 'night', 'wisp', .4);           // in front of the aurora, very faint
    add(8, 1360, 1620, 50, 110, 'day', 'wisp', .7);           // and some under the cloud sea
    list.sort((a, b) => a.depth - b.depth);
    for (const c of list) { const wpx = Math.max(6, Math.round(c.w * s)); c.img = c.kind === 'wisp' ? wispSprite(c.seed, wpx, CLOUD_PAL[c.pal]) : cloudSprite(c.seed, wpx, CLOUD_PAL[c.pal], c.kind); c.h = c.img.height / s; }
    clouds = list;
  }
  function drawClouds(g, front) {
    for (const c of clouds) {
      if ((c.depth > 1.05) !== front) continue;
      c.x += (.5 + c.depth * .7 + wind.v * .1 * c.depth) * v.dt;
      if (c.x > W + 40) c.x = -c.w - 40;
      if (!seen(c.y - c.h, c.y)) continue;
      g.globalAlpha = c.a; g.drawImage(c.img, X(c.x), Y(c.y) - c.img.height);
    }
    g.globalAlpha = 1;
  }

  // ---------- rain clouds and rain ----------
  let storms = [];
  const drops = [];
  function gatherStorms() {
    storms = [];
    const n = 3, top = v.camY + v.vh * .06;
    for (let i = 0; i < n; i++) {
      const w = rnd(60, 96), x = v.x0 - 20 + (i + rnd(.1, .7)) * (v.vw + 40) / n - w / 2;
      const y = clamp(top + rnd(10, v.vh * .26), 1380, 2120);
      storms.push({ x, y, w, img: cloudSprite((R() * 1e9) | 0, Math.round(w * s), CLOUD_PAL.storm, 'storm'), a: 0 });
    }
  }
  function drawStorms(g) {
    if (!storms.length) return;
    const fade = wx.rain;
    for (const c of storms) {
      c.x += (2 + wind.v * .25) * v.dt; c.a = fade;
      c.y = clamp(c.y + v.dcw * .75, 1380, 2120);   // far away: they keep up with a climbing camera, mostly
      if (c.a <= .01) continue;
      const h = c.img.height / s;
      // rain falls from the cloud's belly
      const nd = c.a * c.w * .09 * v.dt * 30; for (let k = 0; k < nd; k++) drops.push({ x: c.x + rnd(.1, .9) * c.w, y: c.y - h * .3 + rnd(0, 8), vy: rnd(170, 230), life: rnd(.5, .9), a: rnd(.5, .85), len: rnd(5, 10) | 0 });
      if (!seen(c.y - h, c.y + 140)) continue;
      g.globalAlpha = step(c.a, 6); g.drawImage(c.img, X(c.x), Y(c.y) - c.img.height);
    }
    g.globalAlpha = 1;
    if (fade <= 0 && v.t - wx.t0 > wx.len) storms = [];
  }
  function drawRain(g) {
    // a light drizzle over the whole sky below the cloud sea while it rains
    if (wx.rain > 0) {
      const n = wx.rain * v.vw * v.vh * .0009 * v.dt * 10;
      for (let i = 0; i < n; i++) {
        const y = v.camY + R() * v.vh;
        if (y < 1360 || y > 2196) continue;
        drops.push({ x: v.x0 + R() * v.vw, y, vy: rnd(150, 210), life: rnd(.25, .55), a: rnd(.28, .5), len: rnd(3, 7) | 0 });
      }
    }
    if (!drops.length) return;
    g.fillStyle = '#eef2ff';
    const slant = (2 + wind.v) / 190;
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.life -= v.dt; d.y += d.vy * v.dt; d.x += (2 + wind.v) * v.dt;
      if (d.life <= 0 || d.y > 2196) { drops[i] = drops[drops.length - 1]; drops.pop(); continue; }
      if (!onView(d.x, d.y, 10)) continue;
      const x = X(d.x), y = Y(d.y), L = Math.max(2, d.len);
      g.globalAlpha = step(Math.min(d.a, d.life * 4), 4);
      for (let k = 0; k < L; k++) g.fillRect(Math.round(x - k * slant * 1.2), y - k, 1, 1);
    }
    g.globalAlpha = 1;
    if (drops.length > 900) drops.splice(0, drops.length - 900);
  }

  // ---------- the rainbow after the rain ----------
  let bowImg = null;
  function buildBow() {
    const cols = ['#ff8aa0', '#ffb07a', '#ffe48a', '#a4ea9a', '#8ad0ff', '#9aa4ff', '#c8a0ff'];
    const band = Math.max(2, Math.round(1.6 * s)), r0 = Math.round(RAINBOW.r * s), rOut = r0 + band * cols.length;
    const c = canvas(rOut * 2 + 1, rOut + 1), g = c.getContext('2d');
    for (let y = 0; y <= rOut; y++) for (let x = 0; x <= rOut * 2; x++) {
      const d = Math.hypot(x - rOut, rOut - y); if (d < r0 || d >= rOut) continue;
      g.fillStyle = cols[cols.length - 1 - Math.floor((d - r0) / band)]; g.fillRect(x, y, 1, 1);
    }
    bowImg = c;
  }
  function drawBow(g) {
    if (wx.bow <= 0 || !seen(RAINBOW.y - RAINBOW.r - 14, RAINBOW.y)) return;
    const rOut = (bowImg.width - 1) / 2;
    g.globalAlpha = step(wx.bow * .32, 12);
    g.drawImage(bowImg, X(RAINBOW.x) - rOut, Y(RAINBOW.y) - bowImg.height);
    g.globalAlpha = 1;
  }

  // ---------- the low sun: a pulsing glow and slowly turning rays; light shafts under the cloud sea ----------
  const rays = Array.from({ length: 7 }, (_, i) => ({ a: -Math.PI * (.1 + .8 * (i + rnd(.1, .9)) / 7), w: rnd(.01, .035), len: rnd(150, 290), ph: rnd(0, 6), sp: rnd(.5, 1.3) }));
  function drawSun(g) {
    if (!seen(SUN.y - 400, SUN.y + 40)) return;
    const t = v.t, sx = X(SUN.x), sy = Y(SUN.y);
    g.globalCompositeOperation = 'lighter';
    const pulse = .85 + .15 * Math.sin(t / 1300);
    [[26, .03], [16, .04], [10, .05], [6, .06]].forEach(([r, a]) => { const d = disk(r * s * (.96 + .04 * Math.sin(t / 900)), '#ffe6c8'); g.globalAlpha = step(a * pulse, 64); g.drawImage(d, sx - (d.width >> 1), sy - (d.height >> 1)); });
    g.fillStyle = '#fff0d4';
    const top = Math.max(0, Y(SUN.y - 420)), bot = Math.min(v.ch - 1, sy);
    for (const ray of rays) {
      const a = ray.a + .025 * Math.sin(t / 9000 + ray.ph), sa = Math.sin(a), ca = Math.cos(a), tw = Math.tan(ray.w);
      const glow = .5 + .5 * Math.sin(t / 2300 * ray.sp + ray.ph);
      for (let yy = top; yy <= bot; yy += 1) {
        const wy = v.camY + yy / s, d = (wy - SUN.y) / sa; if (d < 6 || d > ray.len) continue;
        const cx = SUN.x + d * ca, hw = d * tw / Math.abs(sa);
        const fall = 1 - d / ray.len, a2 = step(.07 * fall * Math.sqrt(fall) * (.3 + .7 * glow), 48);
        if (a2 <= 0) continue;
        g.globalAlpha = a2; const x0 = X(cx - hw), x1 = X(cx + hw); g.fillRect(x0, yy, Math.max(1, x1 - x0), 1);
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }
  const shafts = Array.from({ length: 6 }, (_, i) => ({ x: 20 + i * 52 + rnd(-10, 10), w: rnd(7, 16), ph: rnd(0, 6), y1: rnd(1560, 1660) }));
  function drawShafts(g) {
    const y0 = 1348; if (!seen(y0, 1660)) return;
    g.globalCompositeOperation = 'lighter'; g.fillStyle = '#fff4e0';
    const slope = .42, t = v.t;
    for (const sh of shafts) {
      const glow = .5 + .5 * Math.sin(t / 2800 + sh.ph), x = sh.x + 6 * Math.sin(t / 11000 + sh.ph);
      const top = Math.max(0, Y(y0)), bot = Math.min(v.ch - 1, Y(sh.y1));
      for (let yy = top; yy <= bot; yy++) {
        const wy = v.camY + yy / s, f = (wy - y0) / (sh.y1 - y0);
        const a = step(.06 * glow * Math.min(1, f * 6) * (1 - f), 40); if (a <= 0) continue;
        const cx = x + (wy - y0) * slope; g.globalAlpha = a; g.fillRect(X(cx - sh.w / 2), yy, Math.max(1, Math.round(sh.w * s)), 1);
      }
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  // ---------- glints and sparkles ----------
  const glints = [];
  function drawGlints(g) {
    const t = v.t;
    // on the lake: short bright ripples that come and go
    if (seen(LAKE.y0, LAKE.y1) && glints.length < 16 && R() < .5) {
      const x = rnd(LAKE.x0, LAKE.x1), cx = (LAKE.x0 + LAKE.x1) / 2, hw = (LAKE.x1 - LAKE.x0) / 2, edge = 1 - Math.pow((x - cx) / hw, 2);
      glints.push({ x, y: LAKE.y0 + 3 + R() * (LAKE.y1 - LAKE.y0 - 4) * Math.sqrt(Math.max(0, edge)), w: rnd(2, 6), t0: t, len: rnd(600, 1600), kind: 'lake' });
    }
    // on the snow in the sun and on the treetops
    if (seen(2330, 2417) && glints.length < 28 && R() < .25) glints.push({ x: rnd(v.x0, v.x0 + v.vw), y: rnd(2342, 2410), t0: t, len: rnd(500, 1000), kind: 'spark' });
    if (wx.bow > .2 && seen(2030, 2190) && R() < .08) glints.push({ x: rnd(v.x0, v.x0 + v.vw), y: rnd(v.camY, v.camY + v.vh), t0: t, len: 700, kind: 'spark' });
    for (let i = glints.length - 1; i >= 0; i--) {
      const gl = glints[i], f = (t - gl.t0) / gl.len;
      if (f >= 1) { glints.splice(i, 1); continue; }
      const a = Math.sin(Math.PI * f);
      if (gl.kind === 'lake') { g.fillStyle = f < .5 ? '#ffffff' : '#dfe8ff'; g.globalAlpha = step(a * .85, 4); g.fillRect(X(gl.x), Y(gl.y), Math.max(1, Math.round(gl.w * s * (.6 + .4 * a))), 1); }
      else { const fr = sparks()[Math.min(2, (a * 3) | 0)]; g.globalAlpha = 1; g.drawImage(fr, X(gl.x) - 2, Y(gl.y) - 2); }
    }
    g.globalAlpha = 1;
  }

  // ---------- the forest: chimney smoke, lantern and window light, the twinkling tree ----------
  const smoke = [];
  let smokeT = 0;
  function drawForest(g) {
    const t = v.t;
    if (!seen(2180, 2420)) { smoke.length = 0; return; }
    // smoke puffs: rise, grow, lean with the wind, fade in steps
    smokeT -= v.dt; if (smokeT <= 0) { smokeT = rnd(.28, .45); smoke.push({ x: CHIMNEY.x + rnd(-.5, .5), y: CHIMNEY.y, age: 0, life: rnd(4.5, 6.5), sw: rnd(0, 6) }); }
    for (let i = smoke.length - 1; i >= 0; i--) {
      const p = smoke[i]; p.age += v.dt;
      if (p.age > p.life) { smoke.splice(i, 1); continue; }
      const f = p.age / p.life;
      p.y -= (6.5 - 3 * f) * v.dt; p.x += (wind.v * .55 * Math.min(1, f * 3) + 1.2 * Math.sin(p.age * 1.3 + p.sw)) * v.dt;
      const d = disk((.8 + f * 3.8) * s, f < .35 ? '#f2f0fa' : '#dcdaf0');
      g.globalAlpha = step(.6 * (1 - f) * Math.min(1, p.age * 3), 5); g.drawImage(d, X(p.x) - (d.width >> 1), Y(p.y) - (d.height >> 1));
    }
    g.globalAlpha = 1;
    // warm light: lanterns flicker, the cabin window glows, the star on the tree twinkles
    g.globalCompositeOperation = 'lighter';
    for (const [lx, ly, size] of LANTERNS) {
      if (!onView(lx, ly, 30)) continue;
      const fl = .78 + .12 * Math.sin(t / 97 + lx) + .1 * Math.sin(t / 41 + ly);
      [[12, .05], [7, .08], [4, .12]].forEach(([r, a]) => { const d = disk(r * size * s, '#ffcf7a'); g.globalAlpha = step(a * fl, 64); g.drawImage(d, X(lx) - (d.width >> 1), Y(ly) - (d.height >> 1)); });
    }
    { const fl = .85 + .15 * Math.sin(t / 230); const d = disk(5 * s, '#ffcf7a'); g.globalAlpha = step(.1 * fl, 64); g.drawImage(d, X(WINDOW.x) - (d.width >> 1), Y(WINDOW.y) - (d.height >> 1)); }
    {
      const tw = .5 + .5 * Math.sin(t / 380), d = disk(6 * s, '#fff0a8');
      g.globalAlpha = step(.16 * tw + .05, 32); g.drawImage(d, X(TREE_STAR.x) - (d.width >> 1), Y(TREE_STAR.y) - (d.height >> 1));
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      const fr = sparks()[tw > .66 ? 2 : tw > .33 ? 1 : 0]; g.drawImage(fr, X(TREE_STAR.x) - 2, Y(TREE_STAR.y) - 2);
    }
    // little lights on the tree blink in turn
    const cols = ['#ff6a7a', '#ffd24a', '#7af0a8', '#7ac8ff', '#ff9ae0'];
    for (let k = 0; k < 14; k++) {
      const row = k % 5, yy = TREE_STAR.y + 8 + row * 6.2, half = 2.5 + row * 2.6, xx = TREE_STAR.x + Math.sin(k * 2.39) * half;
      const on = ((t / 420 + k * .37) | 0) % 3 !== 0; if (!on) continue;
      g.fillStyle = cols[(k + ((t / 1260) | 0)) % 5]; g.fillRect(X(xx), Y(yy), s > 1 ? 2 : 1, s > 1 ? 2 : 1);
    }
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  }

  // ---------- snow: three depths, leaning with the wind, thicker during a shower ----------
  let flakes = [];
  function buildSnow() {
    flakes = Array.from({ length: Math.round(v.cw * v.ch / 260) }, () => newFlake(true));
  }
  function newFlake(anywhere) {
    const z = R(), depth = z < .55 ? .55 : z < .88 ? .85 : z < .985 ? 1.2 : 1.6;
    return { x: R() * v.cw, y: anywhere ? R() * v.ch : -3, z, depth, r: R(), ph: R() * 6, fall: (depth * 16 + R() * 10) * (v.ch / 360) };
  }
  function drawSnow(g, dcam) {
    const thick = 1 + 1.3 * wx.rain, push = (wind.v * .9) * s;
    for (const f of flakes) {
      f.y += f.fall * v.dt + dcam * f.depth; f.ph += v.dt * (1.2 + f.depth);
      f.x += (push * f.depth + Math.sin(f.ph) * 6 * f.depth) * v.dt;
      if (f.y > v.ch + 3) { Object.assign(f, newFlake(false)); f.y = -3; }
      if (f.y < -4) { f.y = v.ch + 2; }
      if (f.x > v.cw + 3) f.x -= v.cw + 6; else if (f.x < -3) f.x += v.cw + 6;
      const wy = v.camY + f.y / s, dens = smooth(1930, 2130, wy) * .55 * thick;   // only near the forest
      if (f.r > dens) continue;
      const x = Math.round(f.x), y = Math.round(f.y);
      if (f.depth >= 1.6) { g.globalAlpha = .95; g.fillStyle = '#ffffff'; g.fillRect(x - 1, y, 3, 1); g.fillRect(x, y - 1, 1, 3); }
      else if (f.depth >= 1.2) { g.globalAlpha = .95; g.fillStyle = '#ffffff'; g.fillRect(x, y, 2, 2); }
      else { g.globalAlpha = f.depth > .7 ? .9 : .55; g.fillStyle = f.depth > .7 ? '#ffffff' : '#e6e8fb'; g.fillRect(x, y, 1, 1); }
    }
    g.globalAlpha = 1;
  }

  // ---------- leaves: blown in by the gusts (and now and then one drifts off the big pines) ----------
  const leaves = [];
  function drawLeaves(g, dcam) {
    const low = seen(1840, 2420);
    if (low && leaves.length < 26) {
      if (wind.k > .12 && R() < wind.k * 9 * v.dt) { const y0 = Math.max(0, Y(1900)); if (y0 < v.ch - 10) leaves.push(newLeaf(-4, rnd(y0, v.ch * .95))); }
      if (seen(2200, 2340) && R() < .5 * v.dt) { const p = pick(PINES); leaves.push(newLeaf(X(rnd(p[0], p[1])), Y(rnd(p[2], p[2] + 50)))); }
    }
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i]; l.ph += v.dt * l.spin; l.age += v.dt;
      const lift = wind.k > .45 ? -14 * wind.k * Math.max(0, Math.sin(l.ph * .7)) : 0;
      l.x += (wind.v * 1.15 * s * l.depth + 6 * Math.sin(l.ph * .5)) * v.dt;
      l.y += ((9 + 5 * Math.sin(l.ph)) * l.depth + lift) * v.dt + dcam * l.depth;
      if (l.x > v.cw + 8 || l.y > v.ch + 8 || l.age > 30 || v.camY + l.y / s < 1830) { leaves.splice(i, 1); continue; }
      const fr = leafFrames(l.c)[((l.ph * 1.6) | 0) & 3];
      g.drawImage(fr, Math.round(l.x), Math.round(l.y));
    }
  }
  const newLeaf = (x, y) => ({ x, y, c: (R() * LEAF_COLS.length) | 0, ph: R() * 6, spin: rnd(2.5, 5), depth: rnd(.8, 1.3), age: 0 });

  // ---------- wind streaks: curly white lines that whoosh past in the gusts ----------
  const streaks = [];
  function newStreak() {
    const pts = [], len = rnd(90, 170) * (v.cw / 320 + .4), loopAt = rnd(.35, .7) * len, r = rnd(3, 6), amp = rnd(1.5, 4), lam = rnd(14, 26);
    let looped = false;
    for (let u = 0; u < len; u += 1) {
      if (!looped && u >= loopAt) {   // one curl along the way
        looped = true; const lx = u, ly = amp * Math.sin(u / lam);
        for (let a = 0; a < Math.PI * 2; a += 1 / r) pts.push([lx + r * Math.sin(a), ly - r + r * Math.cos(a)]);
      }
      pts.push([u, amp * Math.sin(u / lam)]);
    }
    return { pts, x: rnd(-60, v.cw * .55), y: rnd(v.ch * .06, v.ch * .8), t0: v.t, life: rnd(1100, 1700), tail: rnd(22, 40) | 0 };
  }
  function drawStreaks(g, dcam) {
    if (wind.k > .28 && streaks.length < 5 && R() < wind.k * 2.2 * v.dt) streaks.push(newStreak());
    g.fillStyle = '#ffffff';
    for (let i = streaks.length - 1; i >= 0; i--) {
      const st = streaks[i], f = (v.t - st.t0) / st.life;
      st.y += dcam;
      if (f >= 1) { streaks.splice(i, 1); continue; }
      const head = Math.floor(f * f * (3 - 2 * f) * (st.pts.length + st.tail)), fade = Math.sin(Math.PI * f);
      for (let k = Math.max(0, head - st.tail); k < Math.min(head, st.pts.length); k++) {
        const along = (k - (head - st.tail)) / st.tail;
        g.globalAlpha = step(.55 * fade * along, 3); if (g.globalAlpha <= 0) continue;
        g.fillRect(Math.round(st.x + st.pts[k][0]), Math.round(st.y + st.pts[k][1]), 1, 1);
      }
    }
    g.globalAlpha = 1;
  }

  // ---------- snow puffs off the big pines in a gust; spindrift off the summits ----------
  const dust = [];
  function puffPines() {
    if (!seen(2200, 2340)) return;
    for (const [x0, x1, y0, y1] of PINES) for (let k = 0; k < 4; k++) {
      const cx = rnd(x0, x1), cy = rnd(y0, y1);
      for (let j = 0; j < 14; j++) dust.push({ x: cx + rnd(-3, 3), y: cy + rnd(-2, 2), vx: rnd(-2, 4), vy: rnd(-2, 4), g: rnd(18, 30), life: rnd(1.6, 2.8), age: 0, a: rnd(.6, 1) });
    }
  }
  function drawDust(g) {
    if (seen(1640, 1770)) for (const [sx, sy] of SUMMITS) {
      if (R() < (.35 + wind.k * 1.6) * 10 * v.dt) dust.push({ x: sx + rnd(-2, 2), y: sy + rnd(0, 3), vx: rnd(4, 9), vy: rnd(-3, 1), g: rnd(1, 4), life: rnd(1.4, 2.6), age: 0, a: rnd(.45, .8) });
    }
    g.fillStyle = '#ffffff';
    for (let i = dust.length - 1; i >= 0; i--) {
      const p = dust[i]; p.age += v.dt;
      if (p.age > p.life) { dust[i] = dust[dust.length - 1]; dust.pop(); continue; }
      p.vy += p.g * v.dt; p.x += (p.vx + wind.v * .8) * v.dt; p.y += p.vy * v.dt;
      if (!onView(p.x, p.y, 4)) continue;
      g.globalAlpha = step(p.a * (1 - p.age / p.life), 4); g.fillRect(X(p.x), Y(p.y), 1, 1);
    }
    g.globalAlpha = 1;
    if (dust.length > 700) dust.splice(0, dust.length - 700);
  }

  // ---------- mist rolling over the cloud sea ----------
  let mist = [];
  function buildMist() {
    mist = [[1146, 9, 3, .3], [1170, 12, 5, .26], [1340, 10, 4, .22]].map(([y, hh, speed, a], i) => {
      const w = Math.round(W * s), h = Math.round(hh * s), c = canvas(w, h), g = c.getContext('2d'), r = rng(300 + i);
      const ph = [r() * 6, r() * 6, r() * 6];
      g.fillStyle = '#efe4f8';
      for (let x = 0; x < w; x++) {
        const u = x / w * Math.PI * 2;   // wraps seamlessly
        const n = .5 + .25 * Math.sin(u * 3 + ph[0]) + .18 * Math.sin(u * 7 + ph[1]) + .1 * Math.sin(u * 13 + ph[2]);
        const top = Math.round(h * (1 - n) * .9);
        for (let y = top; y < h; y++) { const k = (y - top) / (h - top + .01); if (k > .82 && (x + y) % 2) continue; if (y === top && x % 2) continue; g.fillRect(x, y, 1, 1); }
      }
      return { c, y, speed, a, off: r() * w };
    });
  }
  function drawMist(g) {
    for (const m of mist) {
      if (!seen(m.y - 14, m.y + 2)) continue;
      m.off = (m.off + (m.speed + wind.v * .25) * s * v.dt) % m.c.width;
      const x = Math.round(X(0) + m.off - m.c.width), y = Y(m.y) - m.c.height;
      g.globalAlpha = m.a; g.drawImage(m.c, x, y); g.drawImage(m.c, x + m.c.width, y);
    }
    g.globalAlpha = 1;
  }

  // ---------- birds ----------
  const flocks = [];
  const BANDS = [   // kind, y0, y1, max flocks
    ['goose', 1790, 2120, 1], ['small', 2120, 2290, 1], ['goose', 1390, 1620, 1], ['gull', 1365, 1470, 1], ['eagle', 1560, 1730, 1],
  ];
  function spawnFlocks() {
    for (const [kind, y0, y1, max] of BANDS) {
      const lo = Math.max(y0, v.camY + 12), hi = Math.min(y1, v.camY + v.vh * .8);
      if (hi - lo < 10) continue;
      if (flocks.filter((f) => f.kind === kind && f.y > y0 - 60 && f.y < y1 + 60).length >= max) continue;
      if (R() > v.dt * .45) continue;
      const dir = R() < .72 ? 1 : -1, y = rnd(lo, hi);
      const f = { kind, y, dir, x: dir > 0 ? v.x0 - 30 : v.x0 + v.vw + 30, members: [], t0: v.t, ph: R() * 10 };
      if (kind === 'goose') { const n = 5 + ((R() * 5) | 0); f.speed = rnd(15, 21); for (let i = 0; i < n; i++) { const k = Math.ceil(i / 2), side = i % 2 ? 1 : -1; f.members.push({ dx: -k * 8, dy: side * k * 4.2, ph: k * .55 + R() * .2 }); } }
      if (kind === 'small') { const n = 2 + ((R() * 4) | 0); f.speed = rnd(22, 30); for (let i = 0; i < n; i++) f.members.push({ dx: -i * rnd(6, 11), dy: rnd(-7, 7), ph: R() * 3 }); }
      if (kind === 'gull') { const n = 1 + ((R() * 3) | 0); f.speed = rnd(12, 17); for (let i = 0; i < n; i++) f.members.push({ dx: -i * rnd(10, 18), dy: rnd(-8, 8), ph: R() * 6 }); }
      if (kind === 'eagle') { f.speed = rnd(9, 13); f.members.push({ dx: 0, dy: 0, ph: 0 }); f.cx = v.x0 + rnd(.25, .75) * v.vw; f.x = dir > 0 ? v.x0 - 30 : v.x0 + v.vw + 30; f.circle = 0; }
      flocks.push(f);
    }
  }
  function drawBirds(g) {
    spawnFlocks();
    const t = v.t / 1000;
    for (let i = flocks.length - 1; i >= 0; i--) {
      const f = flocks[i], fr = birdFrames(f.kind), age = (v.t - f.t0) / 1000;
      if (f.kind === 'eagle') {
        // glides in, circles a few times on the rising air, then sails off
        const r = 22, w = .55;
        if (f.circle === 0 && Math.abs(f.x - f.cx) < 3) f.circle = 1, f.ca = v.t / 1000, f.cy0 = f.y;
        if (f.circle === 1) { const a = (t - f.ca) * w; f.x = f.cx + Math.sin(a) * r * f.dir; f.y = f.cy0 + (1 - Math.cos(a)) * r * .35; if (a > Math.PI * 6) f.circle = 2; }
        else f.x += f.dir * f.speed * v.dt + wind.v * .1 * v.dt;
        // mostly a glide, a few slow wing beats now and then
        const m = f.members[0], flap = Math.sin(t * .9 + f.ph) > .7, idx = flap ? fr.cycle[((t * 8) | 0) % fr.cycle.length] : fr.glide;
        if (onView(f.x, f.y, 30)) g.drawImage(fr.f[idx], X(f.x + m.dx) - (fr.w >> 1), Y(f.y + m.dy) - (fr.h >> 1));
      } else {
        f.x += (f.dir * f.speed + wind.v * .3) * v.dt;
        for (const m of f.members) {
          let idx, bob;
          if (f.kind === 'small') {   // bounding flight: a burst of flaps, then wings tucked and a dip
            const c = (t * 1.25 + m.ph) % 1, flapping = c < .55;
            idx = flapping ? fr.cycle[((t * 14 + m.ph * 3) | 0) % fr.cycle.length] : fr.tucked;
            bob = flapping ? -2.5 * Math.sin(c / .55 * Math.PI * .5) : -2.5 + 4.5 * ((c - .55) / .45);
          } else if (f.kind === 'gull') {   // long glides, a few lazy flaps
            const glide = Math.sin(t * .8 + m.ph) > -.2; idx = glide ? fr.glide : fr.cycle[((t * 6 + m.ph) | 0) % fr.cycle.length]; bob = 2 * Math.sin(t * 1.3 + m.ph);
          } else { idx = fr.cycle[((t * 7 - m.ph * 2 + 60) | 0) % fr.cycle.length]; bob = 1.2 * Math.sin(t * 2 + m.ph); }
          const x = f.x + m.dx * f.dir, y = f.y + m.dy + bob;
          if (onView(x, y, 12)) g.drawImage(fr.f[idx], X(x) - (fr.w >> 1), Y(y) - (fr.h >> 1));
        }
      }
      if (f.x < v.x0 - 140 || f.x > v.x0 + v.vw + 140 || age > 60) flocks.splice(i, 1);
    }
  }

  // ---------- hot-air balloons drifting in the evening sky ----------
  let balloons = [];
  function buildBalloons() {
    balloons = [[40, 1905], [220, 1990], [130, 2060], [280, 1820], [70, 1470], [250, 1560]].map(([x, y], i) => {
      const [a, b] = BAL_COLS[i % BAL_COLS.length]; return { x, y, img: balloonSprite(a, b), ph: R() * 6, v: rnd(1.2, 2.6) };
    });
  }
  function drawBalloons(g) {
    for (const b of balloons) {
      b.x += (b.v + wind.v * .12) * v.dt; if (b.x > W + 20) b.x = -20;
      const y = b.y + 2.5 * Math.sin(v.t / 1700 + b.ph);
      if (!onView(b.x, y, 20)) continue;
      g.drawImage(b.img, X(b.x) - (b.img.width >> 1), Y(y) - (b.img.height >> 1));
      // a puff of flame now and then
      if (Math.sin(v.t / 600 + b.ph * 3) > .93) { g.fillStyle = '#ffd24a'; g.fillRect(X(b.x) - 1, Y(y) + (b.img.height >> 1) - 5, 2, 1); }
    }
  }

  // ---------- the night: twinkling painted stars, shooting stars, the moon's halo, the aurora shimmer ----------
  let stars = [], aurora = null, nightDone = false;
  function buildNight(slices, slicePx) {
    // find the painted stars (bright little points in the top of the map) to twinkle them, and the aurora's light
    try {
      const need = Math.ceil(1800 / slicePx);
      if (slices.slice(0, need).some((im) => !im)) return;
      nightDone = true;   // one go only, even if it fails
      const mh = 1800, c = canvas(640, mh), g = c.getContext('2d');
      slices.slice(0, need).forEach((im, i) => g.drawImage(im, 0, i * slicePx));
      const d = g.getImageData(0, 0, 640, mh).data, lum = (i) => d[i] + d[i + 1] + d[i + 2];
      const found = [];
      for (let y = 40; y < 900; y++) for (let x = 1; x < 639; x++) {
        const i = (y * 640 + x) * 4, L = lum(i); if (L < 600) continue;
        if (L < lum(i - 4) || L < lum(i + 4) || L < lum(i - 2560) || L < lum(i + 2560)) continue;
        const ring = (lum(i - 8) + lum(i + 8) + lum(i - 5120) + lum(i + 5120)) / 4; if (L - ring < 140) continue;
        if (Math.hypot(x / 2 - MOON.x, y / 2 - MOON.y) < MOON.r + 6) continue;
        found.push({ x: x / 2, y: y / 2, p: R() * 20, sp: rnd(.6, 1.6), big: L > 700 });
      }
      stars = found.sort(() => R() - .5).slice(0, 260);
      // the aurora's green light, as its own picture (map pixels), to brighten in moving waves
      const a0 = 880, a1 = 1800, ac = canvas(640, a1 - a0), ag = ac.getContext('2d'), out = ag.createImageData(640, a1 - a0);
      for (let y = a0; y < a1; y++) for (let x = 0; x < 640; x++) {
        const i = (y * 640 + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2], o = ((y - a0) * 640 + x) * 4;
        const green = gg > r + 40 && gg > 110, violet = b > 190 && r > 120 && gg < r && r + gg + b > 470;
        if (!green && !violet) continue;
        out.data[o] = Math.min(255, r * 1.1); out.data[o + 1] = Math.min(255, gg * 1.15); out.data[o + 2] = Math.min(255, b * 1.1); out.data[o + 3] = 255;
      }
      ag.putImageData(out, 0, 0); aurora = { c: ac, y0: a0 / 2 };
    } catch (e) { stars = []; aurora = null; nightDone = true; }
  }
  const shooting = [];
  function drawNight(g) {
    const t = v.t;
    if (!seen(0, 940)) { shooting.length = 0; return; }
    g.globalCompositeOperation = 'lighter';
    // aurora: bright waves rolling along the curtains
    if (aurora && seen(aurora.y0, aurora.y0 + aurora.c.height / 2)) {
      const strip = 4, sy0 = Math.max(0, Math.floor((v.camY - aurora.y0) * 2)), sy1 = Math.min(aurora.c.height, Math.ceil((v.camY + v.vh - aurora.y0) * 2));
      if (sy1 > sy0) for (let x = 0; x < 640; x += strip) {
        const wx = x / 2, wave = Math.pow(.5 + .5 * Math.sin(wx / 19 - t / 820), 3) * (.55 + .45 * Math.sin(wx / 7.3 + t / 1270));
        const a = step(wave * .5, 10); if (a <= 0) continue;
        g.globalAlpha = a; g.drawImage(aurora.c, x, sy0, strip, sy1 - sy0, X(wx), Y(aurora.y0 + sy0 / 2), Math.max(1, Math.round(strip / 2 * s)), Math.round((sy1 - sy0) / 2 * s));
      }
    }
    // the moon breathes a soft halo
    if (seen(MOON.y - 60, MOON.y + 60)) {
      const p = .8 + .2 * Math.sin(t / 2100);
      [[MOON.r + 22, .035], [MOON.r + 12, .05], [MOON.r + 5, .06]].forEach(([r, a]) => { const d = disk(r * s, '#cfc8ff'); g.globalAlpha = step(a * p, 64); g.drawImage(d, X(MOON.x) - (d.width >> 1), Y(MOON.y) - (d.height >> 1)); });
    }
    // painted stars twinkle: a pixel cross flashes on them now and then
    g.fillStyle = '#fff6e6';
    for (const st of stars) {
      if (!onView(st.x, st.y, 2)) continue;
      const tw = Math.sin(t / 1000 * st.sp + st.p); if (tw < .8) continue;
      const x = X(st.x), y = Y(st.y), arm = st.big && tw > .96 ? 2 : 1;
      g.globalAlpha = step((tw - .8) / .2, 3);
      g.fillRect(x - arm, y, arm * 2 + 1, 1); g.fillRect(x, y - arm, 1, arm * 2 + 1);
    }
    g.globalAlpha = 1;
    // shooting stars
    if (seen(0, 800) && shooting.length < 2 && R() < v.dt * .3) {
      const dir = R() < .5 ? -1 : 1, a = rnd(.3, .6);
      shooting.push({ x: v.x0 + rnd(.15, .85) * v.vw, y: Math.min(780, v.camY + rnd(.05, .5) * v.vh), vx: dir * Math.cos(a) * 230, vy: Math.sin(a) * 230, t0: t, life: rnd(500, 850) });
    }
    for (let i = shooting.length - 1; i >= 0; i--) {
      const sh = shooting[i], f = (t - sh.t0) / sh.life; if (f >= 1) { shooting.splice(i, 1); continue; }
      const k = (t - sh.t0) / 1000, hx = sh.x + sh.vx * k, hy = sh.y + sh.vy * k, n = 16, fade = Math.min(1, (1 - f) * 3);
      g.fillStyle = '#ffffff';
      for (let j = 0; j < n; j++) { const b = j / n; g.globalAlpha = step(fade * (1 - b), 4); if (g.globalAlpha <= 0) continue; g.fillRect(X(hx - sh.vx * .00028 * j * 16 / s) , Y(hy - sh.vy * .00028 * j * 16 / s), 1, 1); }
      g.globalAlpha = fade; g.fillRect(X(hx), Y(hy), 2, 1); g.fillRect(X(hx), Y(hy) - 1, 1, 2);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  }

  // ---------- the sleigh (over the aurora) and the plane (over the cloud sea) ----------
  let sleigh = null, sleighNext = 4000, plane = null, planeNext = 2000;
  const trail = [];
  let sleighImgs = null, planeImgs = null;
  function drawTravellers(g) {
    const t = v.t;
    sleighImgs ||= [sleighSprite(0), sleighSprite(1)];
    planeImgs ||= [planeSprite(false), planeSprite(true)];
    if (!sleigh && t > sleighNext && seen(SLEIGH_Y - 80, SLEIGH_Y + 80)) sleigh = { x: v.x0 - 40, t0: t };
    if (sleigh) {
      sleigh.x += 28 * v.dt;
      const y = SLEIGH_Y - (sleigh.x - v.x0) * .12 + 3 * Math.sin(t / 500);
      if (R() < .9) trail.push({ x: sleigh.x + rnd(-1, 2), y: y + rnd(2, 5), t0: t, life: rnd(700, 1500) });
      const img = sleighImgs[((t / 160) | 0) % 2];
      g.drawImage(img, X(sleigh.x) - (img.width >> 1), Y(y) - (img.height >> 1));
      if (sleigh.x > v.x0 + v.vw + 50) { sleigh = null; sleighNext = t + rnd(18000, 34000); }
    }
    for (let i = trail.length - 1; i >= 0; i--) {
      const p = trail[i], f = (t - p.t0) / p.life; if (f >= 1) { trail.splice(i, 1); continue; }
      p.y += 3 * v.dt; if (!onView(p.x, p.y, 4)) continue;
      g.globalAlpha = step(1 - f, 4); g.fillStyle = (p.t0 / 90 | 0) % 3 ? '#ffe27a' : '#ffffff'; g.fillRect(X(p.x) - (sleighImgs[0].width >> 1) + 1, Y(p.y), 1, 1);
    }
    g.globalAlpha = 1;
    if (!plane && t > planeNext && seen(PLANE_Y - 40, PLANE_Y + 40)) plane = { x: v.x0 + v.vw + 30, t0: t };
    if (plane) {
      plane.x -= 24 * v.dt;
      const img = planeImgs[((t / 450) | 0) % 2], px = X(plane.x), py = Y(PLANE_Y);
      // contrail behind it, thinning out in steps
      g.fillStyle = '#ffffff';
      for (let k = 0; k < 4; k++) { g.globalAlpha = .45 - k * .1; g.fillRect(px + (img.width >> 1) + Math.round(k * 22 * s), py + 1, Math.round(22 * s), 1); }
      g.globalAlpha = 1; g.drawImage(img, px - (img.width >> 1), py - (img.height >> 1));
      if (plane.x < v.x0 - 140) { plane = null; planeNext = t + rnd(16000, 30000); }
    }
  }

  // ---------- a soft grey-violet dimming while it rains ----------
  function drawGloom(g) {
    if (wx.rain <= 0) return;
    const y0 = Y(1360), y1 = Y(2200); if (y1 < 0 || y0 > v.ch) return;
    g.globalAlpha = step(wx.rain * .12, 24); g.fillStyle = '#5a5488';
    g.fillRect(0, Math.max(0, y0), v.cw, Math.min(v.ch, y1) - Math.max(0, y0));
    g.globalAlpha = 1;
  }

  return {
    wind,
    get weather() { return wx; },
    get stats() { return { stars: stars.length, aurora: !!aurora, clouds: clouds.length, storms: storms.length, flocks: flocks.map((f) => f.kind), drops: drops.length, leaves: leaves.length, flakes: flakes.length, wind: +wind.v.toFixed(1) }; },
    // view: { t, camY, vh, vw, x0, s, cw, ch }; slices: the map pictures (for the stars and the aurora)
    draw(g, view, slices, slicePx) {
      v.dt = last ? Math.min(.1, (view.t - last) / 1000) : 0; last = view.t;
      Object.assign(v, view);
      if (view.s !== s || !built) {
        s = view.s; built = true; diskCache.clear();
        buildClouds(); buildBow(); buildMist(); buildBalloons(); buildSnow(); storms = [];
      }
      if (!nightDone && slices) buildNight(slices, slicePx);
      const dcw = lastCam == null ? 0 : v.camY - lastCam, dcam = -dcw * s; lastCam = v.camY; v.dcw = dcw;
      g.imageSmoothingEnabled = false;
      updWind(); updWeather();
      drawNight(g);
      drawSun(g);
      drawBow(g);
      drawShafts(g);
      drawClouds(g, false);
      drawTravellers(g);
      drawBalloons(g);
      drawBirds(g);
      drawClouds(g, true);
      drawGloom(g);
      drawStorms(g);
      drawForest(g);
      drawGlints(g);
      drawDust(g);
      drawRain(g);
      drawSnow(g, dcam);
      drawLeaves(g, dcam);
      drawStreaks(g, dcam);
    },
  };
}
