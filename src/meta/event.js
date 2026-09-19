// F14: Hasat festivali ilerlemesi + ödülleri (kayıt: save.event {week, done}).
import { save, persist, addCoins, addGems } from './save.js';
import { festWeek, festActive, festMsLeft, festivalLevels, FEST_N } from '../engine/festival.js';
export { festActive, festMsLeft, festivalLevels, FEST_N };

export const FEST_COINS = 60, FEST_HALF = { hammer: 1 }, FEST_ALL_GEMS = 10;
function ev(now = Date.now()) {
  const w = festWeek(now);
  if (!save.event || save.event.week !== w) { save.event = { week: w, done: 0 }; }
  return save.event;
}
export const festDone = (now) => ev(now).done;
export const festNext = (now) => (festActive(now) && ev(now).done < FEST_N ? ev(now).done + 1 : 0);
// festival bölümü kazanıldı → ödül özeti (sıra dışı / süresi geçmiş kazanç sayılmaz)
export function festWin(n, now = Date.now()) {
  const e = ev(now);
  if (!festActive(now) || n !== e.done + 1) return null;
  e.done = n; addCoins(FEST_COINS);
  const r = { coins: FEST_COINS };
  if (n === 5) { save.boosters.hammer = (save.boosters.hammer || 0) + 1; r.hammer = 1; }
  if (n === FEST_N) { addGems(FEST_ALL_GEMS); r.gems = FEST_ALL_GEMS; r.all = true; }
  persist(); return r;
}
