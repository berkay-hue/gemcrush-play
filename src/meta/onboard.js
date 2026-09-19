// F8: first-time guide (5 steps), farm-side daily streak, "while you were away" summary.
import { save, persist, dailyStatus, claimDaily, addGems } from './save.js';
import { CROPS } from './crops.js';
import { PRODUCTS, isReady } from './produce.js';
import { owns } from './farm.js';

export const FTUE = [
  { id: 'play', text: '👆 İlk bölümü oyna, yıldız kazan' },
  { id: 'reward', text: '✨ Kazandıkların çiftliğe uçuyor!' },
  { id: 'coop', text: '👆 Kümese dokun, yıldızla satın al' },
  { id: 'plant', text: '👆 Tarla al ve ek, ürün zamanla büyür' },
  { id: 'pet', text: '👆 Bir hayvana dokun, onu sev' },
];
const st = () => (save.farm.ftue = save.farm.ftue || { i: 0 });
// Existing players (already past level 3 or owning the coop) skip the guide.
export function ftueCurrent() {
  const f = st();
  if (f.i === 0 && (save.level > 3 || owns('kumes'))) { f.i = FTUE.length; persist(); }
  return FTUE[f.i] || null;
}
export function ftueDone(id) {
  const cur = ftueCurrent();
  if (!cur || cur.id !== id) return false;
  st().i++; persist(); return true;
}

// Daily: 7th day of a streak also gives a gem.
export function farmDaily() { return dailyStatus(); }
export function farmClaimDaily() {
  const s = dailyStatus(); if (!s.available) return null;
  const coins = claimDaily(); const gems = (s.streak + 1) % 7 === 0 ? 1 : 0;
  if (gems) addGems(gems);
  return { coins, gems, streak: s.streak + 1 };
}

// Away summary: what finished since the last session (min 10 min away).
export function awaySummary(now = Date.now()) {
  const last = save.lastSeen || 0;
  save.lastSeen = now; persist();
  if (!last || now - last < 10 * 60000) return null;
  const crops = save.farm.crops || {}; const lines = [];
  for (const [id, c] of Object.entries(crops)) if (c.readyAt > last && c.readyAt <= now) lines.push(`${CROPS[id].emoji} hasat hazır`);
  const prod = (save.farm.prod || {});
  for (const id in PRODUCTS) if (prod[id] > last && isReady(id, now)) lines.push(`${PRODUCTS[id].emoji || '📦'} ürün toplanmayı bekliyor`);
  const h = Math.floor((now - last) / 3600000), m = Math.floor((now - last) / 60000) % 60;
  return { away: h ? `${h} sa ${m} dk` : `${m} dk`, lines };
}
export function touchSeen() { save.lastSeen = Date.now(); persist(); }
