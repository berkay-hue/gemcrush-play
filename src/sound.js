// Tiny WebAudio synth: no audio files needed.
import { save } from './meta/save.js';
let ctx = null;
function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; }
function tone(freq, dur, type = 'sine', gain = 0.15, slide = 0) {
  if (!save.sound) return; const a = ac(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(gain, a.currentTime); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
}
export const sfx = {
  unlock: () => ac(),
  swap: () => tone(420, 0.08, 'triangle', 0.08),
  bad: () => tone(160, 0.15, 'sawtooth', 0.08, -60),
  match: (cascade = 1) => tone(520 + cascade * 90, 0.14, 'sine', 0.14),
  special: () => { tone(300, 0.25, 'square', 0.08, 500); tone(900, 0.3, 'sine', 0.1); },
  combo: () => { [0, 60, 120].forEach((d, i) => setTimeout(() => tone(600 + i * 200, 0.25, 'triangle', 0.12), d)); },
  fall: () => tone(220, 0.05, 'triangle', 0.03),
  rock: () => tone(120, 0.12, 'square', 0.08, -40),
  coin: () => { tone(1200, 0.08, 'sine', 0.1); setTimeout(() => tone(1600, 0.12, 'sine', 0.1), 70); },
  win: () => [0, 120, 240, 360].forEach((d, i) => setTimeout(() => tone([523, 659, 784, 1046][i], 0.35, 'triangle', 0.14), d)),
  lose: () => [0, 200].forEach((d, i) => setTimeout(() => tone([330, 220][i], 0.4, 'sawtooth', 0.08), d)),
  harvest: () => [0, 70, 140].forEach((d, i) => setTimeout(() => tone([660, 880, 1320][i], 0.12, 'triangle', 0.1), d)),
  pet: () => { tone(700, 0.1, 'sine', 0.1, 300); setTimeout(() => tone(1000, 0.12, 'sine', 0.08, 200), 90); },
  build: () => { tone(200, 0.1, 'square', 0.08); setTimeout(() => tone(260, 0.1, 'square', 0.08), 110); setTimeout(() => sfx.coin(), 240); },
  click: () => tone(800, 0.05, 'sine', 0.06),
};
