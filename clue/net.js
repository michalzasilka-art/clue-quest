// Clue Quest networking: the teacher's browser is the game; every phone connects to it peer-to-peer (WebRTC data
// channels through PeerJS and its free public signalling + TURN servers, the same way FoxKarts parties work), so
// there is no game server and nothing is stored. The 6-digit game code is the teacher's peer id.
// Phones are known by a player id (pid) they keep in localStorage, so a phone that sleeps or reloads comes back
// as the same player with the same score.
//
//   const H = await hostGame({ onHello(pid, me, isNew) → first message for that phone, onMessage(pid, m), onGone(pid) })
//   H.code   H.send(pid, msg)   H.sendAll(msg)   H.kick(pid)   H.close()
//   const G = await joinGame(code, { pid, name, char })    rejects with Error .code 'no such game' | 'network' | 'bad code' | 'kicked'
//   G.on(type, fn)   G.send(msg)   G.onLost(fn)   G.close()     G.first: the host's first message (from onHello)

const PREFIX = 'fugio-clue-';
const MESSAGES = {
  'no such game': 'No game with that code. Check the code on the big screen.',
  network: 'No connection. Check the internet and try again.',
  'bad code': 'The game code has 6 numbers.',
  kicked: 'The teacher removed you from this game.',
  full: 'This game is full.',
  unsupported: 'This browser cannot join. Try Chrome or Safari.',
};
function oops(code) { const e = new Error(MESSAGES[code] || code); e.code = code; return e; }
const fromPeerError = (e) => oops(e && e.type === 'peer-unavailable' ? 'no such game' : e && e.type === 'browser-incompatible' ? 'unsupported' : 'network');
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
    const t = setTimeout(() => { p.destroy(); fail({ type: 'network' }); }, 15000);
    p.once('open', () => { clearTimeout(t); ok(p); });
    p.once('error', (e) => { clearTimeout(t); p.destroy(); fail(e); });
  });
}

// ---------- the teacher ----------
export async function hostGame(h) {
  const Peer = await loadPeer();
  let peer = null, code = '', closed = false;
  for (let tries = 0; tries < 6 && !code; tries++) {
    const c = newCode();
    try { peer = await openPeer(Peer, PREFIX + c); code = c; }
    catch (e) { if (!(e && e.type === 'unavailable-id')) throw fromPeerError(e); }
  }
  if (!code) throw oops('network');
  const byPid = new Map();   // pid → DataConnection (the newest one)
  const banned = new Set();
  peer.on('connection', (c) => {
    let pid = null;
    c.on('data', (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'hello') {
        const id = String(m.pid || c.peer).slice(0, 40);
        if (banned.has(id)) { c.send({ type: 'refuse', why: 'kicked' }); return setTimeout(() => c.close(), 400); }
        const isNew = !byPid.has(id);
        if (isNew && byPid.size >= MAX_PLAYERS) { c.send({ type: 'refuse', why: 'full' }); return setTimeout(() => c.close(), 400); }
        const old = byPid.get(id); pid = id; byPid.set(id, c);
        if (old && old !== c) try { old.close(); } catch (e) { /* gone */ }
        const first = h.onHello(id, m.me || {}, isNew);
        c.send({ type: 'welcome', code, first });
      } else if (pid && byPid.get(pid) === c) h.onMessage(pid, m);
    });
    const gone = () => { if (pid && byPid.get(pid) === c) { byPid.delete(pid); if (!closed) h.onGone(pid); } };
    c.on('close', gone); c.on('error', gone);
  });
  peer.on('disconnected', () => { if (!closed) try { peer.reconnect(); } catch (e) { /* tried */ } });   // signalling only; phones stay
  peer.on('error', (e) => { if (e && e.type !== 'peer-unavailable' && h.onError) h.onError(fromPeerError(e).message); });
  const send = (pid, msg) => { const c = byPid.get(pid); if (c && c.open) try { c.send(msg); } catch (e) { /* closing */ } };
  const close = () => { if (closed) return; closed = true; for (const c of byPid.values()) try { c.close(); } catch (e) { /* gone */ } setTimeout(() => { try { peer.destroy(); } catch (e) { /* gone */ } }, 300); };
  addEventListener('pagehide', close);
  return {
    code, send, close,
    sendAll(msg) { for (const pid of byPid.keys()) send(pid, msg); },
    online: (pid) => byPid.has(pid),
    kick(pid) { banned.add(pid); send(pid, { type: 'kicked' }); const c = byPid.get(pid); byPid.delete(pid); setTimeout(() => { try { c && c.close(); } catch (e) { /* gone */ } }, 400); },
  };
}

// ---------- a student ----------
export async function joinGame(rawCode, me) {
  const code = cleanCode(rawCode);
  if (code.length !== 6) throw oops('bad code');
  const Peer = await loadPeer();
  let peer;
  try { peer = await openPeer(Peer); } catch (e) { throw fromPeerError(e); }
  const handlers = {}, lost = [];
  let closed = false, conn = null, first = null;
  const cleanup = () => { removeEventListener('pagehide', close); setTimeout(() => { try { peer.destroy(); } catch (e) { /* gone */ } }, 300); };
  function close() { if (closed) return; closed = true; try { conn && conn.close(); } catch (e) { /* gone */ } cleanup(); }
  try {
    await new Promise((ok, fail) => {
      const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const t = setTimeout(() => fail(oops('no such game')), 15000);
      const err = (e) => { clearTimeout(t); fail(fromPeerError(e)); };
      peer.once('error', err);
      c.on('open', () => c.send({ type: 'hello', pid: me.pid, me: { name: me.name, char: me.char } }));
      c.on('data', (m) => {
        if (!m || typeof m !== 'object') return;
        if (!conn) {
          if (m.type === 'welcome') { clearTimeout(t); peer.off('error', err); conn = c; first = m.first; ok(); }
          else if (m.type === 'refuse') { clearTimeout(t); fail(oops(m.why)); }
          return;
        }
        for (const f of handlers[m.type] || []) try { f(m); } catch (e) { console.error('clue', m.type, e); }
      });
      const drop = () => { if (!conn) return; if (closed) return; closed = true; for (const f of lost) f(); cleanup(); };
      c.on('close', drop); c.on('error', drop);
    });
  } catch (e) { closed = true; cleanup(); throw e; }
  addEventListener('pagehide', close);
  return {
    code, get first() { return first; },
    on(type, fn) { (handlers[type] ||= []).push(fn); },
    onLost(fn) { lost.push(fn); },
    send(msg) { if (!closed && conn && conn.open) try { conn.send(msg); } catch (e) { /* closing */ } },
    close,
  };
}
