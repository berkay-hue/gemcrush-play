// F27: Kuzucuk'un gardırobu — şapka / tulum / aksesuar yuvaları; 🪙 ya da 💎 ile alınır, 3D kuzuda canlı giyilir.
import { save, persist, spendCoins, spendGems } from './save.js';

export const SLOTS = ['hat', 'suit', 'acc'];
// cost: { c: jeton } | { g: elmas } | null (bedava) ; lvl: açılma seviyesi
export const WARDROBE = [
  { id: 'hat_straw', slot: 'hat', emoji: '👒', cost: null, name: { tr: 'Hasır Şapka', en: 'Straw Hat' } },
  { id: 'hat_none', slot: 'hat', emoji: '🚫', cost: null, name: { tr: 'Şapkasız', en: 'No Hat' } },
  { id: 'hat_cap', slot: 'hat', emoji: '🧢', cost: { c: 150 }, name: { tr: 'Kasket', en: 'Cap' } },
  { id: 'hat_beanie', slot: 'hat', emoji: '🧶', cost: { c: 200 }, name: { tr: 'Örgü Bere', en: 'Beanie' } },
  { id: 'hat_flower', slot: 'hat', emoji: '🌼', cost: { c: 250 }, lvl: 5, name: { tr: 'Çiçek Taç', en: 'Flower Crown' } },
  { id: 'hat_cowboy', slot: 'hat', emoji: '🤠', cost: { c: 400 }, lvl: 8, name: { tr: 'Kovboy Şapkası', en: 'Cowboy Hat' } },
  { id: 'hat_party', slot: 'hat', emoji: '🥳', cost: { g: 3 }, name: { tr: 'Parti Külahı', en: 'Party Hat' } },
  { id: 'hat_crown', slot: 'hat', emoji: '👑', cost: { g: 10 }, lvl: 10, name: { tr: 'Altın Taç', en: 'Gold Crown' } },
  { id: 'suit_denim', slot: 'suit', color: 0x3f78c9, cost: null, name: { tr: 'Kot Tulum', en: 'Denim' } },
  { id: 'suit_red', slot: 'suit', color: 0xd64541, cost: { c: 120 }, name: { tr: 'Kırmızı Tulum', en: 'Red Overalls' } },
  { id: 'suit_green', slot: 'suit', color: 0x3a9a4f, cost: { c: 120 }, name: { tr: 'Yeşil Tulum', en: 'Green Overalls' } },
  { id: 'suit_pink', slot: 'suit', color: 0xf07fb0, cost: { c: 180 }, name: { tr: 'Pembe Tulum', en: 'Pink Overalls' } },
  { id: 'suit_purple', slot: 'suit', color: 0x7b4fc9, cost: { c: 250 }, lvl: 6, name: { tr: 'Mor Tulum', en: 'Purple Overalls' } },
  { id: 'suit_black', slot: 'suit', color: 0x2b2f33, cost: { c: 300 }, lvl: 8, name: { tr: 'Gece Tulumu', en: 'Midnight' } },
  { id: 'suit_gold', slot: 'suit', color: 0xe6b422, metal: 1, cost: { g: 8 }, name: { tr: 'Altın Tulum', en: 'Golden Suit' } },
  { id: 'acc_none', slot: 'acc', emoji: '🚫', cost: null, name: { tr: 'Yok', en: 'None' } },
  { id: 'acc_bandana', slot: 'acc', emoji: '🧣', cost: { c: 100 }, name: { tr: 'Bandana', en: 'Bandana' } },
  { id: 'acc_bow', slot: 'acc', emoji: '🎀', cost: { c: 140 }, name: { tr: 'Papyon', en: 'Bow Tie' } },
  { id: 'acc_bell', slot: 'acc', emoji: '🔔', cost: { c: 180 }, name: { tr: 'Çıngırak', en: 'Bell' } },
  { id: 'acc_glasses', slot: 'acc', emoji: '🕶️', cost: { c: 300 }, lvl: 7, name: { tr: 'Güneş Gözlüğü', en: 'Sunglasses' } },
  { id: 'acc_scarf', slot: 'acc', emoji: '🧤', cost: { c: 220 }, name: { tr: 'Kış Atkısı', en: 'Winter Scarf' } },
  { id: 'acc_medal', slot: 'acc', emoji: '🏅', cost: { g: 5 }, name: { tr: 'Şampiyon Madalyası', en: 'Champion Medal' } },
];
export const DEFAULT_LOOK = { hat: 'hat_straw', suit: 'suit_denim', acc: 'acc_none' };
const byId = Object.fromEntries(WARDROBE.map((w) => [w.id, w]));
export const wItem = (id) => byId[id];

function st() {
  const w = save.wardrobe && typeof save.wardrobe === 'object' ? save.wardrobe : (save.wardrobe = {});
  if (!Array.isArray(w.own)) w.own = [];
  for (const s of SLOTS) if (!byId[w[s]] || byId[w[s]].slot !== s) w[s] = DEFAULT_LOOK[s];
  return w;
}
export const look = () => { const w = st(); return { hat: w.hat, suit: w.suit, acc: w.acc }; };
export const owns = (id) => { const it = byId[id]; return !!it && (!it.cost || st().own.includes(id)); };
export const locked = (id) => { const it = byId[id]; return !!it && !!it.lvl && (save.level || 1) < it.lvl; };
export const worn = (id) => { const it = byId[id]; return !!it && st()[it.slot] === id; };

// 'ok' | 'owned' | 'locked' | 'coins' | 'gems'
export function buy(id) {
  const it = byId[id]; if (!it) return 'locked';
  if (owns(id)) return 'owned';
  if (locked(id)) return 'locked';
  if (it.cost.g ? !spendGems(it.cost.g) : !spendCoins(it.cost.c)) return it.cost.g ? 'gems' : 'coins';
  st().own.push(id); persist(); return 'ok';
}
export function wear(id) {
  const it = byId[id]; if (!it || !owns(id)) return false;
  st()[it.slot] = id; persist(); return true;
}
