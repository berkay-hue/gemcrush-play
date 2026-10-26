// F14: Hasat festivali ilerlemesi + ödülleri (kayıt: save.event {week, done}).
import { save, persist, addCoins, addGems } from './save.js';
import { festWeek, festActive, festMsLeft, festivalLevels, FEST_N } from '../engine/festival.js';
import { gameNow } from './clock.js'; // F356: süreler oyun saatiyle
export { festActive, festMsLeft, festivalLevels, FEST_N };

export const FEST_COINS = 60, FEST_HALF = { hammer: 1 }, FEST_ALL_GEMS = 10;
function ev(now = gameNow()) {
  const w = festWeek(now);
  if (!save.event || !Number.isInteger(save.event.week) || w > save.event.week) { save.event = { week: w, done: 0 }; } // F341: geri saatte sıfırlanmaz
  return save.event;
}
// F341 (uygulamadaki F263): kayıt ileri bir haftaya aitse (saat geri alındı) festival oynanmaz, ödül vermez
const cur = (e, now = gameNow()) => e.week === festWeek(now);
export const festDone = (now) => { const e = ev(now); return cur(e, now) ? e.done : 0; };
export const festNext = (now) => { const e = ev(now); return festActive(now) && cur(e, now) && e.done < FEST_N ? e.done + 1 : 0; };
// festival bölümü kazanıldı → ödül özeti (sıra dışı / süresi geçmiş kazanç sayılmaz)
export function festWin(n, now = gameNow()) {
  const e = ev(now);
  if (!festActive(now) || !cur(e, now) || n !== e.done + 1) return null;
  e.done = n; addCoins(FEST_COINS);
  const r = { coins: FEST_COINS };
  if (n === 5) { save.boosters.hammer = (save.boosters.hammer || 0) + 1; r.hammer = 1; }
  if (n === FEST_N) { addGems(FEST_ALL_GEMS); r.gems = FEST_ALL_GEMS; r.all = true; }
  persist(); return r;
}
