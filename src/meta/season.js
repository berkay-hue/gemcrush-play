// Faz 5: seasonal decor, sold for diamonds only while its season is on.
import { save, persist, spendGems } from './save.js';
import { gameNow } from './clock.js'; // F356: süreler oyun saatiyle

export const SEASONS = [
  { id: 'kis', months: [11, 0, 1], emoji: '⛄', price: 20, tr: 'Kardan adam', en: 'Snowman' },
  { id: 'bahar', months: [2, 3, 4], emoji: '🌷', price: 20, tr: 'Lale bahçesi', en: 'Tulip bed' },
  { id: 'yaz', months: [5, 6, 7], emoji: '🌻', price: 20, tr: 'Ayçiçeği', en: 'Sunflowers' },
  { id: 'guz', months: [8, 9, 10], emoji: '🎃', price: 20, tr: 'Balkabağı', en: 'Pumpkin' },
];
export function currentSeason(d = new Date(gameNow())) { return SEASONS.find((s) => s.months.includes(d.getMonth())); }
export function decor() { return (save.farm.decor = save.farm.decor || []); }
export function buySeasonal(d = new Date(gameNow())) {
  const s = currentSeason(d);
  if (decor().includes(s.id) || !spendGems(s.price)) return false;
  decor().push(s.id); persist(); return true;
}
