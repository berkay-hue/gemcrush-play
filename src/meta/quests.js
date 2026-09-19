// Faz 3: sequential quest chain + one-time dialogues shown when farm items open.
import { save, persist, addCoins } from './save.js';
import { owns } from './farm.js';

const won = (n) => () => save.level > n;
export const QUESTS = [
  { id: 'q_kumes', check: () => owns('kumes'), reward: 30, text: { tr: 'Kümes kur', en: 'Build the coop' } },
  { id: 'q_win3', check: won(3), reward: 40, text: { tr: '3 bölüm kazan', en: 'Win 3 levels' } },
  { id: 'q_tavuk', check: () => owns('tavuk'), reward: 40, text: { tr: 'Tavuk al', en: 'Get a hen' } },
  { id: 'q_horoz', check: () => owns('horoz'), reward: 60, text: { tr: 'Horozu al', en: 'Get the rooster' } },
  { id: 'q_tarla2', check: () => owns('tarla2'), reward: 50, text: { tr: '2 tarla sür', en: 'Plow 2 fields' } },
  { id: 'q_win8', check: won(8), reward: 80, text: { tr: '8 bölüm kazan', en: 'Win 8 levels' } },
  { id: 'q_ahir', check: () => owns('ahir'), reward: 80, text: { tr: 'Ahır kur', en: 'Build the barn' } },
  { id: 'q_inek', check: () => owns('inek'), reward: 100, text: { tr: 'İnek al', en: 'Get a cow' } },
  { id: 'q_at', check: () => owns('at'), reward: 150, text: { tr: 'At al', en: 'Get a horse' } },
  { id: 'q_ambar', check: () => owns('ambar'), reward: 200, text: { tr: 'Ambarı kur', en: 'Build the granary' } },
];

const qs = () => save.farm.quests || (save.farm.quests = { idx: 0, seen: [] });
export function currentQuest() { return QUESTS[qs().idx] || null; }
export function questDone() { const q = currentQuest(); return !!(q && q.check()); }
export function claimQuest() {
  const q = currentQuest(); if (!q || !q.check()) return 0;
  qs().idx++; addCoins(q.reward); persist(); return q.reward;
}

// farmer 👩‍🌾 and the item speak in turns
export const DIALOG = {
  kumes: [['👩‍🌾', { tr: 'Kümes hazır! Şimdi bir tavuk lazım.', en: 'The coop is ready! Now we need a hen.' }]],
  tavuk: [['🐔', { tr: 'Gıt gıdak! Yuvam çok güzel.', en: 'Cluck! Lovely nest.' }], ['👩‍🌾', { tr: 'Yakında yumurta da gelir.', en: 'Eggs will come soon.' }]],
  horoz: [['🐓', { tr: 'Üü-ürüü! Her sabah seni ben uyandırırım.', en: 'Cock-a-doodle! I will wake you each morning.' }], ['👩‍🌾', { tr: 'Erken kalkana +2 hamle!', en: 'Early risers get +2 moves!' }]],
  ahir: [['👩‍🌾', { tr: 'Ahır kocaman oldu. Büyük hayvanlara yer var.', en: 'Big barn! Room for big animals.' }]],
  koyun: [['🐑', { tr: 'Mee! Kaybedince seni teselli ederim.', en: 'Baa! I will cheer you up when you lose.' }]],
  inek: [['🐄', { tr: 'Möö! Sütüm bombalar kadar güçlü.', en: 'Moo! My milk is as strong as bombs.' }]],
  at: [['🐴', { tr: 'Hiii! Tahtayı ben karıştırırım.', en: 'Neigh! I will shuffle the board for you.' }], ['👩‍🌾', { tr: 'Çiftlik büyüyor!', en: 'The farm is growing!' }]],
  ambar: [['👩‍🌾', { tr: 'Ambar tamam. Hasat zamanı yaklaşıyor!', en: 'Granary done. Harvest time is near!' }]],
  tarla1: [['👩‍🌾', { tr: 'İlk tarlamız! Buğday bitecek.', en: 'Our first field! Wheat will grow.' }]],
};
export function takeDialog(id) {
  const q = qs(); if (!DIALOG[id] || q.seen.includes(id)) return null;
  q.seen.push(id); persist(); return DIALOG[id];
}
