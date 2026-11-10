// Clue Quest, the teacher's big screen: pick a topic → lobby with code + QR → rounds (clue, timer, reveal,
// leaderboard) → podium. This browser is the game: it keeps the players, the scores and the clock.
import { $, $$, esc, shuffle, store, show, qrCanvas, confetti, ordinal } from './ui.js';
import { world, pathPoint, MEADOW, W as WW, H as WH } from './world.js';
import { HEROES, heroById, spriteURL } from './sprites.js';
import { SETS, setById, parseCustom } from './words.js';
import { hostGame } from './net.js';
import { sfx, unlock, music, setMuted, isMuted } from './sound.js';

const LETTERS = ['a', 'b', 'c'];
const img = (id, cls = '') => `<img class="px-img ${cls}" src="${spriteURL(id)}" alt="">`;

$('#app').innerHTML = `
<div class="stage" id="worldStage"><canvas id="world"></canvas><div id="tokens"></div></div>
<div class="corner"><button class="btn px ghost" id="muteBtn" title="Sound on/off (M)">SOUND ON</button></div>
<section class="screen" id="setup"><div class="stage">
  <div class="logo">CLUE <i>QUEST</i></div>
  <div class="sub">Read the clue. Guess the word. Everyone plays on their phone.</div>
  <div id="sets"></div>
  <div id="options">
    <div class="choice px" data-k="rounds"><span>QUESTIONS</span><button class="px" data-v="5">5</button><button class="px" data-v="10">10</button><button class="px" data-v="15">15</button><button class="px" data-v="0">ALL</button></div>
    <div class="choice px" data-k="secs"><span>SECONDS</span><button class="px" data-v="10">10</button><button class="px" data-v="20">20</button><button class="px" data-v="30">30</button></div>
    <button class="btn px green" id="create">CREATE GAME ▶</button>
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
  <div class="lobby-hint" id="lobbyHint">PICK YOUR HERO ON YOUR PHONE.<br>IT WILL APPEAR HERE IN THE VILLAGE!</div>
  <div class="bar">
    <div class="count px"><span id="count">0</span> PLAYERS</div>
    <div class="topic px" id="lobbyTopic"></div>
    <button class="btn px ghost" id="backSetup">◀ TOPIC</button>
    <button class="btn px green" id="startBtn" disabled>START ▶</button>
  </div>
</div></section>

<section class="screen" id="question" hidden><div class="stage">
  <div class="qtop"><div class="px" id="qNum">1 / 10</div><div class="px" id="qTopic"></div><div class="px" id="qCode"></div></div>
  <div id="clue" class="px"><small id="clueLbl">WHAT IS IT?</small><p id="clueText"></p></div>
  <div id="timer" class="px">20</div>
  <div id="answersT"></div>
  <div id="answered"><div class="px" id="ansCount">0 / 0 ANSWERED</div><div class="faces" id="faces"></div><button class="btn px" id="qNext">SKIP ▶</button></div>
</div></section>

<section class="screen" id="board" hidden><div class="stage">
  <div class="board-panel px"><h2>TOP 5</h2><div id="rows"></div></div>
  <div class="more" id="boardMore"></div>
  <button class="btn px green" id="boardNext">NEXT ▶</button>
</div></section>

<section class="screen" id="podium" hidden><div class="stage">
  <h1 class="logo">WINNERS!</h1>
  <div id="steps"></div>
  <div class="again"><button class="btn px green" id="againBtn">PLAY AGAIN ▶</button></div>
</div></section>`;

world($('#world'));

// ---------- settings ----------
const prefs = store.get('clue-host', { set: 'animals', rounds: 10, secs: 20 });
let custom = store.get('clue-mine', '');
function setsHTML() {
  const cards = SETS.map((s) => `<button class="set px${prefs.set === s.id ? ' on' : ''}" data-id="${s.id}">${img(s.icon)}<span><b>${esc(s.title)}</b><small>${s.level} · ${s.words.length} WORDS</small></span></button>`);
  const n = parseCustom(custom).words.length;
  cards.push(`<button class="set px${prefs.set === 'mine' ? ' on' : ''}" data-id="mine">${img('ghost')}<span><b>My words</b><small>${n ? n + ' WORDS · EDIT' : 'WRITE YOUR OWN'}</small></span></button>`);
  $('#sets').innerHTML = cards.join('');
}
function optsHTML() {
  for (const box of $$('.choice')) for (const b of $$('button', box)) b.classList.toggle('on', String(prefs[box.dataset.k]) === b.dataset.v);
}
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
const muteBtn = $('#muteBtn');
const drawMute = () => { muteBtn.textContent = isMuted() ? 'SOUND OFF' : 'SOUND ON'; };
muteBtn.onclick = () => { unlock(); setMuted(!isMuted()); store.set('clue-mute', isMuted()); drawMute(); };
setMuted(!!store.get('clue-mute', false)); drawMute();

function toast(text, ms = 3500) {
  const t = document.createElement('div'); t.className = 'toast px'; t.textContent = text;
  document.querySelector('.screen:not([hidden]) .stage').appendChild(t); setTimeout(() => t.remove(), ms);
}

// ---------- the game ----------
const players = new Map();   // pid → { pid, name, char, score, streak, online, last }
let net = null, phase = 'setup', rounds = [], qi = -1, qStart = 0, qDur = 20000, answers = new Map(), timerT = null, topicTitle = '';
let lastTick = -1, closeT = null;
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Player';
const validChar = (c) => (HEROES.some((h) => h.id === c) ? c : HEROES[0].id);
const list = () => [...players.values()];
const ranked = () => list().sort((a, b) => b.score - a.score || a.joined - b.joined);
function placeOf(pid) { const r = ranked(), me = players.get(pid); return 1 + r.filter((p) => p.score > me.score).length; }

function qMessage() {
  const r = rounds[qi];
  return { type: 'q', n: qi + 1, total: rounds.length, desc: r.desc, opts: r.opts, left: Math.max(0, qDur - (performance.now() - qStart)), dur: qDur };
}
function screenFor(pid) {
  const p = players.get(pid);
  const me = { name: p.name, char: p.char, score: p.score };
  if (phase === 'q') return { ...qMessage(), me, got: answers.has(pid) ? answers.get(pid).choice : null };
  if (phase === 'reveal' || phase === 'board') return { type: 'res', me, ...resultFor(pid) };
  if (phase === 'podium') return { type: 'end', me, place: placeOf(pid), of: players.size, score: p.score };
  return { type: 'wait', me, topic: topicTitle };
}

async function openGame() {
  if (net) { goLobby(); return; }
  $('#loading').hidden = false; $('#create').disabled = true;
  try {
    net = await hostGame({
      onHello(pid, me, isNew) {
        let p = players.get(pid);
        if (!p) { p = { pid, score: 0, streak: 0, joined: performance.now(), last: null }; players.set(pid, p); }
        p.name = cleanName(me.name); p.char = validChar(me.char); p.online = true;
        if (isNew && phase === 'lobby') sfx.join();
        refresh();
        return screenFor(pid);
      },
      onMessage(pid, m) {
        const p = players.get(pid); if (!p) return;
        if (m.type === 'look') { p.name = cleanName(m.name); p.char = validChar(m.char); refresh(); }
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
  rounds = shuffle(words).slice(0, n).map(([word, desc, w1, w2]) => {
    const opts = shuffle([word, w1, w2]);
    return { word, desc, opts, right: opts.indexOf(word) };
  });
}
function goLobby() {
  phase = 'lobby'; qi = -1; pickRounds();
  for (const p of players.values()) { p.score = 0; p.streak = 0; p.last = null; }
  $('#lobbyTopic').textContent = `${topicTitle} · ${rounds.length} questions · ${prefs.secs}s`;
  show('lobby'); refresh(); music(true);
  for (const p of players.values()) net.send(p.pid, screenFor(p.pid));
}
function refresh() {
  if (phase === 'lobby') {
    const ps = list();
    $('#count').textContent = ps.filter((p) => p.online).length;
    $('#startBtn').disabled = !ps.some((p) => p.online);
    $('#lobbyHint').hidden = ps.length > 0;
    placeTokens('lobby');
  } else if (phase === 'q') drawAnswered();
}

// ---------- the heroes on the map: in the village while waiting, on the lit path by score after each round ----------
const toks = new Map();   // pid → element
const pct = (x, y) => ({ left: (x / WW * 100).toFixed(2) + '%', top: (y / WH * 100).toFixed(2) + '%' });
function tokenFor(p) {
  let el = toks.get(p.pid);
  if (!el) {
    el = document.createElement('button'); el.className = 'tok'; el.dataset.pid = p.pid;
    el.innerHTML = '<i class="pin"></i><img class="px-img hop" alt=""><span></span>';
    $('#tokens').appendChild(el); toks.set(p.pid, el);
    el.querySelector('img').style.animationDelay = (Math.random() * -.7).toFixed(2) + 's';
    el.classList.add('pop');
  }
  const im = el.querySelector('img'), src = spriteURL(p.char);
  if (im.getAttribute('src') !== src) im.src = src;
  el.querySelector('span').textContent = p.name;
  el.classList.toggle('off', !p.online);
  return el;
}
function placeTokens(mode) {
  for (const [pid, el] of toks) if (!players.has(pid)) { el.remove(); toks.delete(pid); }
  const ps = mode === 'lobby' ? list() : ranked();
  const n = ps.length; if (!n) return;
  if (mode === 'lobby') {
    // a grid on the meadow, as big as fits
    const bw = MEADOW.x1 - MEADOW.x0, bh = MEADOW.y1 - MEADOW.y0;
    let s = 26;
    while (s > 9 && Math.ceil(n / Math.floor(bw / (s * 1.2))) * s * 1.35 > bh) s -= 1;
    const cols = Math.max(1, Math.floor(bw / (s * 1.2))), rows = Math.ceil(n / cols);
    ps.forEach((p, i) => {
      const el = tokenFor(p), r = Math.floor(i / cols), c = i % cols, inRow = Math.min(cols, n - r * cols);
      const x = MEADOW.x0 + bw / 2 + (c - (inRow - 1) / 2) * s * 1.2 + ((r % 2) ? s * .3 : 0);
      const y = MEADOW.y1 - (rows - 1 - r) * s * 1.35;
      Object.assign(el.style, pct(x, y), { width: (s / WW * 100).toFixed(2) + '%', zIndex: 10 + r });
      el.classList.remove('lead');
    });
  } else {
    const max = Math.max(1, rounds.length * 1000);
    const s = n > 20 ? 13 : n > 10 ? 16 : 20;
    const used = [];
    ps.forEach((p, i) => {
      const el = tokenFor(p);
      let t = Math.min(1, p.score / max), pt = pathPoint(t);
      // heroes on the same spot step aside a little
      let k = used.filter((q) => Math.hypot(q.x - pt.x, q.y - pt.y) < s * .55).length;
      const pos = { x: pt.x + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * s * .55, y: pt.y + (k % 3) * 2 };
      used.push(pt);
      Object.assign(el.style, pct(pos.x, pos.y + 1), { width: (s / WW * 100).toFixed(2) + '%', zIndex: 100 - Math.min(i, 90) });
      el.classList.toggle('lead', i === 0 && p.score > 0);
    });
  }
}
$('#tokens').addEventListener('click', (e) => {
  if (phase !== 'lobby') return;
  const k = e.target.closest('.tok'); if (!k) return;
  if (!k.classList.contains('ask')) { $$('#tokens .ask').forEach((x) => x.classList.remove('ask')); k.classList.add('ask'); setTimeout(() => k.classList.remove('ask'), 3000); return; }
  const pid = k.dataset.pid; net.kick(pid); players.delete(pid); refresh();
});
$('#create').onclick = () => { unlock(); sfx.tap(); openGame(); };
$('#backSetup').onclick = () => { sfx.tap(); music(false); phase = 'setup'; show('setup'); $('#create').textContent = 'OPEN LOBBY ▶'; };
$('#startBtn').onclick = () => { unlock(); startQuestion(0); };

function startQuestion(i) {
  music(false); clearTimeout(closeT);
  qi = i; phase = 'q'; answers = new Map(); qDur = prefs.secs * 1000; qStart = performance.now(); lastTick = -1;
  const r = rounds[qi];
  $('#qNum').textContent = `${qi + 1} / ${rounds.length}`;
  $('#qTopic').textContent = topicTitle.toUpperCase();
  $('#qCode').textContent = 'CODE ' + net.code;
  $('#clueLbl').textContent = 'WHAT IS IT?'; $('#clue').classList.remove('revealed');
  $('#clueText').textContent = r.desc;
  $('#answersT').innerHTML = r.opts.map((o, k) => `<div class="ans px opt-${LETTERS[k]} pop" style="animation-delay:${.15 + k * .12}s"><span class="shape"></span><span>${esc(o)}</span><span class="n"></span></div>`).join('');
  $('#qNext').textContent = 'SKIP ▶'; $('#qNext').className = 'btn px';
  show('question'); sfx.start();
  for (const p of players.values()) net.send(p.pid, { ...qMessage(), me: { name: p.name, char: p.char, score: p.score } });
  drawAnswered(); tickTimer();
}
function tickTimer() {
  clearTimeout(timerT);
  if (phase !== 'q') return;
  const left = Math.max(0, qDur - (performance.now() - qStart)), s = Math.ceil(left / 1000);
  $('#timer').textContent = s; $('#timer').classList.toggle('low', s <= 5);
  if (s !== lastTick) { if (s <= 5 && s > 0) sfx.tick(); lastTick = s; }
  if (left <= 0) { reveal(); return; }
  timerT = setTimeout(tickTimer, 100);
}
function drawAnswered() {
  const on = list().filter((p) => p.online || answers.has(p.pid));
  $('#ansCount').textContent = `${answers.size} / ${on.length} ANSWERED`;
  $('#faces').innerHTML = [...answers.keys()].map((pid) => players.get(pid)).filter(Boolean).map((p) => img(p.char, 'pop')).join('');
}
function answer(pid, m) {
  if (phase !== 'q' || m.n !== qi + 1 || answers.has(pid)) return;
  const choice = m.choice | 0; if (choice < 0 || choice > 2) return;
  answers.set(pid, { choice, t: performance.now() - qStart });
  net.send(pid, { type: 'got', choice });
  sfx.tap(); drawAnswered();
  const waiting = list().filter((p) => p.online && !answers.has(p.pid));
  if (!waiting.length) { clearTimeout(closeT); closeT = setTimeout(() => { if (phase === 'q') reveal(); }, 700); }
}
function points(t) { return Math.round((500 + 500 * Math.max(0, 1 - t / qDur)) / 10) * 10; }
function resultFor(pid) {
  const p = players.get(pid), r = rounds[qi] || rounds[rounds.length - 1];
  return { ok: !!(p.last && p.last.ok), pts: p.last ? p.last.pts : 0, none: !p.last || p.last.none, word: r.word, score: p.score, streak: p.streak, place: placeOf(pid), of: players.size, last: qi === rounds.length - 1 };
}
function reveal() {
  if (phase !== 'q') return;
  clearTimeout(timerT); clearTimeout(closeT);
  phase = 'reveal';
  const r = rounds[qi], counts = [0, 0, 0];
  for (const p of players.values()) {
    const a = answers.get(p.pid);
    if (!a) { p.last = { ok: false, pts: 0, none: true }; p.streak = 0; continue; }
    counts[a.choice]++;
    const ok = a.choice === r.right;
    let pts = ok ? points(a.t) : 0;
    if (ok) { p.streak++; if (p.streak >= 3) pts += 100; } else p.streak = 0;
    p.score += pts; p.last = { ok, pts };
  }
  $('#timer').textContent = '0';
  $('#clueLbl').innerHTML = `THE ANSWER IS<b>${esc(r.word.toUpperCase())}</b>`; $('#clue').classList.add('revealed');
  $$('#answersT .ans').forEach((el, k) => {
    el.classList.remove('pop');
    el.classList.toggle('dim', k !== r.right); el.classList.toggle('win', k === r.right);
    $('.n', el).textContent = counts[k];
  });
  $('#ansCount').textContent = `${counts[r.right]} / ${answers.size} RIGHT`;
  $('#faces').innerHTML = [...answers].filter(([, a]) => a.choice === r.right).map(([pid]) => players.get(pid)).filter(Boolean).map((p) => img(p.char, 'hop')).join('');
  $('#qNext').textContent = qi === rounds.length - 1 ? 'RESULTS ▶' : 'NEXT ▶'; $('#qNext').className = 'btn px green';
  sfx.reveal();
  for (const p of players.values()) net.send(p.pid, { type: 'res', me: { name: p.name, char: p.char, score: p.score }, ...resultFor(p.pid) });
}
$('#qNext').onclick = () => {
  if (phase === 'q') { reveal(); return; }
  if (phase !== 'reveal') return;
  if (qi === rounds.length - 1) podium(); else leaderboard();
};
function leaderboard() {
  phase = 'board';
  const r = ranked(), top = r.slice(0, 5);
  $('#rows').innerHTML = top.map((p, i) => `<div class="rank" style="animation-delay:${i * .1}s"><span class="pl">${1 + r.filter((x) => x.score > p.score).length}</span>${img(p.char)}<span class="nm">${esc(p.name)}</span><span class="sc">${p.score}</span></div>`).join('');
  $('#boardMore').textContent = `QUESTION ${qi + 1} OF ${rounds.length} · CLIMB TO THE CHRISTMAS TREE!`;
  show('board'); sfx.pick();
  requestAnimationFrame(() => placeTokens('map'));
}
$('#boardNext').onclick = () => { if (phase === 'board') startQuestion(qi + 1); };
function podium() {
  phase = 'podium';
  const r = ranked(), order = [[1, r[1]], [0, r[0]], [2, r[2]]];
  $('#steps').innerHTML = order.filter(([, p]) => p).map(([i, p]) => `<div class="step p${i + 1}">${img(p.char, i === 0 ? 'hop' : '')}<div class="nm">${esc(p.name)}</div><div class="sc">${p.score}</div><div class="blk px">${i + 1}</div></div>`).join('');
  show('podium');
  setTimeout(() => { sfx.fanfare(); confetti(5000); }, 2300);
  for (const p of players.values()) net.send(p.pid, screenFor(p.pid));
}
$('#againBtn').onclick = () => { sfx.tap(); phase = 'setup'; show('setup'); $('#create').textContent = 'OPEN LOBBY ▶'; for (const p of players.values()) net.send(p.pid, { type: 'wait', me: { name: p.name, char: p.char, score: 0 }, topic: '' }); };

addEventListener('keydown', (e) => {
  if (e.target.closest('textarea, input')) return;
  if (e.key === 'm' || e.key === 'M') { muteBtn.click(); return; }
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  const b = { setup: '#create', lobby: '#startBtn', reveal: '#qNext', board: '#boardNext' }[phase];
  if (b && !$(b).disabled && $('#mine').hidden) $(b).click();
});
show('setup');
