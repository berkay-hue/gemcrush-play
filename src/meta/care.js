// F37: hayvan bakımı — her hayvanın mutluluk çubuğu 3 bakımdan gelir: besle, sev, temizle.
// Her bakım 1/3 doldurur ve 24 saatte erir. Mutluluk ≥ %90 iken yapılan bakım, günde en fazla bir kez,
// %25 şansla 🥚✨ altın yumurta düşürür (+💎3 +🪙150).
import { save, persist, addCoins, addGems, spendCoins } from './save.js';
import { LIVESTOCK, feed, isSick } from './animals.js';
import { spendEnergy } from './energy.js';

const H = 3600000;
export const CARE = {
  feed: { emoji: '🌾', cd: 4 * H, coins: 5 },
  pet: { emoji: '✋', cd: 1 * H },
  clean: { emoji: '🧽', cd: 6 * H, energy: 1 },
};
export const FADE = 24 * H, GOLD_AT = 90, GOLD_CHANCE = 0.25, GOLD = { gems: 3, coins: 150 };
const day = (now) => Math.floor(now / 86400000);
const C = (id) => { const f = save.farm; f.care = f.care || {}; return f.care[id] || (f.care[id] = {}); };
// besleme zamanı: ahır hayvanında açlık sistemininki, diğerlerinde kendi kaydı
const lastOf = (id, k) => (k === 'feed' && LIVESTOCK.includes(id) ? (save.farm.an && save.farm.an[id] && save.farm.an[id].fedAt) || 0 : C(id)[k] || 0);
const part = (id, k, now) => Math.max(0, 1 - (now - lastOf(id, k)) / FADE);
export function happiness(id, now = Date.now()) {
  if (LIVESTOCK.includes(id) && isSick(id, now)) return 0;
  return Math.round((100 / 3) * (part(id, 'feed', now) + part(id, 'pet', now) + part(id, 'clean', now)));
}
export const careLeft = (id, k, now = Date.now()) => Math.max(0, lastOf(id, k) + CARE[k].cd - now);
export const goldReady = (id, now = Date.now()) => C(id).gold !== day(now);
// { ok, err: 'cd'|'coins'|'energy'|'sick', gold }
export function doCare(id, k, now = Date.now(), rnd = Math.random) {
  if (!CARE[k]) return { ok: false, err: 'x' };
  if (k === 'feed' && LIVESTOCK.includes(id)) { const e = feed(id, now); if (e) return { ok: false, err: e }; }
  else {
    if (LIVESTOCK.includes(id) && isSick(id, now)) return { ok: false, err: 'sick' };
    if (careLeft(id, k, now) > 0) return { ok: false, err: 'cd' };
    const q = CARE[k];
    if (q.coins && (save.coins || 0) < q.coins) return { ok: false, err: 'coins' };
    if (q.energy && !spendEnergy(q.energy, now)) return { ok: false, err: 'energy' };
    if (q.coins) spendCoins(q.coins);
    C(id)[k] = now;
  }
  save.farm.cared = (save.farm.cared || 0) + 1;
  const gold = rollGold(id, now, rnd);
  persist(); return { ok: true, gold };
}
// kovayla besleme de altın yumurta şansı verir
export function rollGold(id, now = Date.now(), rnd = Math.random) {
  if (happiness(id, now) < GOLD_AT || !goldReady(id, now) || rnd() >= GOLD_CHANCE) return false;
  C(id).gold = day(now); save.farm.goldEggs = (save.farm.goldEggs || 0) + 1;
  addGems(GOLD.gems); addCoins(GOLD.coins); persist(); return true;
}
