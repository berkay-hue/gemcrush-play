// F32: zararlılar — büyüyen ekine 2 saatte bir şansla karga 🐦‍⬛ ya da tırtıl 🐛 konar.
// Dokunup kovarsın (+5 🪙); kovmadan hasat edersen ürünün %30'u gider. Korkuluk kargayı hiç yaklaştırmaz.
import { save, persist, spendCoins, addCoins } from './save.js';

const SLOT = 2 * 3600e3, CHANCE = 0.3;
export const SCARE = { cost: 150, lvl: 2, emoji: '🧑‍🌾' };
export const PESTS = { crow: { emoji: '🐦‍⬛', tr: 'Karga', en: 'Crow' }, bug: { emoji: '🐛', tr: 'Tırtıl', en: 'Caterpillar' } };
export const PEST_CUT = 0.7, SHOO = 5;

function st() {
  const f = save.farm || (save.farm = {});
  if (!f.pests || typeof f.pests !== 'object' || Array.isArray(f.pests)) f.pests = {};
  if (!f.scare || typeof f.scare !== 'object' || Array.isArray(f.scare)) f.scare = {};
  return f;
}
// deterministik: tarla + saat dilimi + ekim zamanı → 0..1
function rnd(id, slot, salt) {
  let h = 2166136261 ^ salt;
  for (const ch of id + ':' + slot) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 2246822507); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
export const hasScarecrow = (id) => !!st().scare[id];
const crop = (id) => (save.farm && save.farm.crops || {})[id];

// aktif zararlı: 'crow' | 'bug' | null. Ekimden sonraki ilk dilimden itibaren; kovulan dilim temiz kalır.
export function pestAt(id, now = Date.now()) {
  const c = crop(id); if (!c || !c.ms) return null;
  const planted = c.readyAt - c.ms, slot = Math.floor(now / SLOT);
  if (slot <= Math.floor(planted / SLOT)) return null;
  // olgun ürüne son dilimdeki zararlı kalır (hasat edilene kadar)
  const s = Math.min(slot, Math.floor(c.readyAt / SLOT));
  if (st().pests[id] === s) return null;
  const salt = Math.floor(planted / 1000) | 0;
  if (rnd(id, s, salt) >= CHANCE) return null;
  const kind = rnd(id, s, salt + 7) < 0.5 ? 'crow' : 'bug';
  if (kind === 'crow' && hasScarecrow(id)) return null;
  return kind;
}
export function shoo(id, now = Date.now()) {
  const k = pestAt(id, now); if (!k) return null;
  const c = crop(id), slot = Math.min(Math.floor(now / SLOT), Math.floor(c.readyAt / SLOT));
  st().pests[id] = slot; addCoins(SHOO); save.farm.shooed = (save.farm.shooed || 0) + 1; persist();
  return k;
}
// 'ok' | 'owned' | 'locked' | 'coins'
export function scareStatus(id) {
  if (hasScarecrow(id)) return 'owned';
  if ((save.level || 1) < SCARE.lvl) return 'locked';
  if ((save.coins || 0) < SCARE.cost) return 'coins';
  return 'ok';
}
export function buyScarecrow(id) {
  const s = scareStatus(id); if (s !== 'ok') return s;
  if (!spendCoins(SCARE.cost)) return 'coins';
  st().scare[id] = 1; persist(); return 'ok';
}
// 3D imzası: k = korkuluk, C = karga, B = tırtıl
export const pestSig = (id, now = Date.now()) => (hasScarecrow(id) ? 'k' : '') + ({ crow: 'C', bug: 'B' }[pestAt(id, now)] || '');
