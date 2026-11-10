// Clue Quest: the snowy Christmas world, drawn pixel by pixel on a 320×180 canvas (the teacher's 16:9 screen) and
// as a tall snowy hillside behind a phone. A night sky with stars, an aurora and the moon; snowy mountains; a
// village with lit cabins, lamps and a snowman on the meadow (where the heroes gather in the lobby); and a lit-up
// path that zig-zags up the big mountain to a giant Christmas tree on the summit. pathPoint(t) gives the spot on
// that path for t = 0 (the start arch) … 1 (the tree), in canvas pixels, so heroes can stand on it.

export const W = 320, H = 180;
const PATH = [[150, 160], [300, 146], [196, 124], [302, 104], [222, 88], [290, 70], [248, 56], [262, 42]];
const SEGS = []; let LEN = 0;
for (let i = 1; i < PATH.length; i++) { const [ax, ay] = PATH[i - 1], [bx, by] = PATH[i], l = Math.hypot(bx - ax, by - ay); SEGS.push({ ax, ay, bx, by, l, s: LEN }); LEN += l; }
export function pathPoint(t) {
  const d = Math.max(0, Math.min(1, t)) * LEN;
  const s = SEGS.find((q) => d <= q.s + q.l) || SEGS[SEGS.length - 1], f = (d - s.s) / s.l;
  return { x: s.ax + (s.bx - s.ax) * f, y: s.ay + (s.by - s.ay) * f };
}
// the meadow where the heroes wait in the lobby (canvas pixels)
export const MEADOW = { x0: 8, x1: 136, y0: 116, y1: 166 };

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const C = {
  sky: ['#070a22', '#0a0e2c', '#0e1438', '#121a46', '#172154', '#1d2962', '#243272', '#2c3c82'],
  star: '#e8f0ff', moon: '#f6f2dc', moonD: '#d6cfae', aur1: '#3ee8a8', aur2: '#38c8e8',
  far: '#2a3672', farS: '#8a9ad8', farD: '#222c60',
  snow: '#e6eefc', snowL: '#ffffff', snowM: '#c6d4f2', snowD: '#9eb0dc', snowDD: '#7a8cc4',
  rock: '#4a5280', rockD: '#363c64',
  pine: '#17473c', pineL: '#24604c', pineD: '#0f3028', trunk: '#4a2e22',
  wood: '#7a4a2e', woodD: '#5a321e', woodL: '#94603a', win: '#ffd25a', winG: '#ff9a3a', door: '#4a2a1a',
  path: '#b8c6ea', pathD: '#93a3d2', pathL: '#d6e0f8',
  lights: ['#ff4a5a', '#ffd24a', '#4aee7a', '#5aa8ff', '#ff8ad8'],
  red: '#d83a4a', gold: '#ffd24a', ink: '#1d1430',
};

const RAMP = ['#6a7cb8', '#8494cc', '#9eaedc', '#b8c6ea', '#cfdaf5', '#e2eafc', '#f2f6ff'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function tone(x, y, v) {
  const f = Math.max(0, Math.min(.999, v)) * (RAMP.length - 1), i = Math.floor(f);
  return (f - i) * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? RAMP[Math.min(i + 1, RAMP.length - 1)] : RAMP[i];
}
function makeCtx(c) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; }
const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

function sky(g, w, h, horizon) {
  const n = C.sky.length, bh = Math.ceil(horizon / n);
  C.sky.forEach((c, i) => R(g, 0, i * bh, w, bh + 1, c));
  // dithered seams between the bands
  for (let i = 1; i < n; i++) for (let x = (i % 2); x < w; x += 2) R(g, x, i * bh - 1, 1, 1, C.sky[i]);
}
function aurora(g, w, y0, t, rand) {
  // two soft ribbons, drawn as stepped columns that wave slowly
  for (let x = 0; x < w; x++) {
    const y = y0 + Math.round(6 * Math.sin(x / 23 + t / 3000) + 3 * Math.sin(x / 9 + t / 1700));
    const len = 8 + Math.round(4 * Math.sin(x / 13 + t / 2500));
    for (let k = 0; k < len; k++) {
      if ((x + k) % 2 && k > len / 2) continue;
      g.globalAlpha = .07 + .2 * (1 - k / len);
      R(g, x, y + k, 1, 1, k < 3 ? C.aur2 : C.aur1);
    }
  }
  g.globalAlpha = 1;
}
function moon(g, x, y, r) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = dx * dx + dy * dy;
    if (d <= r * r) R(g, x + dx, y + dy, 1, 1, C.moon);
    else if (d <= (r + 2) * (r + 2) && (dx + dy) % 2 === 0) { g.globalAlpha = .25; R(g, x + dx, y + dy, 1, 1, C.moon); g.globalAlpha = 1; }
  }
  [[-3, -2, 2], [2, 1, 3], [-1, 4, 1], [4, -4, 1]].forEach(([a, b, s]) => R(g, x + a, y + b, s, s, C.moonD));
}
// a snowy pine: (x, ground y), height h
function pine(g, x, y, h, rand) {
  const fol = h - 2, tier = Math.max(3, Math.ceil(fol / 3));
  R(g, x - 1, y - 2, 2, 2, C.trunk);
  for (let r = 0; r < fol; r++) {
    const tp = r % tier, ti = Math.floor(r / tier), hw = Math.floor((1 + tp * 2 + ti * 2) / 2), yy = y - 2 - fol + r;
    R(g, x - hw, yy, hw * 2 + 1, 1, C.pine);
    R(g, x - hw, yy, 1, 1, C.pineL); R(g, x + hw, yy, 1, 1, C.pineD);
    if (tp === 0 || (tp === 1 && rand() < .5)) R(g, x - hw, yy, Math.max(1, hw + (rand() < .5 ? 1 : 0)), 1, C.snow);
    else if (rand() < .25) R(g, x - hw + Math.floor(rand() * (hw * 2 + 1)), yy, 1, 1, C.snowM);
  }
  R(g, x, y - 2 - fol - 1, 1, 1, C.snowL);
}
// a cabin with a snowy roof, lit windows, a door with a wreath and a chimney. Returns the chimney top for smoke.
function cabin(g, x, y, w, h, rand) {
  R(g, x, y - h, w, h, C.wood);
  for (let k = y - h + 1; k < y; k += 2) R(g, x, k, w, 1, C.woodD);
  R(g, x, y - h, 1, h, C.woodL); R(g, x + w - 1, y - h, 1, h, C.woodD);
  // roof
  const rh = Math.ceil(w / 2.4);
  for (let r = 0; r < rh; r++) { const hw = Math.round((r + 1) * (w / 2 + 2) / rh); R(g, x + w / 2 - hw, y - h - rh + r, hw * 2, 1, r < 2 ? C.snowL : (r % 3 === 0 ? C.snowM : C.snow)); }
  R(g, x - 2, y - h, w + 4, 1, C.snowD);
  for (let i = 0; i < w + 4; i += 3) R(g, x - 2 + i, y - h + 1, 1, 1 + (i % 2), '#d8f0ff');   // icicles
  // chimney
  const cx = x + Math.round(w * .72); R(g, cx, y - h - rh - 2, 3, rh - 1, '#8a3a32'); R(g, cx - 1, y - h - rh - 3, 5, 1, C.snowL);
  // windows
  const wy = y - h + 3;
  for (const wx of [x + 2, x + w - 6]) { R(g, wx - 1, wy - 1, 6, 5, C.woodD); R(g, wx, wy, 4, 3, C.win); R(g, wx + 2, wy, 1, 3, C.woodD); R(g, wx, wy + 1, 4, 1, C.woodD); R(g, wx - 1, wy + 4, 6, 1, C.snow); }
  // door + wreath
  const dx = x + Math.floor(w / 2) - 2; R(g, dx, y - 6, 4, 6, C.door); R(g, dx + 1, y - 5, 2, 2, '#2a8a4a'); R(g, dx + 1, y - 4, 1, 1, C.red);
  return { x: cx + 1, y: y - h - rh - 4 };
}
function snowman(g, x, y) {
  const ball = (cx, cy, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) R(g, cx + dx, cy + dy, 1, 1, dx > r / 3 ? C.snowM : C.snowL); };
  ball(x, y - 4, 4); ball(x, y - 10, 3); ball(x, y - 15, 2);
  R(g, x - 1, y - 16, 1, 1, C.ink); R(g, x + 1, y - 16, 1, 1, C.ink); R(g, x, y - 15, 2, 1, '#ff8a3a');
  R(g, x - 2, y - 13, 5, 1, C.red); R(g, x + 1, y - 12, 1, 2, C.red);   // scarf
  R(g, x - 2, y - 19, 5, 1, C.ink); R(g, x - 1, y - 22, 3, 3, C.ink);    // hat
  R(g, x, y - 10, 1, 1, C.ink); R(g, x, y - 8, 1, 1, C.ink);
  R(g, x - 6, y - 12, 3, 1, C.trunk); R(g, x + 4, y - 12, 3, 1, C.trunk);
}
function lamp(g, x, y) { R(g, x, y - 12, 1, 12, '#2a2440'); R(g, x - 1, y - 14, 3, 2, '#2a2440'); R(g, x - 1, y - 15, 3, 1, C.snowL); return { x, y: y - 12 }; }
function present(g, x, y, c) { R(g, x, y - 4, 5, 4, c); R(g, x + 2, y - 4, 1, 4, C.gold); R(g, x, y - 3, 5, 1, C.gold); R(g, x + 1, y - 5, 1, 1, C.gold); R(g, x + 3, y - 5, 1, 1, C.gold); }

// ---------- the big world (teacher) ----------
function buildWorld() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = makeCtx(c), rand = rng(7);
  sky(g, W, H, 110);
  // far range
  for (let x = 0; x < W; x++) {
    const y = Math.round(84 - 14 * Math.abs(Math.sin(x / 31)) - 8 * Math.abs(Math.sin(x / 13 + 1)) + 2 * Math.sin(x / 5));
    for (let k = y; k < 112; k++) R(g, x, k, 1, 1, (k - y > 14 && (x + k) % 2) || k - y > 22 ? C.farD : C.far);
    const cap = 4 + Math.round(2 * Math.sin(x / 7));
    R(g, x, y, 1, cap, C.farS); if ((x * 7) % 5 === 0) R(g, x, y + cap, 1, 1, C.farS);
  }
  // mid hills
  for (let x = 0; x < W; x++) {
    const y = Math.round(100 - 7 * Math.sin(x / 26 + .6) - 4 * Math.sin(x / 11));
    for (let k = y; k < 112; k++) R(g, x, k, 1, 1, tone(x, k, .5 - (k - y) * .012 + .08 * Math.sin(x / 9)));
    R(g, x, y, 1, 1, RAMP[5]);
  }
  for (let i = 0; i < 26; i++) { const x = Math.floor(rand() * W), y = Math.round(100 - 7 * Math.sin(x / 26 + .6) - 4 * Math.sin(x / 11)) + 3; pine(g, x, y, 7 + Math.floor(rand() * 5), rand); }
  // meadow (village ground)
  for (let y = 108; y < H; y++) for (let x = 0; x < W; x++) {
    // soft drifts lit from the moon (top left); a few sparkles
    const v = .66 + (y - 108) * .0022 - x * .0006 + .07 * Math.sin(x / 17 + y / 9) + .04 * Math.sin(x / 5 - y / 3);
    R(g, x, y, 1, 1, y === 108 ? RAMP[6] : ((x * 31 + y * 17) % 97 === 0 ? '#ffffff' : tone(x, y, v)));
  }
  // a frozen pond
  for (let y = -6; y <= 6; y++) for (let x = -20; x <= 20; x++) if (x * x / 400 + y * y / 36 <= 1) R(g, 58 + x, 150 + y, 1, 1, (x + y * 3) % 11 === 0 ? '#e8f6ff' : y < -3 ? '#7ab0e0' : '#93c4ec');
  for (let x = -14; x <= 8; x += 7) R(g, 58 + x, 148 + (x % 2), 4, 1, '#ffffff');
  // the big mountain: left foot (120,180), summit plateau around (262,42), right foot off-screen
  const top = (x) => x < 246 ? 180 - (x - 120) / .947 : x <= 278 ? 42 + Math.round(Math.abs(x - 262) / 6) : 45 + (x - 278) * 1.1;
  for (let x = 120; x < W; x++) {
    const ty = Math.max(30, Math.round(top(x) + 2 * Math.sin(x / 4) + (x % 7 === 0 ? 1 : 0)));
    const ridge = 262 + (ty - 42) * .15;
    for (let y = ty; y < H; y++) {
      const right = x > 262 + (y - 42) * .12;
      // lit left face, shaded right face, darker towards the foot, gullies
      let v = right ? .36 - (x - ridge) * .002 : .8 - (y - ty) * .0035 + .05 * Math.sin(x / 7 + y / 11);
      v += .05 * Math.sin((x + y * .6) / 5);
      if (y - ty < 2) v = right ? .55 : 1;
      if (!right && y - ty < 5 && x > 150) v -= .05;
      R(g, x, y, 1, 1, (x * 29 + y * 13) % 89 === 0 ? '#ffffff' : tone(x, y, v));
    }
    // the foot of the mountain casts a soft shadow onto the meadow
    if (x < 246) { const fy = Math.round(180 - (x - 120) / .947); for (let k = 1; k < 4; k++) if (fy + k < H && fy > 108) R(g, x - k, fy + k, 1, 1, tone(x - k, fy + k, .5 + k * .05)); }
  }
  // rocks and ridges on the mountain
  for (let i = 0; i < 40; i++) {
    const x = 150 + Math.floor(rand() * 170), ty = top(x); if (!(ty < H)) continue;
    const y = Math.round(Math.max(ty + 4, 50) + rand() * (H - Math.max(ty + 4, 50)));
    const w = 3 + Math.floor(rand() * 6);
    R(g, x, y, w, 2, C.rock); R(g, x + 1, y + 2, w - 2, 1, C.rockD); R(g, x + w - 2, y, 2, 2, C.rockD); R(g, x, y - 1, w - 1, 1, RAMP[6]); R(g, x + 1, y, 1, 1, '#6a74a8');
  }
  // pines on the mountain and around the meadow
  for (let i = 0; i < 46; i++) {
    const x = 130 + Math.floor(rand() * 190), ty = top(x), y = Math.round(ty + 8 + rand() * (H - ty - 10));
    if (y > H - 2 || nearPath(x, y, 9)) continue;
    pine(g, x, y, 8 + Math.floor(rand() * 8), rand);
  }
  // the path, with its edges
  for (const s of SEGS) for (let k = 0; k <= s.l; k += .5) {
    const x = s.ax + (s.bx - s.ax) * k / s.l, y = s.ay + (s.by - s.ay) * k / s.l;
    R(g, x - 3, y - 1, 7, 4, C.pathD);
  }
  for (const s of SEGS) for (let k = 0; k <= s.l; k += .5) {
    const x = s.ax + (s.bx - s.ax) * k / s.l, y = s.ay + (s.by - s.ay) * k / s.l;
    R(g, x - 2, y, 5, 2, C.path); if (Math.round(k) % 5 === 0) R(g, x - 1, y, 1, 1, C.pathL);
  }
  // the village on the meadow's back edge
  const chimneys = [];
  [[10, 112, 22, 12], [44, 110, 18, 10], [94, 113, 24, 13]].forEach(([x, y, w, h]) => chimneys.push(cabin(g, x, y, w, h, rand)));
  for (const x of [36, 68, 74, 122, 6]) pine(g, x, 112, 12 + (x % 5), rand);
  for (const [x, y, h] of [[4, 178, 22], [14, 180, 18], [180, 180, 20], [196, 181, 16], [112, 124, 10], [2, 140, 14], [146, 120, 11]]) pine(g, x, y, h, rand);
  const lamps = [lamp(g, 30, 116), lamp(g, 86, 118), lamp(g, 140, 150)];
  snowman(g, 128, 136);
  // start arch: candy-cane posts with a red banner
  for (const ax of [140, 162]) for (let y = 0; y < 18; y++) R(g, ax, 160 - y, 2, 1, (y >> 1) % 2 ? C.red : C.snowL);
  R(g, 139, 140, 26, 4, C.red); R(g, 139, 140, 26, 1, '#ff7a8a'); R(g, 150, 139, 4, 1, C.gold);
  // the Christmas tree on the summit
  const tx = 262, ty = 42;
  R(g, tx - 2, ty - 3, 4, 3, C.trunk);
  for (let r = 0; r < 34; r++) {
    const tier = Math.floor(r / 9), tp = r % 9, hw = Math.min(15, 1 + Math.floor(tp * .9) + tier * 3), y = ty - 3 - 34 + r;
    R(g, tx - hw, y, hw * 2 + 1, 1, C.pine); R(g, tx - hw, y, 2, 1, C.pineL); R(g, tx + hw - 1, y, 2, 1, C.pineD);
    if (tp === 0) R(g, tx - hw, y, hw + 1, 1, C.snow);
  }
  // garlands
  for (let r = 0; r < 3; r++) for (let k = -8 - r * 3; k <= 8 + r * 3; k++) R(g, tx + k, ty - 30 + r * 10 + Math.round(Math.abs(k) / 4), 1, 1, C.gold);
  present(g, tx - 14, ty, C.red); present(g, tx + 8, ty, '#4a8aff'); present(g, tx - 7, ty + 1, '#3ac85a');
  return { canvas: c, chimneys, lamps, tree: { x: tx, y: ty } };
}
function nearPath(x, y, d) { for (const s of SEGS) { const t = Math.max(0, Math.min(1, ((x - s.ax) * (s.bx - s.ax) + (y - s.ay) * (s.by - s.ay)) / (s.l * s.l))); if (Math.hypot(s.ax + (s.bx - s.ax) * t - x, s.ay + (s.by - s.ay) * t - y) < d) return true; } return false; }

// path lights and tree ornaments, which blink
const LIGHTS = []; for (let d = 4; d < LEN; d += 7) { const p = pathPoint(d / LEN); LIGHTS.push({ x: p.x, y: p.y - 4 }); }
const ORN = [[-3, -30], [4, -27], [-6, -22], [7, -18], [-2, -16], [-9, -10], [3, -9], [10, -6], [-5, -4], [0, -24], [-11, -3], [12, -2]];

function stars(rand, w, h) { return Array.from({ length: Math.round(w * h / 260) }, () => ({ x: Math.floor(rand() * w), y: Math.floor(rand() * h), p: rand() * 10, big: rand() < .12 })); }
function flakes(rand, w, h, n) { return Array.from({ length: n }, () => ({ x: rand() * w, y: rand() * h, v: .15 + rand() * .35, d: rand() * 6, big: rand() < .15 })); }
function drawStars(g, list, t) {
  for (const s of list) {
    const on = Math.sin(t / 600 + s.p) > -.3; if (!on) continue;
    R(g, s.x, s.y, 1, 1, C.star);
    if (s.big && Math.sin(t / 900 + s.p) > .5) { g.globalAlpha = .5; R(g, s.x - 1, s.y, 3, 1, C.star); R(g, s.x, s.y - 1, 1, 3, C.star); g.globalAlpha = 1; }
  }
}
function drawSnow(g, list, w, h) {
  for (const f of list) {
    f.y += f.v; f.d += .04; if (f.y > h) { f.y = -2; f.x = Math.random() * w; }
    const x = Math.round(f.x + Math.sin(f.d) * 1.5);
    R(g, x, f.y, f.big ? 2 : 1, f.big ? 2 : 1, f.big ? '#ffffff' : '#dfe8ff');
  }
}
function smoke(g, chimneys, t) {
  for (const [i, c] of chimneys.entries()) for (let k = 0; k < 5; k++) {
    const age = ((t / 90 + k * 9 + i * 13) % 45), x = c.x + Math.round(Math.sin(age / 6 + i) * 2 + age / 8), y = c.y - age / 2;
    g.globalAlpha = .45 * (1 - age / 45); R(g, x, y, age > 20 ? 3 : 2, age > 20 ? 2 : 2, '#c8d0ea');
  }
  g.globalAlpha = 1;
}
function glow(g, x, y, r, col, a) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy); if (d > r || (dx + dy) % 2) continue;
    g.globalAlpha = a * (1 - d / r); R(g, x + dx, y + dy, 1, 1, col);
  }
  g.globalAlpha = 1;
}

export function world(canvas) {
  canvas.width = W; canvas.height = H;
  const g = makeCtx(canvas), base = buildWorld(), rand = rng(3);
  const st = stars(rand, W, 70), fl = flakes(rand, W, H, 150);
  let last = 0;
  const frame = (t) => {
    requestAnimationFrame(frame);
    if (t - last < 66) return; last = t;
    g.drawImage(base.canvas, 0, 0);
    drawStars(g, st, t);
    aurora(g, W, 14, t);
    moon(g, 42, 24, 9);
    smoke(g, base.chimneys, t);
    for (const l of base.lamps) glow(g, l.x, l.y + 1, 6, '#ffd890', .5);
    LIGHTS.forEach((l, i) => { const c = C.lights[(i + Math.floor(t / 500)) % C.lights.length]; R(g, l.x, l.y, 1, 1, '#2a2440'); R(g, l.x, l.y + 1, 1, 1, c); if ((i + Math.floor(t / 250)) % 3 === 0) glow(g, l.x, l.y + 1, 2, c, .5); });
    const { x: tx, y: ty } = base.tree;
    ORN.forEach(([dx, dy], i) => R(g, tx + dx, ty + dy, 2, 2, C.lights[(i + Math.floor(t / 700)) % C.lights.length]));
    const pulse = .45 + .25 * Math.sin(t / 400);
    glow(g, tx, ty - 40, 9, '#fff2a0', pulse);
    R(g, tx - 1, ty - 44, 3, 7, C.gold); R(g, tx - 3, ty - 42, 7, 3, C.gold); R(g, tx, ty - 41, 1, 1, '#fffbe0');
    drawSnow(g, fl, W, H);
  };
  requestAnimationFrame(frame);
}

// ---------- a phone: a tall snowy night hillside ----------
export function phoneWorld(canvas) {
  const g = makeCtx(canvas);
  let w = 0, h = 0, base = null, st = [], fl = [];
  function build() {
    w = 96; h = Math.max(120, Math.round(w * innerHeight / innerWidth));
    canvas.width = w; canvas.height = h;
    const b = document.createElement('canvas'); b.width = w; b.height = h;
    const q = makeCtx(b), rand = rng(11), hz = Math.round(h * .74);
    sky(q, w, h, hz);
    for (let x = 0; x < w; x++) { const y = Math.round(hz - 6 - 10 * Math.abs(Math.sin(x / 17)) - 3 * Math.sin(x / 6)); R(q, x, y, 1, h - y, C.far); R(q, x, y, 1, 3, C.farS); }
    for (let x = 0; x < w; x++) { const y = Math.round(hz + 4 - 5 * Math.sin(x / 15 + 1)); R(q, x, y, 1, h - y, C.snowM); R(q, x, y, 1, 1, C.snowL); }
    for (let i = 0; i < 9; i++) { const x = Math.floor(rand() * w); pine(q, x, Math.round(hz + 6 - 5 * Math.sin(x / 15 + 1)), 7 + Math.floor(rand() * 5), rand); }
    const gy = h - 14;
    for (let y = gy; y < h; y++) for (let x = 0; x < w; x++) R(q, x, y, 1, 1, y === gy ? C.snowL : (x * 13 + y * 7) % 17 === 0 ? C.snowM : C.snow);
    const ch = cabin(q, 60, gy + 2, 20, 11, rand);
    pine(q, 8, gy + 3, 16, rand); pine(q, 22, gy + 4, 12, rand); pine(q, 88, gy + 3, 14, rand);
    base = { canvas: b, chimneys: [ch] };
    st = stars(rand, w, Math.round(h * .5)); fl = flakes(rand, w, h, Math.round(w * h / 90));
  }
  build(); addEventListener('resize', build);
  let last = 0;
  const frame = (t) => {
    requestAnimationFrame(frame);
    if (t - last < 66) return; last = t;
    g.drawImage(base.canvas, 0, 0);
    drawStars(g, st, t); aurora(g, w, 10, t); moon(g, w - 18, 16, 7); smoke(g, base.chimneys, t); drawSnow(g, fl, w, h);
  };
  requestAnimationFrame(frame);
}
