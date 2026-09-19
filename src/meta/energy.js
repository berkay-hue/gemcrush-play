// Farmer energy: caps farm-side actions per session (pacing). +5/hour, max 20.
import { save, persist } from './save.js';
export const E_MAX = 20, E_REGEN = 12 * 60000;
const E = () => save.energy || (save.energy = { n: E_MAX, ts: Date.now() });
export function energy(now = Date.now()) {
  const e = E();
  if (e.n >= E_MAX) { e.ts = now; return e.n; }
  const g = Math.floor((now - e.ts) / E_REGEN);
  if (g > 0) { e.n = Math.min(E_MAX, e.n + g); e.ts += g * E_REGEN; if (e.n >= E_MAX) e.ts = now; persist(); }
  return e.n;
}
export function msToNextEnergy(now = Date.now()) { return energy(now) >= E_MAX ? 0 : Math.max(0, E_REGEN - (now - E().ts)); }
export function spendEnergy(k, now = Date.now()) {
  if (energy(now) < k) return false;
  const e = E(); if (e.n >= E_MAX) e.ts = now; e.n -= k; persist(); return true;
}
// 3-star wins can overfill up to +10
export function addEnergy(k) { energy(); const e = E(); e.n = Math.min(E_MAX + 10, e.n + k); persist(); }
