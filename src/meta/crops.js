// Crops: plant on an owned field, grow in real time, harvest for coins.
// Every match-3 win shortens every growing crop by WIN_CUT (5 min).
import { save, persist, addCoins, spendGems } from './save.js';
import { bereketLeft } from './bereket.js';
import { owns, bldLvl, BLD_MAX } from './farm.js';
import { stash } from './produce.js';

const M = 60000, H = 60 * M;
export const WIN_CUT = 5 * M;
export const CROPS = {
  tarla1: { key: 'wheat', emoji: '🌾', ms: 2 * H, price: 12 },
  tarla2: { key: 'corn', emoji: '🌽', ms: 10 * H, price: 60 },
  tarla3: { key: 'carrot', emoji: '🥕', ms: 4 * H, price: 25 },
  tarla4: { key: 'tomato', emoji: '🍅', ms: 6 * H, price: 35 },
  tarla5: { key: 'sunflower', emoji: '🌻', ms: 8 * H, price: 45 },
  tarla6: { key: 'strawberry', emoji: '🍓', ms: 3 * H, price: 22 },
  tarla7: { key: 'pumpkin', emoji: '🎃', ms: 9 * H, price: 55 },
  tarla8: { key: 'melon', emoji: '🍈', ms: 7 * H, price: 42 },
  tarla9: { key: 'turnip', emoji: '🧅', ms: 5 * H, price: 30 },
  tarla10: { key: 'wheat', emoji: '🌾', ms: 2 * H, price: 12 },
};
// F23: tohum kataloğu — her tarlaya istediğin tohumu ek (tohum oyuncu seviyesiyle açılır, küçük bir para ister)
export const SEEDS = {
  wheat: { emoji: '🌾', ms: 2 * H, price: 12, cost: 0, lvl: 1, good: 'wheat', name: { tr: 'Buğday', en: 'Wheat' } },
  strawberry: { emoji: '🍓', ms: 3 * H, price: 22, cost: 2, lvl: 3, name: { tr: 'Çilek', en: 'Strawberry' } },
  carrot: { emoji: '🥕', ms: 4 * H, price: 25, cost: 3, lvl: 5, name: { tr: 'Havuç', en: 'Carrot' } },
  turnip: { emoji: '🧅', ms: 5 * H, price: 30, cost: 4, lvl: 8, name: { tr: 'Şalgam', en: 'Turnip' } },
  tomato: { emoji: '🍅', ms: 6 * H, price: 35, cost: 5, lvl: 10, name: { tr: 'Domates', en: 'Tomato' } },
  melon: { emoji: '🍈', ms: 7 * H, price: 42, cost: 6, lvl: 14, name: { tr: 'Kavun', en: 'Melon' } },
  sunflower: { emoji: '🌻', ms: 8 * H, price: 45, cost: 6, lvl: 18, name: { tr: 'Ayçiçeği', en: 'Sunflower' } },
  pumpkin: { emoji: '🎃', ms: 9 * H, price: 55, cost: 8, lvl: 24, name: { tr: 'Balkabağı', en: 'Pumpkin' } },
  corn: { emoji: '🌽', ms: 10 * H, price: 60, cost: 0, lvl: 1, good: 'corn', name: { tr: 'Mısır', en: 'Corn' } },
};
// tarlada ekili (ya da son ekilen) tohum; eski kayıtlarda tarlanın kendi tohumu
export const seedOf = (id) => (F()[id] && F()[id].seed) || (save.farm.lastSeed || {})[id] || CROPS[id].key;
export const cropInfo = (id) => SEEDS[seedOf(id)] || SEEDS.wheat;
export const seedOpen = (k) => (save.level || 1) >= SEEDS[k].lvl;
const F = () => (save.farm.crops = save.farm.crops || {});
// F4: buğday ve mısır ambara ürün olarak girer (takasta kullanılır); diğerleri para verir
export const CROP_GOODS = { tarla1: 'wheat', tarla2: 'corn' }; // eski; artık SEEDS[x].good
// F4: tarla seviyesi (paraya yükseltilir, BLD_MAX'e kadar): -%10 süre / seviye, ürün 1,1,2,2,3
export const plotLvl = (id) => bldLvl(id);
export const cropMs = (id) => Math.round(cropInfo(id).ms * (1 - 0.1 * (plotLvl(id) - 1)));
export const cropYield = (id) => 1 + Math.floor((plotLvl(id) - 1) / 2);
export const plotUpgradeCost = (id) => 60 * plotLvl(id) * plotLvl(id);
export function upgradePlot(id) {
  if (!CROPS[id] || !owns(id) || plotLvl(id) >= BLD_MAX) return false;
  const c = plotUpgradeCost(id); if ((save.coins || 0) < c) return false;
  save.coins -= c; (save.farm.lv || (save.farm.lv = {}))[id] = plotLvl(id) + 1; persist(); return true;
}

// 'empty' | 'growing' | 'ready'
export function cropState(id, now = Date.now()) {
  const c = F()[id];
  if (!c) return 'empty';
  return now >= c.readyAt ? 'ready' : 'growing';
}
// 0..1 growth
export function growth(id, now = Date.now()) {
  const c = F()[id]; if (!c) return 0;
  return Math.max(0, Math.min(1, 1 - (c.readyAt - now) / cropMs(id)));
}
export function msLeft(id, now = Date.now()) { const c = F()[id]; return c ? Math.max(0, c.readyAt - now) : 0; }
export function plant(id, now = Date.now(), seed = seedOf(id)) {
  if (!CROPS[id] || !owns(id) || F()[id] || !SEEDS[seed]) return false;
  const cost = SEEDS[seed].cost || 0; if ((save.coins || 0) < cost) return false;
  save.coins -= cost; (save.farm.lastSeed || (save.farm.lastSeed = {}))[id] = seed;
  F()[id] = { seed, readyAt: now + Math.round(SEEDS[seed].ms * (1 - 0.1 * (plotLvl(id) - 1))) }; persist(); return true;
}
export function harvest(id, now = Date.now()) {
  if (cropState(id, now) !== 'ready') return null;
  const info = cropInfo(id), seed = seedOf(id);
  delete F()[id]; save.farm.harvests = (save.farm.harvests || 0) + 1;
  const n = cropYield(id) * (bereketLeft(now) ? 2 : 1), good = info.good || null;
  const put = good ? stash(good, n) : 0; // ambar doluysa kalan paraya döner
  const coins = info.price * (n - put); if (coins) addCoins(coins);
  persist(); return { coins, good, n: put, seed, emoji: info.emoji };
}
// F17: traktör hazır ekinleri kendisi biçer ve yeniden eker
export function autoHarvest(now = Date.now()) {
  if (!owns('traktor')) return 0;
  let sum = 0;
  for (const id of Object.keys(CROPS)) if (cropState(id, now) === 'ready') { sum += harvest(id, now).coins; plant(id, now); }
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
