// Clue Quest, a student's phone: game code (or straight in from the QR code) → hero, hat and name → wait → each
// round read the clue and tap one of 3 words → right/wrong, metres climbed, streak bonus, height and place → final.
import { $, $$, esc, store, show, ordinal } from './ui.js';
import { phoneWorld } from './world.js';
import { HEROES, HATS, spriteURL, hatURL, balloonsURL } from './sprites.js';
import { joinGame, cleanCode } from './net.js';
import { sfx, unlock } from './sound.js';

phoneWorld($('#sky'));
const LETTERS = ['a', 'b', 'c'];
const flyer = (id) => `<div class="flyer ${id}"><img class="px-img fbal" alt=""><img class="px-img fhero" alt=""></div>`;

$('#app').innerHTML = `
<section class="screen" id="join"><div class="col">
  <div class="logo">CLUE<br><i>QUEST</i></div>
  <div class="card px">
    <h2>GAME CODE</h2>
    <div class="digits" id="digits">${'<span class="px"></span>'.repeat(6)}<input id="codeIn" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="6" aria-label="Game code"></div>
    <p class="err" id="joinErr"></p>
    <button class="btn px" id="codeGo">NEXT ▶</button>
  </div>
  <p class="hint">Type the code from the big screen, or scan its QR code.</p>
  <div class="join-crew">${HEROES.map((h, i) => `<img class="px-img hop" style="animation-delay:${-i * .13}s" src="${spriteURL(h.id, { hat: HATS[(i % (HATS.length - 1)) + 1].id })}" alt="">`).join('')}</div>
</div></section>

<section class="screen" id="me" hidden><div class="col">
  <div class="code-chip px" id="meCode">GAME ------</div>
  ${flyer('pick')}
  <div class="card px">
    <h2>PICK A HERO</h2>
    <div class="heroes" id="heroes"></div>
    <h2 style="margin-top:16px">PICK A HAT</h2>
    <div class="hats" id="hats"></div>
    <h2 style="margin-top:16px">YOUR NAME</h2>
    <input class="namebox" id="nameIn" maxlength="14" autocomplete="off" autocapitalize="words" placeholder="Your name">
    <p class="err" id="meErr"></p>
    <button class="btn px green" id="meGo">JOIN GAME ▶</button>
  </div>
</div></section>

<section class="screen" id="wait" hidden><div class="col">
  <div class="spacer"></div>
  <div class="wait-msg" id="waitTop">YOU'RE IN!</div>
  ${flyer('waiting')}
  <div class="me-name" id="waitName"></div>
  <div class="wait-msg blink" id="waitMsg">FIND YOURSELF IN THE VILLAGE<br>ON THE BIG SCREEN!</div>
  <div class="spacer"></div>
  <button class="btn px ghost" id="changeHero">CHANGE HERO OR HAT</button>
</div></section>

<section class="screen" id="q" hidden><div class="col">
  <div class="ptop"><div class="px" id="pNum">1/10</div><div class="tbar"><i id="tbar"></i></div><div class="px" id="pScore">0 m</div></div>
  <div class="px" id="pclue"><small>WHAT IS IT?</small><span id="pclueText"></span></div>
  <div class="pans" id="pans"></div>
  <div class="locked" id="locked" hidden>ANSWER LOCKED IN!<br><span class="blink">WAIT FOR THE OTHERS…</span></div>
</div></section>

<section class="screen" id="res" hidden><div class="col">
  <div class="verdict" id="verdict"></div>
  ${flyer('result')}
  <div class="res-card px"><div class="lbl">THE WORD WAS</div><div class="w" id="resWord"></div><div class="pts" id="resPts"></div><div class="bonus" id="resBonus"></div></div>
  <div class="stats"><div class="px"><span class="tag">HEIGHT</span><b id="resScore">0 m</b></div><div class="px"><span class="tag">PLACE</span><b id="resPlace">-</b></div></div>
  <p class="hint" id="resHint">Look at the big screen.</p>
</div></section>

<section class="screen" id="end" hidden><div class="col">
  <div class="spacer"></div>
  <div class="verdict" id="endTitle">GAME OVER</div>
  ${flyer('final')}
  <div class="stats"><div class="px"><span class="tag">PLACE</span><b id="endPlace">-</b></div><div class="px"><span class="tag">HEIGHT</span><b id="endScore">0 m</b></div></div>
  <p class="hint">Thanks for playing! Wait for the teacher to start the next game.</p>
  <div class="spacer"></div>
</div></section>

<section class="screen" id="lost" hidden><div class="col">
  <div class="spacer"></div>
  <div class="verdict no" id="lostTitle">OH NO!</div>
  <div class="card px"><p id="lostMsg" style="font-size:18px;margin:0 0 16px">The connection to the game was lost.</p><button class="btn px" id="rejoin">JOIN AGAIN ▶</button><button class="btn px ghost" id="newCode" style="margin-top:16px">ANOTHER CODE</button></div>
  <div class="spacer"></div>
</div></section>`;

// ---------- who am I ----------
const saved = store.get('clue-me', {});
const me = {
  pid: saved.pid || Array.from(crypto.getRandomValues(new Uint8Array(9)), (b) => b.toString(36).padStart(2, '0')).join(''),
  name: saved.name || '',
  char: HEROES.some((h) => h.id === saved.char) ? saved.char : HEROES[(Math.random() * HEROES.length) | 0].id,
  hat: HATS.some((h) => h.id === saved.hat) ? saved.hat : 'santa',
};
const save = () => store.set('clue-me', { pid: me.pid, name: me.name, char: me.char, hat: me.hat, code: game ? game.code : saved.code, at: Date.now() });
let game = null, code = '', editing = false, cur = null, picked = null, tbarT = null, joining = false, streak = 0;
// a hero hanging from balloons (more balloons with a streak, a golden one from 3 in a row)
function drawFlyer(which, s = streak) {
  for (const f of $$('.flyer.' + which)) {
    f.querySelector('.fhero').src = spriteURL(me.char, { hat: me.hat, scale: 6 });
    f.querySelector('.fbal').src = balloonsURL(3 + Math.min(3, s), s >= 3, 1, 6);
  }
}

// ---------- code ----------
const codeIn = $('#codeIn');
function drawDigits() {
  const v = codeIn.value; $$('#digits span').forEach((s, i) => { s.textContent = v[i] || ''; s.classList.toggle('cur', i === Math.min(v.length, 5) && document.activeElement === codeIn); });
}
codeIn.addEventListener('input', () => { codeIn.value = cleanCode(codeIn.value); $('#joinErr').textContent = ''; drawDigits(); if (codeIn.value.length === 6) goCode(); });
codeIn.addEventListener('focus', drawDigits); codeIn.addEventListener('blur', drawDigits);
codeIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') goCode(); });
$('#codeGo').onclick = goCode;
function goCode() {
  unlock();
  const c = cleanCode(codeIn.value);
  if (c.length !== 6) { $('#joinErr').textContent = 'The code has 6 numbers.'; $('#digits').classList.remove('shake'); void $('#digits').offsetWidth; $('#digits').classList.add('shake'); return; }
  code = c; sfx.tap(); openMe(false);
}

// ---------- hero, hat and name ----------
function drawPicks() {
  $('#heroes').innerHTML = HEROES.map((h) => `<button class="hero${h.id === me.char ? ' on' : ''}${h.ours ? ' ours' : ''}" data-id="${h.id}"><img class="px-img${h.id === me.char ? ' hop' : ''}" src="${spriteURL(h.id, { hat: me.hat })}" alt="">${esc(h.name)}</button>`).join('');
  $('#hats').innerHTML = HATS.map((t) => `<button class="hatb${t.id === me.hat ? ' on' : ''}" data-id="${t.id}" title="${esc(t.name)}"><img class="px-img" src="${hatURL(t.id)}" alt="${esc(t.name)}"></button>`).join('');
  drawFlyer('pick');
}
$('#heroes').addEventListener('click', (e) => { const b = e.target.closest('.hero'); if (!b) return; unlock(); sfx.pick(); me.char = b.dataset.id; drawPicks(); bounce(); });
$('#hats').addEventListener('click', (e) => { const b = e.target.closest('.hatb'); if (!b) return; unlock(); sfx.pop(); me.hat = b.dataset.id; drawPicks(); bounce(); });
function bounce() { const f = $('.flyer.pick'); f.classList.remove('boing'); void f.offsetWidth; f.classList.add('boing'); }
function openMe(edit) {
  editing = edit;
  $('#nameIn').value = me.name; $('#meErr').textContent = '';
  $('#meGo').textContent = edit ? 'SAVE ▶' : 'JOIN GAME ▶';
  $('#meCode').textContent = 'GAME ' + code.slice(0, 3) + ' ' + code.slice(3);
  drawPicks(); show('me');
}
$('#nameIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#nameIn').blur(); });
$('#meGo').onclick = async () => {
  unlock();
  const n = $('#nameIn').value.replace(/\s+/g, ' ').trim();
  if (!n) { $('#meErr').textContent = 'Type your name first.'; $('#nameIn').focus(); return; }
  me.name = n.slice(0, 14); save(); sfx.tap();
  if (editing && game) { game.send({ type: 'look', name: me.name, char: me.char, hat: me.hat }); drawWait(); show('wait'); return; }
  connect();
};
$('#changeHero').onclick = () => { sfx.tap(); openMe(true); };

// ---------- connecting ----------
async function connect() {
  if (joining) return; joining = true;
  $('#meGo').disabled = true; $('#meGo').textContent = 'JOINING…'; $('#rejoin').disabled = true;
  try {
    game = await joinGame(code, me);
  } catch (e) {
    joining = false; $('#meGo').disabled = false; $('#meGo').textContent = 'JOIN GAME ▶'; $('#rejoin').disabled = false;
    if (e.code === 'no such game' || e.code === 'bad code' || e.code === 'kicked') {
      if (document.body.dataset.screen === 'lost') { lost(e.message); return; }
      show('join'); codeIn.value = ''; drawDigits(); $('#joinErr').textContent = e.message; return;
    }
    if (document.body.dataset.screen === 'lost') lost(e.message); else $('#meErr').textContent = e.message;
    return;
  }
  joining = false; $('#meGo').disabled = false; $('#rejoin').disabled = false;
  save(); sfx.join();
  history.replaceState(null, '', location.pathname + '?code=' + code);
  game.on('wait', onWait); game.on('q', onQ); game.on('got', onGot); game.on('res', onRes); game.on('end', onEnd);
  game.on('kicked', () => { game.close(); game = null; lost('The teacher removed you from this game.', true); });
  game.onLost(() => { game = null; lost('Lost the connection. Joining again…'); setTimeout(connect, 700); });
  route(game.first);
}
function route(m) { if (!m) return; ({ wait: onWait, q: onQ, res: onRes, end: onEnd }[m.type] || onWait)(m); }
function lost(msg, kicked) {
  clearInterval(tbarT);
  $('#lostMsg').textContent = msg; $('#rejoin').hidden = !!kicked;
  show('lost');
}
$('#rejoin').onclick = () => { unlock(); connect(); };
// back from a locked screen or another app: if the link dropped meanwhile, join again straight away
document.addEventListener('visibilitychange', () => { if (!document.hidden && document.body.dataset.screen === 'lost' && !$('#rejoin').hidden && !joining) connect(); });
$('#newCode').onclick = () => { codeIn.value = ''; drawDigits(); $('#joinErr').textContent = ''; show('join'); };

// ---------- the rounds ----------
const buzz = (p) => { try { if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(p); } catch (e) { /* no buzz */ } };
function drawWait(m) {
  if (m && m.me) streak = m.me.streak || 0;
  drawFlyer('waiting'); $('#waitName').textContent = me.name;
  if (m) $('#waitTop').textContent = m.topic ? 'YOU\'RE IN! · ' + m.topic.toUpperCase() : 'YOU\'RE IN!';
}
function onWait(m) { clearInterval(tbarT); drawWait(m); show('wait'); }
function onQ(m) {
  cur = m; picked = m.got ?? null;
  if (m.me) streak = m.me.streak || 0;
  $('#pNum').textContent = `${m.n}/${m.total}`;
  $('#pScore').textContent = (m.me ? m.me.alt || 0 : 0) + ' m';
  $('#pclueText').textContent = m.desc;
  $('#pans').innerHTML = m.opts.map((o, k) => `<button class="pbtn px opt-${LETTERS[k]} pop" style="animation-delay:${k * .08}s" data-k="${k}"><span class="shape"></span><span>${esc(o)}</span></button>`).join('');
  $('#locked').hidden = picked == null;
  markPicked();
  show('q'); window.scrollTo(0, 0); $('#q').scrollTop = 0;
  const end = performance.now() + m.left, bar = $('#tbar');
  clearInterval(tbarT);
  const step = () => { const f = Math.max(0, (end - performance.now()) / m.dur); bar.style.width = (Math.round(f * 20) * 5) + '%'; bar.classList.toggle('low', f < .25); if (f <= 0) clearInterval(tbarT); };
  step(); tbarT = setInterval(step, 100);
  if (picked == null && m.n === 1) sfx.start();
}
function markPicked() {
  $$('#pans .pbtn').forEach((b) => { const k = +b.dataset.k; b.disabled = picked != null; b.classList.toggle('picked', k === picked); b.classList.toggle('faded', picked != null && k !== picked); });
}
$('#pans').addEventListener('click', (e) => {
  const b = e.target.closest('.pbtn'); if (!b || picked != null || !cur || !game) return;
  picked = +b.dataset.k; sfx.tap();
  buzz(30);
  game.send({ type: 'answer', n: cur.n, choice: picked });
  markPicked(); $('#locked').hidden = false;
});
function onGot(m) { picked = m.choice; markPicked(); $('#locked').hidden = false; }
function onRes(m) {
  clearInterval(tbarT);
  streak = m.streak || 0;
  const v = $('#verdict');
  v.textContent = m.ok ? 'RIGHT!' : m.none ? 'TIME\'S UP!' : 'OOPS!';
  v.className = 'verdict pop ' + (m.ok ? 'ok' : 'no');
  drawFlyer('result');
  const f = $('.flyer.result'); f.className = 'flyer result ' + (m.ok ? 'up' : 'wobble');
  $('#resWord').textContent = m.word;
  $('#resPts').textContent = m.ok ? `+${m.gain} m` : 'NO CLIMB THIS TIME';
  $('#resPts').style.color = m.ok ? '' : '#c02a3a';
  $('#resBonus').textContent = m.ok && m.bonus ? `+${m.bonus} m STREAK BONUS · ${m.streak} IN A ROW!` : m.ok && m.streak === 1 ? 'GET THE NEXT ONE FOR A STREAK BONUS!' : '';
  $('#resScore').textContent = m.alt + ' m';
  $('#resPlace').textContent = `${ordinal(m.place)}/${m.of}`;
  $('#resHint').textContent = m.last ? 'That was the last clue! Look at the big screen.' : (m.zone ? `You are flying over the ${m.zone}. Watch the big screen!` : 'Watch the big screen!');
  show('res');
  if (m.ok) sfx.right(); else sfx.wrong();
  buzz(m.ok ? [40, 60, 40] : 200);
}
function onEnd(m) {
  clearInterval(tbarT);
  $('#endTitle').textContent = m.place === 1 ? 'YOU WON!' : m.place <= 3 ? 'TOP 3!' : 'GAME OVER';
  $('#endTitle').className = 'verdict pop' + (m.place <= 3 ? ' ok' : '');
  drawFlyer('final');
  $('#endPlace').textContent = `${ordinal(m.place)}/${m.of}`;
  $('#endScore').textContent = m.score + ' m';
  show('end');
  if (m.place <= 3) sfx.right();
}

// ---------- start: straight in from the QR code (?code=123456), back in after a reload, or type the code ----------
const urlCode = cleanCode(new URLSearchParams(location.search).get('code'));
drawDigits();
if (urlCode.length === 6) {
  code = urlCode; codeIn.value = urlCode; drawDigits();
  // the same game a moment ago on this phone (it slept or reloaded): straight back in as the same player
  if (me.name && saved.code === urlCode && Date.now() - (saved.at || 0) < 3 * 3600e3) { openMe(false); connect(); }
  else openMe(false);
} else show('join');
