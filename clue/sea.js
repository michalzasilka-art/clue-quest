// Clue Quest, the sea map: the heroes dive from a frozen harbour down to the Sea Star on the sea floor.
// Two painted pixel-art layers (built by Foxino/Clue Quest/Backgrounds/compose_sea.py) give it depth: the far water
// moves slower than the near cliffs, icebergs and kelp, so as you dive the near layer slides past and shows what was
// hidden behind it. Between the two layers: rising bubbles, shoals of little fish, jellyfish, light rays and glowing
// specks (behind the cliffs, so they peek out from between them); in front: big near bubbles and drifting plankton.
// Same camera API as the sky (world.js): y, look, rest, viewH, viewW, onFrame, wind, on.
import { SEA } from './art/sea-meta.js?v=2';

const W = 320, U = SEA.pxPerUnit, WH = SEA.wh;
const R = Math.random, rnd = (a, b) => a + R() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const step = (a, n = 4) => Math.round(a * n) / n;
const smooth = (a, b, v) => { const k = clamp((v - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
function fromRows(rows, pal) {
  const c = document.createElement('canvas'); c.width = Math.max(...rows.map((r) => r.length)); c.height = rows.length;
  const g = c.getContext('2d'); rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch]) { g.fillStyle = pal[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}
const FISH = [['.yy.', 'yyyw', '.yy.'], ['.yy..', 'yyyyw', '.yy..']].map((r) => fromRows(r, { y: '#ffd24a', w: '#ffffff' }));
const FISH2 = [['.ss.', 'sssk', '.ss.'], ['.ss..', 'ssssk', '.ss..']].map((r) => fromRows(r, { s: '#c8e4ff', k: '#2a3a6a' }));
const JELLY = [['.ppp.', 'ppppp', 'p.p.p', '.p.p.'], ['.ppp.', 'ppppp', '.p.p.', 'p.p.p']].map((r) => fromRows(r, { p: '#ff9ae0' }));

export function seaScene(canvas, { viewW, phone }) {
  const g = canvas.getContext('2d');
  let s = 2, vw = viewW || W, vh = 180, camY = 0, target = 0, onFrame = null, last = 0, on = false;
  const load = (name, n) => Array.from({ length: n }, (_, i) => { const im = new Image(); im.src = new URL(`art/${name}-${i}.webp?v=1`, import.meta.url).href; return im; });
  const back = load('sea-back', SEA.backSlices), cliff = load('sea-cliff', SEA.cliffSlices);
  function fit() {
    const cssW = canvas.clientWidth || 960, cssH = canvas.clientHeight || 540;
    vw = viewW || (cssW > cssH * 1.1 ? W : 190);
    const px = cssW / vw >= 3.5 ? 2 : 1;
    const cw = Math.round(vw * px), ch = Math.round(cw * cssH / cssW);
    canvas.width = cw; canvas.height = ch; g.imageSmoothingEnabled = false;
    s = px; vh = ch / s;
    if (!free) camY = target = 0;
  }
  let free = false;
  addEventListener('resize', () => { if (on) fit(); });
  const x0 = () => (W - vw) / 2;
  const X = (x) => Math.round((x - x0()) * s), Y = (y) => Math.round((y - camY) * s);
  // the back layer's own camera: lined up with the cliffs at the top and at the bottom, slower in between
  const backCam = () => camY * (SEA.hBack / U - vh) / Math.max(1, WH - vh);
  const seenB = (y0, y1, bc) => y1 > bc - 8 && y0 < bc + vh + 8;
  const seen = (y0, y1) => y1 > camY - 8 && y0 < camY + vh + 8;

  // life between the layers lives in BACK coordinates (it moves with the far water)
  const HB = SEA.hBack / U;
  const schools = Array.from({ length: 10 }, (_, i) => ({ y: rnd(170, HB * .55), x: rnd(0, W), v: (R() < .5 ? -1 : 1) * rnd(6, 12), n: 4 + ((R() * 6) | 0), k: R() < .5 ? 0 : 1, ph: R() * 6 }));
  const jellies = Array.from({ length: 16 }, () => ({ x: rnd(20, 300), y: rnd(HB * .45, HB - 60), ph: R() * 6 }));
  const specks = Array.from({ length: 90 }, () => ({ x: R() * W, y: rnd(HB * .55, HB), ph: R() * 9, c: R() < .5 ? '#7af0ff' : '#ff8ae8' }));
  const snow = Array.from({ length: 70 }, () => ({ x: R() * W, y: R(), k: R() }));
  const bubbles = [], near = [];
  const vents = Array.from({ length: 14 }, () => ({ x: R() < .5 ? rnd(10, 60) : rnd(260, 310), y: rnd(SEA.surface + 60, WH - 30), t: R() * 3 }));

  function frame(t) {
    requestAnimationFrame(frame);
    if (!on || t - last < 30) return;
    const dt = Math.min(.1, (t - (last || t)) / 1000); last = t;
    camY += (target - camY) * .07; if (Math.abs(target - camY) < .05) camY = target;
    const cw = canvas.width, ch = canvas.height, bc = backCam();
    g.imageSmoothingEnabled = s < U; g.imageSmoothingQuality = 'high';
    g.fillStyle = '#1a3a8a'; g.fillRect(0, 0, cw, ch);
    // 1. the far water
    back.forEach((im, i) => {
      const top = i * SEA.slice / U; if (!im.complete || !im.naturalWidth || !seenB(top, top + im.naturalHeight / U, bc)) return;
      g.drawImage(im, X(0), Math.round((top - bc) * s), Math.round(W * s), Math.round(im.naturalHeight / U * s) + 1);
    });
    g.imageSmoothingEnabled = false;
    const YB = (y) => Math.round((y - bc) * s);
    // 2. life between the layers (in back coordinates)
    g.fillStyle = '#e8f6ff';
    for (const v of vents) { if (!seen(v.y - 60, v.y + 20)) continue; v.t -= dt; if (v.t <= 0) { v.t = rnd(.25, .9); bubbles.push({ x: v.x, y: v.y, v: rnd(12, 22), r: R() < .3 ? 2 : 1, life: rnd(2, 4), near: false }); } }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.life -= dt; b.y -= b.v * dt; b.x += Math.sin(b.y / 7) * .15;
      if (b.life <= 0 || b.y < SEA.surface) { bubbles.splice(i, 1); continue; }
      if (!seen(b.y, b.y)) continue;
      const x = X(b.x), y = Y(b.y); g.globalAlpha = .8;
      if (b.r > 1) { g.fillRect(x, y - s, 2 * s, s); g.fillRect(x - s, y, s, 2 * s); g.fillRect(x + 2 * s, y, s, 2 * s); g.fillRect(x, y + 2 * s, 2 * s, s); } else g.fillRect(x, y, s, s);
    }
    g.globalAlpha = 1;
    for (const f of schools) {
      f.x += f.v * dt; if (f.x > W + 40) f.x = -40; if (f.x < -40) f.x = W + 40;
      if (!seenB(f.y - 20, f.y + 20, bc)) continue;
      const fr = (f.k ? FISH2 : FISH)[((t / 220) | 0) % 2];
      for (let i = 0; i < f.n; i++) {
        const fx = f.x - Math.sign(f.v) * (i % 3) * 6, fy = f.y + ((i * 5) % 11) - 5 + Math.sin(t / 700 + i + f.ph) * 2;
        const x = X(fx), y = YB(fy);
        if (f.v > 0) g.drawImage(fr, x, y, fr.width * s, fr.height * s);
        else { g.save(); g.translate(x + fr.width * s, y); g.scale(-1, 1); g.drawImage(fr, 0, 0, fr.width * s, fr.height * s); g.restore(); }
      }
    }
    for (const j of jellies) { const y = j.y + Math.sin(t / 2400 + j.ph) * 10; if (!seenB(y - 10, y + 10, bc)) continue; const fr = JELLY[((t / 500 + j.ph) | 0) % 2]; g.globalAlpha = .85; g.drawImage(fr, X(j.x + Math.sin(t / 3000 + j.ph) * 5), YB(y), fr.width * s, fr.height * s); }
    g.globalAlpha = 1;
    for (const p of specks) { if (!seenB(p.y, p.y, bc)) continue; const a = Math.sin(t / 600 + p.ph); if (a < .2) continue; g.globalAlpha = step(a, 3); g.fillStyle = p.c; g.fillRect(X(p.x + Math.sin(t / 3000 + p.ph) * 5), YB(p.y), s, s); }
    g.globalAlpha = 1;
    // light rays near the surface, swaying
    if (bc < 420) {
      g.globalCompositeOperation = 'lighter'; g.fillStyle = '#d8f4ff';
      for (let k = 0; k < 6; k++) {
        const bx = 30 + k * 52 + 10 * Math.sin(t / 4200 + k), wd = 8 + (k % 3) * 5, glow = .5 + .5 * Math.sin(t / 2300 + k);
        for (let yy = 0; yy < ch; yy++) {
          const wy = bc + yy / s, f = (wy - SEA.surface) / 260; if (f < 0 || f > 1) continue;
          const a = step(.08 * glow * (1 - f), 24); if (a <= 0) continue;
          g.globalAlpha = a; g.fillRect(X(bx + (wy - SEA.surface) * .28 - wd / 2), yy, Math.round(wd * s), 1);
        }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // the Sea Star's golden glow, pulsing (it is in the far layer)
    const sy = SEA.starBack / U;
    if (seenB(sy - 60, sy + 60, bc)) {
      g.globalCompositeOperation = 'lighter'; const p = .7 + .3 * Math.sin(t / 520);
      for (const [r, a] of [[46, .05], [30, .07], [16, .1]]) {
        g.globalAlpha = step(a * p, 40); g.fillStyle = '#ffd86a'; const rr = r * s, cx = X(W / 2), cy = YB(sy);
        for (let yy = -rr; yy <= rr; yy += s) { const hw = Math.sqrt(rr * rr - yy * yy); g.fillRect(Math.round(cx - hw), Math.round(cy + yy), Math.round(hw * 2), s); }
      }
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    // 3. the near cliffs, icebergs and kelp (the world itself)
    g.imageSmoothingEnabled = s < U; g.imageSmoothingQuality = 'high';
    cliff.forEach((im, i) => {
      const top = i * SEA.slice / U; if (!im.complete || !im.naturalWidth || !seen(top, top + im.naturalHeight / U)) return;
      g.drawImage(im, X(0), Y(top), Math.round(W * s), Math.round(im.naturalHeight / U * s) + 1);
    });
    g.imageSmoothingEnabled = false;
    // 4. in front: big near bubbles and drifting plankton, moving faster than everything (1.35×)
    if (camY > SEA.surface - 40 && near.length < 10 && R() < dt * 2.5) near.push({ x: rnd(0, W), y: camY * 1.35 + vh + 20, v: rnd(10, 22), r: rnd(1.5, 3.5), ph: R() * 6 });
    g.strokeStyle = 'rgba(230,248,255,.6)'; g.lineWidth = Math.max(1, s);
    for (let i = near.length - 1; i >= 0; i--) {
      const b = near[i]; b.y -= b.v * dt; const sy2 = b.y - camY * 1.35;
      if (sy2 < -20 || sy2 > vh + 40) { near.splice(i, 1); continue; }
      const x = X(b.x + Math.sin(t / 900 + b.ph) * 3) + x0() * s, y = Math.round(sy2 * s), r = Math.round(b.r * s);
      g.fillStyle = 'rgba(230,248,255,.7)'; g.fillRect(x - r, y, s, s); g.fillRect(x + r, y, s, s); g.fillRect(x, y - r, s, s); g.fillRect(x, y + r, s, s);
      g.fillRect(x - r + s, y - r + s, s, s); g.fillRect(x + r - s, y - r + s, s, s); g.fillRect(x - r + s, y + r - s, s, s); g.fillRect(x + r - s, y + r - s, s, s);
      g.fillStyle = '#ffffff'; g.fillRect(x - Math.round(r / 2), y - Math.round(r / 2), s, s);
    }
    if (camY > SEA.surface) {
      g.fillStyle = '#d8e8ff';
      for (const f of snow) { f.y = (f.y + dt * (.02 + f.k * .03)) % 1; const a = smooth(SEA.surface, SEA.surface + 300, camY + f.y * vh); g.globalAlpha = (.3 + f.k * .4) * a; const sz = f.k > .8 ? 2 : 1; g.fillRect(Math.round((f.x + Math.sin(t / 2000 + f.x) * 4 - x0()) * s), Math.round(f.y * ch), sz, sz); }
      g.globalAlpha = 1;
    }
    if (onFrame) onFrame(camY, t, 0);
  }
  requestAnimationFrame(frame);
  return {
    get y() { return camY; },
    look(y, now) { free = true; target = clamp(y, 0, WH - vh); if (now) camY = target; },
    rest(now) { free = false; target = 0; if (now) camY = target; },   // up at the harbour (lobbies, phones)
    get viewH() { return vh; }, get viewW() { return vw; },
    onFrame(fn) { onFrame = fn; },
    wind: { v: 4, k: 0 },
    get on() { return on; }, set on(v) { on = v; if (v) { fit(); last = 0; } },
    burst(x, y, n = 16) { for (let i = 0; i < n; i++) bubbles.push({ x: x + rnd(-6, 6), y: y + rnd(-4, 4), v: rnd(14, 30), r: R() < .4 ? 2 : 1, life: rnd(1, 2.2) }); },
  };
}
