// Faz 4: timed animal products, market and egg hatching.
import { save, persist, addCoins, spendGems } from './save.js';
import { owns, ambarCap } from './farm.js';

const H = 3600000;
export const PRODUCTS = {
  tavuk: { good: 'egg', emoji: '🥚', ms: 1 * H, price: 15 },
  inek: { good: 'milk', emoji: '🥛', ms: 2 * H, price: 35 },
  koyun: { good: 'wool', emoji: '🧶', ms: 3 * H, price: 50 },
};
// 3 of a good can be swapped for a booster instead of coins
export const TRADES = { egg: 'shuffle', milk: 'hammer', wool: 'moves5' };
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
  f.inv[pr.good] = (f.inv[pr.good] || 0) + 1;
  f.prod[id] = now + pr.ms; persist();
  return pr;
}
export function inventory() { return P().inv; }
// F16: ambar capacity
export const ambarUsed = () => Object.values(P().inv || {}).reduce((a, n) => a + (n || 0), 0);
export const ambarFull = () => ambarUsed() >= ambarCap();
const byGood = (g) => Object.values(PRODUCTS).find((p) => p.good === g);
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
