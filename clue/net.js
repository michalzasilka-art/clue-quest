// Clue Quest networking. The teacher's browser is the game; phones talk to it through the PeerJS signalling
// server (the free public server FoxKarts parties use too). Every message goes over that server's WebSocket,
// not over a direct WebRTC link: a direct link needs a TURN relay whenever the phone and the laptop cannot reach
// each other (mobile data, school or guest Wi-Fi, most home routers between two devices), and the free TURN
// relays were down (2026-11-10), so phones could not join. A WebSocket works on any network that opens websites.
// The messages are tiny (a clue, three words, an answer), so this is no heavier than setting up WebRTC would be.
// No game server of our own, nothing stored. The 6-digit game code is the teacher's peer id.
// Phones are known by a player id (pid) they keep in localStorage, so a phone that sleeps or reloads comes back
// as the same player with the same score.
//
//   const H = await hostGame({ onHello(pid, me, isNew) → first message for that phone, onMessage(pid, m), onGone(pid) })
//   H.code   H.send(pid, msg)   H.sendAll(msg)   H.kick(pid)   H.online(pid)   H.close()
//   const G = await joinGame(code, { pid, name, char })    rejects with Error .code 'no such game' | 'network' | 'bad code' | 'kicked' | 'full'
//   G.on(type, fn)   G.send(msg)   G.onLost(fn)   G.close()     G.first: the host's first message (from onHello)

const PREFIX = 'fugio-clue-';
const TAG = 'clue1';                 // marks our messages inside the signalling server's CANDIDATE envelope
const PING = 4000, GONE = 15000;     // phones ping the teacher; 15 s of silence = gone
const MESSAGES = {
  'no such game': 'No game with that code. Check the code on the big screen.',
  network: 'No connection. Check the internet and try again.',
  'bad code': 'The game code has 6 numbers.',
  kicked: 'The teacher removed you from this game.',
  full: 'This game is full.',
};
function oops(code) { const e = new Error(MESSAGES[code] || code); e.code = code; return e; }
export const cleanCode = (c) => String(c || '').replace(/\D/g, '').slice(0, 6);
const newCode = () => String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
export const MAX_PLAYERS = 60;

let peerLib = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!peerLib) peerLib = new Promise((ok, fail) => {
    const s = document.createElement('script'); s.src = new URL('lib/peerjs.min.js', import.meta.url).href; s.async = true;
    s.onload = () => (window.Peer ? ok(window.Peer) : fail(oops('network')));
    s.onerror = () => { peerLib = null; s.remove(); fail(oops('network')); };
    document.head.appendChild(s);
  });
  return peerLib;
}
function openPeer(Peer, id) {
  return new Promise((ok, fail) => {
    const p = id ? new Peer(id, { debug: 0 }) : new Peer({ debug: 0 });
    // the error handler is only for opening: once open, a 'peer-unavailable' (a phone that has gone away) must not
    // destroy the peer, which it did before and took the whole game down with it
    const bad = (e) => { clearTimeout(t); p.off('open', good); p.destroy(); fail(e); };
    const good = () => { clearTimeout(t); p.off('error', bad); ok(p); };
    const t = setTimeout(() => { p.off('open', good); p.off('error', bad); p.destroy(); fail({ type: 'network' }); }, 15000);
    p.once('open', good);
    p.once('error', bad);
  });
}
// the relay: our message rides inside a CANDIDATE envelope, which the server passes on to `dst`. The server only
// passes envelopes that carry a well-formed ICE candidate, so each one carries a dummy one (a TEST-NET address that
// is never used); PeerJS on the other side files it under a connection that does not exist, and we empty that pile.
// The server answers EXPIRE (src = the unreachable id) when nobody has that id.
const ENV = { candidate: { candidate: 'candidate:1 1 udp 2122260223 192.0.2.1 9 typ host', sdpMid: '0', sdpMLineIndex: 0 }, type: 'data', connectionId: 'dc_clue' };
const DEBUG = /[?&]debug\b/.test(location.search);
function relay(peer) {
  const sock = peer.socket, fns = [], gone = [];
  sock.on('message', (d) => {
    if (DEBUG) console.log('clue in', d && d.type, d && d.src, d && d.payload && JSON.stringify(d.payload.m || '').slice(0, 80));
    if (!d || !d.src) return;
    if (d.type === 'CANDIDATE' && d.payload && d.payload[TAG]) {
      for (const f of fns) try { f(d.src, d.payload.m); } catch (e) { console.error('clue', e); }
      setTimeout(() => { try { peer._lostMessages && peer._lostMessages.delete(ENV.connectionId); } catch (e) { /* fine */ } }, 0);
    } else if (d.type === 'EXPIRE') for (const f of gone) f(d.src);
  });
  return {
    send(dst, m) { if (DEBUG) console.log('clue out', dst, JSON.stringify(m).slice(0, 80)); try { sock.send({ type: 'CANDIDATE', dst, payload: { ...ENV, [TAG]: 1, m } }); } catch (e) { /* socket closing */ } },
    on: (f) => fns.push(f),
    onExpire: (f) => gone.push(f),
  };
}
function keepSignal(peer, isClosed) {
  peer.on('disconnected', () => { if (!isClosed()) setTimeout(() => { try { if (!isClosed() && peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (e) { /* tried */ } }, 800); });
}

// ---------- the teacher ----------
export async function hostGame(h) {
  const Peer = await loadPeer();
  let peer = null, code = '', closed = false;
  for (let tries = 0; tries < 6 && !code; tries++) {
    const c = newCode();
    try { peer = await openPeer(Peer, PREFIX + c); code = c; }
    catch (e) { if (!(e && e.type === 'unavailable-id')) throw oops('network'); }
  }
  if (!code) throw oops('network');
  const R = relay(peer);
  const byPid = new Map();   // pid → { peer, seen }
  const pidOf = new Map();   // peer id → pid
  const banned = new Set();
  const drop = (pid, tell = true) => {
    const e = byPid.get(pid); if (!e) return;
    byPid.delete(pid); if (pidOf.get(e.peer) === pid) pidOf.delete(e.peer);
    if (tell && !closed) h.onGone(pid);
  };
  R.on((src, m) => {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'hello') {
      const id = String(m.pid || src).slice(0, 40);
      if (banned.has(id)) return R.send(src, { type: 'refuse', why: 'kicked' });
      const old = byPid.get(id), isNew = !old;
      if (isNew && byPid.size >= MAX_PLAYERS) return R.send(src, { type: 'refuse', why: 'full' });
      if (old && old.peer !== src) { pidOf.delete(old.peer); R.send(old.peer, { type: 'replaced' }); }
      byPid.set(id, { peer: src, seen: Date.now() }); pidOf.set(src, id);
      const first = h.onHello(id, m.me || {}, isNew);
      R.send(src, { type: 'welcome', code, first });
      return;
    }
    const pid = pidOf.get(src), e = pid && byPid.get(pid);
    if (!e) { R.send(src, { type: 'who' }); return; }   // we lost track of it: ask it to say hello again
    e.seen = Date.now();
    if (m.type === 'ping') R.send(src, { type: 'pong' });
    else h.onMessage(pid, m);
  });
  R.onExpire((src) => { const pid = pidOf.get(src); if (pid) drop(pid); });
  const sweep = setInterval(() => { const now = Date.now(); for (const [pid, e] of byPid) if (now - e.seen > GONE) drop(pid); }, 3000);
  keepSignal(peer, () => closed);
  peer.on('error', (e) => { if (e && e.type !== 'peer-unavailable' && h.onError) h.onError(oops('network').message); });
  const send = (pid, msg) => { const e = byPid.get(pid); if (e) R.send(e.peer, msg); };
  const close = () => {
    if (closed) return;
    for (const pid of byPid.keys()) send(pid, { type: 'bye' });
    closed = true; clearInterval(sweep);
    setTimeout(() => { try { peer.destroy(); } catch (e) { /* gone */ } }, 400);
  };
  addEventListener('pagehide', close);
  return {
    code, send, close,
    sendAll(msg) { for (const pid of byPid.keys()) send(pid, msg); },
    online: (pid) => byPid.has(pid),
    kick(pid) { banned.add(pid); send(pid, { type: 'kicked' }); drop(pid, false); },
  };
}

// ---------- a student ----------
export async function joinGame(rawCode, me) {
  const code = cleanCode(rawCode);
  if (code.length !== 6) throw oops('bad code');
  const Peer = await loadPeer();
  let peer;
  try { peer = await openPeer(Peer); } catch (e) { throw oops('network'); }
  const R = relay(peer), hostId = PREFIX + code;
  const handlers = {}, lost = [];
  let closed = false, joined = false, first = null, heard = Date.now(), pinger = null;
  const hello = () => R.send(hostId, { type: 'hello', pid: me.pid, me: { name: me.name, char: me.char } });
  const cleanup = () => { clearInterval(pinger); removeEventListener('pagehide', close); setTimeout(() => { try { peer.destroy(); } catch (e) { /* gone */ } }, 300); };
  const drop = () => { if (closed) return; closed = true; cleanup(); for (const f of lost) f(); };
  function close() { if (closed) return; closed = true; cleanup(); }
  try {
    await new Promise((ok, fail) => {
      const t = setTimeout(() => fail(oops('no such game')), 12000);
      const again = setInterval(hello, 2500);   // in case the first hello got lost
      const done = () => { clearTimeout(t); clearInterval(again); };
      R.onExpire((src) => { if (src === hostId && !joined) { done(); fail(oops('no such game')); } });
      R.on((src, m) => {
        if (src !== hostId || !m || typeof m !== 'object') return;
        heard = Date.now();
        if (!joined) {
          if (m.type === 'welcome') { done(); joined = true; first = m.first; ok(); }
          else if (m.type === 'refuse') { done(); fail(oops(m.why)); }
          return;
        }
        if (m.type === 'who') { hello(); return; }
        if (m.type === 'bye' || m.type === 'replaced') { drop(); return; }
        for (const f of handlers[m.type] || []) try { f(m); } catch (e) { console.error('clue', m.type, e); }
      });
      hello();
    });
  } catch (e) { closed = true; cleanup(); throw e; }
  R.onExpire((src) => { if (src === hostId && joined) drop(); });   // the teacher's screen is gone
  keepSignal(peer, () => closed);
  pinger = setInterval(() => { if (Date.now() - heard > GONE) drop(); else R.send(hostId, { type: 'ping' }); }, PING);
  addEventListener('pagehide', close);
  return {
    code, get first() { return first; },
    on(type, fn) { (handlers[type] ||= []).push(fn); },
    onLost(fn) { lost.push(fn); },
    send(msg) { if (!closed) R.send(hostId, msg); },
    close,
  };
}
