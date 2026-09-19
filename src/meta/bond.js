// F7: bonds with the farm - animal names, daily love tour, album pages, pets.
import { save, persist, addCoins, addGems } from './save.js';
import { zoneOpen } from './zones.js';

export const PETS = { kopek: { emoji: '🐶', name: 'Köpek' }, kedi: { emoji: '🐱', name: 'Kedi' } };
export const petsOpen = () => zoneOpen('sol');
const F = () => save.farm;
const today = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

// ---- names ----
export const nameOf = (id) => (F().names || {})[id] || '';
export function setName(id, n) {
  n = String(n || '').replace(/[<>]/g, '').trim().slice(0, 14);
  (F().names || (F().names = {}))[id] = n; persist(); return n;
}

// ---- daily love tour: pet 3 different animals -> reward once a day ----
export const LOVE_N = 3, LOVE_COINS = 30, LOVE_GEMS = 1;
export function loveState(now = Date.now()) {
  let l = F().love;
  if (!l || l.day !== today(now)) l = F().love = { day: today(now), pets: [], done: false };
  return l;
}
export function lovePet(id, now = Date.now()) {
  const l = loveState(now);
  if (l.done || l.pets.includes(id)) return { n: l.pets.length, reward: null };
  l.pets.push(id);
  let reward = null;
  if (l.pets.length >= LOVE_N) { l.done = true; addCoins(LOVE_COINS); addGems(LOVE_GEMS); reward = { coins: LOVE_COINS, gems: LOVE_GEMS }; }
  persist(); return { n: l.pets.length, reward };
}

// ---- album pages: completing a page pays once ----
export const PAGE_REWARD = { farm: 5, season: 5, visitors: 3 };
export function claimPage(page, complete) {
  const got = F().pages || (F().pages = {});
  if (!complete || got[page]) return 0;
  got[page] = 1; addGems(PAGE_REWARD[page]); persist(); return PAGE_REWARD[page];
}
export const pageClaimed = (page) => !!(F().pages || {})[page];
