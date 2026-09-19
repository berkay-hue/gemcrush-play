// F34: nadir tohum — hasatta küçük bir şansla ✨ nadir tohum düşer; 20 hasatta bir garanti.
// Nadir tohum yalnız envanterdeyken ekilir, harcanır; normal tohumdan çok daha değerlidir.
import { save, persist } from './save.js';

export const RARE = {
  goldwheat: { w: 0.7, gem: 0 },
  rainbow: { w: 0.3, gem: 1 },
};
export const RARE_CHANCE = 0.06, RARE_PITY = 20;
let rng = Math.random;
export const _setRng = (f) => { rng = f || Math.random; };

const inv = () => {
  const f = save.farm || (save.farm = {});
  if (!f.rare || typeof f.rare !== 'object' || Array.isArray(f.rare)) f.rare = {};
  return f.rare;
};
export const isRare = (k) => !!RARE[k];
export const rareCount = (k) => inv()[k] | 0;
export const rareTotal = () => Object.keys(RARE).reduce((s, k) => s + rareCount(k), 0);
export const rareOwned = () => Object.keys(RARE).filter((k) => rareCount(k) > 0);
export function addRare(k, n = 1) { if (!RARE[k]) return false; inv()[k] = rareCount(k) + n; persist(); return true; }
export function useRare(k) { if (rareCount(k) < 1) return false; inv()[k] = rareCount(k) - 1; if (!inv()[k]) delete inv()[k]; persist(); return true; }
// hasat sonrası zar: düşerse tohum anahtarı, düşmezse null. Nadir tohum hasadı zar atmaz.
export function rollRare(seed) {
  if (RARE[seed]) return null;
  const f = save.farm; f.rarePity = (f.rarePity | 0) + 1;
  if (f.rarePity < RARE_PITY && rng() >= RARE_CHANCE) { persist(); return null; }
  f.rarePity = 0;
  const k = rng() < RARE.goldwheat.w ? 'goldwheat' : 'rainbow';
  addRare(k); f.rareFound = (f.rareFound | 0) + 1; return k;
}
