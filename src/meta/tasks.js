// F12: günlük/haftalık görevler + sandık, başarımlar, koleksiyon albümü.
// Sayaçlar analytics.track() olaylarından beslenir (bump). Görev ilerlemesi = sayaç − gün/hafta başı anlık görüntüsü.
import { save, persist } from './save.js';
import { THEMES } from './themes.js';

const DAY = 86400000;
export const dayIdx = (now = Date.now()) => Math.floor(now / DAY);
export const weekIdx = (now = Date.now()) => Math.floor((dayIdx(now) + 3) / 7); // Pazartesi başlar

// olay adı -> [sayaç, artış (sayı ya da props alanı)]
const MAP = {
  level_win: [['win', 1], ['stars', 'stars'], ['play', 1]],
  level_fail: [['play', 1]],
  crop_harvest: [['harvest', 1]],
  farm_collect: [['collect', 1]],
  order_deliver: [['order', 1]],
  gift_send: [['gift', 1]],
  friend_help: [['help', 1]],
  booster_use: [['booster', 1]],
  egg_hatch: [['hatch', 1]],
  market_sell: [['sell', 1]],
  crop_plant: [['plant', 1]],
};
const stats = () => (save.stats && typeof save.stats === 'object' ? save.stats : (save.stats = {}));
export const stat = (k) => (k === 'level' ? Math.max(0, (save.level || 1) - 1) : (stats()[k] || 0));

export function bump(name, props = {}) {
  const m = MAP[name]; if (!m) return false;
  const s = stats();
  for (const [k, inc] of m) { const n = typeof inc === 'number' ? inc : Number(props[inc]) || 0; if (n > 0) s[k] = (s[k] || 0) + n; }
  persist(); return true;
}

export const DAILY = [
  { id: 'win3', stat: 'win', n: 3, coins: 60 },
  { id: 'stars6', stat: 'stars', n: 6, coins: 60 },
  { id: 'play5', stat: 'play', n: 5, coins: 50 },
  { id: 'harvest5', stat: 'harvest', n: 5, coins: 50 },
  { id: 'plant4', stat: 'plant', n: 4, coins: 40 },
  { id: 'collect4', stat: 'collect', n: 4, coins: 50 },
  { id: 'order2', stat: 'order', n: 2, coins: 70 },
  { id: 'booster2', stat: 'booster', n: 2, coins: 40 },
  { id: 'sell3', stat: 'sell', n: 3, coins: 50 },
];
export const WEEKLY = [
  { id: 'wwin20', stat: 'win', n: 20, coins: 250 },
  { id: 'wstars45', stat: 'stars', n: 45, coins: 250 },
  { id: 'wharvest30', stat: 'harvest', n: 30, coins: 200 },
  { id: 'worder12', stat: 'order', n: 12, coins: 250 },
  { id: 'wcollect25', stat: 'collect', n: 25, coins: 200 },
  { id: 'wgift7', stat: 'gift', n: 7, coins: 200 },
];
export const CHEST = { d: { coins: 100, gems: 1, cards: 1 }, w: { coins: 300, gems: 5, cards: 3 } };

// deterministik seçim: aynı gün herkes aynı 3 görevi alır
function pick(pool, seed, k = 3) {
  const a = pool.slice(); let x = (seed * 2654435761) >>> 0;
  for (let i = a.length - 1; i > 0; i--) { x = (x * 1103515245 + 12345) >>> 0; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, k);
}
const snap = () => ({ ...stats() });
function T(now = Date.now()) {
  let t = save.tasks;
  if (!t || typeof t !== 'object') t = save.tasks = {};
  const d = dayIdx(now), w = weekIdx(now);
  if (t.d !== d) { t.d = d; t.dBase = snap(); t.dDone = []; t.dChest = false; }
  if (t.w !== w) { t.w = w; t.wBase = snap(); t.wDone = []; t.wChest = false; }
  if (!t.ach || typeof t.ach !== 'object') t.ach = {};
  if (!t.cards || typeof t.cards !== 'object') t.cards = {};
  if (!Array.isArray(t.sets)) t.sets = [];
  return t;
}
const rows = (kind, now) => {
  const t = T(now), base = kind === 'd' ? t.dBase : t.wBase, done = kind === 'd' ? t.dDone : t.wDone;
  const list = kind === 'd' ? pick(DAILY, t.d) : pick(WEEKLY, t.w + 7919);
  return list.map((q) => { const p = Math.max(0, Math.min(q.n, stat(q.stat) - (base[q.stat] || 0))); return { ...q, p, done: p >= q.n, claimed: done.includes(q.id) }; });
};
export const dailyTasks = (now) => rows('d', now);
export const weeklyTasks = (now) => rows('w', now);

export function claimTask(kind, id, now = Date.now()) {
  const q = rows(kind, now).find((r) => r.id === id);
  if (!q || !q.done || q.claimed) return 0;
  (kind === 'd' ? save.tasks.dDone : save.tasks.wDone).push(id);
  save.coins += q.coins; persist(); return q.coins;
}
export const chestReady = (kind, now) => { const t = T(now); return rows(kind, now).every((r) => r.claimed) && !(kind === 'd' ? t.dChest : t.wChest); };
export function openChest(kind, now = Date.now(), rnd = Math.random) {
  if (!chestReady(kind, now)) return null;
  const c = CHEST[kind], t = save.tasks;
  if (kind === 'd') t.dChest = true; else t.wChest = true;
  save.coins += c.coins; save.gems += c.gems;
  const cards = []; for (let i = 0; i < c.cards; i++) cards.push(dropCard(rnd));
  persist(); return { coins: c.coins, gems: c.gems, cards };
}

// ---- başarımlar ----
export const ACH = [
  { id: 'win', stat: 'win', icon: '🏅', tiers: [10, 50, 200], gems: [2, 5, 10] },
  { id: 'stars', stat: 'stars', icon: '⭐', tiers: [30, 150, 500], gems: [2, 5, 10] },
  { id: 'level', stat: 'level', icon: '🗺️', tiers: [25, 100, 200], gems: [3, 6, 12] },
  { id: 'harvest', stat: 'harvest', icon: '🌾', tiers: [20, 100, 500], gems: [2, 5, 10] },
  { id: 'order', stat: 'order', icon: '📋', tiers: [10, 50, 200], gems: [2, 5, 10] },
  { id: 'help', stat: 'help', icon: '💧', tiers: [5, 25, 100], gems: [2, 5, 10] },
  { id: 'gift', stat: 'gift', icon: '❤️', tiers: [10, 50, 200], gems: [2, 5, 10] },
];
export function achList(now) {
  const t = T(now);
  return ACH.map((a) => { const tier = Math.min(a.tiers.length, t.ach[a.id] || 0), max = tier >= a.tiers.length; const goal = a.tiers[Math.min(tier, a.tiers.length - 1)];
    const v = stat(a.stat); return { ...a, tier, max, goal, v: Math.min(v, goal), ready: !max && v >= goal, gem: a.gems[Math.min(tier, a.gems.length - 1)] }; });
}
export function claimAch(id, now) {
  const a = achList(now).find((x) => x.id === id); if (!a || !a.ready) return 0;
  save.tasks.ach[id] = a.tier + 1; save.gems += a.gem; persist(); return a.gem;
}

// ---- albüm ----
export const SETS = [
  { id: 'animals', icon: '🐾', gems: 10, cards: [['tavuk', '🐔', 'Tavuk', 'Hen'], ['horoz', '🐓', 'Horoz', 'Rooster'], ['inek', '🐄', 'İnek', 'Cow'], ['koyun', '🐑', 'Koyun', 'Sheep'], ['at', '🐎', 'At', 'Horse'], ['domuz', '🐖', 'Domuz', 'Pig'], ['kopek', '🐕', 'Köpek', 'Dog']] },
  { id: 'crops', icon: '🧺', gems: 8, cards: [['wheat', '🌾', 'Buğday', 'Wheat'], ['corn', '🌽', 'Mısır', 'Corn'], ['carrot', '🥕', 'Havuç', 'Carrot'], ['tomato', '🍅', 'Domates', 'Tomato'], ['sunflower', '🌻', 'Ayçiçeği', 'Sunflower'], ['strawberry', '🍓', 'Çilek', 'Strawberry']] },
  { id: 'themes', icon: '🎨', gems: 12, cards: THEMES.map((th) => ['th_' + th.id, th.icon, th.tr, th.en]) },
];
export const CARDS = SETS.flatMap((s) => s.cards.map(([id, icon, tr, en]) => ({ id, icon, tr, en, set: s.id })));
export const DUP_COINS = 15;
export function dropCard(rnd = Math.random) {
  const t = T(), c = CARDS[Math.floor(rnd() * CARDS.length) % CARDS.length];
  const had = t.cards[c.id] || 0; t.cards[c.id] = had + 1;
  if (had) save.coins += DUP_COINS;
  persist(); return { ...c, dup: had > 0 };
}
export const hasCard = (id) => (T().cards[id] || 0) > 0;
export function setState(id) {
  const s = SETS.find((x) => x.id === id), t = T(); const got = s.cards.filter(([c]) => t.cards[c]).length;
  return { ...s, got, total: s.cards.length, complete: got === s.cards.length, claimed: t.sets.includes(id) };
}
export function claimSet(id) {
  const s = setState(id); if (!s.complete || s.claimed) return 0;
  save.tasks.sets.push(id); save.gems += s.gems; persist(); return s.gems;
}

// rozet: alınabilir ödül sayısı
export function tasksBadge(now) {
  const n = [...dailyTasks(now), ...weeklyTasks(now)].filter((r) => r.done && !r.claimed).length
    + (chestReady('d', now) ? 1 : 0) + (chestReady('w', now) ? 1 : 0)
    + achList(now).filter((a) => a.ready).length + SETS.filter((s) => { const x = setState(s.id); return x.complete && !x.claimed; }).length;
  return n;
}
