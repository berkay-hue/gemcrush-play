// F38: oyuncular arası pazar — fiyat son 24 saatin arz/talebiyle oynar (sunucu: gc_market_*)
// İlan verirken mal hemen ambardan düşer; satılmazsa 48 saat sonra (ya da geri çekince) iade olur.
import { save, persist, addCoins, acctRpc } from './save.js';

export const FEE = 0.05, MAX_LISTINGS = 8;
export const band = (p) => [Math.floor(p * 0.8), Math.ceil(p * 1.25)];
export const bandOk = (p, x) => { const [a, b] = band(p); return x >= a && x <= b; };
export const idx = (sold, unsold) => Math.max(0.6, Math.min(1.6, 1 + 0.5 * (sold - unsold) / (sold + unsold + 6)));
export const trend = (i) => Math.round((i - 1) * 100); // +% / -%
const inv = () => ((save.farm = save.farm || {}).inv = save.farm.inv || {});

export const mktList = () => acctRpc('gc_market_list');
export async function mktPost(good, n, price) {
  const I = inv(); if ((I[good] || 0) < n) throw new Error('mal');
  I[good] -= n; persist();
  try { return await acctRpc('gc_market_post', { p_good: good, p_n: n, p_price: price }); }
  catch (e) { I[good] = (I[good] || 0) + n; persist(); throw e; }
}
export async function mktBuy(good) {
  const r = await acctRpc('gc_market_buy', { p_good: good, p_max: save.coins || 0 });
  applyBuy(r); return r;
}
export function applyBuy(r) { save.coins = Math.max(0, (save.coins || 0) - r.cost); const I = inv(); I[r.good] = (I[r.good] || 0) + r.n; persist(); }
export async function mktClaim(cancel = false) { const r = await acctRpc('gc_market_claim', { p_cancel: cancel }); applyClaim(r); return r; }
export function applyClaim(r) {
  if (!r) return r; const I = inv(); let n = 0;
  for (const [g, k] of Object.entries(r.back || {})) { I[g] = (I[g] || 0) + k; n += k; }
  if (r.coins) addCoins(r.coins); else if (n) persist();
  return r;
}
