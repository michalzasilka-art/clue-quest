// Clue Quest: the balloon flight world, drawn as pixel art: a small canvas shown big with crisp pixels. World units:
// 320 wide, 2160 tall; the teacher's 16:9 screen shows a 320 × 180 window of it, and a camera glides up and down.
// Bottom to top: a snowy Christmas village at twilight (hills, mountains, pines, lit cabins, the big tree) → the
// low sky with drifting clouds, birds and hot-air balloons → the cloud sea → the high blue sky with a plane →
// the aurora with a sleigh passing → the starry night with the moon → the North Star at the very top.
// Everything moves softly: clouds drift at different speeds, birds flap, balloons bob, smoke curls, lights twinkle,
// snow falls near the ground, stars twinkle and shoot, the aurora waves.
// phoneWorld() draws the same village and sky behind a phone. Over the painted map, ambient.js adds the living sky.

// The map: one painted picture 640 × 4834 px (five ChatGPT sky pictures and the snowy forest clearing, cross-faded;
// built by Clue Quest/Backgrounds/compose_map.py), loaded in seven slices art/map-0…6.webp, 2 px per world unit.
// 0 m at the forest floor up to 1500 m at the North Star.
import { createAmbient } from './ambient.js?v=11';
export const W = 320, VH = 180, WH = 2417;
const MAP = { slices: 7, slicePx: 800, heightPx: 4834, pxPerUnit: 2 };
const O = WH - 2160;                 // the drawn fallback sky was laid out for a 2160-tall world
export const GROUND = WH - 20;       // where the heroes stand in the village
export const TOPY = 56;              // the North Star in the painted sky: the top of the flight (1500 m)
export const ZONES = [               // [name, the zone starts above this y]
  ['Snowy Forest', WH], ['Treetops', 2203], ['Snowy Peaks', 1800], ['Cloud Sea', 1350], ['Aurora Sky', 900], ['Starry Night', 450], ['North Star', 130]];
export const zoneAt = (y) => { let z = ZONES[0][0]; for (const [n, top] of ZONES) if (y < top) z = n; return z; };
let GTOP = WH - 370;                 // the ground picture covers y GTOP … WH (the painted forest: WH − 213)

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a, b, f) => a + (b - a) * f;
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const SKY = [[0, '#04050f'], [430, '#0d1240'], [760, '#1b2873'], [1080, '#2f4aa8'], [1420, '#5577d4'], [1780, '#86a6ec'], [2000, '#b9c8f4'], [2160, '#f6c9d6']].map(([y, c]) => [y ? y + O : 0, c]);
function mix(a, b, f) { const p = (c) => c.match(/\d+/g).map(Number), x = p(a), y = p(b); return `rgb(${x.map((v, k) => Math.round(lerp(v, y[k], f))).join(',')})`; }
function skyAt(y) {
  for (let i = 1; i < SKY.length; i++) if (y <= SKY[i][0]) {
    const [y0, c0] = SKY[i - 1], [y1, c1] = SKY[i], f = Math.max(0, (y - y0) / (y1 - y0)), a = hex(c0), b = hex(c1);
    return `rgb(${a.map((v, k) => Math.round(lerp(v, b[k], f))).join(',')})`;
  }
  const [r, g, b] = hex(SKY[SKY.length - 1][1]); return `rgb(${r},${g},${b})`;
}

// ---------- pictures drawn once ----------
function puff(g, x, y, r, top = '#ffffff', bottom = '#c9d6f4') {
  const gr = g.createLinearGradient(0, y - r, 0, y + r); gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}
// a soft cloud sprite; night = moonlit blue
function cloudSprite(rand, w, night) {
  // one soft shape (all the puffs in one path, one gradient: no seams), a little blurred
  const s = 4, hgt = w * .62, c = document.createElement('canvas'); c.width = w * s; c.height = hgt * s;
  const g = c.getContext('2d'); g.scale(s, s);
  const n = 5 + Math.floor(rand() * 4), base = hgt * .62;
  const gr = g.createLinearGradient(0, base - w * .32, 0, base + w * .1);
  gr.addColorStop(0, night ? '#e8edff' : '#ffffff'); gr.addColorStop(.6, night ? '#b4c0ec' : '#eef2fd'); gr.addColorStop(1, night ? '#7f8fcf' : '#c5d2f2');
  g.filter = 'blur(.5px)'; g.fillStyle = gr; g.beginPath();
  for (let i = 0; i < n; i++) {
    const f = (i + .5) / n, r = w * (.11 + .14 * Math.sin(f * Math.PI)) * (.85 + rand() * .3);
    const x = w * (.12 + .76 * f), y = Math.min(base - r * .2, base - Math.sin(f * Math.PI) * w * .1 + rand() * 3);
    g.moveTo(x + r, y); g.arc(x, y, r, 0, Math.PI * 2);
  }
  g.rect(w * .12, base - w * .06, w * .76, w * .08);
  g.fill('nonzero');
  return c;
}
function pineTree(g, x, y, h, dark = '#1f5a48') {
  const w = h * .5;
  for (let k = 0; k < 3; k++) {
    const ty = y - h + k * h * .27, tw = w * (.55 + k * .25), th = h * .42;
    const gr = g.createLinearGradient(x - tw, 0, x + tw, 0); gr.addColorStop(0, '#2f7a5e'); gr.addColorStop(1, dark);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, ty); g.lineTo(x + tw, ty + th); g.lineTo(x - tw, ty + th); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.92)'; g.beginPath(); g.moveTo(x, ty); g.lineTo(x + tw * .45, ty + th * .45); g.quadraticCurveTo(x, ty + th * .3, x - tw * .5, ty + th * .5); g.closePath(); g.fill();
  }
  g.fillStyle = '#5a3a2a'; g.fillRect(x - h * .04, y - h * .06, h * .08, h * .08);
}
function cabin(g, x, y, w, h) {
  const gr = g.createLinearGradient(0, y - h, 0, y); gr.addColorStop(0, '#9a6040'); gr.addColorStop(1, '#6a3c26');
  g.fillStyle = gr; g.fillRect(x, y - h, w, h);
  g.strokeStyle = 'rgba(60,30,15,.35)'; g.lineWidth = .4; for (let k = y - h + 2; k < y; k += 2.2) { g.beginPath(); g.moveTo(x, k); g.lineTo(x + w, k); g.stroke(); }
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(x - 3, y - h + 1); g.lineTo(x + w / 2, y - h - w * .42); g.lineTo(x + w + 3, y - h + 1); g.quadraticCurveTo(x + w / 2, y - h + 3, x - 3, y - h + 1); g.fill();
  g.fillStyle = '#d6e0fa'; g.beginPath(); g.moveTo(x + w / 2, y - h - w * .42); g.lineTo(x + w + 3, y - h + 1); g.lineTo(x + w / 2, y - h); g.fill();
  g.fillStyle = '#7a3a32'; g.fillRect(x + w * .68, y - h - w * .36, 3, w * .2); g.fillStyle = '#fff'; g.fillRect(x + w * .68 - .6, y - h - w * .37, 4.2, 1.4);
  for (const wx of [x + w * .16, x + w * .66]) {
    const gl = g.createRadialGradient(wx + 2, y - h * .55, 0, wx + 2, y - h * .55, 8); gl.addColorStop(0, 'rgba(255,210,110,.55)'); gl.addColorStop(1, 'rgba(255,210,110,0)');
    g.fillStyle = gl; g.fillRect(wx - 7, y - h * .55 - 8, 18, 16);
    g.fillStyle = '#ffd774'; g.fillRect(wx, y - h * .7, 4.4, 3.6); g.fillStyle = '#6a3c26'; g.fillRect(wx + 2, y - h * .7, .6, 3.6);
  }
  g.fillStyle = '#3e2416'; g.fillRect(x + w / 2 - 2, y - 6, 4, 6);
  g.strokeStyle = '#2e8a4a'; g.lineWidth = .9; g.beginPath(); g.arc(x + w / 2, y - 4.4, 1.2, 0, 7); g.stroke();
  return { chimney: { x: x + w * .68 + 1.5, y: y - h - w * .37 }, eave: { x0: x - 3, x1: x + w + 3, y: y - h + 1 } };
}
function buildGround(s) {
  const H = WH - GTOP, c = document.createElement('canvas'); c.width = Math.round(W * s); c.height = Math.round(H * s);
  const g = c.getContext('2d'); g.scale(s, s); g.translate(0, -GTOP);
  const rand = rng(5);
  // far mountains, soft lavender, with snow caps
  const ridge = (base, amp, seed, col, cap) => {
    const r = rng(seed); const pts = []; for (let x = -10; x <= W + 10; x += 22) pts.push([x, base - amp * (.4 + r() * .6)]);
    const mg = g.createLinearGradient(0, base - amp, 0, base + 40); mg.addColorStop(0, col[0]); mg.addColorStop(1, col[1]);
    g.fillStyle = mg; g.beginPath(); g.moveTo(-10, WH);
    pts.forEach(([x, y], i) => { if (!i) g.lineTo(x, y); else { const [px, py] = pts[i - 1]; g.quadraticCurveTo(px + 11, Math.min(py, y) - amp * .15, x, y); } });
    g.lineTo(W + 10, WH); g.fill();
    if (cap) { g.fillStyle = cap; pts.forEach(([x, y], i) => { if (i && i < pts.length - 1 && y < base - amp * .6) { const top = Math.min(pts[i - 1][1], y) - amp * .15 * .5; g.beginPath(); g.moveTo(x - 9, y + 4); g.quadraticCurveTo(x - 4, top - 1, x, y - 1); g.quadraticCurveTo(x + 4, top, x + 9, y + 5); g.quadraticCurveTo(x + 3, y + 1, x, y + 4); g.quadraticCurveTo(x - 4, y + 1, x - 9, y + 4); g.fill(); } }); }
  };
  ridge(WH - 100, 36, 3, ['#c6c2ea', '#a3a8dc'], 'rgba(255,255,255,.9)');
  ridge(WH - 90, 22, 9, ['#a4a9e0', '#8890cc'], 'rgba(250,250,255,.85)');
  const hill = (base, amp, k, ph, top, bot) => {
    const gr = g.createLinearGradient(0, base - amp, 0, WH); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, WH);
    for (let x = 0; x <= W; x += 4) g.lineTo(x, base - amp * (.5 + .5 * Math.sin(x / k + ph)));
    g.lineTo(W, WH); g.fill();
  };
  hill(WH - 88, 26, 38, .4, '#e6ecff', '#b9c6ee');
  for (let i = 0; i < 22; i++) { const x = rand() * W; pineTree(g, x, WH - 80 - 13 * (.5 + .5 * Math.sin(x / 38 + .4)) + 6, 10 + rand() * 9, '#1c4f42'); }
  hill(WH - 62, 18, 27, 2.1, '#f4f7ff', '#cdd8f6');
  for (let i = 0; i < 12; i++) { const x = rand() * W; pineTree(g, x, WH - 60 - 9 * (.5 + .5 * Math.sin(x / 27 + 2.1)) + 6, 14 + rand() * 10); }
  const gr = g.createLinearGradient(0, WH - 46, 0, WH); gr.addColorStop(0, '#f6f8ff'); gr.addColorStop(1, '#dce4fb');
  g.fillStyle = gr; g.fillRect(0, WH - 46, W, 46);
  const chimneys = [], eaves = [];
  for (const [x, w, h] of [[10, 24, 13], [44, 19, 11], [92, 26, 14], [262, 22, 12], [292, 18, 10]]) { const cb = cabin(g, x, WH - 40, w, h); chimneys.push(cb.chimney); eaves.push(cb.eave); }
  for (const x of [38, 70, 124, 150, 286]) pineTree(g, x, WH - 38, 18 + (x % 7));
  const pg = g.createLinearGradient(0, WH - 26, 0, WH - 14); pg.addColorStop(0, '#9fd2f6'); pg.addColorStop(1, '#6fb0e6');
  g.fillStyle = pg; g.beginPath(); g.ellipse(70, WH - 20, 26, 6, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = .6; g.beginPath(); g.moveTo(54, WH - 21); g.lineTo(66, WH - 23); g.moveTo(74, WH - 18); g.lineTo(86, WH - 20); g.stroke();
  [[124, WH - 18, 5], [124, WH - 26, 4], [124, WH - 32.5, 3]].forEach(([x, y, r]) => puff(g, x, y, r, '#ffffff', '#c8d4f2'));
  g.fillStyle = '#1d1430'; g.fillRect(121, WH - 37, 6, 1); g.fillRect(122, WH - 41, 4, 4); g.fillStyle = '#ff8a3a'; g.beginPath(); g.moveTo(124, WH - 32.5); g.lineTo(128, WH - 32); g.lineTo(124, WH - 31.5); g.fill();
  g.fillStyle = '#d83a4a'; g.fillRect(121, WH - 29.5, 6, 1.4);
  const tx = 214, ty = WH - 16;
  for (let k = 0; k < 4; k++) {
    const yy = ty - 52 + k * 11, tw = 7 + k * 6;
    const tg = g.createLinearGradient(tx - tw, 0, tx + tw, 0); tg.addColorStop(0, '#2f8a62'); tg.addColorStop(1, '#16503c');
    g.fillStyle = tg; g.beginPath(); g.moveTo(tx, yy); g.lineTo(tx + tw, yy + 16); g.lineTo(tx - tw, yy + 16); g.closePath(); g.fill();
  }
  g.fillStyle = '#5a3a2a'; g.fillRect(tx - 2, ty - 4, 4, 4);
  [['#d83a4a', -16], ['#4a8aff', 11], ['#3ac85a', -6]].forEach(([col, dx]) => { g.fillStyle = col; g.fillRect(tx + dx, ty - 4, 6, 5); g.fillStyle = '#ffd24a'; g.fillRect(tx + dx + 2.5, ty - 4, 1, 5); });
  const lamps = [[30, WH - 30], [86, WH - 28], [176, WH - 26], [250, WH - 28]].map(([x, y]) => { g.fillStyle = '#2a2440'; g.fillRect(x - .5, y - 12, 1, 12); g.fillRect(x - 1.5, y - 14, 3, 2); return { x, y: y - 13 }; });
  return { canvas: c, chimneys, eaves, lamps, tree: { x: tx, y: ty } };
}
function hotAirBalloon(g, x, y, r, a, b) {
  const st = 6;
  for (let k = 0; k < st; k++) {
    g.fillStyle = k % 2 ? a : b; g.beginPath();
    const x0 = x - r + (2 * r) * k / st, x1 = x - r + (2 * r) * (k + 1) / st;
    g.moveTo(x, y - r); g.quadraticCurveTo(x0 - (x - x0) * .12, y - r * .3, x0 * .55 + x * .45, y + r * .9);
    g.lineTo(x1 * .55 + x * .45, y + r * .9); g.quadraticCurveTo(x1 + (x1 - x) * .12, y - r * .3, x, y - r); g.fill();
  }
  const sh = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.2); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(1, 'rgba(0,0,40,.25)');
  g.fillStyle = sh; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.strokeStyle = 'rgba(60,40,30,.8)'; g.lineWidth = .4; g.beginPath(); g.moveTo(x - r * .4, y + r * .9); g.lineTo(x - r * .2, y + r * 1.35); g.moveTo(x + r * .4, y + r * .9); g.lineTo(x + r * .2, y + r * 1.35); g.stroke();
  g.fillStyle = '#8a5a32'; g.fillRect(x - r * .22, y + r * 1.32, r * .44, r * .3);
}

// ---------- the scene ----------
function scene(canvas, { viewW, phone }) {
  const g = canvas.getContext('2d');
  const rand = rng(17);
  let s = 4, vw = viewW || W, vh = VH, ground = null, free = false;
  const clouds = [];
  const sprites = [0, 1, 2, 3, 4, 5].map((i) => cloudSprite(rng(40 + i), 50 + i * 12, false));
  const nightSprites = [0, 1, 2, 3].map((i) => cloudSprite(rng(60 + i), 54 + i * 14, true));
  for (let i = 0; i < 70; i++) {
    let y; const r = rand();
    if (r < .42) y = 1220 + O + rand() * 260;       // the cloud sea
    else if (r < .75) y = 1500 + O + rand() * 340;  // the low sky
    else y = 700 + O + rand() * 520;                // thin high clouds
    const night = y < 1150 + O, sp = night ? nightSprites : sprites;
    clouds.push({ x: rand() * (W + 120) - 60, y, img: sp[Math.floor(rand() * sp.length)], k: .5 + rand() * .7, v: .03 + rand() * .09, a: night ? .35 + rand() * .25 : .75 + rand() * .25 });
  }
  clouds.sort((a, b) => a.k - b.k);
  const stars = Array.from({ length: 520 }, () => ({ x: rand() * W, y: Math.pow(rand(), 1.7) * (1500 + O), r: .25 + rand() * .7, p: rand() * 9 }));
  const flakes = Array.from({ length: 160 }, () => ({ x: rand() * W, y: rand(), v: .25 + rand() * .45, d: rand() * 6, r: .3 + rand() * .9 }));
  const birds = Array.from({ length: 9 }, (_, i) => ({ x: rand() * W, y: 1560 + O + (i % 3) * 70 + rand() * 30, v: .12 + rand() * .1, p: rand() * 6 }));
  const balloons = [[60, 1640, 9, '#ff5a6a', '#ffd24a'], [250, 1560, 7, '#4a8aff', '#ffffff'], [150, 1720, 6, '#3ac85a', '#ffd24a'], [290, 1880, 5, '#a86aff', '#ff8ad8']].map(([x, y, r, a, b]) => ({ x, y: y + O, r, a, b, v: .04 + r * .004 }));
  let camY = WH - VH, target = camY, onFrame = null, shoot = null;
  const amb = createAmbient();
  // the painted map, in slices; until every slice is in, the drawn sky and village show instead
  const slices = Array(MAP.slices).fill(null); let painted = false; const forestSky = null;
  slices.forEach((_, i) => { const im = new Image(); im.onload = () => { slices[i] = im; painted = slices.every(Boolean); }; im.src = new URL(`art/map-${i}.webp?v=2`, import.meta.url).href; });
  const SLEIGH_Y = 640, PLANE_Y = 1010;   // in the aurora picture / over the cloud sea
  function fit() {
    // pixel art with big crisp pixels like a classic pixel-art game: the canvas has 2 pixels per world unit on big
    // screens (the painted map's own grain, drawn 1:1) and 1 on phones, and the browser scales it up with hard
    // edges, so every art pixel is a 2–3 screen-pixel square. Landscape screens see the whole 320-wide world,
    // portrait phones the middle 190.
    const cssW = canvas.clientWidth || 960, cssH = canvas.clientHeight || 540;
    vw = viewW || (cssW > cssH * 1.1 ? W : 190);
    const px = cssW / vw >= 3.5 ? 2 : 1;
    const cw = Math.round(vw * px), ch = Math.round(cw * cssH / cssW);
    canvas.width = cw; canvas.height = ch; g.imageSmoothingEnabled = false;
    s = px; vh = ch / s;
    ground = buildGround(2);
    if (phone && !free) camY = target = WH - vh;
  }
  fit(); addEventListener('resize', fit);
  const x0 = () => (W - vw) / 2;   // the phone shows the middle of the world
  const X = (x) => (x - x0()) * s, Y = (y) => (y - camY) * s;
  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    if (t - last < 30) return; last = t;
    camY += (target - camY) * .07; if (Math.abs(target - camY) < .05) camY = target;
    const cw = canvas.width, ch = canvas.height;
    const sk = g.createLinearGradient(0, 0, 0, ch);
    const sc = (y) => (forestSky && y > GTOP - 160 ? mix(skyAt(y), forestSky, Math.min(1, (y - (GTOP - 160)) / 160)) : skyAt(y));
    sk.addColorStop(0, sc(camY)); sk.addColorStop(.5, sc(camY + vh / 2)); sk.addColorStop(1, sc(camY + vh));
    g.fillStyle = sk; g.fillRect(0, 0, cw, ch);
    const vis = (y, m = 40) => y > camY - m && y < camY + vh + m;
    if (painted) {
      g.imageSmoothingEnabled = s < MAP.pxPerUnit; g.imageSmoothingQuality = 'high';   // 1:1 on big screens, averaged down on phones
      slices.forEach((im, i) => {
        const top = i * MAP.slicePx / MAP.pxPerUnit, h = im.height / MAP.pxPerUnit;
        if (top < camY + vh && top + h > camY) g.drawImage(im, Math.round(X(0)), Math.round(Y(top)), Math.round(W * s), Math.round(h * s) + 1);
      });
      g.imageSmoothingEnabled = false;
    }
    for (const st of stars) if (vis(st.y, 2)) {
      const dark = painted ? Math.max(0, Math.min(1, (900 - st.y) / 300)) : Math.max(0, Math.min(1, (1500 + O - st.y) / 700)), tw = .55 + .45 * Math.sin(t / 700 + st.p);
      g.globalAlpha = dark * tw; g.fillStyle = '#ffffff'; const sz = st.r > .7 ? 2 : 1; g.fillRect(Math.round(X(st.x)), Math.round(Y(st.y)), sz, sz);
    }
    g.globalAlpha = 1;
    if (!painted && vis(300 + O, 60)) {
      const mx = X(250), my = Y(300 + O), mr = 18 * s;
      const gl = g.createRadialGradient(mx, my, mr * .6, mx, my, mr * 3); gl.addColorStop(0, 'rgba(255,248,220,.35)'); gl.addColorStop(1, 'rgba(255,248,220,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(mx, my, mr * 3, 0, 7); g.fill();
      const md = g.createRadialGradient(mx - mr * .3, my - mr * .3, mr * .1, mx, my, mr); md.addColorStop(0, '#fffdf0'); md.addColorStop(1, '#e8dfb8');
      g.fillStyle = md; g.beginPath(); g.arc(mx, my, mr, 0, 7); g.fill();
      g.fillStyle = 'rgba(190,175,130,.35)'; [[-.35, -.2, .22], [.25, .25, .17], [.05, -.45, .12], [.4, -.25, .1]].forEach(([a, b, r]) => { g.beginPath(); g.arc(mx + a * mr, my + b * mr, r * mr, 0, 7); g.fill(); });
    }
    if (!painted && vis(640 + O, 160)) {
      // aurora curtains: a bright wavy lower edge, glowing upward and fading out
      g.globalCompositeOperation = 'lighter';
      [[600 + O, [62, 232, 168], 0], [660 + O, [56, 200, 232], 2], [720 + O, [168, 106, 255], 4]].forEach(([yb, [r, gg, b], k]) => {
        for (let x = 0; x <= W; x += 1.6) {
          const edge = yb + 16 * Math.sin(x / 42 + t / 3200 + k) + 7 * Math.sin(x / 13 + t / 2100 + k * 1.7);
          const len = 38 + 18 * Math.sin(x / 21 + t / 2600 + k), glow = .28 + .14 * Math.sin(x / 9 + t / 900 + k);
          const gr = g.createLinearGradient(0, Y(edge), 0, Y(edge - len));
          gr.addColorStop(0, `rgba(${r},${gg},${b},${glow})`); gr.addColorStop(.25, `rgba(${r},${gg},${b},${glow * .6})`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
          g.fillStyle = gr; g.fillRect(X(x), Y(edge - len), 1.7 * s, len * s);
        }
      });
      g.globalCompositeOperation = 'source-over';
    }
    if (vis(TOPY, 80)) {
      const sx = X(160), sy = Y(TOPY), p = .75 + .25 * Math.sin(t / 500);
      const gl = g.createRadialGradient(sx, sy, 0, sx, sy, 40 * s); gl.addColorStop(0, `rgba(255,240,170,${(painted ? .35 : .7) * p})`); gl.addColorStop(1, 'rgba(255,240,170,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(sx, sy, 40 * s, 0, 7); g.fill();
      if (!painted) {
      g.save(); g.translate(sx, sy); g.rotate(t / 6000);
      g.fillStyle = '#fff4c0';
      for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.moveTo(0, -24 * s * p); g.lineTo(2.2 * s, 0); g.lineTo(-2.2 * s, 0); g.fill(); }
      g.restore();
      g.fillStyle = '#ffd24a'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = (k % 2 ? 3.5 : 8) * s; g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } g.fill();
      }
    }
    if (painted) {
      // the living sky: wind, clouds, rain, rainbow, birds, sunlight, smoke, lights, snow, leaves (ambient.js)
      amb.draw(g, { t, camY, vh, vw, x0: x0(), s, cw, ch }, slices, MAP.slicePx);
      if (onFrame) onFrame(camY, t);
      return;
    }
    if (camY < 1000 + O) {
      if (!shoot && Math.random() < .012) shoot = { x: Math.random() * W, y: camY + Math.random() * vh * .5, a: 0 };
      if (shoot) {
        shoot.a += 1; const hx = shoot.x + shoot.a * 4, hy = shoot.y + shoot.a * 1.6;
        const gr = g.createLinearGradient(X(hx - 26), Y(hy - 10), X(hx), Y(hy)); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,.95)');
        g.strokeStyle = gr; g.lineWidth = 1.1 * s * .5; g.beginPath(); g.moveTo(X(hx - 26), Y(hy - 10)); g.lineTo(X(hx), Y(hy)); g.stroke();
        if (shoot.a > 28) shoot = null;
      }
    }
    const slx = ((t / 45) % 1100) - 160;
    if (vis(SLEIGH_Y, 30) && slx < W + 40) {
      const x = X(slx), y = Y(SLEIGH_Y + 4 * Math.sin(t / 700)), u = s;
      g.fillStyle = 'rgba(20,16,40,.9)';
      for (const [dx, ph] of [[24, 0], [38, 1.3]]) { const bob = Math.sin(t / 180 + ph) * 1.2 * u; g.beginPath(); g.ellipse(x + dx * u, y + bob, 4.5 * u, 2 * u, 0, 0, 7); g.fill(); g.fillRect(x + (dx + 3) * u, y - 4 * u + bob, 1.2 * u, 3 * u); g.fillRect(x + (dx - 3) * u, y + 1 * u + bob, .8 * u, 3 * u); g.fillRect(x + (dx + 2) * u, y + 1 * u + bob, .8 * u, 3 * u); }
      g.fillStyle = '#c83040'; g.beginPath(); g.moveTo(x - 6 * u, y - 3 * u); g.lineTo(x + 12 * u, y - 3 * u); g.quadraticCurveTo(x + 16 * u, y + 3 * u, x + 8 * u, y + 4 * u); g.lineTo(x - 4 * u, y + 4 * u); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,230,150,.9)'; g.lineWidth = .5 * u; g.beginPath(); g.moveTo(x + 12 * u, y - 1 * u); g.lineTo(x + 20 * u, y); g.stroke();
      for (let k = 0; k < 8; k++) { g.fillStyle = `rgba(255,242,160,${.8 - k * .1})`; g.beginPath(); g.arc(x - (8 + k * 4) * u, y + Math.sin(t / 200 + k) * u, (1.2 - k * .1) * u, 0, 7); g.fill(); }
    }
    const plx = ((t / 70) % 900) - 120;
    if (vis(PLANE_Y, 20) && plx < W + 20) {
      const x = X(plx), y = Y(PLANE_Y), u = s;
      const tr = g.createLinearGradient(x - 70 * u, y, x, y); tr.addColorStop(0, 'rgba(255,255,255,0)'); tr.addColorStop(1, 'rgba(255,255,255,.55)');
      g.strokeStyle = tr; g.lineWidth = 1 * u; g.beginPath(); g.moveTo(x - 70 * u, y + .5 * u); g.lineTo(x - 6 * u, y + .5 * u); g.stroke();
      g.fillStyle = '#e8ecf8'; g.beginPath(); g.ellipse(x, y, 6 * u, 1.3 * u, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x - 1 * u, y); g.lineTo(x - 4 * u, y + 4 * u); g.lineTo(x - 2 * u, y); g.fill();
      if ((t / 400 | 0) % 2) { g.fillStyle = '#ff4a5a'; g.beginPath(); g.arc(x - 5 * u, y - 1 * u, .9 * u, 0, 7); g.fill(); }
    }
    for (const [ci, c] of clouds.entries()) {
      c.x += c.v; if (c.x > W + 70) c.x = -90;
      if (painted) continue;   // the painted map has its own clouds
      const w = c.img.width / 4 * c.k, h = c.img.height / 4 * c.k;
      if (!vis(c.y, h + 10)) continue;
      g.globalAlpha = c.a; g.drawImage(c.img, X(c.x), Y(c.y - h / 2), w * s, h * s);
    }
    g.globalAlpha = 1;
    for (const b of balloons) {
      b.x += b.v; if (b.x > W + 30) b.x = -30;
      const by = b.y + 3 * Math.sin(t / 1400 + b.r);
      if (vis(by, 30)) { g.save(); g.translate(X(b.x), Y(by)); g.scale(s, s); hotAirBalloon(g, 0, 0, b.r, b.a, b.b); g.restore(); }
    }
    g.strokeStyle = 'rgba(40,40,80,.75)'; g.lineWidth = .7 * s * .5;
    for (const bd of birds) {
      bd.x += bd.v; if (bd.x > W + 10) bd.x = -10;
      if (!vis(bd.y, 10)) continue;
      const f = Math.sin(t / 160 + bd.p) * 2.2, x = X(bd.x), y = Y(bd.y + Math.sin(t / 900 + bd.p) * 2), u = s * .5;
      g.beginPath(); g.moveTo(x - 4 * u, y - f * u); g.quadraticCurveTo(x - 1.5 * u, y - 1 * u, x, y); g.quadraticCurveTo(x + 1.5 * u, y - 1 * u, x + 4 * u, y - f * u); g.stroke();
    }
    if (painted && camY + vh > WH - 230) {
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.imageSmoothingEnabled = false;
      // soft glints drifting over the snow
      for (let k = 0; k < 14; k++) {
        const gx = (k * 47 + t / 90 * (k % 3 + 1)) % W, gy = WH - 20 - ((k * 31) % 90) - 6 * Math.sin(t / 900 + k);
        g.globalAlpha = .5 + .5 * Math.sin(t / 400 + k * 2); g.fillStyle = k % 4 ? '#ffffff' : '#ffe9a8'; g.fillRect(Math.round(X(gx)), Math.round(Y(gy)), 1, 1);
      }
      g.globalAlpha = 1;
    } else if (camY + vh > GTOP) {
      g.drawImage(ground.canvas, X(0), Y(GTOP), W * s, (WH - GTOP) * s);
      const cols = ['#ff4a5a', '#ffd24a', '#4aee7a', '#5aa8ff', '#ff8ad8'];
      for (const [i, e] of ground.eaves.entries()) for (let x = e.x0; x < e.x1; x += 3) { const on = Math.sin(t / 300 + x + i) > -.2; g.fillStyle = cols[((x | 0) + i) % 5]; g.globalAlpha = on ? 1 : .35; g.beginPath(); g.arc(X(x), Y(e.y + 1), .9 * s * .5, 0, 7); g.fill(); }
      g.globalAlpha = 1;
      for (const l of ground.lamps) { const gl = g.createRadialGradient(X(l.x), Y(l.y), 0, X(l.x), Y(l.y), 10 * s); gl.addColorStop(0, 'rgba(255,220,140,.6)'); gl.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = gl; g.beginPath(); g.arc(X(l.x), Y(l.y), 10 * s, 0, 7); g.fill(); }
      for (const [i, c] of ground.chimneys.entries()) for (let k = 0; k < 6; k++) {
        const age = ((t / 60 + k * 30 + i * 47) % 180) / 180;
        g.fillStyle = `rgba(230,234,250,${.55 * (1 - age)})`; g.beginPath(); g.arc(X(c.x + Math.sin(age * 5 + i) * 2 + age * 6), Y(c.y - age * 26), (1 + age * 3.5) * s * .6, 0, 7); g.fill();
      }
      const { x: tx, y: ty } = ground.tree;
      for (let k = 0; k < 16; k++) { const a = k * 2.4, yy = ty - 46 + (k % 4) * 11 + 4, xx = tx + Math.sin(a) * (4 + (k % 4) * 5); g.fillStyle = cols[(k + (t / 500 | 0)) % 5]; g.beginPath(); g.arc(X(xx), Y(yy), 1.1 * s * .5, 0, 7); g.fill(); }
      const sp = .8 + .2 * Math.sin(t / 400), sx = X(tx), sy = Y(ty - 54);
      const gl = g.createRadialGradient(sx, sy, 0, sx, sy, 9 * s); gl.addColorStop(0, `rgba(255,240,160,${.8 * sp})`); gl.addColorStop(1, 'rgba(255,240,160,0)'); g.fillStyle = gl; g.beginPath(); g.arc(sx, sy, 9 * s, 0, 7); g.fill();
      g.fillStyle = '#ffd24a'; g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = (k % 2 ? 1.6 : 4) * s; g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } g.fill();
    }
    const snowy = Math.max(0, Math.min(1, (camY - 1500 - O) / 400));
    if (snowy > 0) {
      g.fillStyle = '#ffffff';
      for (const f of flakes) {
        f.y += f.v / vh; f.d += .03; if (f.y > 1) { f.y = 0; f.x = Math.random() * W; }
        g.globalAlpha = snowy * .9; const sz = f.r > .8 ? 2 : 1; g.fillRect(Math.round(X(f.x + Math.sin(f.d) * 2.5)), Math.round(f.y * ch), sz, sz);
      }
      g.globalAlpha = 1;
    }
    if (onFrame) onFrame(camY, t);
  }
  requestAnimationFrame(frame);
  const api = {
    get y() { return camY; },
    look(y, now) { free = true; target = Math.max(0, Math.min(WH - vh, y)); if (now) camY = target; },
    rest(now) { free = false; target = WH - vh; if (now) camY = target; },   // back to the ground (phones)
    get viewH() { return vh; }, get viewW() { return vw; },
    onFrame(fn) { onFrame = fn; },
    get wind() { return amb.wind; },
  };
  (window.CQW ||= []).push({ api, amb });   // for testing in the browser console
  return api;
}

export function world(canvas) { return scene(canvas, { viewW: W }); }
export function phoneWorld(canvas) { return scene(canvas, { phone: true }); }
