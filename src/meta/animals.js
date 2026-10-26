// Faz 3: livestock needs + sickness. Hunger drains over 12h; 6h at zero -> sick.
// Sick animals give no product and no perk. No death. Cure = vet level (Faz 4) or gems.
import { save, persist, spendCoins, spendGems } from './save.js';
import { owns } from './farm.js';
import { spendEnergy } from './energy.js';
import { gameNow } from './clock.js'; // F356: süreler oyun saatiyle

const H = 3600000;
export const LIVESTOCK = ['inek', 'koyun', 'at', 'domuz'];
export const HUNGER_MS = 12 * H, SICK_AFTER = 6 * H, FEED_CD = 4 * H, FEED_COINS = 10, VET_PER_DAY = 3, CURE_GEMS = 8;
const A = (id, now = gameNow()) => {
  const f = save.farm; f.an = f.an || {};
  if (!f.an[id]) { f.an[id] = { fedAt: now, sick: false }; persist(); }
  return f.an[id];
};
const sickAfter = () => SICK_AFTER * (owns('kopek') ? 2 : 1);   // Faz 5: dog doubles grace time
export function hunger(id, now = gameNow()) { return Math.max(0, Math.min(100, Math.round(100 * (1 - (now - A(id, now).fedAt) / HUNGER_MS)))); }
export function isSick(id, now = gameNow()) {
  if (!owns(id) || !LIVESTOCK.includes(id)) return false;
  const a = A(id, now);
  if (!a.sick && now >= a.fedAt + HUNGER_MS + sickAfter()) { a.sick = true; persist(); }
  return a.sick;
}
export const feedLeft = (id, now = gameNow()) => Math.max(0, A(id, now).fedAt + FEED_CD - now);
// '' ok | 'sick' | 'cd' | 'coins' | 'energy'
export function feed(id, now = gameNow()) {
  if (isSick(id, now)) return 'sick';
  if (feedLeft(id, now) > 0) return 'cd';
  if (save.coins < FEED_COINS) return 'coins';
  if (!spendEnergy(1, now)) return 'energy';
  spendCoins(FEED_COINS); A(id, now).fedAt = now; persist(); return '';
}
export function cure(id, now = gameNow()) { const a = A(id, now); a.sick = false; a.fedAt = now; persist(); }
export function cureWithGems(id) { if (!isSick(id) || !spendGems(CURE_GEMS)) return false; cure(id); return true; }
export const sickList = (now = gameNow()) => LIVESTOCK.filter((id) => isSick(id, now));
const day = (now = gameNow()) => Math.floor(now / 86400000);
// F338 (uygulamadaki F262): saat geri alınınca hak dolmaz; yeni gün yalnız ileride başlar
const vetSame = (v, now) => !!v && v.day >= day(now);
export function vetLeft(now = gameNow()) { const v = save.farm.vet; return vetSame(v, now) ? Math.max(0, VET_PER_DAY - v.n) : VET_PER_DAY; }
export function useVet(now = gameNow()) { if (!vetLeft(now)) return false; const v = save.farm.vet, same = vetSame(v, now); save.farm.vet = { day: same ? v.day : day(now), n: same ? v.n + 1 : 1 }; persist(); return true; }
