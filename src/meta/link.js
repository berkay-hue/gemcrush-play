// F36: canlı çiftlik linki — linkten gelen her sulama sahibine 🪙 + büyüyen ekinlere 10 dk kazandırır
import { save, persist, addCoins, account, waterClaimRaw } from './save.js';

export const WATER = { coins: 15, cut: 10 * 60000, max: 20 };
export function applyWater(n, now = Date.now()) {
  n = Math.max(0, Math.min(WATER.max * 7, n | 0));
  if (!n) return null;
  const coins = n * WATER.coins, cut = Math.min(n, WATER.max) * WATER.cut, crops = (save.farm && save.farm.crops) || {};
  let hit = 0;
  for (const c of Object.values(crops)) if (c.readyAt > now) { c.readyAt = Math.max(now, c.readyAt - cut); hit++; }
  addCoins(coins); save.farm.watered = (save.farm.watered || 0) + n; persist();
  return { n, coins, hit };
}
export async function claimWater(now = Date.now()) { if (!account()) return null; return applyWater(await waterClaimRaw(), now); }
// ?ciftlik=KOD (yalnız harf/rakam)
export function linkCode(search = (typeof location !== 'undefined' ? location.search : '')) {
  const c = new URLSearchParams(search).get('ciftlik');
  return c && /^[A-Za-z0-9]{3,20}$/.test(c) ? c.toUpperCase() : null;
}
export function clearLink() { try { history.replaceState(null, '', location.pathname); } catch {} }
