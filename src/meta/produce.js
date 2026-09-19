// Faz 4: timed animal products, market and egg hatching.
import { save, persist, addCoins, spendGems } from './save.js';
import { owns, ambarCap, animalCount } from './farm.js';
import { honeyMul } from './combo.js';

const H = 3600000;
export const PRODUCTS = {
  tavuk: { good: 'egg', emoji: '🥚', ms: 1 * H, price: 15 },
  inek: { good: 'milk', emoji: '🥛', ms: 2 * H, price: 35 },
  koyun: { good: 'wool', emoji: '🧶', ms: 3 * H, price: 50 },
  kovan: { good: 'honey', emoji: '🍯', ms: 4 * H, price: 70 }, // F26
};
// 3 of a good can be swapped for a booster instead of coins
export const TRADES = { egg: 'shuffle', milk: 'hammer', wool: 'moves5', honey: 'prism' };
// F4: tarladan gelen ürünler de ambara girer ve satılır/takaslanır
export const CROP_ITEMS = { wheat: { good: 'wheat', emoji: '🌾', price: 12 }, corn: { good: 'corn', emoji: '🌽', price: 60 } };
// F30: üretim zincirinin mamulleri (değirmen → un, fırın → ekmek)
export const MADE_ITEMS = { flour: { good: 'flour', emoji: '🥣', price: 40 }, bread: { good: 'bread', emoji: '🍞', price: 110 } };
export const GOODS = { ...Object.fromEntries(Object.values(PRODUCTS).map((p) => [p.good, p])), ...CROP_ITEMS, ...MADE_ITEMS };
// F4: takas tarifleri (ürün karışımı -> güçlendirici)
export const RECIPES = [
  { need: { wheat: 3 }, give: 'shuffle' },
  { need: { wheat: 2, corn: 1 }, give: 'hammer' },
  { need: { corn: 2, egg: 1 }, give: 'moves5' },
  { need: { wheat: 3, corn: 2, milk: 1 }, give: 'prism' },
  { need: { honey: 1, milk: 1 }, give: 'moves5' }, // F26: ballı süt
];
export const canCraft = (i) => Object.entries(RECIPES[i].need).every(([g, n]) => (P().inv[g] || 0) >= n);
export function craft(i) {
  if (!RECIPES[i] || !canCraft(i)) return null;
  const f = P(); for (const [g, n] of Object.entries(RECIPES[i].need)) f.inv[g] -= n;
  const b = RECIPES[i].give; save.boosters[b] = (save.boosters[b] || 0) + 1; persist(); return b;
}
// adds up to n goods while the ambar has room; returns how many were stored
export function stash(good, n) {
  const room = Math.max(0, ambarCap() - ambarUsed()), k = Math.min(n, room);
  if (k) { const f = P(); f.inv[good] = (f.inv[good] || 0) + k; persist(); }
  return k;
}
export const HATCH_WINS = 5;

const P = () => {
  const f = save.farm;
  f.prod = f.prod || {}; f.inv = f.inv || {}; f.chicks = f.chicks || 0;
  return f;
};
export function readyAt(id) {
  const f = P();
  if (!f.prod[id]) { f.prod[id] = Date.now() + PRODUCTS[id].ms; persist(); }
  return f.prod[id];
}
export function isReady(id, now = Date.now()) { return !!PRODUCTS[id] && owns(id) && now >= readyAt(id); }
export function collect(id, now = Date.now()) {
  if (!isReady(id, now) || ambarFull()) return null;
  const f = P(); const pr = PRODUCTS[id];
  // F24: her hayvan 1 ürün verir, ambarda yer kadar
  const k = Math.max(1, Math.min(animalCount(id) || 1, ambarCap() - ambarUsed()));
  f.inv[pr.good] = (f.inv[pr.good] || 0) + k;
  f.prod[id] = now + Math.round(pr.ms * (id === 'kovan' ? honeyMul() : 1)); persist(); // F33: çiçekli kovan hızlı
  return { ...pr, n: k };
}
export function inventory() { return P().inv; }
// F16: ambar capacity
export const ambarUsed = () => Object.values(P().inv || {}).reduce((a, n) => a + (n || 0), 0);
export const ambarFull = () => ambarUsed() >= ambarCap();
const byGood = (g) => GOODS[g];
export function sell(good) {
  const f = P(); if (!f.inv[good]) return 0;
  f.inv[good]--; const c = byGood(good).price; addCoins(c); return c;
}
export function trade(good) {
  const f = P(); if ((f.inv[good] || 0) < 3) return null;
  f.inv[good] -= 3; const b = TRADES[good];
  save.boosters[b] = (save.boosters[b] || 0) + 1; persist(); return b;
}
// incubate one egg; it hatches after HATCH_WINS more levels are won
export function hatchState() {
  const f = P();
  if (!f.hatch) return { active: false };
  const done = Math.min(HATCH_WINS, save.level - f.hatch.from);
  return { active: true, done, ready: done >= HATCH_WINS };
}
export function incubate() {
  const f = P(); if (f.hatch || !f.inv.egg) return false;
  f.inv.egg--; f.hatch = { from: save.level }; persist(); return true;
}
export function hatch() {
  const f = P(); if (!hatchState().ready) return false;
  f.hatch = null; f.chicks++; persist(); return true;
}

// Faz 5: skip a product timer with diamonds (1 per started hour) or a rewarded ad
export function rushCost(id, now = Date.now()) { return Math.max(1, Math.ceil((readyAt(id) - now) / H)); }
export function rush(id, viaAd = false, now = Date.now()) {
  if (!PRODUCTS[id] || !owns(id) || isReady(id, now)) return false;
  if (!viaAd && !spendGems(rushCost(id, now))) return false;
  P().prod[id] = now; persist(); return true;
}
