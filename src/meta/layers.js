// F29: katmanlı tarla — arsanın üstüne kalıcı katmanlar kurulur: gübre (hız), fıskiye (kendini yeniden eker), sera (kış ekimi + dolu kalkanı, +1 ürün).
import { save, persist, spendCoins, spendGems } from './save.js';

export const LAYERS = [
  { id: 'gubre', emoji: '🧪', cost: { c: 250 }, lvl: 3, name: { tr: 'Gübre Katmanı', en: 'Fertilizer' }, info: { tr: 'Büyüme %25 hızlı', en: 'Grows 25% faster' } },
  { id: 'fiskiye', emoji: '💦', cost: { c: 450 }, lvl: 5, name: { tr: 'Fıskiye', en: 'Sprinkler' }, info: { tr: 'Hasattan sonra kendini yeniden eker', en: 'Replants itself after harvest' } },
  { id: 'sera', emoji: '🏡', cost: { g: 6 }, lvl: 7, name: { tr: 'Sera Örtüsü', en: 'Greenhouse' }, info: { tr: '+1 ürün · kışın ekim · dolu kalkanı', en: '+1 yield · winter planting · hail shield' } },
];
const byId = Object.fromEntries(LAYERS.map((l) => [l.id, l]));
export const layerItem = (k) => byId[k];

function st() {
  const f = save.farm || (save.farm = {});
  if (!f.layers || typeof f.layers !== 'object' || Array.isArray(f.layers)) f.layers = {};
  return f.layers;
}
export const layersOf = (id) => { const l = st()[id]; return Array.isArray(l) ? l.filter((k) => byId[k]) : []; };
export const hasLayer = (id, k) => layersOf(id).includes(k);
// 3D imzası için kısa kod: 'g','f','s' harfleri
export const layerSig = (id) => LAYERS.filter((l) => hasLayer(id, l.id)).map((l) => l.id[0]).join('');
export const layerLocked = (k) => (save.level || 1) < (byId[k]?.lvl || 1);

// 'ok' | 'owned' | 'locked' | 'coins' | 'gems' | 'need' (sıra: önce gübre, sonra fıskiye, en üstte sera)
export function layerStatus(id, k) {
  const it = byId[k]; if (!it) return 'locked';
  if (hasLayer(id, k)) return 'owned';
  if (layerLocked(k)) return 'locked';
  const i = LAYERS.indexOf(it); if (i > 0 && !hasLayer(id, LAYERS[i - 1].id)) return 'need';
  if (it.cost.g ? (save.gems || 0) < it.cost.g : (save.coins || 0) < it.cost.c) return it.cost.g ? 'gems' : 'coins';
  return 'ok';
}
export function buyLayer(id, k) {
  const s = layerStatus(id, k); if (s !== 'ok') return s;
  const it = byId[k];
  if (it.cost.g ? !spendGems(it.cost.g) : !spendCoins(it.cost.c)) return it.cost.g ? 'gems' : 'coins';
  const L = st(); L[id] = [...layersOf(id), k]; persist(); return 'ok';
}
export const layerSpeed = (id) => (hasLayer(id, 'gubre') ? 0.75 : 1);
export const layerYield = (id) => (hasLayer(id, 'sera') ? 1 : 0);
