// Clue Quest: the balloon flight world. One very tall pixel-art picture (320 × 2160, twelve screens) drawn in code
// at start, bottom to top: the snowy Christmas village where everyone takes off, a pine forest with a ski lift,
// snowy peaks with a mountain hut, the cloud sea, the aurora sky (a sleigh flies past) and the starry night with the
// moon, up to the North Star at the very top. A camera shows a 320 × 180 slice of it on the teacher's 16:9 screen
// and glides to wherever it is told; on top of that slice run the animations (snow, twinkling stars, chimney smoke,
// blinking lights, the aurora, the ski-lift chairs, birds, drifting clouds, shooting stars, the star's glow).
// phoneWorld() is a smaller snowy night hillside for behind a phone.

export const W = 320, VH = 180, WH = 2160;
export const GROUND = WH - 20;       // where the heroes stand in the village
export const TOPY = 64;              // the North Star: the top of the flight
export const ZONES = [               // [name, the zone starts above this y]
  ['Snowy Village', WH], ['Pine Forest', 1990], ['Snowy Peaks', 1640], ['Cloud Sea', 1260],
  ['Aurora Sky', 880], ['Starry Night', 470], ['North Star', 150]];
export const zoneAt = (y) => { let z = ZONES[0][0]; for (const [n, top] of ZONES) if (y < top) z = n; return z; };

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const C = {
  star: '#e8f0ff', moon: '#f6f2dc', moonD: '#d6cfae', aur1: '#3ee8a8', aur2: '#38c8e8', aur3: '#a86aff',
  far: '#2a3672', farS: '#8a9ad8', farD: '#222c60',
  snowL: '#ffffff', snowM: '#c6d4f2', snowD: '#9eb0dc',
  rock: '#4a5280', rockD: '#363c64',
  pine: '#17473c', pineL: '#24604c', pineD: '#0f3028', trunk: '#4a2e22',
  wood: '#7a4a2e', woodD: '#5a321e', woodL: '#94603a', win: '#ffd25a', door: '#4a2a1a',
  lights: ['#ff4a5a', '#ffd24a', '#4aee7a', '#5aa8ff', '#ff8ad8'],
  red: '#d83a4a', gold: '#ffd24a', ink: '#1d1430',
};
const SKY = ['#02031a', '#04061f', '#070a26', '#0a0e2e', '#0d1236', '#10173e', '#141c48', '#182252', '#1d295e', '#22306a', '#283876', '#2e4082'];
const RAMP = ['#6a7cb8', '#8494cc', '#9eaedc', '#b8c6ea', '#cfdaf5', '#e2eafc', '#f2f6ff'];
const CLOUD = ['#5a6aa8', '#7484c0', '#91a0d4', '#b2bfe6', '#d4ddf6', '#eef2ff'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (ramp, x, y, v) => { const f = Math.max(0, Math.min(.999, v)) * (ramp.length - 1), i = Math.floor(f); return (f - i) * 16 > BAYER[(y & 3) * 4 + (x & 3)] ? ramp[Math.min(i + 1, ramp.length - 1)] : ramp[i]; };
const tone = (x, y, v) => dith(RAMP, x, y, v);
const sparkle = (x, y) => (((x * 73856093) ^ (y * 19349663)) >>> 0) % 173 === 0;
function makeCtx(c) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; }
const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };

// a fast pixel buffer for the big fills
function buffer(w, h) {
  const img = new ImageData(w, h), u32 = new Uint32Array(img.data.buffer), cache = {};
  const col = (hex) => cache[hex] ??= (() => { const n = parseInt(hex.slice(1), 16); return (255 << 24) | ((n & 255) << 16) | (((n >> 8) & 255) << 8) | (n >> 16); })();
  return { img, set(x, y, hex) { if (x >= 0 && x < w && y >= 0 && y < h) u32[y * w + x] = col(hex); } };
}

function pine(g, x, y, h, rand) {
  const fol = h - 2, tier = Math.max(3, Math.ceil(fol / 3));
  R(g, x - 1, y - 2, 2, 2, C.trunk);
  for (let r = 0; r < fol; r++) {
    const tp = r % tier, ti = Math.floor(r / tier), hw = Math.floor((1 + tp * 2 + ti * 2) / 2), yy = y - 2 - fol + r;
    R(g, x - hw, yy, hw * 2 + 1, 1, C.pine);
    R(g, x - hw, yy, 1, 1, C.pineL); R(g, x + hw, yy, 1, 1, C.pineD);
    if (tp === 0 || (tp === 1 && rand() < .5)) R(g, x - hw, yy, Math.max(1, hw + (rand() < .5 ? 1 : 0)), 1, '#e6eefc');
    else if (rand() < .25) R(g, x - hw + Math.floor(rand() * (hw * 2 + 1)), yy, 1, 1, C.snowM);
  }
  R(g, x, y - 2 - fol - 1, 1, 1, C.snowL);
}
function cabin(g, x, y, w, h) {
  R(g, x, y - h, w, h, C.wood);
  for (let k = y - h + 1; k < y; k += 2) R(g, x, k, w, 1, C.woodD);
  R(g, x, y - h, 1, h, C.woodL); R(g, x + w - 1, y - h, 1, h, C.woodD);
  const rh = Math.ceil(w / 2.4);
  for (let r = 0; r < rh; r++) { const hw = Math.round((r + 1) * (w / 2 + 2) / rh); R(g, x + w / 2 - hw, y - h - rh + r, hw * 2, 1, r < 2 ? C.snowL : (r % 3 === 0 ? C.snowM : '#e6eefc')); }
  R(g, x - 2, y - h, w + 4, 1, C.snowD);
  const cx = x + Math.round(w * .72); R(g, cx, y - h - rh - 2, 3, rh - 1, '#8a3a32'); R(g, cx - 1, y - h - rh - 3, 5, 1, C.snowL);
  const wy = y - h + 3;
  for (const wx of [x + 2, x + w - 6]) { R(g, wx - 1, wy - 1, 6, 5, C.woodD); R(g, wx, wy, 4, 3, C.win); R(g, wx + 2, wy, 1, 3, C.woodD); R(g, wx, wy + 1, 4, 1, C.woodD); R(g, wx - 1, wy + 4, 6, 1, '#e6eefc'); }
  const dx = x + Math.floor(w / 2) - 2; R(g, dx, y - 6, 4, 6, C.door); R(g, dx + 1, y - 5, 2, 2, '#2a8a4a'); R(g, dx + 1, y - 4, 1, 1, C.red);
  return { chimney: { x: cx + 1, y: y - h - rh - 4 }, eave: { x0: x - 2, x1: x + w + 2, y: y - h } };
}
function snowman(g, x, y) {
  const ball = (cx, cy, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) R(g, cx + dx, cy + dy, 1, 1, dx > r / 3 ? C.snowM : C.snowL); };
  ball(x, y - 4, 4); ball(x, y - 10, 3); ball(x, y - 15, 2);
  R(g, x - 1, y - 16, 1, 1, C.ink); R(g, x + 1, y - 16, 1, 1, C.ink); R(g, x, y - 15, 2, 1, '#ff8a3a');
  R(g, x - 2, y - 13, 5, 1, C.red); R(g, x + 1, y - 12, 1, 2, C.red);
  R(g, x - 2, y - 19, 5, 1, C.ink); R(g, x - 1, y - 22, 3, 3, C.ink);
  R(g, x - 6, y - 12, 3, 1, C.trunk); R(g, x + 4, y - 12, 3, 1, C.trunk);
}
function lamp(g, x, y) { R(g, x, y - 12, 1, 12, '#2a2440'); R(g, x - 1, y - 14, 3, 2, '#2a2440'); R(g, x - 1, y - 15, 3, 1, C.snowL); return { x, y: y - 12 }; }
function present(g, x, y, c) { R(g, x, y - 4, 5, 4, c); R(g, x + 2, y - 4, 1, 4, C.gold); R(g, x, y - 3, 5, 1, C.gold); R(g, x + 1, y - 5, 1, 1, C.gold); R(g, x + 3, y - 5, 1, 1, C.gold); }
function moon(g, x, y, r) {
  for (let dy = -r - 3; dy <= r + 3; dy++) for (let dx = -r - 3; dx <= r + 3; dx++) {
    const d = dx * dx + dy * dy;
    if (d <= r * r) R(g, x + dx, y + dy, 1, 1, dx + dy > r * .8 ? C.moonD : C.moon);
    else if (d <= (r + 3) * (r + 3) && (dx + dy) % 2 === 0) { g.globalAlpha = .18; R(g, x + dx, y + dy, 1, 1, C.moon); g.globalAlpha = 1; }
  }
  [[-6, -4, 4], [4, 2, 5], [-2, 8, 3], [8, -8, 2], [-9, 4, 2]].forEach(([a, b, s]) => R(g, x + a, y + b, s, s, C.moonD));
}
function cloud(b, cx, cy, w, h, rand) {
  // a puffy moonlit cloud: a row of round bumps, tallest in the middle, flat underneath; bright on top, blue below
  const n = Math.max(4, Math.round(w / 8));
  const bumps = Array.from({ length: n }, (_, i) => { const f = i / (n - 1), m = Math.sin(f * Math.PI); return { x: cx - w / 2 + f * w, y: cy - m * h * .45 + (rand() - .5) * h * .25, r: h * (.32 + m * .5 + rand() * .15) }; });
  const flat = cy + h * .3, topY = cy - h * 1.4;
  for (let y = Math.floor(topY); y <= flat; y++) for (let x = Math.floor(cx - w / 2 - h); x <= cx + w / 2 + h; x++) {
    let inside = false, rim = 1;
    for (const q of bumps) { const d = Math.hypot(x - q.x, y - q.y); if (d <= q.r) { inside = true; rim = Math.min(rim, (y - (q.y - q.r)) / (q.r * 2)); } }
    if (!inside) continue;
    const v = 1.02 - Math.max(0, Math.min(1, (y - topY) / (flat - topY))) * .75 - rim * .12;
    b.set(x, y, y >= flat - 1 ? CLOUD[1] : dith(CLOUD, x, y, v));
  }
}

function buildWorld() {
  const c = document.createElement('canvas'); c.width = W; c.height = WH;
  const g = makeCtx(c), rand = rng(7), b = buffer(W, WH);
  // the sky: deep space at the top fading to the night-blue horizon at the village
  for (let y = 0; y < WH; y++) { const v = Math.pow(y / WH, 1.35); for (let x = 0; x < W; x++) b.set(x, y, dith(SKY, x, y, v)); }
  // a faint milky way across the top
  for (let y = 0; y < 560; y++) for (let x = 0; x < W; x++) {
    const d = Math.abs((y - 120) - (x - 160) * .9 + 40 * Math.sin(x / 60));
    if (d < 70 && rand() < (1 - d / 70) * .22) b.set(x, y, rand() < .5 ? '#232a64' : '#1a2058');
  }
  // stars: more of them the higher you go
  for (let y = 0; y < WH - 300; y++) { const p = .02 * Math.pow(1 - y / WH, 2.2) + .002; for (let x = 0; x < W; x++) if (rand() < p) b.set(x, y, rand() < .3 ? '#9aa8e8' : rand() < .5 ? '#c8d4ff' : '#ffffff'); }
  // far mountain range behind the village
  for (let x = 0; x < W; x++) {
    const y = Math.round(WH - 96 - 18 * Math.abs(Math.sin(x / 31)) - 9 * Math.abs(Math.sin(x / 13 + 1)) + 2 * Math.sin(x / 5));
    for (let k = y; k < WH; k++) b.set(x, k, (k - y > 14 && (x + k) % 2) || k - y > 22 ? C.farD : C.far);
    const cap = 4 + Math.round(2 * Math.sin(x / 7)); for (let k = 0; k < cap; k++) b.set(x, y + k, C.farS);
  }
  // the big mountains, rising from the forest to the snowy peaks
  const peaks = [[60, 1700, 1.25], [170, 1440, 1.1], [286, 1560, 1.2], [118, 1590, 1.4], [232, 1520, 1.3]];
  const mtop = (x) => Math.min(...peaks.map(([px, py, s]) => py + Math.abs(x - px) * s + 6 * Math.sin(x / 5 + px)));
  for (let x = 0; x < W; x++) {
    const ty = Math.round(mtop(x)), right = mtop(x + 2) > mtop(x - 2);   // a slope going down to the right faces away from the moon
    for (let y = ty; y < WH - 70; y++) {
      // near the ridge: lit or shaded face; further down it melts into a soft snowfield with gentle drifts
      const face = right ? .4 : .84, field = .64 + .07 * Math.sin(x / 23 + y / 37) + .05 * Math.sin(x / 9 - y / 17);
      const k = Math.min(1, (y - ty) / 60);
      let v = face * (1 - k) + field * k - Math.max(0, (y - 1900) * .0012);
      if (y - ty < 2) v = right ? .6 : 1;
      b.set(x, y, sparkle(x, y) ? '#ffffff' : tone(x, y, v));
    }
  }
  // the cloud sea
  for (let i = 0; i < 22; i++) cloud(b, rand() * W, 1300 + rand() * 90 - (i % 3) * 34, 50 + rand() * 70, 16 + rand() * 12, rand);
  for (let i = 0; i < 9; i++) cloud(b, rand() * W, 1110 + rand() * 120, 30 + rand() * 40, 9 + rand() * 7, rand);
  // the meadow at the bottom
  for (let y = WH - 72; y < WH; y++) for (let x = 0; x < W; x++) {
    const v = .66 + (y - WH + 72) * .0022 - x * .0004 + .07 * Math.sin(x / 17 + y / 9) + .04 * Math.sin(x / 5 - y / 3);
    b.set(x, y, y === WH - 72 ? RAMP[6] : (sparkle(x, y) ? '#ffffff' : tone(x, y, v)));
  }
  for (let y = -6; y <= 6; y++) for (let x = -22; x <= 22; x++) if (x * x / 484 + y * y / 36 <= 1) b.set(64 + x, WH - 30 + y, (x + y * 3) % 11 === 0 ? '#e8f6ff' : y < -3 ? '#7ab0e0' : '#93c4ec');
  g.putImageData(b.img, 0, 0);

  // rocks on the mountains
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(rand() * W), ty = mtop(x), y = Math.round(ty + 6 + rand() * 260);
    if (y > WH - 90) continue;
    const w = 3 + Math.floor(rand() * 6);
    R(g, x, y, w, 2, C.rock); R(g, x + 1, y + 2, w - 2, 1, C.rockD); R(g, x + w - 2, y, 2, 2, C.rockD); R(g, x, y - 1, w - 1, 1, RAMP[6]);
  }
  // the pine forest on the lower slopes
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(rand() * W), ty = mtop(x), y = Math.round(Math.max(ty + 20, 1700) + rand() * 330);
    if (y > WH - 76 || y < ty + 8) continue;
    pine(g, x, y, 7 + Math.floor(rand() * 9) + Math.round((y - 1700) / 60), rand);
  }
  // the mountain hut on the snowy peak, with a flag
  const hut = cabin(g, 160, 1452, 16, 8);
  R(g, 182, 1430, 1, 22, '#2a2440'); R(g, 183, 1430, 7, 4, C.red); R(g, 183, 1432, 7, 1, '#ff7a8a');
  // the ski lift: towers along a line from the village up the forest
  const LIFT = { x0: 14, y0: WH - 80, x1: 250, y1: 1660 };
  for (let k = 0; k <= 5; k++) {
    const t = k / 5, x = LIFT.x0 + (LIFT.x1 - LIFT.x0) * t, y = LIFT.y0 + (LIFT.y1 - LIFT.y0) * t;
    R(g, x, y, 2, 16, '#3a3450'); R(g, x - 3, y, 8, 1, '#3a3450'); R(g, x - 3, y - 1, 8, 1, C.snowL);
  }
  for (let k = 0; k <= 400; k++) { const t = k / 400; R(g, LIFT.x0 + (LIFT.x1 - LIFT.x0) * t, LIFT.y0 + (LIFT.y1 - LIFT.y0) * t, 1, 1, '#2a2440'); }

  // the village
  const gy = WH - 72, chimneys = [hut.chimney], eaves = [];
  for (const [x, w, h] of [[8, 22, 12], [40, 18, 10], [96, 24, 13], [262, 20, 11]]) { const cb = cabin(g, x, gy + 4, w, h); chimneys.push(cb.chimney); eaves.push(cb.eave); }
  for (const x of [34, 66, 74, 126, 150, 300, 312]) pine(g, x, gy + 4, 12 + (x % 5), rand);
  for (const [x, y, h] of [[4, WH, 22], [14, WH + 2, 18], [316, WH, 20], [300, WH + 2, 16]]) pine(g, x, y, h, rand);
  const lamps = [lamp(g, 30, gy + 8), lamp(g, 88, gy + 10), lamp(g, 180, gy + 12), lamp(g, 250, gy + 10)];
  snowman(g, 120, WH - 26);
  // the big village Christmas tree, where the flight starts
  const tx = 214, ty = WH - 24;
  R(g, tx - 2, ty - 3, 4, 3, C.trunk);
  for (let r = 0; r < 44; r++) {
    const tier = Math.floor(r / 11), tp = r % 11, hw = Math.min(19, 1 + Math.floor(tp * .9) + tier * 4), y = ty - 3 - 44 + r;
    R(g, tx - hw, y, hw * 2 + 1, 1, C.pine); R(g, tx - hw, y, 2, 1, C.pineL); R(g, tx + hw - 1, y, 2, 1, C.pineD);
    if (tp === 0) R(g, tx - hw, y, hw + 1, 1, '#e6eefc');
  }
  for (let r = 0; r < 4; r++) for (let k = -6 - r * 4; k <= 6 + r * 4; k++) R(g, tx + k, ty - 40 + r * 10 + Math.round(Math.abs(k) / 4), 1, 1, C.gold);
  present(g, tx - 18, ty, C.red); present(g, tx + 12, ty, '#4a8aff'); present(g, tx - 9, ty + 1, '#3ac85a'); present(g, tx + 4, ty + 2, '#ff8ad8');
  // the moon
  moon(g, 250, 330, 20);
  // a ringed planet far up
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) if (dx * dx + dy * dy <= 49) R(g, 52 + dx, 200 + dy, 1, 1, dx + dy > 3 ? '#a85a8a' : '#e08ab8');
  for (let k = -13; k <= 13; k++) R(g, 52 + k, 200 + Math.round(k * .25), 1, 1, '#ffd8a8');
  // the aurora's faint glow on the sky behind the moving ribbons
  for (let y = 700; y < 900; y++) for (let x = 0; x < W; x++) if ((x + y) % 3 === 0 && Math.sin(x / 40 + y / 30) > .6) { g.globalAlpha = .07; R(g, x, y, 1, 1, C.aur1); }
  g.globalAlpha = 1;
  return { canvas: c, chimneys, lamps, eaves, tree: { x: tx, y: ty }, lift: LIFT };
}

// ---------- the moving bits ----------
const ORN = [[-4, -38], [5, -34], [-8, -28], [9, -24], [-2, -20], [-12, -14], [4, -12], [13, -8], [-7, -6], [0, -30], [-15, -3], [15, -2], [7, -40], [-10, -36]];
function glow(g, x, y, r, col, a) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const d = Math.sqrt(dx * dx + dy * dy); if (d > r || (dx + dy) % 2) continue;
    g.globalAlpha = a * (1 - d / r); R(g, x + dx, y + dy, 1, 1, col);
  }
  g.globalAlpha = 1;
}
function ribbon(g, y0, t, cy, hue, k) {
  for (let x = 0; x < W; x++) {
    const y = y0 + Math.round(10 * Math.sin(x / 31 + t / 2600 + k) + 5 * Math.sin(x / 11 + t / 1500 + k * 2)) - cy;
    if (y < -40 || y > VH) continue;
    const len = 18 + Math.round(8 * Math.sin(x / 17 + t / 2000 + k));
    for (let j = 0; j < len; j++) {
      if ((x + j) % 2 && j > len / 3) continue;
      g.globalAlpha = .06 + .26 * (1 - j / len);
      R(g, x, y + j, 1, 1, j < 3 ? '#c8fff0' : hue);
    }
  }
  g.globalAlpha = 1;
}
function sleigh(g, x, y) {
  // a little sleigh silhouette with two reindeer, against the aurora
  const map = ['k.k....k.k...........', '.k......k............', 'kkkk...kkkk...rrrrrr.', '.kkkk...kkkk..rrryrr.', '.k..k...k..k.rrrrrrrr', '...............kkkkkk.'];
  map.forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch !== '.') R(g, x + xx, y + yy, 1, 1, ch === 'k' ? '#1a1430' : ch === 'y' ? C.gold : '#c83040'); }));
  for (let k = 0; k < 6; k++) R(g, x - 3 - k * 3, y + 2 + (k % 2), 1, 1, '#fff2a0');
}
function bird(g, x, y, f) {   // a little owl-like bird, two wing frames
  R(g, x, y, 2, 2, '#e8ecff');
  if (f) { R(g, x - 2, y - 1, 2, 1, '#e8ecff'); R(g, x + 2, y - 1, 2, 1, '#e8ecff'); }
  else { R(g, x - 2, y + 1, 2, 1, '#e8ecff'); R(g, x + 2, y + 1, 2, 1, '#e8ecff'); }
}

export const _buildWorld = () => buildWorld();   // for the check page

export function world(canvas) {
  canvas.width = W; canvas.height = VH;
  const g = makeCtx(canvas), base = buildWorld(), rand = rng(3);
  const bright = Array.from({ length: 260 }, () => ({ x: Math.floor(rand() * W), y: Math.floor(Math.pow(rand(), 1.6) * (WH - 400)), p: rand() * 10 }));
  const flakes = Array.from({ length: 140 }, () => ({ x: rand() * W, y: rand() * VH, v: .15 + rand() * .35, d: rand() * 6, big: rand() < .15 }));
  const drift = Array.from({ length: 6 }, (_, i) => ({ x: rand() * W, y: 1060 + i * 45, w: 14 + rand() * 18, v: .08 + rand() * .12 }));
  const birds = Array.from({ length: 4 }, (_, i) => ({ x: rand() * W, y: 1500 + i * 90, v: .3 + rand() * .3 }));
  let camY = WH - VH, target = camY, last = 0, shoot = null, onFrame = null;
  const frame = (t) => {
    requestAnimationFrame(frame);
    if (t - last < 50) return; last = t;
    camY += (target - camY) * .08; if (Math.abs(target - camY) < .5) camY = target;
    const cy = Math.round(camY);
    g.drawImage(base.canvas, 0, cy, W, VH, 0, 0, W, VH);
    const vis = (y, m = 20) => y > cy - m && y < cy + VH + m;
    for (const s of bright) if (vis(s.y, 0) && Math.sin(t / 500 + s.p) > .3) { R(g, s.x, s.y - cy, 1, 1, '#ffffff'); if (Math.sin(t / 700 + s.p) > .85) { g.globalAlpha = .55; R(g, s.x - 1, s.y - cy, 3, 1, '#ffffff'); R(g, s.x, s.y - cy - 1, 1, 3, '#ffffff'); g.globalAlpha = 1; } }
    // aurora ribbons
    if (vis(800, 140)) { ribbon(g, 720, t, cy, C.aur1, 0); ribbon(g, 790, t, cy, C.aur2, 2); ribbon(g, 850, t, cy, C.aur3, 4); }
    // the sleigh crosses the aurora sky every 24 s
    const sx = ((t / 40) % 960) - 120; if (vis(760, 30) && sx < W + 30) sleigh(g, sx, 760 - cy + Math.round(Math.sin(t / 600) * 3));
    // a shooting star now and then, high up
    if (cy < 700) {
      if (!shoot && Math.random() < .015) shoot = { x: Math.random() * W, y: cy + Math.random() * 60, a: 0 };
      if (shoot) { shoot.a++; for (let k = 0; k < 10; k++) { g.globalAlpha = 1 - k / 10; R(g, shoot.x + shoot.a * 4 - k * 2, shoot.y - cy + shoot.a * 2 - k, 1, 1, '#ffffff'); } g.globalAlpha = 1; if (shoot.a > 22) shoot = null; }
    }
    // the North Star
    if (vis(TOPY, 60)) {
      const pulse = .5 + .3 * Math.sin(t / 380), y = TOPY - cy;
      glow(g, 160, y, 26, '#fff4b0', pulse * .7);
      const len = 12 + Math.round(4 * Math.sin(t / 300));
      R(g, 160 - len, y, len * 2 + 1, 1, '#fff6c8'); R(g, 160, y - len, 1, len * 2 + 1, '#fff6c8');
      R(g, 156, y - 3, 9, 7, C.gold); R(g, 158, y - 5, 5, 11, C.gold); R(g, 158, y - 1, 5, 3, '#fffbe0');
    }
    // drifting clouds
    for (const d of drift) { d.x += d.v; if (d.x > W + 30) d.x = -40; if (vis(d.y)) { R(g, d.x, d.y - cy, d.w, 3, '#d4ddf6'); R(g, d.x + 3, d.y - cy - 2, d.w * .5, 2, '#eef2ff'); R(g, d.x + 1, d.y - cy + 3, d.w - 2, 1, '#91a0d4'); } }
    // birds over the forest and the peaks
    for (const bd of birds) { bd.x += bd.v; if (bd.x > W + 6) bd.x = -6; if (vis(bd.y)) bird(g, bd.x, bd.y - cy + Math.round(Math.sin(t / 300 + bd.y) * 2), (t / 160 | 0) % 2); }
    // ski-lift chairs
    const L = base.lift;
    for (let k = 0; k < 8; k++) {
      const f = ((t / 26000) + k / 8) % 1, x = L.x0 + (L.x1 - L.x0) * f, y = L.y0 + (L.y1 - L.y0) * f;
      if (vis(y)) { R(g, x, y - cy, 1, 4, '#2a2440'); R(g, x - 2, y - cy + 4, 5, 2, k % 2 ? C.red : '#4a8aff'); }
    }
    // the village: chimney smoke, lamps, string lights on the eaves, the tree
    for (const [i, ch] of base.chimneys.entries()) if (vis(ch.y, 30)) for (let k = 0; k < 5; k++) {
      const age = ((t / 90 + k * 9 + i * 13) % 45), x = ch.x + Math.round(Math.sin(age / 6 + i) * 2 + age / 8), y = ch.y - age / 2 - cy;
      g.globalAlpha = .45 * (1 - age / 45); R(g, x, y, age > 20 ? 3 : 2, 2, '#c8d0ea');
    }
    g.globalAlpha = 1;
    if (vis(WH - 80, 80)) {
      for (const l of base.lamps) glow(g, l.x, l.y + 1 - cy, 7, '#ffd890', .55);
      for (const [i, e] of base.eaves.entries()) for (let x = e.x0; x < e.x1; x += 3) R(g, x, e.y - cy + 1, 1, 1, C.lights[((x >> 1) + i + (t / 450 | 0)) % C.lights.length]);
      const { x: tx, y: ty } = base.tree;
      ORN.forEach(([dx, dy], i) => R(g, tx + dx, ty + dy - cy, 2, 2, C.lights[(i + (t / 600 | 0)) % C.lights.length]));
      const p = .45 + .25 * Math.sin(t / 400);
      glow(g, tx, ty - 50 - cy, 8, '#fff2a0', p);
      R(g, tx - 1, ty - 54 - cy, 3, 7, C.gold); R(g, tx - 3, ty - 52 - cy, 7, 3, C.gold);
    }
    // falling snow, thinning out above the clouds
    const snowy = Math.max(0, Math.min(1, (cy - 900) / 500));
    for (const [i, f] of flakes.entries()) {
      f.y += f.v; f.d += .04; if (f.y > VH) { f.y = -2; f.x = Math.random() * W; }
      if (i / flakes.length > snowy) continue;
      R(g, Math.round(f.x + Math.sin(f.d) * 1.5), f.y, f.big ? 2 : 1, f.big ? 2 : 1, f.big ? '#ffffff' : '#dfe8ff');
    }
    if (onFrame) onFrame(camY, t);
  };
  requestAnimationFrame(frame);
  return {
    get y() { return camY; },
    look(y, now) { target = Math.max(0, Math.min(WH - VH, Math.round(y))); if (now) camY = target; },
    onFrame(fn) { onFrame = fn; },
  };
}

// ---------- a phone: a tall snowy night hillside ----------
function sky(g, w, h, horizon) {
  const n = 8, cols = SKY.slice(2, 10), bh = Math.ceil(horizon / n);
  cols.forEach((c, i) => R(g, 0, i * bh, w, bh + 1, c));
  for (let i = 1; i < n; i++) for (let x = (i % 2); x < w; x += 2) R(g, x, i * bh - 1, 1, 1, cols[i]);
}
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
    for (let y = gy; y < h; y++) for (let x = 0; x < w; x++) R(q, x, y, 1, 1, y === gy ? C.snowL : (x * 13 + y * 7) % 17 === 0 ? C.snowM : '#e6eefc');
    const cb = cabin(q, 60, gy + 2, 20, 11);
    pine(q, 8, gy + 3, 16, rand); pine(q, 22, gy + 4, 12, rand); pine(q, 88, gy + 3, 14, rand);
    moon(q, w - 18, 16, 7);
    base = { canvas: b, chimney: cb.chimney };
    st = Array.from({ length: Math.round(w * h / 300) }, () => ({ x: Math.floor(rand() * w), y: Math.floor(rand() * h * .55), p: rand() * 10 }));
    fl = Array.from({ length: Math.round(w * h / 90) }, () => ({ x: rand() * w, y: rand() * h, v: .15 + rand() * .3, d: rand() * 6, big: rand() < .1 }));
  }
  build(); addEventListener('resize', build);
  let last = 0;
  const frame = (t) => {
    requestAnimationFrame(frame);
    if (t - last < 66) return; last = t;
    g.drawImage(base.canvas, 0, 0);
    for (const s of st) if (Math.sin(t / 600 + s.p) > -.3) R(g, s.x, s.y, 1, 1, C.star);
    ribbon(g, 6, t, 0, C.aur1, 1);
    for (let k = 0; k < 5; k++) { const age = ((t / 90 + k * 9) % 45); g.globalAlpha = .45 * (1 - age / 45); R(g, base.chimney.x + Math.round(age / 8), base.chimney.y - age / 2, 2, 2, '#c8d0ea'); }
    g.globalAlpha = 1;
    for (const f of fl) { f.y += f.v; f.d += .04; if (f.y > h) { f.y = -2; f.x = Math.random() * w; } R(g, Math.round(f.x + Math.sin(f.d) * 1.5), f.y, f.big ? 2 : 1, f.big ? 2 : 1, f.big ? '#ffffff' : '#dfe8ff'); }
  };
  requestAnimationFrame(frame);
}
