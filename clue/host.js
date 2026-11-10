// Clue Quest, the teacher's big screen: a balloon flight up a very tall snowy world. Pick a topic → lobby (code +
// QR; heroes appear in the village holding balloons) → each round: the clue (answers only on the phones), then
// automatically the answer with how many picked each word, then NEXT: everyone flies up by what they earned, name
// tags on top, the biggest streak shown → next clue → podium. This browser is the game: players, heights, clock.
import { $, $$, esc, shuffle, store, show, qrCanvas, confetti, ordinal } from './ui.js';
import { world, W as WW, VH, WH, GROUND, TOPY, ZONES, zoneAt } from './world.js';
import { HEROES, HATS, heroURL, heroFrame, artReady, balloonsURL } from './sprites.js';
import { SETS, setById, parseCustom } from './words.js';
import { hostGame } from './net.js';
import { sfx, unlock, music, setMuted, isMuted } from './sound.js';

const LETTERS = ['a', 'b', 'c'];
const img = (id, hat = 'none', cls = '') => `<img class="px-img hero-img ${cls}" src="${heroURL(id, { hat })}" alt="">`;

$('#app').innerHTML = `
<div class="stage" id="worldStage"><canvas id="world"></canvas><div id="tokens"></div>
  <div id="ruler"><div class="rail"></div><div id="rulerZones"></div><div id="rulerView"></div><div id="rulerHeads"></div></div>
  <div id="zoneBanner" hidden></div></div>
<div class="corner"><button class="btn px ghost" id="menuBtn" title="Back to the start menu">MENU</button><button class="btn px ghost" id="muteBtn" title="Sound on/off (M)">SOUND ON</button></div>
<section class="screen" id="setup"><div class="stage">
  <div class="logo">CLUE <i>QUEST</i></div>
  <div class="sub">Read the clue, pick the word on your phone, and fly your balloons up to the North Star!</div>
  <div id="sets"></div>
  <div id="options">
    <div class="choice px" data-k="rounds"><span>QUESTIONS</span><button class="px" data-v="5">5</button><button class="px" data-v="10">10</button><button class="px" data-v="15">15</button><button class="px" data-v="0">ALL</button></div>
    <div class="choice px" data-k="secs"><span>SECONDS</span><button class="px" data-v="10">10</button><button class="px" data-v="20">20</button><button class="px" data-v="30">30</button></div>
    <button class="btn px green" id="create">CREATE GAME</button>
  </div>
  <div class="modal" id="mine" hidden><div class="px">
    <h2>MY WORDS</h2>
    <p>One word per line: <b>word ; description ; wrong answer ; wrong answer</b>. The wrong answers are optional: missing ones are taken from your other words.</p>
    <textarea id="mineText" spellcheck="false" placeholder="umbrella ; You open it when it rains. ; raincoat ; boots&#10;bridge ; You walk over it to cross a river. ; tunnel ; road"></textarea>
    <div class="err" id="mineErr"></div>
    <div class="row"><button class="btn px ghost" id="mineCancel">CANCEL</button><button class="btn px" id="mineSave">SAVE WORDS</button></div>
  </div></div>
  <div id="loading" hidden>OPENING THE GAME…</div>
</div></section>

<section class="screen" id="lobby" hidden><div class="stage">
  <div class="join px">
    <div class="jt"><div class="how">Join on your phone:<br><b id="joinUrl">fugio.co/clue</b></div>
    <div class="code"><small>GAME CODE</small><span id="code">------</span></div></div>
    <div class="qrbox"><canvas id="qr"></canvas><div>SCAN ME</div></div>
  </div>
  <div class="lobby-hint" id="lobbyHint">PICK YOUR HERO AND HAT ON YOUR PHONE.<br>YOU WILL APPEAR HERE IN THE VILLAGE!</div>
  <div class="bar">
    <div class="count px"><span id="count">0</span> PLAYERS</div>
    <div class="topic px" id="lobbyTopic"></div>
    <button class="btn px ghost" id="backSetup">TOPIC</button>
    <button class="btn px green" id="startBtn" disabled>LIFT OFF</button>
  </div>
</div></section>

<section class="screen" id="question" hidden><div class="stage">
  <div id="clue" class="px"><div class="cl-top"><span id="qNum">1 / 10</span><span id="qTopic"></span></div><p id="clueText"></p><small>ANSWER ON YOUR PHONE!</small></div>
  <div id="timer" class="px"><span id="timerN">20</span><i id="timerBar"></i></div>
  <div id="answered"><div class="px" id="ansCount">0 / 0 ANSWERED</div><div class="faces" id="faces"></div></div>
  <button class="btn px" id="qSkip">SKIP</button>
</div></section>

<section class="screen" id="results" hidden><div class="stage">
  <div id="resPanel" class="px">
    <div class="rp-lbl">THE ANSWER IS</div><div class="rp-word" id="rpWord"></div>
    <div class="rp-clue" id="rpClue"></div>
    <div id="bars"></div>
    <div class="rp-sum" id="rpSum"></div>
  </div>
  <button class="btn px green" id="resNext">FLY!</button>
</div></section>

<section class="screen" id="fly" hidden><div class="stage">
  <div class="board-panel px"><h2>HIGHEST</h2><div id="rows"></div></div>
  <div class="streak-panel px" id="streakPanel"></div>
  <button class="btn px green" id="flyNext">NEXT CLUE</button>
</div></section>

<section class="screen" id="podium" hidden><div class="stage">
  <h1 class="logo">WINNERS!</h1>
  <div id="steps"></div>
  <div class="again"><button class="btn px green" id="againBtn">PLAY AGAIN</button></div>
</div></section>`;

const cam = world($('#world'));
artReady.then(() => { setsHTML(); syncTokens(); });   // the painted heroes replace the small ones when they have loaded

// ---------- settings ----------
const prefs = store.get('clue-host', { set: 'animals', rounds: 10, secs: 20 });
let custom = store.get('clue-mine', '');
function setsHTML() {
  const cards = SETS.map((s) => `<button class="set px${prefs.set === s.id ? ' on' : ''}" data-id="${s.id}">${img(s.icon, s.hat)}<span><b>${esc(s.title)}</b><small>${s.level} · ${s.words.length} WORDS</small></span></button>`);
  const n = parseCustom(custom).words.length;
  cards.push(`<button class="set px${prefs.set === 'mine' ? ' on' : ''}" data-id="mine">${img('charlie', 'tophat')}<span><b>My words</b><small>${n ? n + ' WORDS · EDIT' : 'WRITE YOUR OWN'}</small></span></button>`);
  $('#sets').innerHTML = cards.join('');
}
function optsHTML() { for (const box of $$('.choice')) for (const b of $$('button', box)) b.classList.toggle('on', String(prefs[box.dataset.k]) === b.dataset.v); }
setsHTML(); optsHTML();
$('#sets').addEventListener('click', (e) => {
  const b = e.target.closest('.set'); if (!b) return;
  unlock(); sfx.pick();
  if (b.dataset.id === 'mine') { openMine(); return; }
  prefs.set = b.dataset.id; store.set('clue-host', prefs); setsHTML();
});
$('#options').addEventListener('click', (e) => {
  const b = e.target.closest('.choice button'); if (!b) return;
  unlock(); sfx.tap();
  prefs[b.closest('.choice').dataset.k] = +b.dataset.v; store.set('clue-host', prefs); optsHTML();
});
function openMine() { $('#mineText').value = custom; $('#mineErr').textContent = ''; $('#mine').hidden = false; $('#mineText').focus(); }
$('#mineCancel').onclick = () => { $('#mine').hidden = true; };
$('#mineSave').onclick = () => {
  const t = $('#mineText').value, { words, errors } = parseCustom(t);
  if (words.length < 3) { $('#mineErr').textContent = errors[0] || 'Write at least 3 words.'; return; }
  custom = t; store.set('clue-mine', t);
  prefs.set = 'mine'; store.set('clue-host', prefs);
  $('#mine').hidden = true; setsHTML();
  if (errors.length) toast(errors[0]);
};
$('#menuBtn').onclick = () => { if (phase === 'setup' || confirm('Leave this game and go back to the menu?')) location.href = new URL('./', location.href).href; };
const muteBtn = $('#muteBtn');
const drawMute = () => { muteBtn.textContent = isMuted() ? 'SOUND OFF' : 'SOUND ON'; };
muteBtn.onclick = () => { unlock(); setMuted(!isMuted()); store.set('clue-mute', isMuted()); drawMute(); };
setMuted(!!store.get('clue-mute', false)); drawMute();
function toast(text, ms = 3500) {
  const t = document.createElement('div'); t.className = 'toast px'; t.textContent = text;
  document.querySelector('.screen:not([hidden]) .stage').appendChild(t); setTimeout(() => t.remove(), ms);
}

// ---------- the game ----------
const players = new Map();   // pid → { pid, name, char, hat, alt, shown, streak, best, online, last, lane }
let net = null, phase = 'setup', rounds = [], qi = -1, qStart = 0, qDur = 20000, answers = new Map(), timerT = null, topicTitle = '';
let lastTick = -1, closeT = null, lanes = 0, topAlt = 1500, climb = 1.5, lastZone = '';
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Player';
const validChar = (c) => (HEROES.some((h) => h.id === c) ? c : HEROES[0].id);
const validHat = (h) => (HATS.some((x) => x.id === h) ? h : 'none');
const list = () => [...players.values()];
const ranked = () => list().sort((a, b) => b.alt - a.alt || a.joined - b.joined);
const placeOf = (pid) => { const me = players.get(pid); return 1 + list().filter((p) => p.alt > me.alt).length; };
const altY = (alt) => GROUND - Math.min(1, alt / topAlt) * (GROUND - TOPY);
const balloonsFor = (p) => ({ n: 3 + Math.min(3, p.streak), gold: p.streak >= 3 });

function qMessage() {
  const r = rounds[qi];
  return { type: 'q', n: qi + 1, total: rounds.length, desc: r.desc, opts: r.opts, left: Math.max(0, qDur - (performance.now() - qStart)), dur: qDur };
}
const meOf = (p) => ({ name: p.name, char: p.char, hat: p.hat, score: p.alt, alt: p.alt, streak: p.streak });
function screenFor(pid) {
  const p = players.get(pid), me = meOf(p);
  if (phase === 'q') return { ...qMessage(), me, got: answers.has(pid) ? answers.get(pid).choice : null };
  if (phase === 'results' || phase === 'fly') return { type: 'res', me, ...resultFor(pid) };
  if (phase === 'podium') return { type: 'end', me, place: placeOf(pid), of: players.size, score: p.alt };
  return { type: 'wait', me, topic: topicTitle };
}

async function openGame() {
  if (net) { goLobby(); return; }
  $('#loading').hidden = false; $('#create').disabled = true;
  try {
    net = await hostGame({
      onHello(pid, me, isNew) {
        let p = players.get(pid);
        if (!p) { p = { pid, alt: 0, shown: 0, streak: 0, best: 0, joined: performance.now(), last: null, lane: lanes++ }; players.set(pid, p); }
        p.name = cleanName(me.name); p.char = validChar(me.char); p.hat = validHat(me.hat); p.online = true;
        if (isNew && phase === 'lobby') sfx.join();
        refresh();
        return screenFor(pid);
      },
      onMessage(pid, m) {
        const p = players.get(pid); if (!p) return;
        if (m.type === 'look') { p.name = cleanName(m.name); p.char = validChar(m.char); p.hat = validHat(m.hat); refresh(); }
        else if (m.type === 'answer') answer(pid, m);
      },
      onGone(pid) { const p = players.get(pid); if (p) { p.online = false; refresh(); } },
      onError(msg) { toast(msg); },
    });
  } catch (e) {
    $('#loading').hidden = true; $('#create').disabled = false;
    toast(e.message || 'Could not open the game.'); return;
  }
  $('#loading').hidden = true; $('#create').disabled = false;
  $('#code').textContent = net.code.slice(0, 3) + ' ' + net.code.slice(3);
  const url = new URL('./', location.href); url.search = '?code=' + net.code;
  const qr = qrCanvas(url.href, 8), c = $('#qr'); c.width = qr.width; c.height = qr.height; c.getContext('2d').drawImage(qr, 0, 0);
  $('#joinUrl').textContent = (location.host.replace(/^www\./, '') + new URL('./', location.href).pathname).replace(/\/$/, '');
  goLobby();
}
function pickRounds() {
  const words = prefs.set === 'mine' ? parseCustom(custom).words : (setById(prefs.set) || SETS[0]).words;
  topicTitle = prefs.set === 'mine' ? 'My words' : (setById(prefs.set) || SETS[0]).title;
  const n = prefs.rounds ? Math.min(prefs.rounds, words.length) : words.length;
  rounds = shuffle(words).slice(0, n).map(([word, desc, w1, w2]) => { const opts = shuffle([word, w1, w2]); return { word, desc, opts, right: opts.indexOf(word) }; });
  topAlt = 1500;                                        // the map: the forest floor (0 m) up to the North Star (1500 m)
  climb = 15 / Math.max(1, rounds.length);              // metres per answer scale with the game's length, so a great flight reaches the star
}
function goLobby() {
  phase = 'lobby'; qi = -1; pickRounds(); lastZone = ZONES[0][0];
  for (const p of players.values()) { p.alt = 0; p.shown = 0; p.streak = 0; p.best = 0; p.last = null; }
  $('#lobbyTopic').textContent = `${topicTitle} · ${rounds.length} clues · ${prefs.secs}s`;
  show('lobby'); cam.look(WH - VH); refresh(); music(true);
  for (const p of players.values()) net.send(p.pid, screenFor(p.pid));
}
function refresh() {
  if (phase === 'lobby') {
    const ps = list();
    $('#count').textContent = ps.filter((p) => p.online).length;
    $('#startBtn').disabled = !ps.some((p) => p.online);
    $('#lobbyHint').hidden = ps.length > 0;
  } else if (phase === 'q') drawAnswered();
  syncTokens();
}

// ---------- the heroes in the sky: tokens follow the camera every frame ----------
const toks = new Map();   // pid → { el, bal, hero, tag, key }
function syncTokens() {
  for (const [pid, t] of toks) if (!players.has(pid)) { t.el.remove(); toks.delete(pid); }
  const n = Math.max(1, players.size);
  const size = n > 24 ? 4.2 : n > 14 ? 5 : n > 7 ? 6 : 7;   // hero width in % of the screen
  $('#tokens').style.setProperty('--tw', size + '%');
  for (const p of players.values()) {
    let t = toks.get(p.pid);
    if (!t) {
      const el = document.createElement('button'); el.className = 'tok pop'; el.dataset.pid = p.pid;
      el.innerHTML = '<span class="tag"></span><img class="px-img bal" alt=""><img class="px-img hero" alt=""><b class="gain"></b>';
      el.style.setProperty('--d', (Math.random() * -2).toFixed(2) + 's');
      $('#tokens').appendChild(el);
      t = { el, bal: el.querySelector('.bal'), hero: el.querySelector('.hero'), tag: el.querySelector('.tag'), gain: el.querySelector('.gain') };
      toks.set(p.pid, t);
    }
    const b = balloonsFor(p), bs = balloonsURL(b.n, b.gold, p.lane); if (t.bal.getAttribute('src') !== bs) t.bal.src = bs;
    t.tag.textContent = p.name;
    t.el.classList.toggle('off', !p.online);
    t.el.classList.toggle('hot', p.streak >= 3);
  }
  drawRulerHeads();
}
// where each hero hangs: a lane across the screen (golden-ratio spread so neighbours differ), height from altitude
const laneX = (lane) => 34 + ((lane * .618034) % 1) * 52;   // right of the panels on the left, left of the ruler
function lobbyPos(p, i, n) {   // standing in the village square, in rows going back
  const cols = Math.min(n, n > 20 ? 12 : n > 10 ? 10 : 8), r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
  return { x: 46 + (c - (inRow - 1) / 2) * (84 / cols) + (r % 2) * 3, y: GROUND - r * 14 };
}
cam.onFrame((camY, t) => {
  if (phase === 'setup') return;
  const ps = list(), n = ps.length;
  const order = phase === 'lobby' ? ps : ranked();
  order.forEach((p, i) => {
    const tk = toks.get(p.pid); if (!tk) return;
    let x, y;
    if (phase === 'lobby') ({ x, y } = lobbyPos(p, i, n));
    else {
      // three staggered rows so name tags never sit on each other; every flyer drifts and bobs gently in the wind
      x = laneX(p.lane) + 1.6 * Math.sin(t / 2300 + p.lane * 1.7);
      y = altY(p.shown) - 6 - (p.lane % 3) * 13 - 3 * Math.sin(t / 900 + p.lane * 2.3);
    }
    const fr = heroFrame(t, p.lane, phase === 'fly' && tk.el.classList.contains('rise')), hs = heroURL(p.char, { hat: p.hat, frame: fr });
    if (tk.src !== hs) { tk.hero.src = hs; tk.src = hs; }   // the hero animates: swinging legs, a blink, a cheer while climbing
    tk.el.style.left = x + '%';
    tk.el.style.top = ((y - camY) / VH * 100).toFixed(2) + '%';
    tk.el.style.zIndex = phase === 'lobby' ? 10 + Math.round(y) % 100 : 200 - i;
  });
  $('#rulerView').style.top = (camY / WH * 100).toFixed(2) + '%';
});

// the altitude ruler on the right: the whole world, its zones, everyone's head at their height and the camera window
$('#rulerZones').innerHTML = ZONES.map(([name, top], i) => `<div class="rz" style="top:${((ZONES[i + 1] ? ZONES[i + 1][1] : 0) / WH * 100).toFixed(2)}%;height:${((top - (ZONES[i + 1] ? ZONES[i + 1][1] : 0)) / WH * 100).toFixed(2)}%"><span>${name.toUpperCase()}</span></div>`).join('');
$('#rulerView').style.height = (VH / WH * 100).toFixed(2) + '%';
function drawRulerHeads() {
  $('#rulerHeads').innerHTML = ranked().map((p, i) => `<img class="px-img rh${i === 0 && p.alt > 0 ? ' lead' : ''}" style="top:${(altY(p.shown) / WH * 100).toFixed(2)}%;left:${(i % 3) * 30}%" src="${heroURL(p.char, { hat: p.hat })}" alt="">`).join('');
}
// the camera keeps the highest flyer in view, under the panels at the top of the screen
function lookAtLeader(now) { const r = ranked(); const y = r.length ? altY(Math.max(...r.map((p) => p.shown))) : GROUND; cam.look(y - VH * .66, now); }   // below the panels at the top

$('#tokens').addEventListener('click', (e) => {
  if (phase !== 'lobby') return;
  const k = e.target.closest('.tok'); if (!k) return;
  if (!k.classList.contains('ask')) { $$('#tokens .ask').forEach((x) => x.classList.remove('ask')); k.classList.add('ask'); setTimeout(() => k.classList.remove('ask'), 3000); return; }
  const pid = k.dataset.pid; net.kick(pid); players.delete(pid); refresh();
});
$('#create').onclick = () => { unlock(); sfx.tap(); openGame(); };
$('#backSetup').onclick = () => { sfx.tap(); music(false); phase = 'setup'; show('setup'); $('#create').textContent = 'OPEN LOBBY'; };
$('#startBtn').onclick = () => {
  unlock(); music(false); sfx.fly();
  // lift off: everyone rises a little above the village before the first clue
  for (const p of players.values()) p.shown = 0;
  startQuestion(0);
};

// ---------- a round: the clue ----------
function startQuestion(i) {
  clearTimeout(closeT);
  qi = i; phase = 'q'; answers = new Map(); qDur = prefs.secs * 1000; qStart = performance.now(); lastTick = -1;
  const r = rounds[qi];
  $('#qNum').textContent = `CLUE ${qi + 1} / ${rounds.length}`;
  $('#qTopic').textContent = topicTitle.toUpperCase();
  $('#clueText').textContent = r.desc;
  $('#clue').classList.remove('pop'); void $('#clue').offsetWidth; $('#clue').classList.add('pop');
  show('question'); sfx.start(); lookAtLeader();
  for (const p of players.values()) net.send(p.pid, { ...qMessage(), me: meOf(p) });
  drawAnswered(); tickTimer();
}
function tickTimer() {
  clearTimeout(timerT);
  if (phase !== 'q') return;
  const left = Math.max(0, qDur - (performance.now() - qStart)), s = Math.ceil(left / 1000);
  $('#timerN').textContent = s; $('#timer').classList.toggle('low', s <= 5);
  $('#timerBar').style.height = (left / qDur * 100).toFixed(1) + '%';
  if (s !== lastTick) { if (s <= 5 && s > 0) sfx.tick(); lastTick = s; }
  if (left <= 0) { showResults(); return; }
  timerT = setTimeout(tickTimer, 100);
}
function drawAnswered() {
  const on = list().filter((p) => p.online || answers.has(p.pid));
  $('#ansCount').textContent = `${answers.size} / ${on.length} ANSWERED`;
  $('#faces').innerHTML = [...answers.keys()].map((pid) => players.get(pid)).filter(Boolean).map((p) => img(p.char, p.hat, 'pop')).join('');
}
function answer(pid, m) {
  if (phase !== 'q' || m.n !== qi + 1 || answers.has(pid)) return;
  const choice = m.choice | 0; if (choice < 0 || choice > 2) return;
  answers.set(pid, { choice, t: performance.now() - qStart });
  net.send(pid, { type: 'got', choice });
  sfx.tap(); drawAnswered();
  const tk = toks.get(pid); if (tk) { tk.el.classList.remove('nod'); void tk.el.offsetWidth; tk.el.classList.add('nod'); }
  // everyone has answered: straight on to the answer
  if (!list().some((p) => p.online && !answers.has(p.pid))) { clearTimeout(closeT); closeT = setTimeout(() => { if (phase === 'q') showResults(); }, 700); }
}
$('#qSkip').onclick = () => { if (phase === 'q') showResults(); };

// ---------- the answer: how many picked each word ----------
const r5 = (m) => Math.round(m / 5) * 5;
const gainFor = (t) => r5((50 + 50 * Math.max(0, 1 - t / qDur)) * climb);   // 50–100 m × climb, faster = higher
const streakBonus = (s) => (s >= 2 ? r5(10 * (Math.min(s, 5) - 1) * climb) : 0); // +10 … +40 m × climb
function resultFor(pid) {
  const p = players.get(pid), r = rounds[qi] || rounds[rounds.length - 1], l = p.last || { none: true };
  return { ok: !!l.ok, pts: (l.gain || 0) + (l.bonus || 0), gain: l.gain || 0, bonus: l.bonus || 0, none: !!l.none, word: r.word, score: p.alt, alt: p.alt, streak: p.streak, place: placeOf(pid), of: players.size, last: qi === rounds.length - 1, zone: zoneAt(altY(p.alt)) };
}
function showResults() {
  if (phase !== 'q') return;
  clearTimeout(timerT); clearTimeout(closeT);
  phase = 'results';
  const r = rounds[qi], counts = [0, 0, 0];
  for (const p of players.values()) {
    const a = answers.get(p.pid);
    if (!a) { p.last = { ok: false, none: true }; p.streak = 0; continue; }
    counts[a.choice]++;
    const ok = a.choice === r.right;
    if (ok) { p.streak++; p.best = Math.max(p.best, p.streak); const gain = gainFor(a.t), bonus = streakBonus(p.streak); p.alt += gain + bonus; p.last = { ok, gain, bonus }; }
    else { p.streak = 0; p.last = { ok: false }; }
  }
  $('#rpWord').textContent = r.word.toUpperCase();
  $('#rpClue').textContent = r.desc;
  const max = Math.max(1, ...counts);
  $('#bars').innerHTML = r.opts.map((o, k) => `<div class="bar-row${k === r.right ? ' win' : ' lose'}"><span class="bw opt-${LETTERS[k]} px"><span class="shape"></span>${esc(o)}</span><span class="bt"><i class="opt-${LETTERS[k]}" style="--w:${(counts[k] / max * 100).toFixed(0)}%"></i></span><b>${counts[k]}</b></div>`).join('');
  $('#rpSum').textContent = `${counts[r.right]} OF ${answers.size} GOT IT RIGHT`;
  $('#resNext').textContent = 'FLY!';
  show('results'); sfx.reveal();
  for (const p of players.values()) net.send(p.pid, { type: 'res', me: meOf(p), ...resultFor(p.pid) });
  syncTokens();
}
$('#resNext').onclick = () => { if (phase === 'results') flyUp(); };

// ---------- NEXT: everyone flies up; name tags on top; the biggest streak ----------
let flyT = null;
function flyUp() {
  phase = 'fly';
  const r = ranked();
  $('#rows').innerHTML = r.slice(0, 5).map((p, i) => `<div class="rank" style="animation-delay:${.3 + i * .12}s"><span class="pl">${1 + r.filter((x) => x.alt > p.alt).length}</span>${img(p.char, p.hat)}<span class="nm">${esc(p.name)}</span><span class="sc">${p.alt} m</span></div>`).join('');
  const best = list().filter((p) => p.streak > 0).sort((a, b) => b.streak - a.streak || b.alt - a.alt)[0];
  $('#streakPanel').innerHTML = best
    ? `<h2>BIGGEST STREAK</h2><div class="sp">${img(best.char, best.hat, 'hop')}<div><b>${esc(best.name)}</b><span class="fire">×${best.streak} IN A ROW</span><small>${best.streak >= 2 ? '+' + streakBonus(best.streak) + ' m STREAK BONUS' : 'ONE MORE FOR A BONUS!'}</small></div></div>`
    : '<h2>BIGGEST STREAK</h2><div class="sp"><small>NOBODY YET: GET TWO IN A ROW!</small></div>';
  $('#flyNext').textContent = qi === rounds.length - 1 ? 'RESULTS' : 'NEXT CLUE';
  show('fly'); sfx.fly();
  // "+75 m" over each hero that climbs
  for (const p of players.values()) {
    const tk = toks.get(p.pid); if (!tk) continue;
    const up = p.alt - p.shown;
    tk.gain.textContent = up > 0 ? `+${up} m` : '';
    tk.el.classList.toggle('rise', up > 0);
  }
  // animate the climb (the leaders a little later, so the camera rises with them)
  const from = new Map(list().map((p) => [p.pid, p.shown])), t0 = performance.now(), D = 2600;
  cancelAnimationFrame(flyT);
  const step = (t) => {
    let done = true;
    for (const p of players.values()) {
      const delay = Math.min(600, (p.alt / Math.max(1, topAlt)) * 900), f = Math.max(0, Math.min(1, (t - t0 - delay) / D));
      if (f < 1) done = false;
      const e = 1 - Math.pow(1 - f, 3);
      p.shown = Math.round(from.get(p.pid) + (p.alt - from.get(p.pid)) * e);
    }
    lookAtLeader(); drawRulerHeads();
    if (!done) flyT = requestAnimationFrame(step);
    else {
      lookAtLeader();
      const z = zoneAt(altY(r[0] ? r[0].alt : 0));
      if (r[0] && z !== lastZone) { lastZone = z; banner(`${r[0].name} reached the ${z}!`); }
    }
  };
  flyT = requestAnimationFrame(step);
  syncTokens();
}
function banner(text) {
  const b = $('#zoneBanner'); b.textContent = text.toUpperCase(); b.hidden = false;
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); sfx.right();
  setTimeout(() => { b.hidden = true; }, 3200);
}
$('#flyNext').onclick = () => {
  if (phase !== 'fly') return;
  for (const t of toks.values()) t.el.classList.remove('rise');
  if (qi === rounds.length - 1) podium(); else startQuestion(qi + 1);
};

// ---------- the podium ----------
function podium() {
  phase = 'podium';
  const r = ranked(), order = [[1, r[1]], [0, r[0]], [2, r[2]]];
  $('#steps').innerHTML = order.filter(([, p]) => p).map(([i, p]) => `<div class="step p${i + 1}"><img class="px-img sbal" src="${balloonsURL(3 + Math.min(3, p.best), p.best >= 3, p.lane)}" alt="">${img(p.char, p.hat, i === 0 ? 'hop' : '')}<div class="nm">${esc(p.name)}</div><div class="sc">${p.alt} m</div><div class="blk px">${i + 1}</div></div>`).join('');
  show('podium'); lookAtLeader();
  setTimeout(() => { sfx.fanfare(); confetti(5000); }, 2300);
  for (const p of players.values()) net.send(p.pid, screenFor(p.pid));
}
$('#againBtn').onclick = () => {
  sfx.tap(); phase = 'setup'; show('setup'); cam.look(WH - VH); $('#create').textContent = 'OPEN LOBBY';
  for (const p of players.values()) { p.alt = 0; p.shown = 0; p.streak = 0; net.send(p.pid, { type: 'wait', me: meOf(p), topic: '' }); }
};

addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input')) return;
  if (e.key === 'm' || e.key === 'M') { muteBtn.click(); return; }
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  const b = { setup: '#create', lobby: '#startBtn', results: '#resNext', fly: '#flyNext' }[phase];
  if (b && !$(b).disabled && $('#mine').hidden) $(b).click();
});
show('setup'); cam.look(WH - VH, true);
