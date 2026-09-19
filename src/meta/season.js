// Faz 5: seasonal decor, sold for diamonds only while its season is on.
import { save, persist, spendGems } from './save.js';

export const SEASONS = [
  { id: 'kis', months: [11, 0, 1], emoji: '⛄', price: 20, tr: 'Kardan adam', en: 'Snowman' },
  { id: 'bahar', months: [2, 3, 4], emoji: '🌷', price: 20, tr: 'Lale bahçesi', en: 'Tulip bed' },
  { id: 'yaz', months: [5, 6, 7], emoji: '🌻', price: 20, tr: 'Ayçiçeği', en: 'Sunflowers' },
  { id: 'guz', months: [8, 9, 10], emoji: '🎃', price: 20, tr: 'Balkabağı', en: 'Pumpkin' },
];
export function currentSeason(d = new Date()) { return SEASONS.find((s) => s.months.includes(d.getMonth())); }
export function decor() { return (save.farm.decor = save.farm.decor || []); }
export function buySeasonal(d = new Date()) {
  const s = currentSeason(d);
  if (decor().includes(s.id) || !spendGems(s.price)) return false;
  decor().push(s.id); persist(); return true;
}
