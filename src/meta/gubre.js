// F39: match-3 taşları → gübre. Kazanılan bölümde toplanan taşlar renk başına torbaya dönüşür;
// renkli gübre yalnız o renkteki ekini hızlandırır, su (mavi/buz/gümüş) her ekine yarım etki eder.
import { save, persist } from './save.js';
import { cropState, seedOf } from './crops.js';

const M = 60000;
export const PER_BAG = 25, BAG_MAX = 20;
export const GUBRE = {
  r: { emoji: '🟥', cut: 30 * M, seeds: ['strawberry', 'tomato'], name: { tr: 'Kırmızı gübre', en: 'Red fertilizer' } },
  g: { emoji: '🟩', cut: 30 * M, seeds: ['melon', 'turnip', 'carrot'], name: { tr: 'Yeşil gübre', en: 'Green fertilizer' } },
  y: { emoji: '🟨', cut: 30 * M, seeds: ['wheat', 'corn', 'sunflower', 'pumpkin'], name: { tr: 'Sarı gübre', en: 'Yellow fertilizer' } },
  w: { emoji: '💧', cut: 15 * M, seeds: null, name: { tr: 'Su', en: 'Water' } },
};
// taş rengi (CONFIG.gemColors sırası) → gübre türü
export const GEM_BAG = { 0: 'w', 1: 'r', 2: 'g', 3: 'w', 4: 'y', 5: 'w' };
const B = () => (save.farm.gubre = save.farm.gubre || {});
const R = () => (save.farm.gubreRest = save.farm.gubreRest || {});
export const bags = (k) => B()[k] || 0;

// bölüm kazanınca: toplanan taşları torbaya çevir (artan taş sonraki bölüme devreder); { r: 2, w: 1 } döner
export function gemsToBags(collected = {}) {
  const pool = {};
  for (const [t, n] of Object.entries(collected)) { const k = GEM_BAG[t]; if (k) pool[k] = (pool[k] || 0) + (n || 0); }
  const got = {};
  for (const [k, n] of Object.entries(pool)) {
    const tot = (R()[k] || 0) + n, q = Math.floor(tot / PER_BAG);
    R()[k] = tot % PER_BAG;
    const add = Math.min(q, BAG_MAX - bags(k)); if (add > 0) { B()[k] = bags(k) + add; got[k] = add; }
  }
  persist(); return got;
}
// bu tarlaya uyan gübre (önce renkli, yoksa su); yoksa null
export const fits = (k, id) => cropState(id) === 'growing' && (!GUBRE[k].seeds || GUBRE[k].seeds.includes(seedOf(id)));
export const bestBag = (id) => ['r', 'g', 'y', 'w'].find((k) => bags(k) > 0 && fits(k, id)) || null;
export const colorFor = (id) => ['r', 'g', 'y'].find((k) => GUBRE[k].seeds.includes(seedOf(id))) || 'w';
export function fertilize(id, k = bestBag(id), now = Date.now()) {
  if (!k || !bags(k) || !fits(k, id)) return false;
  const c = save.farm.crops[id]; c.readyAt = Math.max(now, c.readyAt - GUBRE[k].cut);
  B()[k] = bags(k) - 1; persist(); return k;
}
export const bagsLine = (got) => Object.entries(got).map(([k, n]) => `+${n}${GUBRE[k].emoji}`).join(' ');
