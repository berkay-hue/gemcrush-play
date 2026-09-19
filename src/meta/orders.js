// F10: sipariş panosu — köylüler ambardaki ürünleri ister; teslim = 🪙 + XP (çiftlik seviyesi).
import { save, persist, addCoins, addGems } from './save.js';
import { owns } from './farm.js';
import { GOODS } from './produce.js';

export const SLOTS = 3;
export const SKIP_MS = 15 * 60000;
export const NPCS = [['👩‍🌾', 'Ayşe'], ['👨‍🍳', 'Mehmet'], ['👵', 'Fatma Nine'], ['🧑‍🎨', 'Can'], ['👮', 'Ali'], ['👧', 'Elif'], ['🧔', 'Osman'], ['👩‍🏫', 'Zeynep']];
const SRC = { wheat: 'tarla1', corn: 'tarla2', egg: 'tavuk', milk: 'inek', wool: 'koyun', flour: 'degirmen', bread: 'firin' };

const O = () => {
  const f = save.farm;
  if (!f.orders || !Array.isArray(f.orders.list)) f.orders = { list: [], done: 0 };
  if (typeof f.xp !== 'number' || !(f.xp >= 0)) f.xp = 0;
  return f.orders;
};
// F23: her tarlaya her tohum ekilebilir — buğday/mısır herhangi bir tarla varsa istenebilir
const anyPlot = () => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].some((i) => owns('tarla' + i));
export const available = () => { const g = Object.keys(SRC).filter((k) => (k === 'wheat' || k === 'corn' ? anyPlot() : owns(SRC[k]))); return g.length ? g : ['wheat']; };

export function makeOrder(rnd = Math.random) {
  const pool = available(), kinds = Math.min(pool.length, 1 + Math.floor(rnd() * 2) + (farmLevel() >= 5 ? 1 : 0));
  const need = {}; const bag = [...pool];
  for (let i = 0; i < kinds; i++) {
    const g = bag.splice(Math.floor(rnd() * bag.length), 1)[0];
    need[g] = 1 + Math.floor(rnd() * Math.min(4, 1 + Math.floor(farmLevel() / 2)));
  }
  const value = Object.entries(need).reduce((a, [g, n]) => a + GOODS[g].price * n, 0);
  const [emoji, name] = NPCS[Math.floor(rnd() * NPCS.length)];
  return { emoji, name, need, coins: Math.round(value * 1.5), xp: 5 + Math.round(value / 6) };
}

// eksik/bekleyen yuvaları doldurur; liste döner
export function refreshOrders(now = Date.now()) {
  const o = O(); let ch = false;
  for (let i = 0; i < SLOTS; i++) {
    const x = o.list[i];
    if (!x || (x.wait && now >= x.wait)) { o.list[i] = makeOrder(); ch = true; }
  }
  if (o.list.length > SLOTS) { o.list.length = SLOTS; ch = true; }
  if (ch) persist();
  return o.list;
}
export const canDeliver = (i) => { const x = O().list[i]; return !!x && !x.wait && Object.entries(x.need).every(([g, n]) => ((save.farm.inv || {})[g] || 0) >= n); };
export const readyCount = () => { refreshOrders(); return O().list.filter((_, i) => canDeliver(i)).length; };

export function deliver(i, now = Date.now()) {
  if (!canDeliver(i)) return null;
  const o = O(), x = o.list[i], before = farmLevel();
  for (const [g, n] of Object.entries(x.need)) save.farm.inv[g] -= n;
  addCoins(x.coins); save.farm.xp += x.xp; o.done = (o.done || 0) + 1;
  o.list[i] = { wait: now + 60000 };      // kısa nefes, sonra yeni köylü
  const up = farmLevel() > before; if (up) addGems(1);
  persist();
  return { coins: x.coins, xp: x.xp, levelUp: up ? farmLevel() : 0 };
}
export function skip(i, now = Date.now()) {
  const o = O(); if (!o.list[i] || o.list[i].wait) return false;
  o.list[i] = { wait: now + SKIP_MS }; persist(); return true;
}

// seviye L'ye çıkmak için toplam 25·L·(L-1) XP
export const xpFor = (L) => 25 * L * (L - 1);
export function farmLevel(xp = (O(), save.farm.xp)) { let L = 1; while (xp >= xpFor(L + 1)) L++; return L; }
export function xpProgress() { const L = farmLevel(), a = xpFor(L), b = xpFor(L + 1); return { level: L, cur: save.farm.xp - a, need: b - a }; }
