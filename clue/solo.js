// Clue Quest, Individual: one player on one screen (a phone or a computer), racing three computer flyers up the
// map. Pick a topic → each clue: read it, tap one of 3 words → the answer flashes → everyone flies up by what they
// earned → the next clue comes by itself → after 10 clues, the podium and your best height (kept on this device).
import { $, $$, esc, store, show, shuffle, confetti, ordinal } from './ui.js';
import { HEROES, HATS, heroURL, heroFrame, balloonsURL } from './sprites.js';
import { SETS } from './words.js';
import { W, WH, GROUND, TOPY, zoneAt } from './world.js';
import { sfx, unlock } from './sound.js';

const LETTERS = ['a', 'b', 'c'];
const ROUNDS = 10, SECS = 20, TOP_ALT = 1500, CLIMB = 15 / ROUNDS;
const RIVAL_NAMES = ['Rusty', 'Miso', 'Bolt', 'Zara', 'Pip', 'Luna', 'Boo', 'Kiki', 'Max', 'Tomi'];
const altY = (alt) => GROUND - Math.min(1, alt / TOP_ALT) * (GROUND - TOPY);
const r5 = (m) => Math.round(m / 5) * 5;
const gainFor = (t) => r5((50 + 50 * Math.max(0, 1 - t / (SECS * 1000))) * CLIMB);
const streakBonus = (s) => (s >= 2 ? r5(10 * (Math.min(s, 5) - 1) * CLIMB) : 0);

let built = false, cam = null, me = null, onExit = null;
let fly = [], rounds = [], qi = 0, qStart = 0, timer = null, picked = null, phase = 'off', topic = SETS[0], raf = 0;

function build() {
  if (built) return; built = true;
  $('#app').insertAdjacentHTML('beforeend', `
<section class="screen" id="soloTopic" hidden><div class="col">
  <div class="logo small">CLUE<br><i>QUEST</i></div>
  <div class="card px"><h2>PICK A TOPIC</h2><div class="topics" id="soloTopics"></div>
  <button class="btn px green" id="soloGo">START FLYING</button>
  <button class="btn px ghost" id="soloBack" style="margin-top:14px">BACK</button></div>
</div></section>
<section class="screen solo-game" id="soloGame" hidden>
  <div class="solo-hud"><div class="px" id="soloNum">CLUE 1/10</div><div class="tbar"><i id="soloBar"></i></div><div class="px" id="soloAlt">0 m</div></div>
  <div class="solo-panel">
    <div class="px solo-clue" id="soloClue"><small id="soloLbl">WHAT IS IT?</small><span id="soloText"></span></div>
    <div class="pans" id="soloAns"></div>
  </div>
  <div class="solo-banner" id="soloBanner" hidden></div>
</section>
<section class="screen" id="soloEnd" hidden><div class="col">
  <div class="spacer"></div>
  <div class="verdict pop" id="soloTitle">YOU WON!</div>
  <div class="solo-podium" id="soloPodium"></div>
  <div class="stats"><div class="px"><span class="tag">HEIGHT</span><b id="soloEndAlt">0 m</b></div><div class="px"><span class="tag">BEST</span><b id="soloBest">0 m</b></div></div>
  <p class="hint" id="soloZone"></p>
  <button class="btn px green" id="soloAgain">FLY AGAIN</button>
  <button class="btn px ghost" id="soloMenu">MENU</button>
  <div class="spacer"></div>
</div></section>`);
  document.body.insertAdjacentHTML('beforeend', '<div id="soloLayer" hidden><div id="soloTokens"></div><div id="soloRuler"><div class="rail"></div><div id="soloHeads"></div></div></div>');
  $('#soloTopics').innerHTML = SETS.map((s) => `<button class="topic-b px" data-id="${s.id}"><img class="px-img" src="${heroURL(s.icon, { hat: s.hat })}" alt=""><span><b>${esc(s.title)}</b><small>${s.level}</small></span></button>`).join('');
  $('#soloTopics').addEventListener('click', (e) => { const b = e.target.closest('.topic-b'); if (!b) return; sfx.pick(); topic = SETS.find((s) => s.id === b.dataset.id); store.set('clue-solo-topic', topic.id); drawTopics(); });
  $('#soloGo').onclick = () => { unlock(); sfx.fly(); begin(); };
  $('#soloBack').onclick = () => { sfx.tap(); stop(); onExit && onExit('me'); };
  $('#soloAns').addEventListener('click', (e) => { const b = e.target.closest('.pbtn'); if (b) choose(+b.dataset.k); });
  addEventListener('keydown', (e) => { if (phase === 'q' && ['1', '2', '3'].includes(e.key)) choose(+e.key - 1); });
  $('#soloAgain').onclick = () => { unlock(); sfx.tap(); begin(); };
  $('#soloMenu').onclick = () => { sfx.tap(); stop(); onExit && onExit('menu'); };
}
function drawTopics() { $$('#soloTopics .topic-b').forEach((b) => b.classList.toggle('on', b.dataset.id === topic.id)); }

// the entry point: after the player picked hero, hat and name
export function startSolo(world, player, exit) {
  cam = world; me = player; onExit = exit; build();
  topic = SETS.find((s) => s.id === store.get('clue-solo-topic')) || SETS[0];
  drawTopics(); show('soloTopic');
}
function stop() { phase = 'off'; clearTimeout(timer); cancelAnimationFrame(raf); $('#soloLayer').hidden = true; cam.rest(); }

function begin() {
  const words = shuffle(topic.words).slice(0, ROUNDS);
  rounds = words.map(([word, desc, w1, w2]) => { const opts = shuffle([word, w1, w2]); return { word, desc, opts, right: opts.indexOf(word) }; });
  // three rivals with other heroes and hats, each a little different in skill and speed
  const others = shuffle(HEROES.filter((h) => h.id !== me.char)).slice(0, 3), names = shuffle(RIVAL_NAMES);
  fly = [{ me: true, name: me.name, char: me.char, hat: me.hat, x: 160 }].concat(others.map((h, i) => ({
    name: names[i], char: h.id, hat: HATS[1 + Math.floor(Math.random() * (HATS.length - 1))].id, x: [92, 228, 124][i],
    skill: [.55, .7, .82][i], speed: [9000, 6500, 4500][i],
  })));
  for (const f of fly) Object.assign(f, { alt: 0, shown: 0, streak: 0, best: 0, el: null });
  $('#soloTokens').innerHTML = '';
  for (const [i, f] of fly.entries()) {
    const el = document.createElement('div'); el.className = 'tok pop' + (f.me ? ' mine' : '');
    el.innerHTML = '<span class="tag"></span><img class="px-img bal" alt=""><img class="px-img hero" alt=""><b class="gain"></b>';
    el.style.setProperty('--d', (-i * .7) + 's');
    $('#soloTokens').appendChild(el); f.el = el; drawTok(f);
  }
  $('#soloLayer').hidden = false; qi = 0; show('soloGame');
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  cam.look(altY(0) - cam.viewH * .8, true);
  setTimeout(() => ask(0), 600);
}
function drawTok(f) {
  f.el.querySelector('.tag').textContent = f.me ? f.name + ' (YOU)' : f.name;
  f.el.querySelector('.bal').src = balloonsURL(3 + Math.min(3, f.streak), f.streak >= 3, f.x | 0);
  f.el.classList.toggle('hot', f.streak >= 3);
}
// every frame: place the flyers over the world and follow the player with the camera
function loop(t) {
  raf = requestAnimationFrame(loop);
  const vw = cam.viewW, vh = cam.viewH, x0 = (W - vw) / 2, cy = cam.y;
  const mine = fly.find((f) => f.me), hover = vh * .5;   // everyone hangs half a screen above the ground line, clear of the answer panel
  if (phase !== 'off') cam.look(altY(mine.shown) - hover - vh * .4);
  fly.forEach((f, i) => {
    const x = f.x + 3 * Math.sin(t / 2300 + i * 1.7), y = altY(f.shown) - hover - 3 * Math.sin(t / 900 + i * 2.3) - (f.me ? 0 : 8 * (i % 2));
    const hs = heroURL(f.char, { hat: f.hat, frame: heroFrame(t, i, f.el.classList.contains('rise')) });
    if (f.src !== hs) { f.el.querySelector('.hero').src = hs; f.src = hs; }
    f.el.style.left = ((x - x0) / vw * 100).toFixed(2) + '%';
    f.el.style.top = ((y - cy) / vh * 100).toFixed(2) + '%';
    f.el.style.zIndex = f.me ? 50 : 10 + i;
  });
  $('#soloHeads').innerHTML = fly.map((f) => `<img class="px-img rh${f.me ? ' lead' : ''}" style="top:${(altY(f.shown) / WH * 100).toFixed(2)}%" src="${heroURL(f.char, { hat: f.hat })}" alt="">`).join('');
}

function ask(i) {
  qi = i; picked = null; phase = 'q';
  const r = rounds[i];
  $('#soloNum').textContent = `CLUE ${i + 1}/${ROUNDS}`;
  $('#soloAlt').textContent = fly[0].alt + ' m';
  $('#soloLbl').textContent = 'WHAT IS IT?';
  $('#soloText').textContent = r.desc;
  $('#soloAns').innerHTML = r.opts.map((o, k) => `<button class="pbtn px opt-${LETTERS[k]} pop" style="animation-delay:${k * .08}s" data-k="${k}"><span class="shape"></span><span>${esc(o)}</span></button>`).join('');
  $('#soloClue').classList.remove('pop'); void $('#soloClue').offsetWidth; $('#soloClue').classList.add('pop');
  qStart = performance.now(); sfx.start();
  // the rivals answer in their own time
  for (const f of fly) if (!f.me) {
    f.t = Math.min(SECS * 1000 - 500, f.speed * (.5 + Math.random()));
    f.ok = Math.random() < f.skill;
  }
  tick();
}
function tick() {
  clearTimeout(timer);
  if (phase !== 'q') return;
  const left = Math.max(0, SECS * 1000 - (performance.now() - qStart)), f = left / (SECS * 1000);
  $('#soloBar').style.width = (Math.round(f * 40) * 2.5) + '%'; $('#soloBar').classList.toggle('low', f < .25);
  if (left <= 0) { choose(-1); return; }
  timer = setTimeout(tick, 100);
}
function choose(k) {
  if (phase !== 'q' || picked != null) return;
  picked = k; phase = 'reveal'; clearTimeout(timer);
  const r = rounds[qi], t = performance.now() - qStart, ok = k === r.right;
  $$('#soloAns .pbtn').forEach((b, j) => { b.disabled = true; b.classList.toggle('right', j === r.right); b.classList.toggle('wrongpick', j === k && !ok); b.classList.toggle('faded', j !== r.right && j !== k); });
  $('#soloLbl').textContent = ok ? 'RIGHT!' : k < 0 ? 'TIME IS UP!' : 'OOPS! IT WAS…';
  if (ok) { sfx.right(); } else sfx.wrong();
  // everyone's climb this round
  for (const f of fly) {
    const right = f.me ? ok : f.ok, time = f.me ? t : f.t;
    if (right) { f.streak++; f.best = Math.max(f.best, f.streak); f.gainNow = gainFor(time) + streakBonus(f.streak); }
    else { f.streak = 0; f.gainNow = 0; }
    f.from = f.alt; f.alt += f.gainNow;
  }
  const mine = fly[0];
  banner(ok ? `+${mine.gainNow} m${mine.streak >= 2 ? ' · STREAK ×' + mine.streak : ''}` : 'NO CLIMB THIS TIME');
  setTimeout(climb, 1300);
}
function climb() {
  phase = 'fly'; sfx.fly();
  for (const f of fly) { drawTok(f); const g = f.el.querySelector('.gain'); g.textContent = f.gainNow ? `+${f.gainNow} m` : ''; f.el.classList.toggle('rise', f.gainNow > 0); }
  const t0 = performance.now(), D = 2000;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
    for (const f of fly) f.shown = Math.round(f.from + (f.alt - f.from) * e);
    $('#soloAlt').textContent = fly[0].shown + ' m';
    if (k < 1) requestAnimationFrame(step);
    else {
      for (const f of fly) f.el.classList.remove('rise');
      if (qi + 1 < ROUNDS) setTimeout(() => ask(qi + 1), 500); else setTimeout(finish, 800);
    }
  };
  requestAnimationFrame(step);
}
function banner(text) { const b = $('#soloBanner'); b.textContent = text; b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); setTimeout(() => { b.hidden = true; }, 1800); }

function finish() {
  phase = 'end';
  const ranked = fly.slice().sort((a, b) => b.alt - a.alt), place = 1 + ranked.filter((f) => f.alt > fly[0].alt).length;
  const best = Math.max(store.get('clue-best', 0), fly[0].alt); store.set('clue-best', best);
  $('#soloTitle').textContent = place === 1 ? 'YOU WON!' : place <= 3 ? `${ordinal(place).toUpperCase()} PLACE!` : 'GOOD FLIGHT!';
  $('#soloTitle').className = 'verdict pop' + (place <= 3 ? ' ok' : '');
  $('#soloPodium').innerHTML = ranked.map((f, i) => `<div class="sp-row${f.me ? ' me' : ''}"><span class="pl">${i + 1}</span><img class="px-img" src="${heroURL(f.char, { hat: f.hat })}" alt=""><span class="nm">${esc(f.name)}${f.me ? ' (YOU)' : ''}</span><b>${f.alt} m</b></div>`).join('');
  $('#soloEndAlt').textContent = fly[0].alt + ' m'; $('#soloBest').textContent = best + ' m';
  $('#soloZone').textContent = `You flew up to the ${zoneAt(altY(fly[0].alt))}.` + (fly[0].alt >= TOP_ALT ? ' You reached the North Star!' : '');
  $('#soloLayer').hidden = true;
  show('soloEnd');
  if (place === 1) { sfx.fanfare(); confetti(4000); } else sfx.right();
}
