// F14: ücretsiz 30 basamaklı sezon yolu (kayıt: save.pass {season, xp, claimed[]}).
import { save, persist, addCoins, addGems, addLife } from './save.js';
import { currentSeason } from './season.js';

export const TIERS = 30, XP_TIER = 25;
const BOOST = ['hammer', 'shuffle', 'moves5', 'prism'];
export function reward(i) {
  if (i % 10 === 0) return { gems: 10 };
  if (i % 5 === 0) return { gems: 3 };
  if (i % 4 === 0) return { life: 1 };
  if (i % 3 === 0) return { booster: BOOST[(i / 3 - 1) % 4] };
  return { coins: 40 + i * 5 };
}
export const rewardIcon = (r) => r.gems ? `💎${r.gems}` : r.life ? '❤' : r.booster ? { hammer: '🔨', shuffle: '🔀', moves5: '+5', prism: '🌈' }[r.booster] : `🪙${r.coins}`;
// sezon anahtarı: kış Aralık'ta başlar → Aralık bir sonraki yılın kışına sayılır
export function seasonKey(d = new Date()) {
  const s = currentSeason(d); return `${d.getFullYear() + (d.getMonth() === 11 ? 1 : 0)}-${s.id}`;
}
export function seasonMsLeft(d = new Date()) {
  const s = currentSeason(d); const last = s.months[s.months.length - 1];
  const y = d.getFullYear() + (d.getMonth() === 11 && last !== 11 ? 1 : 0);
  return new Date(y, last + 1, 1).getTime() - d.getTime();
}
export function pass(d = new Date()) {
  const k = seasonKey(d);
  if (!save.pass || save.pass.season !== k) save.pass = { season: k, xp: 0, claimed: [] };
  return save.pass;
}
export const tierOf = (d) => Math.min(TIERS, Math.floor(pass(d).xp / XP_TIER));
export const claimable = (d) => { const p = pass(d), n = tierOf(d); let c = 0; for (let i = 1; i <= n; i++) if (!p.claimed.includes(i)) c++; return c; };
export const winXp = (stars, festival) => (10 + stars * 5) * (festival ? 2 : 1);
export function addXp(n, d = new Date()) { const p = pass(d), before = tierOf(d); p.xp = Math.min(TIERS * XP_TIER, p.xp + n); persist(); return tierOf(d) - before; }
export function claim(i, d = new Date()) {
  const p = pass(d);
  if (i < 1 || i > tierOf(d) || p.claimed.includes(i)) return null;
  const r = reward(i); p.claimed.push(i);
  if (r.coins) addCoins(r.coins);
  if (r.gems) addGems(r.gems);
  if (r.life) addLife(1);
  if (r.booster) save.boosters[r.booster] = (save.boosters[r.booster] || 0) + 1;
  persist(); return r;
}
