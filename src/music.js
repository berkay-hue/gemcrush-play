// F40: telifsiz, tamamen kodla üretilen arka plan müziği (WebAudio; dosya yok).
// İki parça: 'farm' (giriş + çiftlik: sıcak ninni) ve 'game' (bölüm içi: yumuşak lo-fi arpej).
// Sakin, kesintisiz döngü; sahne geçişinde yumuşak geçiş, sekme gizlenince durur, Ayarlar'dan kapatılır.
import { save, persist } from './meta/save.js';
import { ac } from './sound.js';

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
// [vuruş, midi, süre(vuruş)] — her ölçü 4 vuruş
export const TRACKS = {
  farm: {
    bpm: 72, peak: 0.2,
    chords: [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], // C Am F G
    melody: [
      [[0, 76, 1], [1, 79, 1], [2, 81, 0.5], [2.5, 79, 1.5]],
      [[0, 76, 1], [1, 72, 1], [2, 74, 2]],
      [[0, 72, 1], [1, 74, 0.5], [1.5, 76, 1.5], [3, 79, 1]],
      [[0, 79, 1.5], [1.5, 76, 0.5], [2, 74, 2]],
      [[0, 76, 1], [1, 79, 1], [2, 81, 0.5], [2.5, 79, 1.5]],
      [[0, 76, 1], [1, 79, 1], [2, 84, 2]],
      [[0, 81, 1], [1, 79, 1], [2, 76, 1], [3, 74, 1]],
      [[0, 74, 1], [1, 76, 1], [2, 72, 2]],
    ],
  },
  game: {
    bpm: 84, peak: 0.16,
    chords: [[41, 53, 57, 60, 64], [43, 55, 59, 62, 67], [40, 52, 55, 59, 62], [45, 52, 57, 60, 64]], // Fmaj7 G Em7 Am7
    melody: [
      [[1, 72, 1.5], [3, 76, 1]],
      [[0, 74, 2]],
      [[1, 71, 1], [2, 72, 1], [3, 74, 1]],
      [[0, 76, 3]],
      [[1, 81, 1.5], [3, 79, 1]],
      [[0, 74, 2]],
      [[2, 71, 1], [3, 72, 1]],
      [[0, 69, 3]],
    ],
  },
};
export const trackFor = (sceneKey) => (sceneKey === 'Game' ? 'game' : 'farm');
export const musicOn = () => save.music !== false;
export function setMusic(on) { save.music = !!on; persist(); if (on) music.play(want); else music.stop(); }

let want = 'farm', cur = null, bus = null, fx = null, timer = 0, bar = 0, nextAt = 0;

function chain(a) {
  if (fx) return fx;
  const out = a.createGain(); out.gain.value = 1;
  const lp = a.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
  const dl = a.createDelay(1); dl.delayTime.value = 0.36;
  const fb = a.createGain(); fb.gain.value = 0.32;
  const dlp = a.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1600;
  const wet = a.createGain(); wet.gain.value = 0.35;
  out.connect(lp).connect(a.destination);
  out.connect(dl); dl.connect(dlp).connect(fb).connect(dl); dlp.connect(wet).connect(lp);
  return (fx = out);
}
function voice(a, dest, f, t, dur, type, gain, att, rel, detune = 0) {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = f; o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + att);
  g.gain.setTargetAtTime(0.0001, t + Math.max(att, dur), rel / 4);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + rel + 0.1);
}
function schedBar(a, tr, t0, n) {
  const b = 60 / tr.bpm, ch = tr.chords[n % tr.chords.length], phrase = n % 16;
  const soft = phrase >= 8; // ikinci 8 ölçü: melodi seyrek, yalnız zemin → yorulmaz
  // zemin: yumuşak ped (iki hafif akortsuz üçgen)
  const pad = a.createBiquadFilter(); pad.type = 'lowpass'; pad.frequency.value = 900; pad.connect(bus);
  ch.slice(1).forEach((m) => { voice(a, pad, hz(m), t0, 4 * b, 'triangle', 0.045, 1.2, 2.2, -6); voice(a, pad, hz(m), t0, 4 * b, 'sine', 0.035, 1.2, 2.2, 5); });
  voice(a, bus, hz(ch[0]), t0, 3.6 * b, 'sine', 0.09, 0.08, 1.2);
  if (tr === TRACKS.game) {
    // lo-fi arpej: sekizlikler, çok kısık
    const up = ch.slice(1).concat([ch[2] + 12]);
    for (let i = 0; i < 8; i++) if (!soft || i % 2 === 0) voice(a, bus, hz(up[(i * 3) % up.length] + 12), t0 + i * b / 2, b * 0.4, 'triangle', 0.028, 0.01, 0.5);
  }
  const mel = tr.melody[n % tr.melody.length];
  mel.forEach(([at, m, d], i) => {
    if (soft && i % 2) return;
    const t = t0 + at * b, f = hz(soft ? m + 12 : m);
    voice(a, bus, f, t, d * b * 0.9, 'sine', 0.07, 0.012, 1.6); // müzik kutusu
    voice(a, bus, f * 2, t, d * b * 0.5, 'sine', 0.015, 0.01, 0.8);
  });
}
function tick() {
  const a = ac(); if (!a || !cur || !bus) return;
  const tr = TRACKS[cur], b = 60 / tr.bpm;
  if (nextAt < a.currentTime) nextAt = a.currentTime + 0.1;
  while (nextAt < a.currentTime + 1.6) { schedBar(a, tr, nextAt, bar++); nextAt += 4 * b; }
}
function fadeOut(a, g, s = 1.4) { if (!g) return; g.gain.cancelScheduledValues(a.currentTime); g.gain.setValueAtTime(g.gain.value, a.currentTime); g.gain.linearRampToValueAtTime(0, a.currentTime + s); setTimeout(() => { try { g.disconnect(); } catch {} }, s * 1000 + 3000); }

export const music = {
  // sahne sadece hangi parçayı istediğini söyler; ses ancak ilk dokunuştan sonra başlar
  play(name) {
    want = name || want;
    if (!musicOn() || !unlocked || document.hidden) return;
    if (cur === want && bus) return;
    const a = ac(); if (!a) return;
    fadeOut(a, bus);
    cur = want; bar = 0; nextAt = a.currentTime + 0.15;
    bus = a.createGain(); bus.gain.setValueAtTime(0, a.currentTime); bus.gain.linearRampToValueAtTime(TRACKS[cur].peak, a.currentTime + 2.5);
    bus.connect(chain(a));
    clearInterval(timer); timer = setInterval(tick, 250); tick();
  },
  stop() { const a = ac(); clearInterval(timer); timer = 0; if (a) fadeOut(a, bus, 0.8); bus = null; cur = null; },
  unlock() { unlocked = true; music.play(want); },
  get playing() { return cur; },
};
let unlocked = false;
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.hidden) music.stop(); else music.play(want); });
