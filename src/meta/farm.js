// Farm meta: catalog of plots, buildings and animals bought with farm stars.
// Pure logic (no Phaser) so it can be unit-tested in Node.
import { save, persist, spendStars, starBalance } from './save.js';

// x/y are positions on the 540x960 farm screen.
export const CATALOG = [
  // buildings
  { id: 'kumes',  kind: 'building', emoji: '🛖', price: 4,  lvl: 3,  x: 110, y: 330, name: { tr: 'Kümes', en: 'Coop' } },
  { id: 'ahir',   kind: 'building', emoji: '🏚️', price: 10, lvl: 8, x: 430, y: 330, name: { tr: 'Ahır', en: 'Barn' } },
  { id: 'ambar',  kind: 'building', emoji: '🏠', price: 6,  lvl: 4, x: 270, y: 250, name: { tr: 'Ambar', en: 'Storehouse' } },
  // animals (need their building)
  { id: 'tavuk', lvl: 3,  kind: 'animal', emoji: '🐔', price: 3,  needs: 'kumes', x: 70,  y: 440, name: { tr: 'Tavuk', en: 'Hen' } },
  { id: 'horoz', lvl: 6,  kind: 'animal', emoji: '🐓', price: 6,  needs: 'kumes', x: 160, y: 450, name: { tr: 'Horoz', en: 'Rooster' } },
  { id: 'koyun', lvl: 8,  kind: 'animal', emoji: '🐑', price: 8,  needs: 'ahir',  x: 370, y: 440, name: { tr: 'Koyun', en: 'Sheep' } },
  { id: 'inek', lvl: 14,   kind: 'animal', emoji: '🐄', price: 12, needs: 'ahir',  x: 470, y: 450, name: { tr: 'İnek', en: 'Cow' } },
  { id: 'at', lvl: 30,     kind: 'animal', emoji: '🐎', price: 18, needs: 'ahir',  x: 420, y: 540, name: { tr: 'At', en: 'Horse' } },
  // crop plots
  // F23: 10 tarla; isim yalnız başlangıç tohumu, her tarlaya istenen tohum ekilir
  ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({
    id: `tarla${i + 1}`, kind: 'plot', emoji: ['🌾', '🌽', '🥕', '🍅', '🌻', '🍓', '🎃', '🍈', '🧅', '🌾'][i], price: i ? 2 + i * 2 : 0, lvl: [2, 5, 10, 18, 26, 35, 42, 50, 60, 70][i],
    needs: i ? `tarla${i}` : null, x: 110 + (i % 3) * 160, y: 650 + Math.floor(i / 3) * 110,
    name: { tr: `Tarla ${i + 1}`, en: `Field ${i + 1}` },
  })),
  // F17: araçlar
  { id: 'traktor', kind: 'vehicle', emoji: '🚜', price: 20, lvl: 20, x: 270, y: 560, name: { tr: 'Traktör', en: 'Tractor' } },
];
export const TABS = [['building', '🏠'], ['animal', '🐄'], ['plot', '🌾'], ['vehicle', '🚜']];

export const item = (id) => CATALOG.find((x) => x.id === id);
export const owns = (id) => save.farm.owned.includes(id);

// 'owned' | 'locked' (prerequisite missing) | 'buyable' | 'expensive'
export function status(id) {
  const it = item(id);
  if (!it) return 'locked';
  if (owns(id)) return 'owned';
  if ((save.level || 1) < (it.lvl || 1)) return 'locked';
  if (it.needs && !owns(it.needs)) return 'locked';
  return starBalance() >= it.price ? 'buyable' : 'expensive';
}

export function buyItem(id) {
  if (status(id) !== 'buyable') return false;
  if (!spendStars(item(id).price)) return false;
  save.farm.owned.push(id);
  persist();
  return true;
}
// F24: hayvanlar tek tek alınır (her alımda 1), her türden en fazla 4
export const ANIMAL_MAX = 4;
export const animalCount = (id) => (owns(id) ? Math.max(1, Math.min(ANIMAL_MAX, ((save.farm.cnt || {})[id]) || 1)) : 0);
// 'max' | 'buyable' | 'expensive' (yalnız sahip olunan hayvan için)
export function moreStatus(id) {
  const it = item(id);
  if (!it || it.kind !== 'animal' || !owns(id)) return 'max';
  if (animalCount(id) >= ANIMAL_MAX) return 'max';
  return starBalance() >= it.price ? 'buyable' : 'expensive';
}
export function buyMore(id) {
  if (moreStatus(id) !== 'buyable') return false;
  if (!spendStars(item(id).price)) return false;
  (save.farm.cnt || (save.farm.cnt = {}))[id] = animalCount(id) + 1;
  persist();
  return true;
}
// items whose level just became reachable and were never announced (🔓 Yeni)
export function newUnlocks() {
  const seen = save.farm.seen || (save.farm.seen = []);
  return CATALOG.filter((i) => !owns(i.id) && !seen.includes(i.id) && (save.level || 1) >= (i.lvl || 1));
}
export function markSeen(ids) { const s = save.farm.seen || (save.farm.seen = []); ids.forEach((i) => s.includes(i) || s.push(i)); persist(); }

// ---- F13: per-save positions (world x,z) ----
export const posOf = (id) => (save.farm.pos || {})[id] || null;
export function setPos(id, x, z) { (save.farm.pos || (save.farm.pos = {}))[id] = [Math.round(x * 2) / 2, Math.round(z * 2) / 2]; persist(); }

// ---- F7 (v2): purchasable side plots. Left/right of the main island; each needs a
// minimum level first, then coins. rect = [x0, z0, x1, z1] in world coords.
export const ARSA = [
  { id: 'sol1', lvl: 5, coins: 500, rect: [-22, -3, -12, 3] },
  { id: 'sag1', lvl: 8, coins: 800, rect: [12, -3, 22, 3] },
  { id: 'sol2', lvl: 12, coins: 1500, rect: [-22, -9, -12, -3] },
  { id: 'sag2', lvl: 16, coins: 2000, rect: [12, -9, 22, -3] },
  { id: 'sol3', lvl: 20, coins: 3000, rect: [-22, 3, -12, 9] },
  { id: 'sag3', lvl: 25, coins: 4000, rect: [12, 3, 22, 9] },
];
export const arsa = (id) => ARSA.find((a) => a.id === id);
export function plots() {
  const f = save.farm;
  if (!Array.isArray(f.plots)) f.plots = ARSA.slice(0, Math.min(ARSA.length, f.land || 0)).map((a) => a.id); // eski "land" kademesi → ilk n arsa
  return f.plots;
}
export const ownsPlot = (id) => plots().includes(id);
// 'owned' | 'level' | 'coins' | 'ok'
export function plotStatus(id) {
  const a = arsa(id); if (!a) return 'level';
  if (ownsPlot(id)) return 'owned';
  if ((save.level || 1) < a.lvl) return 'level';
  return (save.coins || 0) < a.coins ? 'coins' : 'ok';
}
export function buyPlot(id) {
  if (plotStatus(id) !== 'ok') return false;
  save.coins -= arsa(id).coins; plots().push(id); persist(); return true;
}
// is world point (x,z) inside an owned plot (with margin m)?
export const inPlot = (x, z, m = 0) => ARSA.some((a) => ownsPlot(a.id) && x >= a.rect[0] + m && x <= a.rect[2] - m && z >= a.rect[1] + m && z <= a.rect[3] - m);

// ---- F16/F18: building levels (1..5), ambar capacity ----
export const BLD_MAX = 5;
export const bldLvl = (id) => (save.farm.lv || {})[id] || 1;
export const upgradeCost = (id) => 150 * bldLvl(id) * (id === 'ambar' ? 1 : 2);
export function upgrade(id) {
  if (!owns(id) || bldLvl(id) >= BLD_MAX) return false;
  const c = upgradeCost(id); if ((save.coins || 0) < c) return false;
  save.coins -= c; (save.farm.lv || (save.farm.lv = {}))[id] = bldLvl(id) + 1; persist(); return true;
}
export const ambarCap = () => (owns('ambar') ? 50 * bldLvl('ambar') : 20);

// ---- Faz 2: animal perks ----
export const PERK_TEXT = {
  horoz: { tr: 'Her bölüme +2 hamle', en: '+2 moves every level' },
  inek:  { tr: '4\'lü eşleşmede %10 bomba şansı', en: '10% bomb chance on 4-matches' },
  at:    { tr: 'Her bölümde 1 bedava karıştırma', en: '1 free shuffle per level' },
  koyun: { tr: 'Her 3 kayıpta 1 can iade', en: 'Refunds 1 life every 3 losses' },
};
export function perks() {
  return {
    extraMoves: owns('horoz') ? 2 : 0,
    bombBonus: owns('inek') ? 0.1 : 0,
    freeShuffle: owns('at') ? 1 : 0,
    lifeRefund: owns('koyun'),
  };
}
// returns true when this loss triggers the sheep's life refund
export function sheepOnLoss() {
  if (!owns('koyun')) return false;
  const pk = save.farm.perks || (save.farm.perks = {});
  pk.losses = (pk.losses || 0) + 1;
  persist();
  return pk.losses % 3 === 0;
}
