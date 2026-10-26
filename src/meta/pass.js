// F14: ücretsiz 30 basamaklı sezon yolu (kayıt: save.pass {season, xp, claimed[]}).
import { save, persist, addCoins, addGems, addLife, GIFT_LIFE_CAP } from './save.js';
import { currentSeason, SEASONS } from './season.js';

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
// F340 (uygulamadaki F264): sezon sırası (yıl*4 + kış/bahar/yaz/güz); bozuk anahtar -1
const ord = (k) => { const m = /^(\d+)-(\w+)$/.exec(typeof k === 'string' ? k : ''); const s = m ? SEASONS.findIndex((x) => x.id === m[2]) : -1; return m && s >= 0 ? +m[1] * 4 + s : -1; };
// F340: kart yalnız ileri giden sezonda sıfırlanır; saat geri alınınca kayıtlı (ileri) sezon korunur
export function pass(d = new Date()) {
  const k = seasonKey(d);
  if (!save.pass || ord(k) > ord(save.pass.season)) { const old = save.pass; save.pass = { season: k, xp: 0, claimed: [] }; if (old && typeof old === 'object' && ord(old.season) >= 0) carry(old); }
  return save.pass;
}
// F351 (uygulamadaki F242): sezon değişince kazanılmış ama alınmamış basamaklar silinmez, otomatik verilir; çiftlikte bir kez gösterilir
function carry(old) {
  const n = Math.min(TIERS, Math.floor((+old.xp || 0) / XP_TIER)), got = Array.isArray(old.claimed) ? old.claimed : [], sum = {};
  for (let i = 1; i <= n; i++) {
    if (got.includes(i)) continue;
    const r = reward(i); grant(r);
    const k = r.booster ?? Object.keys(r)[0]; sum[k] = (sum[k] || 0) + (r.coins ?? r.gems ?? 1);
  }
  if (!Object.keys(sum).length) return;
  const pc = save.passCarry && typeof save.passCarry === 'object' ? save.passCarry : {};
  for (const k in sum) pc[k] = (pc[k] || 0) + sum[k];
  save.passCarry = pc; persist();
}
function grant(r) {
  if (r.coins) addCoins(r.coins);
  if (r.gems) addGems(r.gems);
  if (r.life) addLife(1, GIFT_LIFE_CAP); // F342: ödül canı dolu canda da eklenir
  if (r.booster) save.boosters[r.booster] = (save.boosters[r.booster] || 0) + 1;
}
const CARRY_ICON = { coins: '🪙', gems: '💎', life: '❤', hammer: '🔨', shuffle: '🔀', moves5: '+5 ×', prism: '🌈' };
export const carryLine = (m) => Object.entries(m).map(([k, v]) => `${CARRY_ICON[k] || k}${v}`).join(' ');
// F340: kayıtlı sezon saatten ileride kalınca XP ve ödül işlemez
export const passLive = (d = new Date()) => pass(d).season === seasonKey(d);
export const tierOf = (d) => Math.min(TIERS, Math.floor(pass(d).xp / XP_TIER));
export const claimable = (d) => { if (!passLive(d)) return 0; const p = pass(d), n = tierOf(d); let c = 0; for (let i = 1; i <= n; i++) if (!p.claimed.includes(i)) c++; return c; };
export const winXp = (stars, festival) => (10 + stars * 5) * (festival ? 2 : 1);
export function addXp(n, d = new Date()) { if (!passLive(d)) return 0; const p = pass(d), before = tierOf(d); p.xp = Math.min(TIERS * XP_TIER, p.xp + n); persist(); return tierOf(d) - before; }
export function claim(i, d = new Date()) {
  const p = pass(d);
  if (!passLive(d) || i < 1 || i > tierOf(d) || p.claimed.includes(i)) return null;
  const r = reward(i); p.claimed.push(i); grant(r);
  persist(); return r;
}
