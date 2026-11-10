// Chunky 8-bit sounds made on the spot with WebAudio square/triangle waves (no sound files).
let ac = null, master = null, muted = false, loopTimer = null;
export function unlock() {
  try {
    if (!ac) { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = .22; master.connect(ac.destination); }
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { ac = null; }
}
export const setMuted = (m) => { muted = m; if (master) master.gain.value = m ? 0 : .22; };
export const isMuted = () => muted;
function tone(f, t0, dur, type = 'square', vol = .5, slide = 0) {
  if (!ac || muted) return;
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
  o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.linearRampToValueAtTime(f + slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * .7); g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02);
}
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);   // MIDI note → Hz
export const sfx = {
  tap: () => tone(880, 0, .05, 'square', .3),
  join: () => { tone(N(72), 0, .07); tone(N(79), .07, .1); },
  pick: () => { tone(N(76), 0, .05); tone(N(83), .05, .07); },
  tick: () => tone(N(84), 0, .04, 'square', .25),
  tock: () => tone(N(72), 0, .06, 'square', .35),
  start: () => [60, 64, 67, 72].forEach((n, i) => tone(N(n), i * .09, .1)),
  right: () => [72, 76, 79, 84].forEach((n, i) => tone(N(n), i * .07, .09)),
  wrong: () => { tone(N(55), 0, .14, 'square', .4); tone(N(50), .14, .28, 'square', .4, -40); },
  reveal: () => { tone(N(67), 0, .08); tone(N(74), .1, .08); tone(N(79), .2, .2, 'triangle', .6); },
  fly: () => { for (let i = 0; i < 10; i++) tone(N(60 + i * 2), i * .05, .07, 'square', .22); tone(N(84), .52, .25, 'triangle', .5); },
  pop: () => { tone(N(90), 0, .03, 'square', .4); tone(N(70), .03, .06, 'square', .3, -200); },
  fanfare: () => [[67, 0], [67, .12], [67, .24], [72, .36], [76, .6], [79, .78], [84, .96]].forEach(([n, t], i) => tone(N(n), t, i === 6 ? .5 : .14, 'square', .45)),
};
// a little looping lobby tune (teacher screen only)
const TUNE = [72, 76, 79, 76, 74, 77, 81, 77, 72, 76, 79, 84, 83, 79, 74, 71];
const BASS = [48, 48, 53, 53, 48, 48, 55, 55];
export function music(on) {
  clearInterval(loopTimer); loopTimer = null;
  if (!on) return;
  let i = 0;
  const step = () => {
    if (!ac || muted) { i++; return; }
    tone(N(TUNE[i % TUNE.length]), 0, .16, 'square', .16);
    if (i % 2 === 0) tone(N(BASS[(i / 2) % BASS.length]), 0, .3, 'triangle', .35);
    i++;
  };
  loopTimer = setInterval(step, 220);
}
