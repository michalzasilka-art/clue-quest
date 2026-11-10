// Clue Quest, Individual: one player alone on one screen (a phone or a computer). A lobby in the snowy forest where
// your hero hangs from its balloons (switch hero and hat, type your name, pick a topic), then 10 clues: the clue sits
// in a box right next to your hero, you tap one of 3 words at the bottom, the result floats up, your hero cheers or
// droops and climbs, and the next clue comes by itself. The camera follows you up the painted map to 1500 m; at the
// end you get a title for how high you flew and your best height is kept on this device.
import { $, $$, esc, store, show, shuffle, confetti } from './ui.js';
import { HEROES, HATS, heroURL, heroFrame, hatURL, balloonsURL, heroHold } from './sprites.js';
import { SETS } from './words.js';
import { W, WH, GROUND, TOPY, ZONES, zoneAt } from './world.js';
import { sfx, unlock } from './sound.js';

const LETTERS = ['a', 'b', 'c'];
const ROUNDS = 10, SECS = 20, TOP_ALT = 1500, CLIMB = 15 / ROUNDS;
const altY = (alt) => GROUND - Math.min(1, alt / TOP_ALT) * (GROUND - TOPY);
const r5 = (m) => Math.round(m / 5) * 5;
const gainFor = (t) => r5((50 + 50 * Math.max(0, 1 - t / (SECS * 1000))) * CLIMB);
const streakBonus = (s) => (s >= 2 ? r5(10 * (Math.min(s, 5) - 1) * CLIMB) : 0);
const TITLES = [[1500, 'NORTH STAR HERO'], [1200, 'STAR CHASER'], [900, 'AURORA RIDER'], [600, 'CLOUD SURFER'], [300, 'PEAK EXPLORER'], [0, 'TREETOP FLYER']];
const titleFor = (alt) => TITLES.find(([m]) => alt >= m)[1];

let built = false, cam = null, me = null, onExit = null, saveMe = null;
let rounds = [], qi = 0, qStart = 0, timer = null, phase = 'off', topic = SETS[0], raf = 0;
const P = { alt: 0, shown: 0, from: 0, streak: 0, best: 0, right: 0, gain: 0, mood: 'idle', moodUntil: 0, zone: '' };

function build() {
  if (built) return; built = true;
  $('#app').insertAdjacentHTML('beforeend', `
<section class="screen solo-lobby" id="soloLobby" hidden>
  <div class="sl-top"><div class="logo small">CLUE <i>QUEST</i></div><div class="tagline">THE BALLOON CLIMB</div></div>
  <div class="sl-stage">
    <button class="sl-arrow" id="slPrev" aria-label="Previous hero">◀</button>
    <div class="sl-hero"><img class="px-img sl-bal" id="slBal" alt=""><img class="px-img sl-img" id="slHero" alt=""><div class="sl-shadow"></div></div>
    <button class="sl-arrow" id="slNext" aria-label="Next hero">▶</button>
  </div>
  <div class="sl-name"><b id="slHeroName">FOXINO</b><small id="slHeroTag"></small></div>
  <div class="sl-panel">
    <div class="sl-hats" id="slHats"></div>
    <input class="sl-input" id="slName" maxlength="14" autocomplete="off" autocapitalize="words" placeholder="YOUR NAME">
    <div class="sl-topics" id="slTopics"></div>
    <p class="err" id="slErr"></p>
    <button class="btn px green" id="soloGo">BEGIN CLIMB</button>
    <div class="sl-row"><button class="btn px ghost" id="soloBack">MENU</button><div class="sl-best px" id="slBest"></div></div>
  </div>
</section>
<section class="screen solo-game" id="soloGame" hidden>
  <div class="solo-hud"><div class="px" id="soloNum">CLUE 1/10</div><div class="px sg-streak" id="soloStreak" hidden></div><div class="px" id="soloAlt">0 m</div></div>
  <div class="sg-clue px" id="soloClue"><small id="soloLbl">WHAT IS IT?</small><span id="soloText"></span></div>
  <div class="sg-result" id="soloResult" hidden><b id="srTitle"></b><span id="srWord"></span><i id="srPts"></i></div>
  <div class="sg-bottom"><div class="sg-timer" id="soloTimer"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="tt"></circle><circle cx="18" cy="18" r="15" class="tf" id="soloRing"></circle></svg><span id="soloSecs">20</span></div><div class="pans" id="soloAns"></div></div>
  <div class="solo-banner" id="soloBanner" hidden></div>
</section>
<section class="screen solo-end" id="soloEnd" hidden><div class="col">
  <div class="spacer"></div>
  <div class="se-label">YOU FLEW TO</div>
  <div class="se-height" id="seHeight">0 m</div>
  <div class="se-title" id="seTitle">TREETOP FLYER</div>
  <div class="se-hero"><img class="px-img" id="seBal" alt=""><img class="px-img" id="seHero" alt=""></div>
  <div class="stats"><div class="px"><span class="tag">RIGHT</span><b id="seRight">0/10</b></div><div class="px"><span class="tag">BEST</span><b id="seBest">0 m</b></div></div>
  <p class="hint" id="seZone"></p>
  <button class="btn px green" id="soloAgain">CLIMB AGAIN</button>
  <button class="btn px ghost" id="soloMenu">LOBBY</button>
  <div class="spacer"></div>
</div></section>`);
  document.body.insertAdjacentHTML('beforeend', `<div id="soloLayer" hidden>
  <div id="soloMe" class="tok mine"><span class="tag"></span><img class="px-img bal" alt=""><img class="px-img hero" alt=""><b class="gain"></b></div>
  <div id="soloRuler"><div class="rail"></div><div id="soloTicks"></div><div id="soloMark"><img class="px-img" alt=""><span></span></div></div></div>`);
  $('#soloTicks').innerHTML = [0, 250, 500, 750, 1000, 1250, 1500].map((m) => `<div class="tick" style="top:${(altY(m) / WH * 100).toFixed(2)}%"><span>${m === 1500 ? '★' : m}</span></div>`).join('');
  // lobby controls
  $('#slPrev').onclick = () => stepHero(-1);
  $('#slNext').onclick = () => stepHero(1);
  $('#slHats').addEventListener('click', (e) => { const b = e.target.closest('.sl-hat'); if (!b) return; unlock(); sfx.pop(); me.hat = b.dataset.id; drawLobby(true); });
  $('#slTopics').addEventListener('click', (e) => { const b = e.target.closest('.sl-topic'); if (!b) return; unlock(); sfx.pick(); topic = SETS.find((s) => s.id === b.dataset.id); store.set('clue-solo-topic', topic.id); drawLobby(); });
  $('#slName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#slName').blur(); });
  $('#soloGo').onclick = () => {
    unlock();
    const n = $('#slName').value.replace(/\s+/g, ' ').trim();
    if (!n) { $('#slErr').textContent = 'Type your name first.'; $('#slName').focus(); return; }
    me.name = n.slice(0, 14); saveMe && saveMe(); $('#slErr').textContent = '';
    sfx.fly(); begin();
  };
  $('#soloBack').onclick = () => { sfx.tap(); stop(); onExit && onExit('menu'); };
  $('#soloAns').addEventListener('click', (e) => { const b = e.target.closest('.pbtn'); if (b) choose(+b.dataset.k); });
  addEventListener('keydown', (e) => {
    if (phase === 'q' && ['1', '2', '3'].includes(e.key)) choose(+e.key - 1);
    if (phase === 'lobby' && e.key === 'ArrowLeft') stepHero(-1);
    if (phase === 'lobby' && e.key === 'ArrowRight') stepHero(1);
  });
  $('#soloAgain').onclick = () => { unlock(); sfx.tap(); begin(); };
  $('#soloMenu').onclick = () => { sfx.tap(); openLobby(); };
  cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
}
function stepHero(d) {
  unlock(); sfx.pick();
  const i = HEROES.findIndex((h) => h.id === me.char);
  me.char = HEROES[(i + d + HEROES.length) % HEROES.length].id;
  saveMe && saveMe(); drawLobby(true);
}
function drawLobby(bounce) {
  const h = HEROES.find((x) => x.id === me.char) || HEROES[0];
  $('#slHeroName').textContent = h.name.toUpperCase();
  $('#slHeroTag').textContent = h.ours ? '★ FOXINO CREW' : 'WINTER FRIEND';
  $('#slBal').src = balloonsURL(3, false, 2, 6);
  $('.sl-hero').style.setProperty('--hold', heroHold(h.id).toFixed(3));
  $('#slHats').innerHTML = HATS.map((t) => `<button class="sl-hat${t.id === me.hat ? ' on' : ''}" data-id="${t.id}" title="${esc(t.name)}"><img class="px-img" src="${hatURL(t.id)}" alt="${esc(t.name)}"></button>`).join('');
  $('#slTopics').innerHTML = SETS.map((s) => `<button class="sl-topic${s.id === topic.id ? ' on' : ''}" data-id="${s.id}">${esc(s.title)}</button>`).join('');
  const on = $('#slTopics .on'); if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
  const best = store.get('clue-best', 0);
  $('#slBest').textContent = best ? `BEST ${best} m · ${titleFor(best)}` : 'NORTH STAR AT 1500 m';
  if (bounce) { const s = $('.sl-hero'); s.classList.remove('boing'); void s.offsetWidth; s.classList.add('boing'); }
}

// ---------- the entry point (from the start menu) ----------
export function startSolo(world, player, exit, save) {
  cam = world; me = player; onExit = exit; saveMe = save; build();
  topic = SETS.find((s) => s.id === store.get('clue-solo-topic')) || SETS[0];
  openLobby();
}
function openLobby() {
  stop(); phase = 'lobby';
  $('#slName').value = me.name || '';
  drawLobby(); show('soloLobby');
}
function stop() { clearTimeout(timer); $('#soloLayer').hidden = true; cam.rest(); if (phase !== 'lobby') phase = 'off'; }

// ---------- the climb ----------
function begin() {
  rounds = shuffle(topic.words).slice(0, ROUNDS).map(([word, desc, w1, w2]) => { const opts = shuffle([word, w1, w2]); return { word, desc, opts, right: opts.indexOf(word) }; });
  Object.assign(P, { alt: 0, shown: 0, from: 0, streak: 0, best: 0, right: 0, gain: 0, mood: 'idle', moodUntil: 0, zone: ZONES[0][0] });
  $('#soloMe .tag').textContent = me.name;
  $('#soloMe').style.setProperty('--hold', heroHold(me.char).toFixed(3));
  $('#soloMark img').src = heroURL(me.char, { hat: me.hat });
  drawBalloons();
  $('#soloLayer').hidden = false; $('#soloStreak').hidden = true;
  show('soloGame'); phase = 'intro';
  cam.look(altY(0) - cam.viewH * .95, true);
  setTimeout(() => ask(0), 700);
}
function drawBalloons() { $('#soloMe .bal').src = balloonsURL(3 + Math.min(3, P.streak), P.streak >= 3, 2); $('#soloMe').classList.toggle('hot', P.streak >= 3); }

// every frame: your hero hangs a little left of centre, the clue box beside it; the camera follows you up
function loop(t) {
  raf = requestAnimationFrame(loop);
  if (phase === 'lobby') {
    const im = $('#slHero'), src = heroURL(me.char, { hat: me.hat, frame: heroFrame(t, 0, 'idle'), scale: 6 });
    if (im.getAttribute('src') !== src) im.src = src;
    return;
  }
  if (phase === 'off' || phase === 'end') return;
  const vw = cam.viewW, vh = cam.viewH, x0 = (W - vw) / 2, wide = innerWidth > innerHeight * 1.1;
  const hover = vh * .62;                                   // you hang this far above your height line, clear of the answers
  const y = altY(P.shown) - hover - 4 * Math.sin(t / 1000);
  cam.look(altY(P.shown) - hover - vh * (wide ? .64 : .5));   // feet half-way down a phone, lower on a wide screen so the balloons clear the top bar
  const sx = wide ? 26 : 22, el = $('#soloMe');
  el.style.left = (sx + 1.5 * Math.sin(t / 2300)) + '%';
  el.style.top = ((y - cam.y) / vh * 100).toFixed(2) + '%';
  const mood = t < P.moodUntil ? P.mood : (phase === 'climb' ? 'rise' : 'idle');
  const src = heroURL(me.char, { hat: me.hat, frame: heroFrame(t, 3, mood) });
  if (el.dataset.src !== src) { el.querySelector('.hero').src = src; el.dataset.src = src; }
  $('#soloMark').style.top = (altY(P.shown) / WH * 100).toFixed(2) + '%';
  $('#soloMark span').textContent = P.shown + ' m';
}

function ask(i) {
  qi = i; phase = 'q';
  const r = rounds[i];
  $('#soloNum').textContent = `CLUE ${i + 1}/${ROUNDS}`;
  $('#soloLbl').textContent = 'WHAT IS IT?';
  $('#soloText').textContent = r.desc;
  $('#soloResult').hidden = true;
  $('#soloAns').innerHTML = r.opts.map((o, k) => `<button class="pbtn px opt-${LETTERS[k]} pop" style="animation-delay:${.1 + k * .08}s" data-k="${k}"><span class="shape"></span><span>${esc(o)}</span></button>`).join('');
  const c = $('#soloClue'); c.hidden = false; c.classList.remove('slidein'); void c.offsetWidth; c.classList.add('slidein');
  qStart = performance.now(); sfx.start(); tick();
}
function tick() {
  clearTimeout(timer);
  if (phase !== 'q') return;
  const left = Math.max(0, SECS * 1000 - (performance.now() - qStart)), f = left / (SECS * 1000), s = Math.ceil(left / 1000);
  $('#soloSecs').textContent = s;
  $('#soloRing').style.strokeDashoffset = (94.25 * (1 - f)).toFixed(1);
  $('#soloTimer').classList.toggle('low', s <= 5);
  if (left <= 0) { choose(-1); return; }
  timer = setTimeout(tick, 100);
}
function choose(k) {
  if (phase !== 'q') return;
  phase = 'reveal'; clearTimeout(timer);
  const r = rounds[qi], t = performance.now() - qStart, ok = k === r.right;
  $$('#soloAns .pbtn').forEach((b, j) => { b.disabled = true; b.classList.toggle('right', j === r.right); b.classList.toggle('wrongpick', j === k && !ok); b.classList.toggle('faded', j !== r.right && j !== k); });
  if (ok) { P.streak++; P.best = Math.max(P.best, P.streak); P.right++; const bonus = streakBonus(P.streak); P.gain = gainFor(t) + bonus; P.bonus = bonus; }
  else { P.streak = 0; P.gain = 0; P.bonus = 0; }
  P.from = P.alt; P.alt += P.gain;
  P.mood = ok ? 'cheer' : 'sad'; P.moodUntil = performance.now() + 1500;
  // the result floats up between the clue and the answers
  $('#srTitle').textContent = ok ? (P.streak >= 3 ? 'ON FIRE!' : 'RIGHT!') : k < 0 ? 'TIME IS UP!' : 'OOPS!';
  $('#srTitle').className = ok ? 'ok' : 'no';
  $('#srWord').textContent = ok ? r.word : `IT WAS: ${r.word}`;
  $('#srPts').textContent = ok ? `+${P.gain} m${P.bonus ? ` · STREAK ×${P.streak} +${P.bonus} m` : ''}` : 'NO CLIMB THIS TIME';
  const res = $('#soloResult'); res.hidden = false; res.classList.remove('floatup'); void res.offsetWidth; res.classList.add('floatup');
  $('#soloClue').hidden = true;
  $('#soloStreak').hidden = P.streak < 2; $('#soloStreak').textContent = `STREAK ×${P.streak}`;
  if (ok) sfx.right(); else sfx.wrong();
  setTimeout(climb, 1300);
}
function climb() {
  phase = 'climb';
  drawBalloons();
  const el = $('#soloMe'), g = el.querySelector('.gain');
  g.textContent = P.gain ? `+${P.gain} m` : '';
  el.classList.toggle('rise', P.gain > 0);
  if (P.gain) sfx.fly();
  const t0 = performance.now(), D = P.gain ? 2100 : 500;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
    P.shown = Math.round(P.from + (P.alt - P.from) * e);
    $('#soloAlt').textContent = P.shown + ' m';
    if (k < 1) { requestAnimationFrame(step); return; }
    el.classList.remove('rise');
    const z = zoneAt(altY(P.alt) - 40);
    if (z !== P.zone) { P.zone = z; banner(`WELCOME TO THE ${z.toUpperCase()}`); }
    if (qi + 1 < ROUNDS) setTimeout(() => ask(qi + 1), 700); else setTimeout(finish, 900);
  };
  requestAnimationFrame(step);
}
function banner(text) { const b = $('#soloBanner'); b.textContent = text; b.hidden = false; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); sfx.reveal(); setTimeout(() => { b.hidden = true; }, 2200); }

function finish() {
  phase = 'end';
  const best = Math.max(store.get('clue-best', 0), P.alt), newBest = P.alt > store.get('clue-best', 0); store.set('clue-best', best);
  $('#seHeight').textContent = P.alt + ' m';
  $('#seTitle').textContent = titleFor(P.alt);
  $('#seHero').src = heroURL(me.char, { hat: me.hat, frame: P.alt ? 3 : 0, scale: 6 });
  $('.se-hero').style.setProperty('--hold', heroHold(me.char).toFixed(3));
  $('#seBal').src = balloonsURL(3 + Math.min(3, P.best), P.best >= 3, 2, 6);
  $('#seRight').textContent = `${P.right}/${ROUNDS}`;
  $('#seBest').textContent = best + ' m';
  $('#seZone').textContent = P.alt >= TOP_ALT ? 'You reached the North Star!' : `You flew up to the ${zoneAt(altY(P.alt))}.` + (newBest ? ' A new best!' : '');
  $('#soloLayer').hidden = true;
  show('soloEnd');
  if (newBest || P.alt >= TOP_ALT) { sfx.fanfare(); confetti(4000); } else sfx.right();
}
