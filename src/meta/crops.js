// Crops: plant on an owned field, grow in real time, harvest for coins.
// Every match-3 win shortens every growing crop by WIN_CUT (5 min).
import { save, persist, addCoins, spendGems } from './save.js';
import { bereketLeft } from './bereket.js';
import { owns } from './farm.js';

const M = 60000, H = 60 * M;
export const WIN_CUT = 5 * M;
export const CROPS = {
  tarla1: { key: 'wheat', emoji: '🌾', ms: 2 * H, price: 12 },
  tarla2: { key: 'corn', emoji: '🌽', ms: 10 * H, price: 60 },
  tarla3: { key: 'carrot', emoji: '🥕', ms: 4 * H, price: 25 },
  tarla4: { key: 'tomato', emoji: '🍅', ms: 6 * H, price: 35 },
  tarla5: { key: 'sunflower', emoji: '🌻', ms: 8 * H, price: 45 },
  tarla6: { key: 'strawberry', emoji: '🍓', ms: 3 * H, price: 22 },
};
const F = () => (save.farm.crops = save.farm.crops || {});

// 'empty' | 'growing' | 'ready'
export function cropState(id, now = Date.now()) {
  const c = F()[id];
  if (!c) return 'empty';
  return now >= c.readyAt ? 'ready' : 'growing';
}
// 0..1 growth
export function growth(id, now = Date.now()) {
  const c = F()[id]; if (!c) return 0;
  return Math.max(0, Math.min(1, 1 - (c.readyAt - now) / CROPS[id].ms));
}
export function msLeft(id, now = Date.now()) { const c = F()[id]; return c ? Math.max(0, c.readyAt - now) : 0; }
export function plant(id, now = Date.now()) {
  if (!CROPS[id] || !owns(id) || F()[id]) return false;
  F()[id] = { readyAt: now + CROPS[id].ms }; persist(); return true;
}
export function harvest(id, now = Date.now()) {
  if (cropState(id, now) !== 'ready') return 0;
  delete F()[id]; const c = CROPS[id].price * (bereketLeft(now) ? 2 : 1); addCoins(c);
  save.farm.harvests = (save.farm.harvests || 0) + 1; persist(); return c;
}
// F17: traktör hazır ekinleri kendisi biçer ve yeniden eker
export function autoHarvest(now = Date.now()) {
  if (!owns('traktor')) return 0;
  let sum = 0;
  for (const id of Object.keys(CROPS)) if (cropState(id, now) === 'ready') { sum += harvest(id, now); plant(id, now); }
  return sum;
}
// called on every level win; returns list of crop ids that were shortened
export function winCut(now = Date.now()) {
  const hit = [];
  for (const [id, c] of Object.entries(F())) if (c.readyAt > now) { c.readyAt = Math.max(now, c.readyAt - WIN_CUT); hit.push(id); }
  if (hit.length) persist();
  return hit;
}
export function cropRushCost(id, now = Date.now()) { return Math.max(1, Math.ceil(msLeft(id, now) / H)); }
export function cropRush(id, viaAd = false, now = Date.now()) {
  if (cropState(id, now) !== 'growing') return false;
  if (!viaAd && !spendGems(cropRushCost(id, now))) return false;
  F()[id].readyAt = now; persist(); return true;
}
