// F35: hava kartları — 3 saatte bir yeni hava: yağmur (ekin 20 dk erken), kuraklık (fıskiyesiz tarla 30 dk gecikir),
// dolu (seralı olmayan ekinin %30'u gider), rüzgâr, açık. Tahmin önceden görünür. Test: ?hava=yagmur|dolu|kurak|ruzgar|acik
import { save, persist } from './save.js';
import { hasLayer } from './layers.js';

export const SLOT = 3 * 3600e3, RAIN_CUT = 20 * 60e3, DRY_ADD = 30 * 60e3, HAIL_CUT = 0.7;
export const HAVA = {
  yagmur: { id: 'yagmur', emoji: '🌧️', tr: 'Yağmur', en: 'Rain', fx: { tr: 'Ekinler 20 dk erken olgunlaşır', en: 'Crops ripen 20 min sooner' } },
  dolu: { id: 'dolu', emoji: '🌨️', tr: 'Dolu', en: 'Hail', fx: { tr: 'Serasız ekinin %30\'u gider', en: 'Unshielded crops lose 30%' }, guard: 'sera' },
  kurak: { id: 'kurak', emoji: '🔥', tr: 'Kuraklık', en: 'Drought', fx: { tr: 'Fıskiyesiz ekin 30 dk gecikir', en: 'Crops without sprinkler +30 min' }, guard: 'fiskiye' },
  ruzgar: { id: 'ruzgar', emoji: '🌬️', tr: 'Rüzgâr', en: 'Wind', fx: { tr: 'Etkisi yok, yapraklar uçuşur', en: 'No effect, leaves fly' } },
  acik: { id: 'acik', emoji: '☀️', tr: 'Açık', en: 'Clear', fx: { tr: 'Güzel bir gün', en: 'A lovely day' } },
};
export const slotOf = (now) => Math.floor(now / SLOT);
function override() {
  try { const q = new URLSearchParams(location.search).get('hava'); return HAVA[q] ? q : null; } catch { return null; }
}
function pick(slot) {
  let h = Math.imul(slot ^ 0x5bd1e995, 2654435761); h ^= h >>> 13; h = Math.imul(h, 2246822507); h ^= h >>> 16;
  const r = (h >>> 0) % 100;
  return r < 18 ? 'yagmur' : r < 25 ? 'dolu' : r < 35 ? 'kurak' : r < 55 ? 'ruzgar' : 'acik';
}
export const havaSlot = (slot) => override() || pick(slot);
export const havaAt = (now = Date.now()) => havaSlot(slotOf(now));
export const hava = (now = Date.now()) => HAVA[havaAt(now)];
// şimdiki + sonraki n dilim: [{ id, at }]
export const forecast = (now = Date.now(), n = 4) => Array.from({ length: n + 1 }, (_, i) => { const s = slotOf(now) + i; return { id: havaSlot(s), at: s * SLOT }; });
export const msToNextSlot = (now = Date.now()) => (slotOf(now) + 1) * SLOT - now;

// geçen her yeni dilimin etkisini o dilimin başında büyüyen ekinlere uygular (ilk çalışmada geriye dönük değil)
export function havaTick(now = Date.now()) {
  const f = save.farm || (save.farm = {}), cur = slotOf(now);
  if (typeof f.havaSlot !== 'number' || f.havaSlot > cur) { f.havaSlot = cur; persist(); return []; }
  if (f.havaSlot === cur) return [];
  const hits = [], crops = f.crops || {};
  for (let s = Math.max(f.havaSlot + 1, cur - 15); s <= cur; s++) {
    const w = havaSlot(s), t0 = s * SLOT; if (!HAVA[w].guard && w !== 'yagmur') continue;
    for (const [id, c] of Object.entries(crops)) {
      if (!c || !c.ms || c.readyAt - c.ms >= t0 || c.readyAt <= t0) continue; // bu dilimin başında büyümüyordu
      if (w === 'yagmur') { const d = Math.min(RAIN_CUT, c.readyAt - t0); c.readyAt -= d; c.ms -= d; hits.push([id, w]); }
      else if (hasLayer(id, HAVA[w].guard)) hits.push([id, w + '-guard']);
      else if (w === 'kurak') { c.readyAt += DRY_ADD; c.ms += DRY_ADD; hits.push([id, w]); }
      else if (!c.dolu) { c.dolu = 1; hits.push([id, w]); }
    }
  }
  f.havaSlot = cur; persist(); return hits;
}
