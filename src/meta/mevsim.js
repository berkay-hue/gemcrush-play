// F31: çiftlik mevsimleri — her hafta mevsim döner (bahar → yaz → güz → kış).
// Mevsimin tohumları %25 hızlı büyür ve %20 pahalı satılır; çiftlik rengi + parçacıklar mevsime göre değişir.
// Test: ?mevsim=bahar|yaz|guz|kis
const D = 864e5, W = 7 * D;
export const MEVSIM = {
  bahar: { id: 'bahar', emoji: '🌷', tr: 'Bahar', en: 'Spring', seeds: ['strawberry', 'carrot', 'wheat'], grass: [0x7fe06a, 0.18], leaf: [0xffb7d5, 0.22], fx: 'petal' },
  yaz: { id: 'yaz', emoji: '☀️', tr: 'Yaz', en: 'Summer', seeds: ['sunflower', 'tomato', 'melon'], grass: [0xd8d46a, 0.12], leaf: null, fx: 'pollen' },
  guz: { id: 'guz', emoji: '🍂', tr: 'Güz', en: 'Autumn', seeds: ['pumpkin', 'corn', 'turnip'], grass: [0xc9a64a, 0.3], leaf: [0xe0782e, 0.55], fx: 'leaf' },
  kis: { id: 'kis', emoji: '❄️', tr: 'Kış', en: 'Winter', seeds: ['turnip', 'carrot', 'wheat'], grass: [0xeef4fa, 0.5], leaf: [0xeef5fb, 0.4], fx: 'snow' },
};
export const ORDER = ['bahar', 'yaz', 'guz', 'kis'];
export const SPEED = 0.75, PRICE = 1.2;
// hafta pazartesi başlar (1970-01-01 perşembe → +3 gün)
const week = (now) => Math.floor((now + 3 * D) / W);
function override() {
  try { const q = new URLSearchParams(location.search).get('mevsim'); return MEVSIM[q] ? q : null; } catch { return null; }
}
export function mevsimId(now = Date.now()) { return override() || ORDER[((week(now) % 4) + 4) % 4]; }
export const mevsim = (now = Date.now()) => MEVSIM[mevsimId(now)];
export const nextMevsim = (now = Date.now()) => MEVSIM[ORDER[(ORDER.indexOf(mevsimId(now)) + 1) % 4]];
export const msToNext = (now = Date.now()) => (week(now) + 1) * W - 3 * D - now;
export const daysLeft = (now = Date.now()) => Math.max(1, Math.ceil(msToNext(now) / D));
export const inSeason = (seed, now = Date.now()) => mevsim(now).seeds.includes(seed);
