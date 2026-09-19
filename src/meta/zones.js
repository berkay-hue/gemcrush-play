// Faz 1: expansion zones left/right of the main farm. Unlock with stars,
// then clear obstacles (coins + energy + real-time timer) for rewards.
import { save, persist, addCoins, addGems, spendCoins, spendGems, spendStars, starBalance } from './save.js';
import { spendEnergy } from './energy.js';
import { WIN_CUT } from './crops.js';

const M = 60000, H = 60 * M;
export const OBST = {
  bush:  { emoji: '🌿', coins: 20, energy: 1, ms: 30 * M, reward: { coins: 45 } },
  stump: { emoji: '🪵', coins: 50, energy: 2, ms: 2 * H, reward: { coins: 90, gems: 1 } },
  rock:  { emoji: '🪨', coins: 90, energy: 3, ms: 4 * H, reward: { coins: 150, gems: 2 } },
};
const ob = (id, kind, x, y) => ({ id, kind, x, y });
export const ZONES = {
  sol: { price: 12, bg: 0x6aab58, name: { tr: 'Orman Kıyısı', en: 'Woodland Edge' }, unlocks: { tr: 'Evcil hayvanlar (köpek, kedi)', en: 'Pets (dog, cat)' },
    obstacles: [ob('s1', 'bush', 120, 420), ob('s2', 'bush', 400, 460), ob('s3', 'stump', 260, 560), ob('s4', 'stump', 110, 680), ob('s5', 'rock', 420, 700)] },
  sag: { price: 20, bg: 0x74c0a0, name: { tr: 'Dere Kenarı', en: 'Creekside' }, unlocks: { tr: 'Domuz ağılı', en: 'Pig pen' },
    obstacles: [ob('r1', 'bush', 140, 430), ob('r2', 'stump', 390, 450), ob('r3', 'bush', 260, 580), ob('r4', 'rock', 120, 700), ob('r5', 'rock', 410, 690), ob('r6', 'stump', 270, 790)] },
};
const Z = () => (save.farm.zones = save.farm.zones || {});
export const zoneOpen = (z) => !!Z()[z];
export function openZone(z) {
  if (zoneOpen(z) || starBalance() < ZONES[z].price || !spendStars(ZONES[z].price)) return false;
  Z()[z] = { clr: {} }; persist(); return true;
}
const find = (z, o) => ZONES[z].obstacles.find((x) => x.id === o);
// 'locked' | 'idle' | 'clearing' | 'ready' | 'done'
export function obstState(z, o, now = Date.now()) {
  if (!zoneOpen(z)) return 'locked';
  const v = Z()[z].clr[o];
  if (v === undefined) return 'idle';
  if (v === 'done') return 'done';
  return now >= v ? 'ready' : 'clearing';
}
export const obstLeft = (z, o, now = Date.now()) => (obstState(z, o, now) === 'clearing' ? Z()[z].clr[o] - now : 0);
// returns '' on success or a reason: 'coins' | 'energy'
export function startClear(z, o, now = Date.now()) {
  if (obstState(z, o, now) !== 'idle') return 'state';
  const k = OBST[find(z, o).kind];
  if (save.coins < k.coins) return 'coins';
  if (!spendEnergy(k.energy, now)) return 'energy';
  spendCoins(k.coins); Z()[z].clr[o] = now + k.ms; persist(); return '';
}
export function collectClear(z, o, now = Date.now()) {
  if (obstState(z, o, now) !== 'ready') return null;
  const r = OBST[find(z, o).kind].reward;
  Z()[z].clr[o] = 'done'; if (r.coins) addCoins(r.coins); if (r.gems) addGems(r.gems); persist(); return r;
}
export const clearRushCost = (z, o, now = Date.now()) => Math.max(1, Math.ceil(obstLeft(z, o, now) / H));
export function clearRush(z, o, viaAd = false, now = Date.now()) {
  if (obstState(z, o, now) !== 'clearing') return false;
  if (!viaAd && !spendGems(clearRushCost(z, o, now))) return false;
  Z()[z].clr[o] = now; persist(); return true;
}
export const zoneDone = (z) => zoneOpen(z) && ZONES[z].obstacles.every((o) => Z()[z].clr[o.id] === 'done');
// every match-3 win: all clearing timers −WIN_CUT
export function zoneCut(now = Date.now()) {
  let n = 0;
  for (const st of Object.values(Z())) for (const [o, v] of Object.entries(st.clr)) if (typeof v === 'number' && v > now) { st.clr[o] = Math.max(now, v - WIN_CUT); n++; }
  if (n) persist(); return n;
}
